-- Lets users pick a colour for their profile cover banner / avatar accent.
-- Stores a palette key (e.g. 'cyan-violet'); null means use the deterministic
-- gradient derived from the user's id.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_color TEXT;
