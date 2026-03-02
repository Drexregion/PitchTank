-- Allow reading event_settings for all users (settings are public per event)
-- Run this in Supabase SQL Editor if event_settings returns empty due to RLS

-- First check if RLS is enabled (optional - for debugging)
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'event_settings';

-- Create policy to allow SELECT on event_settings
-- Adjust if you need stricter rules (e.g. only for active events)
CREATE POLICY "Allow public read of event_settings"
ON event_settings
FOR SELECT
USING (true);
