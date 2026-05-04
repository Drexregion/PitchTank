-- ============================================================
-- Continuation of schema cleanup: creates the is_enrolled_in_event
-- helper and all RLS policies that depend on it.
-- Run this after 20260503000000 which partially applied.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Helper function (avoids recursive RLS on investors table)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_enrolled_in_event(p_event_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.investors i
    JOIN public.users u ON u.id = i.profile_user_id
    WHERE i.event_id = p_event_id
      AND u.auth_user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 2. Recreate events/pitches participant policies using helper
--    (they may have been created with inline investor subquery — replace)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS events_view_participants ON events;
CREATE POLICY events_view_participants ON events FOR SELECT USING (
  is_enrolled_in_event(id)
);

DROP POLICY IF EXISTS pitches_view_participants ON pitches;
CREATE POLICY pitches_view_participants ON pitches FOR SELECT USING (
  is_enrolled_in_event(event_id)
);

-- ----------------------------------------------------------------
-- 3. investors: event view (was failing due to recursion)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS investors_view_event ON investors;
CREATE POLICY investors_view_event ON investors FOR SELECT USING (
  profile_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR is_enrolled_in_event(event_id)
);

-- ----------------------------------------------------------------
-- 4. price_history: event scope
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS price_history_read_event_scope ON price_history;
CREATE POLICY price_history_read_event_scope ON price_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = price_history.event_id
      AND e.status = 'active'
  )
  OR is_enrolled_in_event(event_id)
  OR is_platform_admin()
);

-- ----------------------------------------------------------------
-- 5. applications policies
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS applications_read_own_claimed ON applications;
CREATE POLICY applications_read_own_claimed ON applications FOR SELECT USING (
  claimed_by_user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS applications_claim ON applications;
CREATE POLICY applications_claim ON applications FOR UPDATE
  USING (
    claimed_by_user_id IS NULL
    AND status = 'approved'
  )
  WITH CHECK (
    claimed_by_user_id IN (
      SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
    AND status = 'approved'
  );

-- ----------------------------------------------------------------
-- 6. RLS on users table
-- ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_public_read  ON users;
DROP POLICY IF EXISTS users_owner_write  ON users;
DROP POLICY IF EXISTS users_admin_manage ON users;

CREATE POLICY users_public_read ON users FOR SELECT USING (true);

CREATE POLICY users_owner_write ON users FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY users_admin_manage ON users
  FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
