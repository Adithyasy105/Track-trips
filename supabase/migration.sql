-- Migration script: Old schema to New schema
-- This script migrates from the old expense_splits structure to the new trips-based structure

-- Drop existing triggers and functions first
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop old tables that won't be used in new schema
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;

-- Add password_hash column to users if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Update group_members table structure
-- Drop the old primary key constraint if it exists (id-based)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_members_pkey' 
    AND contype = 'p'
  ) THEN
    ALTER TABLE public.group_members DROP CONSTRAINT group_members_pkey;
  END IF;
END $$;

-- Drop id column if it exists
ALTER TABLE public.group_members DROP COLUMN IF EXISTS id;

-- Add composite primary key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_members_pkey'
  ) THEN
    ALTER TABLE public.group_members 
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, username);
  END IF;
END $$;

-- Create trips table
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

-- Create new expenses table (with trip_id instead of group_id)
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

-- Create places_visited table
CREATE TABLE IF NOT EXISTS places_visited (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  photo_url TEXT,
  location VARCHAR(255),
  visited_time TIMESTAMP DEFAULT NOW()
);

-- Drop old indexes
DROP INDEX IF EXISTS idx_group_members_group;
DROP INDEX IF EXISTS idx_group_members_user;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(username);
CREATE INDEX IF NOT EXISTS idx_trips_group ON trips(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_username);
CREATE INDEX IF NOT EXISTS idx_places_trip ON places_visited(trip_id);

-- Function to auto-update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trips table
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: Old expense data will be lost during migration
-- If you need to preserve data, you would need to:
-- 1. Create trips for each group
-- 2. Migrate expenses from old format to new format
-- 3. Convert expense_splits to participants array
