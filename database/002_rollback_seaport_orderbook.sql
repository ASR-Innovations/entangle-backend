-- Rollback Migration: Remove Seaport Orderbook Tables
-- This script safely removes all Seaport orderbook tables and related objects

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_seaport_orders_updated_at ON seaport_orders;

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS update_seaport_orders_updated_at();

-- ============================================================================
-- DROP TABLES (in reverse order of dependencies)
-- ============================================================================

-- Drop dependent tables first
DROP TABLE IF EXISTS order_events CASCADE;
DROP TABLE IF EXISTS order_cancellations CASCADE;
DROP TABLE IF EXISTS order_fulfillments CASCADE;

-- Drop main table last
DROP TABLE IF EXISTS seaport_orders CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables are removed
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
    AND table_schema = 'public';

-- Summary
SELECT 'Rollback 002: Seaport Orderbook Tables Removed Successfully' AS status;
