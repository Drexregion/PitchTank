-- ============================================================
-- Security fix: enable RLS on all tables, fix buggy policies,
-- tighten applications access, and protect trading data.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Platform-admin helper (SECURITY DEFINER bypasses RLS so it
--    can always read user_roles without circular dependency)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ----------------------------------------------------------------
-- 2. Seed admin rows in user_roles for every existing event
--    (rahel.gunaratne1@gmail.com and admin@pitchtank.ca)
-- ----------------------------------------------------------------
INSERT INTO user_roles (user_id, role, event_id)
SELECT 'a072d868-f683-48db-a1be-9afb7093a994', 'admin', id FROM events
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = 'a072d868-f683-48db-a1be-9afb7093a994'
    AND event_id = events.id
);

INSERT INTO user_roles (user_id, role, event_id)
SELECT 'c251f6d6-b6c1-4559-be9e-d66ffcc7c855', 'admin', id FROM events
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = 'c251f6d6-b6c1-4559-be9e-d66ffcc7c855'
    AND event_id = events.id
);

-- ----------------------------------------------------------------
-- 3. Trigger: auto-add admin rows whenever a new event is created
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION _seed_admin_roles_for_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_roles (user_id, role, event_id)
  VALUES
    ('a072d868-f683-48db-a1be-9afb7093a994', 'admin', NEW.id),
    ('c251f6d6-b6c1-4559-be9e-d66ffcc7c855', 'admin', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_admin_roles_on_event_create ON events;
CREATE TRIGGER seed_admin_roles_on_event_create
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION _seed_admin_roles_for_event();

-- ----------------------------------------------------------------
-- 4. Enable RLS on all tables that currently have it disabled
-- ----------------------------------------------------------------
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_holdings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 5. events
--    Bug: events_admin_manage and events_view_participants used
--         ur.event_id = ur.id (wrong column — always false or
--         mismatched). Replace both.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS events_admin_manage       ON events;
DROP POLICY IF EXISTS events_view_participants  ON events;

-- Admins can do everything
CREATE POLICY events_admin_manage ON events
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Anyone (including anonymous) can read events — they are public by design
-- (shared via QR code / URL; nothing sensitive in the events row itself)
DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT
  USING (true);

-- Any user who has a role in an event can see it (in addition to the
-- public read policy above)
CREATE POLICY events_view_participants ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.event_id = events.id
        AND ur.user_id  = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 6. founders
--    Bug: founders_admin_manage used ur.event_id = ur.event_id
--         (always true — any investor could mutate founders).
--         founders_view_participants had the same bug.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS founders_admin_manage      ON founders;
DROP POLICY IF EXISTS founders_view_participants ON founders;

CREATE POLICY founders_admin_manage ON founders
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Anyone can read founders for active events (needed for anonymous event viewers)
DROP POLICY IF EXISTS founders_public_read ON founders;
CREATE POLICY founders_public_read ON founders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = founders.event_id
        AND e.status = 'active'
    )
  );

-- founders_view_active already joins events correctly — keep it.
-- Add explicit participant view (users enrolled in the event can see founders).
CREATE POLICY founders_view_participants ON founders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.event_id = founders.event_id
        AND ur.user_id  = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 7. investors
--    Bug: all three policies used ur.event_id = ur.event_id
--         (always true for any row in user_roles).
--    investors_admin_view is redundant with admin_manage — drop it.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS investors_admin_manage ON investors;
DROP POLICY IF EXISTS investors_admin_view   ON investors;
DROP POLICY IF EXISTS investors_view_own     ON investors;

DROP POLICY IF EXISTS investors_admin_manage ON investors;
CREATE POLICY investors_admin_manage ON investors
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Any participant in the same event can see all investors in that event
-- (needed for the leaderboard)
DROP POLICY IF EXISTS investors_view_event ON investors;
CREATE POLICY investors_view_event ON investors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.event_id = investors.event_id
        AND ur.user_id  = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 8. investor_holdings
--    Existing SELECT policies are correct. Add missing admin ALL
--    and investor-level write access (needed for trading and reset).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS investor_holdings_admin_manage ON investor_holdings;
CREATE POLICY investor_holdings_admin_manage ON investor_holdings
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Investors can manage their own holdings (trading updates these rows)
DROP POLICY IF EXISTS investor_holdings_investor_write ON investor_holdings;
CREATE POLICY investor_holdings_investor_write ON investor_holdings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM investors i
      WHERE i.id       = investor_holdings.investor_id
        AND i.user_id  = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investors i
      WHERE i.id       = investor_holdings.investor_id
        AND i.user_id  = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 9. trades
