-- FIX: Allow unauthenticated users to read founder invitations by token
-- Run this in Supabase SQL Editor to fix the invitation validation issue

-- First, check if RLS is enabled
SELECT tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'founder_invitations';

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Allow authenticated users to read founder invitations" ON public.founder_invitations;

-- Create a new policy that allows anyone to read invitations
-- This is needed for the signup process where users aren't authenticated yet
CREATE POLICY "Allow public read access to founder invitations"
ON public.founder_invitations
FOR SELECT
TO public
USING (true);

-- Verify the policy was created
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'founder_invitations';
