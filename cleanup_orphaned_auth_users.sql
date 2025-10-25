-- CLEANUP: Handle inconsistent auth/founder user state
-- Run this in Supabase SQL Editor to clean up orphaned auth users

-- Find auth users that don't have corresponding founder_users records
-- This query will help identify orphaned auth users
SELECT 
  au.id as auth_user_id,
  au.email,
  au.created_at as auth_created_at,
  fu.id as founder_user_id
FROM auth.users au
LEFT JOIN public.founder_users fu ON au.id = fu.auth_user_id
WHERE fu.id IS NULL
ORDER BY au.created_at DESC;

-- Optional: Delete orphaned auth users (uncomment if needed)
-- WARNING: This will permanently delete auth users without founder records
-- DELETE FROM auth.users 
-- WHERE id IN (
--   SELECT au.id 
--   FROM auth.users au
--   LEFT JOIN public.founder_users fu ON au.id = fu.auth_user_id
--   WHERE fu.id IS NULL
-- );

-- Check current founder_users records
SELECT 
  id,
  auth_user_id,
  email,
  first_name,
  last_name,
  created_at
FROM public.founder_users
ORDER BY created_at DESC;
