-- Add email and encrypted_password columns to dashboard_access_links
ALTER TABLE public.dashboard_access_links 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Make refresh_token and access_token nullable as they are not needed for permanent links
ALTER TABLE public.dashboard_access_links 
ALTER COLUMN refresh_token DROP NOT NULL;

-- Security: Ensure RLS allows the new columns to be read by public (needed for magic login)
-- The existing policy "Allow public select by ID" USING (true) covers this.
-- However, we must ensure that the `encryption_key` (which is NOT in the DB, but passed in URL) is the only way to decrypt.
-- Users can see the encrypted blobs, but without the key from the URL, they are useless.
