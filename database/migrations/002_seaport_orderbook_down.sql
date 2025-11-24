-- ============================================================================
-- Migration: 002 - Seaport Orderbook Tables (DOWN)
-- Description: Rollback script to remove Seaport orderbook tables
-- Author: System
-- Date: 2024
-- ============================================================================

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
-- MIGRATION TRACKING
-- ============================================================================

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '002';
