-- Create a separate table for storing encryption keys securely
-- This ensures that only Admins can retrieve the key to reconstruct the URL.
-- Regular users (anon) attempting to use the magic link cannot access this table.

CREATE TABLE IF NOT EXISTS public.dashboard_access_keys (
    link_id UUID PRIMARY KEY REFERENCES public.dashboard_access_links(id) ON DELETE CASCADE,
    encryption_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_access_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Only Admins can insert/select/update/delete
CREATE POLICY "Admins can manage access keys"
ON public.dashboard_access_keys
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Policy: Schools? No. Schools don't need to view their own key (they have the link).
-- Policy: Anon? No. NEVER allow anon to read this.
