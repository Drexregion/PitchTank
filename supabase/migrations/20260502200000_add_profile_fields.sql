-- Add social links and role fields to founder_users
ALTER TABLE founder_users
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url   TEXT,
  ADD COLUMN IF NOT EXISTS role          TEXT; -- 'pitcher' | 'sponsor' | 'judge' | null
