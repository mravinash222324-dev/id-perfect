-- 1. Add RLS policies for Admins on profiles
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 1.1 FIX SELECT POLICY (This is why you see "No Profile")
-- 1.1 FIX SELECT POLICY (Debugging: Allow ALL authenticated users)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. Refine dashboard_access_links policies
DROP POLICY IF EXISTS "Allow public select by ID" ON public.dashboard_access_links;
CREATE POLICY "Allow public select by ID"
ON public.dashboard_access_links FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public update by ID" ON public.dashboard_access_links;
CREATE POLICY "Allow public update by ID"
ON public.dashboard_access_links FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 3. Modify handle_new_user trigger to respect metadata role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  -- 1. Insert Profile
  INSERT INTO public.profiles (user_id, full_name, institution_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'institution_name'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    institution_name = EXCLUDED.institution_name;
  
  -- 2. Determine Role
  -- Use role from metadata if valid, otherwise default to 'teacher'
  BEGIN
    _role := (NEW.raw_user_meta_data ->> 'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'teacher'::public.app_role;
  END;

  IF _role IS NULL THEN
    _role := 'teacher'::public.app_role;
  END IF;

  -- 3. Insert Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 4. Update students RLS to include 'school' role
-- We need to drop and recreate or create new policies because modifying 'OR' conditions in existing policies is tricky via SQL without knowing exact names if auto-generated, 
-- but we named them clearly in previous migration.

DROP POLICY IF EXISTS "Admins and teachers can insert students" ON public.students;
DROP POLICY IF EXISTS "Admins, teachers, and schools can insert students" ON public.students;

CREATE POLICY "Admins, teachers, and schools can insert students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'teacher'::public.app_role) OR
  public.has_role(auth.uid(), 'school'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and teachers can update students" ON public.students;
DROP POLICY IF EXISTS "Admins, teachers, and schools can update students" ON public.students;

CREATE POLICY "Admins, teachers, and schools can update students"
ON public.students FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'teacher'::public.app_role) OR
  public.has_role(auth.uid(), 'school'::public.app_role)
);

-- Ensure schools can view their own students (if we want to restrict visibility later, we can, but for now 'Authenticated users can view students' is broad).
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
CREATE POLICY "Authenticated users can view students"
ON public.students FOR SELECT
TO authenticated
USING (true);

-- 5. Grant usage on storage for schools if not covered
-- Existing policies use bucket_id checks. 
-- "Authenticated users can upload student photos" -> WITH CHECK (bucket_id = 'student-photos').
-- This covers schools.

-- 6. Fix Missing Constraints (HOTFIX)
-- This is critical for the ON CONFLICT clauses in triggers to work.
DO $$ 
BEGIN
    -- 1. Deduplicate profiles (keep latest)
    WITH duplicates AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM public.profiles
    )
    DELETE FROM public.profiles
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

    -- 2. Add Constraint if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;
