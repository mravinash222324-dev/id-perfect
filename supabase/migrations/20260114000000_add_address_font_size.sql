-- Add address_font_size column to students table safely
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS address_font_size integer DEFAULT 100;

-- Comment on column
COMMENT ON COLUMN public.students.address_font_size IS 'Percentage scale factor for address font size (default 100)';
