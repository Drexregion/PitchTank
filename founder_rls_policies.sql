-- Founder Authentication System - RLS Policies
-- Run this script in your Supabase SQL Editor to set up proper Row Level Security

-- ==============================================
-- FOUNDER_INVITATIONS TABLE POLICIES
-- ==============================================

-- Enable RLS on founder_invitations table
ALTER TABLE public.founder_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert founder invitations
CREATE POLICY "Allow authenticated users to insert founder invitations"
ON public.founder_invitations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to read founder invitations
CREATE POLICY "Allow authenticated users to read founder invitations"
ON public.founder_invitations
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to update founder invitations (for marking as used)
CREATE POLICY "Allow authenticated users to update founder invitations"
ON public.founder_invitations
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================
-- FOUNDER_USERS TABLE POLICIES
-- ==============================================

-- Enable RLS on founder_users table
ALTER TABLE public.founder_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert founder users
CREATE POLICY "Allow authenticated users to insert founder users"
ON public.founder_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow users to read their own founder user data
CREATE POLICY "Allow users to read their own founder user data"
ON public.founder_users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Policy: Allow users to update their own founder user data
CREATE POLICY "Allow users to update their own founder user data"
ON public.founder_users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Policy: Allow authenticated users to read all founder users (for admin purposes)
CREATE POLICY "Allow authenticated users to read all founder users"
ON public.founder_users
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- ==============================================
-- FOUNDERS TABLE POLICIES (Updated for founder_user_id)
-- ==============================================

-- Enable RLS on founders table
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert founders
CREATE POLICY "Allow authenticated users to insert founders"
ON public.founders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow users to read founders
CREATE POLICY "Allow authenticated users to read founders"
ON public.founders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Allow users to update their own founder projects
CREATE POLICY "Allow users to update their own founder projects"
ON public.founders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.founder_users 
    WHERE founder_users.id = founders.founder_user_id 
    AND founder_users.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.founder_users 
    WHERE founder_users.id = founders.founder_user_id 
    AND founder_users.auth_user_id = auth.uid()
  )
);

-- Policy: Allow users to delete their own founder projects
CREATE POLICY "Allow users to delete their own founder projects"
ON public.founders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.founder_users 
    WHERE founder_users.id = founders.founder_user_id 
    AND founder_users.auth_user_id = auth.uid()
  )
);

-- ==============================================
-- EVENTS TABLE POLICIES (if not already set)
-- ==============================================

-- Enable RLS on events table (if not already enabled)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read events
CREATE POLICY "Allow authenticated users to read events"
ON public.events
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to insert events (for admin)
CREATE POLICY "Allow authenticated users to insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to update events (for admin)
CREATE POLICY "Allow authenticated users to update events"
ON public.events
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Check if RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('founder_invitations', 'founder_users', 'founders', 'events')
ORDER BY tablename;

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('founder_invitations', 'founder_users', 'founders', 'events')
ORDER BY tablename, policyname;
