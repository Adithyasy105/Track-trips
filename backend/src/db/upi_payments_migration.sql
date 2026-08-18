-- TripSync UPI/manual-confirmation migration. Run once in Supabase SQL Editor.
-- This migration never deletes users, payments, trips, or expenses.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS settlement_key VARCHAR(180);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_id VARCHAR(80);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS initiated_at TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS claimed_paid_at TIMESTAMPTZ;

UPDATE public.payments SET amount_paise = ROUND(amount * 100)::BIGINT
WHERE amount_paise IS NULL AND amount IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_amount_paise_positive'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_amount_paise_positive
      CHECK (amount_paise IS NULL OR amount_paise > 0) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_paise_positive;

-- The current production constraint allows only pending/completed. Replace it
-- with the explicit four-state payment lifecycle without touching payment rows.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'payment_initiated', 'awaiting_receiver_confirmation', 'completed'));

CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_id_unique ON public.payments(reference_id)
  WHERE reference_id IS NOT NULL;

-- Enforce one active instruction/attempt per trip and payer/receiver pair, even when
-- a new expense changes the current settlement amount while an old hold is active.
DROP INDEX IF EXISTS payments_one_active_settlement;
CREATE UNIQUE INDEX payments_one_active_settlement ON public.payments(trip_id, from_username, to_username)
  WHERE status IN ('pending', 'payment_initiated', 'awaiting_receiver_confirmation');

-- Add the new states when status is a PostgreSQL enum. Existing rows are preserved.
DO $$
DECLARE
  status_type regtype;
BEGIN
  SELECT format('%I.%I', udt_schema, udt_name)::regtype INTO status_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status';
  IF status_type IS NOT NULL AND EXISTS (SELECT 1 FROM pg_type WHERE oid = status_type AND typtype = 'e') THEN
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS ''payment_initiated''', status_type);
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS ''awaiting_receiver_confirmation''', status_type);
  END IF;
END $$;

-- REQUIRED PRECHECK: Inspect production payments.status before running this migration:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.payments'::regclass;
-- If it is an ENUM, add payment_initiated and awaiting_receiver_confirmation safely.
-- If it is a CHECK, widen that particular constraint while preserving every existing legacy value.
-- This migration intentionally does not drop an unknown production constraint.
