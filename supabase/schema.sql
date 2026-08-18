-- Migration-aware schema: Works for both fresh installs and migrations from old schema

-- Drop existing triggers and functions first
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop old tables that are being replaced
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;

-- Users table (using username as primary key)
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  upi_id VARCHAR(255),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add password_hash column if it doesn't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.users ADD COLUMN password_hash VARCHAR(255);
  END IF;
END $$;

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  created_by VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add password_hash to groups if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'groups' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN password_hash VARCHAR(255);
  END IF;
END $$;

-- Group members table - migrate from old structure
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Migrate group_members structure if needed
DO $$
BEGIN
  -- Drop old id-based primary key if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_members_pkey' 
    AND contype = 'p'
    AND conrelid = 'public.group_members'::regclass
  ) THEN
    ALTER TABLE public.group_members DROP CONSTRAINT group_members_pkey;
  END IF;
  
  -- Drop id column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'group_members' 
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.group_members DROP COLUMN id;
  END IF;
  
  -- Add composite primary key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_members_pkey'
  ) THEN
    ALTER TABLE public.group_members 
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, username);
  END IF;
END $$;

-- Trips table (depends on groups)
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  start_date DATE,
  end_date DATE,
  description TEXT,
  created_by VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trip members table (optional members subset per trip)
CREATE TABLE IF NOT EXISTS trip_members (
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (trip_id, username)
);

-- Ensure trip_members exists if migrating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trip_members'
  ) THEN
    CREATE TABLE public.trip_members (
      trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
      username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
      added_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (trip_id, username)
    );
  END IF;
END $$;

-- Expenses table (depends on trips + users) - NEW structure
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  payer_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category VARCHAR(50),
  participants TEXT[] NOT NULL, -- Array of usernames
  split_type VARCHAR(20) NOT NULL DEFAULT 'EQUAL',
  split_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP DEFAULT NOW()
);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS split_type VARCHAR(20) NOT NULL DEFAULT 'EQUAL';

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS split_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Places visited table (depends on trips)
CREATE TABLE IF NOT EXISTS places_visited (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  created_by VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  photo_url TEXT,
  location VARCHAR(255),
  visited_time TIMESTAMP DEFAULT NOW()
);

-- Add created_by to places_visited if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'places_visited' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.places_visited ADD COLUMN created_by VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_group_members_group;
DROP INDEX IF EXISTS idx_group_members_user;
DROP INDEX IF EXISTS idx_trips_group;
DROP INDEX IF EXISTS idx_expenses_trip;
DROP INDEX IF EXISTS idx_expenses_payer;
DROP INDEX IF EXISTS idx_places_trip;

-- Create indexes for better query performance
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(username);
CREATE INDEX idx_trips_group ON trips(group_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members(username);
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_expenses_payer ON expenses(payer_username);
CREATE INDEX idx_places_trip ON places_visited(trip_id);

-- Function to auto-update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trips table (now that trips table definitely exists)
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
