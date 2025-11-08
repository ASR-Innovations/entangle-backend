-- Migration: Add auction display and tracking fields
-- Run this on your existing database to add new columns

-- Add creator display info
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(255);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add event details
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS event_date TIMESTAMP;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS event_start_time TIMESTAMP;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS event_end_time TIMESTAMP;

-- Add blockchain data cache
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_price VARCHAR(50);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS duration_blocks INTEGER;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS end_block INTEGER;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS highest_bid VARCHAR(50);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS highest_bidder VARCHAR(42);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS blocks_remaining INTEGER;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS time_remaining_seconds INTEGER;

-- Add status and timestamp
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS ended BOOLEAN DEFAULT FALSE;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auctions_twitter_id ON auctions(twitter_id);
CREATE INDEX IF NOT EXISTS idx_auctions_event_date ON auctions(event_date);
CREATE INDEX IF NOT EXISTS idx_auctions_ended ON auctions(ended);
CREATE INDEX IF NOT EXISTS idx_auctions_end_block ON auctions(end_block);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auctions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_auctions_updated_at ON auctions;
CREATE TRIGGER trigger_update_auctions_updated_at
    BEFORE UPDATE ON auctions
    FOR EACH ROW
    EXECUTE FUNCTION update_auctions_updated_at();

-- Verify migration
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'auctions'
ORDER BY ordinal_position;
