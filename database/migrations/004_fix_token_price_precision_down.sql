-- Migration Rollback: Revert token price_change field precision changes
-- WARNING: This will fail if there are percentage values that exceed NUMERIC(10,4) range
-- Only use this rollback if you need to revert to the old schema

-- Revert price_change fields back to original precision
-- From NUMERIC(12,2) back to NUMERIC(10,4)
ALTER TABLE creator_tokens
  ALTER COLUMN price_change_24h TYPE NUMERIC(10, 4);

ALTER TABLE creator_tokens
  ALTER COLUMN price_change_7d TYPE NUMERIC(10, 4);
