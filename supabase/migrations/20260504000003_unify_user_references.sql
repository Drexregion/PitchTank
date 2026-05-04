-- ============================================================
-- Unify all user FK columns to use profile_user_id / users.id
-- ============================================================

-- ----------------------------------------------------------------
-- 1. pitches: rename user_id → profile_user_id, add FK constraint
--    (user_id already stored users.id, not auth UID)
-- ----------------------------------------------------------------
ALTER TABLE pitches RENAME COLUMN user_id TO profile_user_id;
ALTER TABLE pitches
  ADD CONSTRAINT pitches_profile_user_id_fkey
  FOREIGN KEY (profile_user_id) REFERENCES users(id);

-- ----------------------------------------------------------------
-- 2. investors: drop legacy user_id (raw auth UID, superseded by
--    profile_user_id which was backfilled in schema_cleanup)
-- ----------------------------------------------------------------
ALTER TABLE investors DROP COLUMN IF EXISTS user_id;

-- ----------------------------------------------------------------
-- 3. applications: drop claimed_by_auth_user_id (raw auth UID,
--    superseded by claimed_by_user_id → users.id)
--    Must drop dependent policies first.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS applications_read_by_token ON applications;
DROP POLICY IF EXISTS applications_claim ON applications;

-- Recreate applications_read_by_token using claimed_by_user_id
CREATE POLICY applications_read_by_token ON applications
  FOR SELECT USING (
    claim_token IS NOT NULL
    AND claimed_by_user_id IS NULL
  );

-- Recreate applications_claim using claimed_by_user_id (already exists
-- from schema_cleanup, but drop+recreate to be safe)
CREATE POLICY applications_claim ON applications FOR UPDATE
  USING (
    claimed_by_user_id IS NULL
    AND status = 'approved'
  )
  WITH CHECK (
    claimed_by_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    AND status = 'approved'
  );

ALTER TABLE applications DROP COLUMN IF EXISTS claimed_by_auth_user_id;
