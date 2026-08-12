-- ==============================================================================
-- TripSync V2 Complete Schema Migration & Performance Optimization Script
-- Execute this SQL in your Supabase SQL Editor (Database -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. TRANSACTIONAL OUTBOX TABLE
-- Stores outbox events atomically created during business transactions.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL, -- e.g., 'EXPENSE', 'SETTLEMENT', 'TRIP'
  aggregate_id VARCHAR(100) NOT NULL,   -- e.g., trip_id or expense_id
  event_type VARCHAR(100) NOT NULL,    -- e.g., 'EXPENSE_CREATED', 'EXPENSE_DELETED'
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'published', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Index for outbox worker polling performance
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events(status, created_at) WHERE status = 'pending';

-- 2. IDEMPOTENCY CONSUMER TRACKING TABLE
-- Prevents duplicate execution of Kafka consumer events across distributed workers.
CREATE TABLE IF NOT EXISTS public.processed_events (
  event_id UUID PRIMARY KEY,
  consumer_group VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUERY PERFORMANCE INDEXES
-- Optimizes query performance under high concurrency (k6 load testing)
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON public.expenses(payer_username);
CREATE INDEX IF NOT EXISTS idx_payments_trip_status ON public.payments(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_gid_user ON public.group_members(group_id, username);
CREATE INDEX IF NOT EXISTS idx_trip_members_tid_user ON public.trip_members(trip_id, username);
CREATE INDEX IF NOT EXISTS idx_places_trip_id ON public.places_visited(trip_id);

-- 4. ATOMIC SUPABASE RPC FUNCTION: insert_expense_with_outbox
-- Ensures inserting an expense and writing its outbox event happen inside a SINGLE atomic PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.insert_expense_with_outbox(
  p_trip_id UUID,
  p_payer_username VARCHAR,
  p_amount NUMERIC,
  p_description TEXT,
  p_category VARCHAR,
  p_participants TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense_id UUID;
  v_expense_record JSONB;
BEGIN
  -- 1. Insert Expense
  INSERT INTO public.expenses (trip_id, payer_username, amount, description, category, participants)
  VALUES (p_trip_id, p_payer_username, p_amount, p_description, p_category, p_participants)
  RETURNING id, trip_id, payer_username, amount, description, category, participants, timestamp
  INTO v_expense_id;

  v_expense_record := jsonb_build_object(
    'id', v_expense_id,
    'trip_id', p_trip_id,
    'payer_username', p_payer_username,
    'amount', p_amount,
    'description', p_description,
    'category', p_category,
    'participants', p_participants
  );

  -- 2. Insert into Outbox (atomic transaction with expense creation)
  INSERT INTO public.outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
  VALUES ('EXPENSE', p_trip_id::text, 'EXPENSE_CREATED', v_expense_record, 'pending');

  RETURN v_expense_record;
END;
$$;
