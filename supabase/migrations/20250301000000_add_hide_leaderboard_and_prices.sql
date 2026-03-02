-- Add hide_leaderboard_and_prices column to event_settings
-- When true: hides leaderboard tab, uses commitment-based buying, hides price/market cap from participants
ALTER TABLE event_settings
ADD COLUMN IF NOT EXISTS hide_leaderboard_and_prices BOOLEAN DEFAULT FALSE;
