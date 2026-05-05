-- Sync investor names from linked user first_name + last_name
UPDATE investors
SET name = TRIM(
  COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')
)
FROM users u
WHERE investors.profile_user_id = u.id
  AND (u.first_name IS NOT NULL OR u.last_name IS NOT NULL);
