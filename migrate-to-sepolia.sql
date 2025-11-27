-- Migration: Clean up Avalanche data and prepare for Sepolia
-- This removes all old auction data from the Avalanche contract

BEGIN;

-- Backup old data (optional - comment out if you don't need it)
-- CREATE TABLE auctions_avalanche_backup AS SELECT * FROM auctions;

-- Delete all old auctions from Avalanche contract
DELETE FROM auctions WHERE contract_address = '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796';

-- Delete any orphaned meetings
DELETE FROM meetings WHERE auction_id NOT IN (SELECT id FROM auctions);

-- Optionally, reset the auction sequence if you want to start from ID 1
-- This is commented out by default - uncomment if you want to reset IDs
-- ALTER SEQUENCE auctions_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT
    COUNT(*) as remaining_auctions,
    COUNT(DISTINCT contract_address) as unique_contracts
FROM auctions;

COMMIT;

-- Success message
\echo 'Migration complete! Old Avalanche data removed. Database ready for Sepolia.'
