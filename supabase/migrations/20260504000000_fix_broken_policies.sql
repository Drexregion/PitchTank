-- ============================================================
-- Fix policies broken by schema_cleanup migration.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Restore public read on events (was dropped by schema_cleanup).
--    The homepage and event page need to load events for anonymous
--    and non-enrolled users.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT
  USING (true);

-- ----------------------------------------------------------------
-- 2. Fix investor_holdings_investor_write: was checking
--    investors.user_id = auth.uid() (old raw-uid column).
--    Now we go through the users table via profile_user_id.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS investor_holdings_investor_write ON investor_holdings;
CREATE POLICY investor_holdings_investor_write ON investor_holdings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM investors i
      JOIN users u ON u.id = i.profile_user_id
      WHERE i.id = investor_holdings.investor_id
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investors i
      JOIN users u ON u.id = i.profile_user_id
      WHERE i.id = investor_holdings.investor_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 3. Fix trades policies: same stale investors.user_id reference.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS trades_investor_select ON trades;
CREATE POLICY trades_investor_select ON trades
  FOR SELECT
  USING (
    investor_id IN (
      SELECT i.id FROM investors i
      JOIN users u ON u.id = i.profile_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS trades_investor_insert ON trades;
CREATE POLICY trades_investor_insert ON trades
  FOR INSERT
  WITH CHECK (
    investor_id IN (
      SELECT i.id FROM investors i
      JOIN users u ON u.id = i.profile_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );
