-- Transactional Outbox & Idempotency SQL Schema for Supabase PostgreSQL

-- 1. Table: outbox_events
-- Stores domain events atomically created during business transactions.
CREATE TABLE IF NOT EXISTS outbox_events (
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

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'pending';

-- 2. Table: processed_events
-- Idempotency tracking table for consumers (Kafka / Background Workers)
CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  consumer_group VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Stored Procedure: Atomic Expense + Outbox Insertion (Supabase RPC)
-- Ensures that inserting an expense and recording its outbox event happen in a SINGLE PostgreSQL transaction.
CREATE OR REPLACE FUNCTION insert_expense_with_outbox(
  p_trip_id UUID,
  p_payer_username VARCHAR,
  p_amount NUMERIC,
  p_description TEXT,
  p_category VARCHAR,
  p_participants TEXT[],
  p_split_type VARCHAR DEFAULT 'EQUAL',
  p_split_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense_id UUID;
  v_expense_record JSONB;
BEGIN
  INSERT INTO expenses (
    trip_id,
    payer_username,
    amount,
    description,
    category,
    participants,
    split_type,
    split_data
  )
  VALUES (
    p_trip_id,
    p_payer_username,
    p_amount,
    p_description,
    p_category,
    p_participants,
    COALESCE(p_split_type, 'EQUAL'),
    COALESCE(p_split_data, '{}'::jsonb)
  )
  RETURNING id, trip_id, payer_username, amount, description, category, participants, split_type, split_data, timestamp
  INTO v_expense_id;

  v_expense_record := jsonb_build_object(
    'id', v_expense_id,
    'trip_id', p_trip_id,
    'payer_username', p_payer_username,
    'amount', p_amount,
    'description', p_description,
    'category', p_category,
    'participants', p_participants,
    'split_type', COALESCE(p_split_type, 'EQUAL'),
    'split_data', COALESCE(p_split_data, '{}'::jsonb)
  );

  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
  VALUES ('EXPENSE', p_trip_id::text, 'EXPENSE_CREATED', v_expense_record, 'pending');

  RETURN v_expense_record;
END;
$$;
