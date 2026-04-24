-- Add claim token to applications so accepted founders can link their profile
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS claim_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS claimed_by_auth_user_id UUID REFERENCES auth.users(id);

-- Backfill existing rows that have no token
UPDATE applications SET claim_token = gen_random_uuid() WHERE claim_token IS NULL;
