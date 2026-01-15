-- Add design_overrides column to students table safely
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS design_overrides jsonb DEFAULT null;

-- Comment on column (idempotent-ish, overwrites is fine)
COMMENT ON COLUMN public.students.design_overrides IS 'Stores specific JSON design overrides (position, scale) for this student card';
