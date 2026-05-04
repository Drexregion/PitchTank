-- Allow authenticated users to register themselves as an investor in an event.
-- profile_user_id must match their own users.id row.
CREATE POLICY investors_self_register ON investors
  FOR INSERT
  WITH CHECK (
    profile_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );
