-- FIX: Allow founder user creation during signup
-- Run this in Supabase SQL Editor to fix the founder_users RLS issue

-- First, check if RLS is enabled on founder_users
SELECT tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'founder_users';

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to insert founder users" ON public.founder_users;
DROP POLICY IF EXISTS "Allow users to read their own founder user data" ON public.founder_users;
DROP POLICY IF EXISTS "Allow users to update their own founder user data" ON public.founder_users;
DROP POLICY IF EXISTS "Allow authenticated users to read all founder users" ON public.founder_users;

-- Create new policies that allow public access for signup
CREATE POLICY "Allow public insert access to founder users"
ON public.founder_users
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public read access to founder users"
ON public.founder_users
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public update access to founder users"
ON public.founder_users
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Verify the policies were created
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'founder_users';
