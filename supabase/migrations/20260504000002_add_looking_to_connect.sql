ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS looking_to_connect TEXT;
