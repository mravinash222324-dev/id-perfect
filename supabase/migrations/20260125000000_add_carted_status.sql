-- Migration to add 'carted' status for Shopping Cart workflow

-- The error "22P02: invalid input value for enum batch_status" indicates 'batch_status' is an enum.
-- We need to add 'carted' to it.

ALTER TYPE public.batch_status ADD VALUE IF NOT EXISTS 'carted';

-- If there is also a check constraint on the table, we might need to update it too.
-- Uncomment the following if you still get a constraint violation error:
-- ALTER TABLE public.print_batches DROP CONSTRAINT IF EXISTS print_batches_status_check;
-- ALTER TABLE public.print_batches ADD CONSTRAINT print_batches_status_check CHECK (status IN ('draft', 'carted', 'submitted', 'processing', 'completed'));
