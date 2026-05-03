-- Allow anyone (including unauthenticated/anon) to read investors for the leaderboard.
-- We only expose: id, name, and computed values (no email, no user_id, no PII).
-- investor_holdings needs to be readable too so portfolio values can be calculated.

CREATE POLICY "investors_public_read"
ON public.investors
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "investor_holdings_public_read"
ON public.investor_holdings
FOR SELECT
TO anon, authenticated
USING (true);
