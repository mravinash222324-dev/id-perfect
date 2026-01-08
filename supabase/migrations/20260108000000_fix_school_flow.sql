-- 1. Add 'school' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school';

-- 1b. Re-create has_role and get_user_role to ensure they use the updated enum type
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 2. Add school_id to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES auth.users(id);

-- 3. Add assigned_schools to id_templates
ALTER TABLE public.id_templates ADD COLUMN IF NOT EXISTS assigned_schools UUID[] DEFAULT '{}';

-- 4. Create print_batches table
CREATE TABLE IF NOT EXISTS public.print_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT NOT NULL,
    school_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'completed')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(school_id, batch_name)
);

-- 5. Create dashboard_access_links table
CREATE TABLE IF NOT EXISTS public.dashboard_access_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Update students table for print_batch_id and photo_ref if missing
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS print_batch_id UUID REFERENCES public.print_batches(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_ref TEXT;

-- 7. Enable RLS
ALTER TABLE public.print_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_access_links ENABLE ROW LEVEL SECURITY;

-- 8. Policies for print_batches
CREATE POLICY "Schools can manage their own batches"
ON public.print_batches FOR ALL
USING (auth.uid() = school_id);

CREATE POLICY "Admins can view all batches"
ON public.print_batches FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 9. Policies for dashboard_access_links
-- Only service role or admins should ideally manage this via API, 
-- but for current app logic we need authenticated access for creation and public/anon for retrieval by ID.
-- Retrieval of details like tokens should be restricted.
ALTER TABLE public.dashboard_access_links FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select by ID"
ON public.dashboard_access_links FOR SELECT
USING (true); -- MagicLogin.tsx fetches by ID

CREATE POLICY "Allow authenticated insert"
ON public.dashboard_access_links FOR INSERT
TO authenticated
WITH CHECK (true); -- AdminSchools.tsx inserts

CREATE POLICY "Allow update by ID"
ON public.dashboard_access_links FOR UPDATE
USING (true); -- MagicLogin.tsx updates last_used_at

-- 10. Update id_templates RLS to filter by assigned_schools for non-admins
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.id_templates;
CREATE POLICY "Users can view assigned or public templates"
ON public.id_templates FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    assigned_schools = '{}' OR 
    auth.uid() = ANY(assigned_schools)
);
