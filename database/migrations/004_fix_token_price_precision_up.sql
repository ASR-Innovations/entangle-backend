-- Migration: Fix token price_change field precision
-- This migration ensures price change fields can handle large percentage values
--
-- Root cause: The code was not parsing VARCHAR price values before doing math,
-- which could produce Infinity or NaN values that can't be stored in NUMERIC fields.
--
-- This migration increases precision as a safety measure, though the code fix
-- (parseFloat + capping) is the primary solution.

-- Increase precision for price_change fields to handle extreme percentage changes
-- From NUMERIC(10,4) to NUMERIC(12,2) - allows values up to ±9,999,999,999.99%
-- This provides headroom for edge cases while the code caps at ±999,999%
ALTER TABLE creator_tokens
  ALTER COLUMN price_change_24h TYPE NUMERIC(12, 2);

ALTER TABLE creator_tokens
  ALTER COLUMN price_change_7d TYPE NUMERIC(12, 2);

-- Note: Other price fields (current_price, volume_24h, market_cap, total_liquidity)
-- are correctly stored as VARCHAR(78) to handle Wei-denominated values as strings.
-- No changes needed for those fields.
