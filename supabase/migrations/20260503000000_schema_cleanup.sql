-- ============================================================
-- Schema cleanup: unify identity into `users`, rename tables,
-- merge auxiliary tables, drop dead tables.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Rename founder_users → users; add is_admin
-- ----------------------------------------------------------------
ALTER TABLE founder_users RENAME TO users;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Seed admins from user_roles
UPDATE users SET is_admin = true
WHERE auth_user_id IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);

-- ----------------------------------------------------------------
-- 2. Auto-create users row on auth signup
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ----------------------------------------------------------------
-- 3. Rename founders → pitches; founder_user_id → user_id
-- ----------------------------------------------------------------
ALTER TABLE founders RENAME TO pitches;
ALTER TABLE pitches RENAME COLUMN founder_user_id TO user_id;

-- ----------------------------------------------------------------
-- 4. investors.user_id: add proper FK column → users.id
--    (old user_id stores raw auth UID as text/uuid)
-- ----------------------------------------------------------------
ALTER TABLE investors ADD COLUMN IF NOT EXISTS profile_user_id UUID REFERENCES users(id);

UPDATE investors i
  SET profile_user_id = u.id
  FROM users u
  WHERE u.auth_user_id = i.user_id::uuid;

-- ----------------------------------------------------------------
-- 5. Rename founder_id → pitch_id everywhere
-- ----------------------------------------------------------------
ALTER TABLE investor_holdings RENAME COLUMN founder_id TO pitch_id;
ALTER TABLE trades             RENAME COLUMN founder_id TO pitch_id;
ALTER TABLE price_history      RENAME COLUMN founder_id TO pitch_id;

-- ----------------------------------------------------------------
-- 6. Merge event_settings into events
-- ----------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS snapshot_interval_seconds   INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_price_history_points    INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS hide_leaderboard_and_prices BOOLEAN NOT NULL DEFAULT false;

UPDATE events e
  SET snapshot_interval_seconds   = COALESCE(es.snapshot_interval_seconds, 60),
      max_price_history_points    = COALESCE(es.max_price_history_points, 1000),
      hide_leaderboard_and_prices = COALESCE(es.hide_leaderboard_and_prices, false)
  FROM event_settings es
  WHERE es.event_id = e.id;

-- ----------------------------------------------------------------
-- 7. Merge event_questions into events as JSONB
-- ----------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE events e
SET registration_questions = COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'id',            q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'required',      q.required,
        'sort_order',    q.sort_order,
        'description',   q.description
      ) ORDER BY q.sort_order
    )
    FROM event_questions q
    WHERE q.event_id = e.id
  ),
  '[]'::json
);

-- ----------------------------------------------------------------
-- 8. applications: add FK column → users.id
-- ----------------------------------------------------------------
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES users(id);

UPDATE applications a
  SET claimed_by_user_id = u.id
  FROM users u
  WHERE u.auth_user_id = a.claimed_by_auth_user_id;

-- ----------------------------------------------------------------
-- 9. Drop merged/dead tables
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS event_settings;
DROP TABLE IF EXISTS event_questions;
DROP TABLE IF EXISTS user_roles;

-- ----------------------------------------------------------------
-- 10. Update is_platform_admin() to use users.is_admin
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND is_admin = true
  );
$$;

-- ----------------------------------------------------------------
-- 11. Drop the admin-seeding trigger (user_roles is gone)
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS seed_admin_roles_on_event_create ON events;
DROP FUNCTION IF EXISTS _seed_admin_roles_for_event();

-- ----------------------------------------------------------------
-- 12. Update RLS policies that relied on user_roles
-- ----------------------------------------------------------------

-- events: participant view (was: user has a role in event)
DROP POLICY IF EXISTS events_view_participants ON events;
CREATE POLICY events_view_participants ON events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM investors
    WHERE event_id = events.id
      AND profile_user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
  )
);

-- pitches: admin manage (rename from founders_admin_manage)
DROP POLICY IF EXISTS founders_admin_manage ON pitches;
CREATE POLICY pitches_admin_manage ON pitches
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- pitches: public read for active events
DROP POLICY IF EXISTS founders_public_read ON pitches;
CREATE POLICY pitches_public_read ON pitches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = pitches.event_id
      AND e.status = 'active'
  )
);

-- pitches: participant view
DROP POLICY IF EXISTS founders_view_participants ON pitches;
CREATE POLICY pitches_view_participants ON pitches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM investors
    WHERE event_id = pitches.event_id
      AND profile_user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
  )
);

-- investors: event view (was: user has role in same event)
DROP POLICY IF EXISTS investors_view_event ON investors;
CREATE POLICY investors_view_event ON investors FOR SELECT USING (
  -- own row
  profile_user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  OR
  -- any other investor in the same event (leaderboard)
  EXISTS (
    SELECT 1 FROM investors i2
    WHERE i2.event_id = investors.event_id
      AND i2.profile_user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
  )
);

-- investor_holdings: update investor_write policy (investor_id unchanged)
-- policy already correct — no user_roles dependency

-- trades: policies already use investors table — no change needed

-- price_history: event scope (was: user_roles enrollment check)
DROP POLICY IF EXISTS price_history_read_event_scope ON price_history;
CREATE POLICY price_history_read_event_scope ON price_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = price_history.event_id
      AND e.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM investors i
    WHERE i.event_id = price_history.event_id
      AND i.profile_user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
  )
  OR is_platform_admin()
);

-- applications: read own claimed (was: claimed_by_auth_user_id = auth.uid())
DROP POLICY IF EXISTS applications_read_own_claimed ON applications;
CREATE POLICY applications_read_own_claimed ON applications FOR SELECT USING (
  claimed_by_user_id IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- applications: claim update (update claimed_by_user_id instead of auth col)
DROP POLICY IF EXISTS applications_claim ON applications;
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

-- ----------------------------------------------------------------
-- 13. RLS on users table (replaces founder_users policies)
-- ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_public_read   ON users;
DROP POLICY IF EXISTS users_owner_write   ON users;
DROP POLICY IF EXISTS users_admin_manage  ON users;

-- Anyone can read profiles (public directory)
CREATE POLICY users_public_read ON users FOR SELECT USING (true);

-- Users can update their own row
CREATE POLICY users_owner_write ON users FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Admins can manage all
CREATE POLICY users_admin_manage ON users
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
