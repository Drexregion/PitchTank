-- Add note column to trades table to store investor reasoning for buy/sell decisions
-- This migration adds support for trade notes feature

-- Add note column (nullable, text type)
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS note TEXT;

-- Create index for faster queries on trades with notes
CREATE INDEX IF NOT EXISTS idx_trades_note_not_null 
ON trades(founder_id, created_at) 
WHERE note IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN trades.note IS 'Optional note from investor explaining their reasoning for the trade';

