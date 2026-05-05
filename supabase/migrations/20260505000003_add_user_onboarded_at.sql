-- Tracks whether a user has completed the in-app onboarding flow.
-- NULL = needs onboarding; a timestamp = completed at that time.
-- Existing users implicitly start as NULL so they all see the new
-- onboarding once on their next sign-in (the product changed enough
-- to warrant showing it to returning users too).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.onboarded_at IS
  'Timestamp when the user finished the onboarding flow. NULL means they still need to see it.';
