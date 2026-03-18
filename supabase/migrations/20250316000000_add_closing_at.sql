-- Add closing_at to events for admin-controlled grace-period countdown
-- When set, the trading page shows a warning countdown to users.
-- closing_at does NOT gate trading — trades still go through while status = 'active'.
-- The admin panel drives the status = 'completed' update when the countdown expires.
ALTER TABLE events
ADD COLUMN IF NOT EXISTS closing_at TIMESTAMPTZ NULL;