--    No policies existed at all — add admin ALL + investor read/insert.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS trades_admin_manage ON trades;
CREATE POLICY trades_admin_manage ON trades
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS trades_investor_select ON trades;
CREATE POLICY trades_investor_select ON trades
  FOR SELECT
  USING (
    investor_id IN (
      SELECT id FROM investors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS trades_investor_insert ON trades;
CREATE POLICY trades_investor_insert ON trades
  FOR INSERT
  WITH CHECK (
    investor_id IN (
      SELECT id FROM investors WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 10. price_history
--     Bug: the OR branch used ur.event_id = ur.event_id (always true).
--     Recreate with the correct event scope.
--     Add admin DELETE (needed for the "Reset Trading Data" button).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS price_history_read_event_scope ON price_history;

CREATE POLICY price_history_read_event_scope ON price_history
  FOR SELECT
  USING (
    -- Anyone can read price history for active events
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = price_history.event_id
        AND e.status = 'active'
    )
    OR
    -- Enrolled users can read price history for their own event
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.event_id = price_history.event_id
        AND ur.user_id  = auth.uid()
    )
    OR
    is_platform_admin()
  );

DROP POLICY IF EXISTS price_history_admin_delete ON price_history;
CREATE POLICY price_history_admin_delete ON price_history
  FOR DELETE
  USING (is_platform_admin());

-- ----------------------------------------------------------------
-- 11. user_roles
--     Existing policy only allows users to read their own rows.
--     Add admin manage policy (needed to add investors to events, etc.).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS user_roles_admin_manage ON user_roles;
CREATE POLICY user_roles_admin_manage ON user_roles
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----------------------------------------------------------------
-- 12. applications — two fixes:
--
--  a) SELECT was open to all authenticated users (exposed applicant
--     emails and answers to every logged-in user).
--     Restrict to admins only — applicants don't need to query their
--     own submission back; the claim flow uses the token from email.
--
--  b) UPDATE was open to all authenticated users, allowing:
--     - hijacking another user's claim token
--     - self-approving a rejected application
--
--     Fix: admins can update anything; non-admins may ONLY claim an
--     application that is (a) already approved by an admin and
--     (b) not yet claimed, and may ONLY set claimed_by_auth_user_id
--     to their own uid (enforced by WITH CHECK + status guard).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Auth read applications"   ON applications;
DROP POLICY IF EXISTS "Auth update applications" ON applications;

DROP POLICY IF EXISTS applications_admin_read ON applications;
CREATE POLICY applications_admin_read ON applications
  FOR SELECT
  USING (is_platform_admin());

-- Founders can read their own claimed application (shown on /profile)
DROP POLICY IF EXISTS applications_read_own_claimed ON applications;
CREATE POLICY applications_read_own_claimed ON applications
  FOR SELECT
  USING (claimed_by_auth_user_id = auth.uid());

-- Anyone can look up an approved, unclaimed application by its claim token
-- (needed for the /profile?id=<token> flow before claiming)
DROP POLICY IF EXISTS applications_read_by_token ON applications;
CREATE POLICY applications_read_by_token ON applications
  FOR SELECT
  USING (
    claim_token IS NOT NULL
    AND claimed_by_auth_user_id IS NULL
    AND status = 'approved'
  );

DROP POLICY IF EXISTS applications_admin_update ON applications;
CREATE POLICY applications_admin_update ON applications
  FOR UPDATE
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Non-admin claim: can only claim rows that are approved AND unclaimed;
-- after the update, claimed_by_auth_user_id must be the caller's uid
-- and status must remain 'approved' (prevents self-approval of pending/
-- rejected applications).
DROP POLICY IF EXISTS applications_claim ON applications;
CREATE POLICY applications_claim ON applications
  FOR UPDATE
  USING (
    claimed_by_auth_user_id IS NULL
    AND status = 'approved'
  )
  WITH CHECK (
    claimed_by_auth_user_id = auth.uid()
    AND status = 'approved'
  );

-- ----------------------------------------------------------------
-- 13. event_questions
--     The existing "Auth write event_questions" ALL policy allowed
--     any authenticated user to create/edit/delete questions.
--     Restrict writes to admins.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Auth write event_questions" ON event_questions;

DROP POLICY IF EXISTS event_questions_admin_write ON event_questions;
CREATE POLICY event_questions_admin_write ON event_questions
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ----------------------------------------------------------------
-- 14. event_settings
--     Bug: event_settings_admin_manage used ur.event_id = ur.event_id
--     (always true — any authenticated user with any role could manage
--     event settings). Replace with is_platform_admin().
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS event_settings_admin_manage ON event_settings;
DROP POLICY IF EXISTS event_settings_public_read ON event_settings;

CREATE POLICY event_settings_admin_manage ON event_settings
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Anyone can read event_settings (needed to determine simpleMode for anonymous viewers)
CREATE POLICY event_settings_public_read ON event_settings
  FOR SELECT
  USING (true);
