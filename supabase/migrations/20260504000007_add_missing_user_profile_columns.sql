-- linkedin_url, twitter_url, and role were originally added to founder_users
-- but were lost when that table was renamed to users in the schema cleanup.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url   TEXT,
  ADD COLUMN IF NOT EXISTS role          TEXT; -- 'pitcher' | 'sponsor' | 'judge' | 'member'
