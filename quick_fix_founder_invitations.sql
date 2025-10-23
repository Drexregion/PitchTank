-- QUICK FIX: Enable founder invitation creation
-- Run this in Supabase SQL Editor to immediately fix the RLS issue

-- Enable RLS on founder_invitations table
ALTER TABLE public.founder_invitations ENABLE ROW LEVEL SECURITY;

-- Create a simple policy to allow authenticated users to insert founder invitations
CREATE POLICY "Allow authenticated users to insert founder invitations"
ON public.founder_invitations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow reading founder invitations
CREATE POLICY "Allow authenticated users to read founder invitations"
ON public.founder_invitations
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Allow updating founder invitations (for marking as used)
CREATE POLICY "Allow authenticated users to update founder invitations"
ON public.founder_invitations
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
