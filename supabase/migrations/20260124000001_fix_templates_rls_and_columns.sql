-- Add missing columns to id_templates
ALTER TABLE public.id_templates ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'horizontal';
ALTER TABLE public.id_templates ADD COLUMN IF NOT EXISTS csv_headers TEXT[] DEFAULT '{}';

-- Fix RLS Policies for id_templates to allow schools/teachers to create/manage templates

-- First, drop the old restrictive policy (if it exists)
DROP POLICY IF EXISTS "Admins can manage templates" ON public.id_templates;

-- 1. Admins have full access
CREATE POLICY "Admins can manage all templates"
ON public.id_templates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Schools and Teachers can INSERT templates
CREATE POLICY "Schools and Teachers can create templates"
ON public.id_templates FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'school'::public.app_role) OR 
  public.has_role(auth.uid(), 'teacher'::public.app_role) OR
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Users can UPDATE their own templates (based on created_by)
CREATE POLICY "Users can update their own templates"
ON public.id_templates FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- 4. Users can DELETE their own templates
CREATE POLICY "Users can delete their own templates"
ON public.id_templates FOR DELETE
TO authenticated
USING (created_by = auth.uid());
