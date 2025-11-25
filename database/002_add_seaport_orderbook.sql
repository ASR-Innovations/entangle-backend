-- Migration: Add Seaport Orderbook Tables
-- This migration adds tables for storing and managing Seaport protocol orders

-- ============================================================================
-- SEAPORT ORDERS TABLE
-- ============================================================================
-- Main table for storing all Seaport orders (listings and offers)
CREATE TABLE IF NOT EXISTS seaport_orders (
    -- Primary identifier
    order_hash VARCHAR(66) PRIMARY KEY,
    
    -- Order classification
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('listing', 'offer')),
    
    -- NFT identification
    nft_contract VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    
    -- Participants
    maker VARCHAR(42) NOT NULL,
    taker VARCHAR(42),
    
    -- Payment details
    payment_token VARCHAR(42) NOT NULL,
    price VARCHAR(78) NOT NULL,
    price_decimal VARCHAR(50),
    
    -- Platform fee
    platform_fee_amount VARCHAR(78),
    platform_fee_recipient VARCHAR(42),
    
    -- Timing
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    
    -- Order data
    order_components JSONB NOT NULL,
    signature TEXT NOT NULL,
    
    -- Status flags
    is_active BOOLEAN DEFAULT true,
    is_cancelled BOOLEAN DEFAULT false,
    is_fulfilled BOOLEAN DEFAULT false,
    
    -- Fulfillment tracking
    fulfilled_at TIMESTAMP,
    fulfilled_by VARCHAR(42),
    fulfillment_tx_hash VARCHAR(66),
    
    -- Cancellation tracking
    cancelled_at TIMESTAMP,
    cancellation_tx_hash VARCHAR(66),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- User reference
    para_user_id VARCHAR(255),
    
    -- Foreign key constraint
    CONSTRAINT fk_seaport_orders_user FOREIGN KEY (para_user_id) 
        REFERENCES users(para_user_id) ON DELETE SET NULL
);

-- ============================================================================
-- ORDER FULFILLMENTS TABLE
-- ============================================================================
-- Tracks on-chain fulfillment events for orders
CREATE TABLE IF NOT EXISTS order_fulfillments (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66) NOT NULL,
    fulfiller VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    amount_paid VARCHAR(78),
    platform_fee_paid VARCHAR(78),
    fulfilled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_order_fulfillments_order FOREIGN KEY (order_hash) 
        REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

-- ============================================================================
-- ORDER CANCELLATIONS TABLE
-- ============================================================================
-- Tracks order cancellation events
CREATE TABLE IF NOT EXISTS order_cancellations (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66) NOT NULL,
    cancelled_by VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE,
    cancellation_reason VARCHAR(255),
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_order_cancellations_order FOREIGN KEY (order_hash) 
        REFERENCES seaport_orders(order_hash) ON DELETE CASCADE
);

-- ============================================================================
-- ORDER EVENTS TABLE
-- ============================================================================
-- General event log for all order-related activities
CREATE TABLE IF NOT EXISTS order_events (
    id SERIAL PRIMARY KEY,
    order_hash VARCHAR(66),
    event_type VARCHAR(50) NOT NULL,
    actor VARCHAR(42),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Primary query patterns for seaport_orders
CREATE INDEX IF NOT EXISTS idx_seaport_orders_token_id 
    ON seaport_orders(token_id, nft_contract);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_maker 
    ON seaport_orders(maker);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_order_type 
    ON seaport_orders(order_type);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_is_active 
    ON seaport_orders(is_active);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_expires_at 
    ON seaport_orders(expires_at);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_created_at 
    ON seaport_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seaport_orders_para_user_id 
    ON seaport_orders(para_user_id);

-- Composite index for common query pattern: active orders by type and token
CREATE INDEX IF NOT EXISTS idx_seaport_orders_active_orders 
    ON seaport_orders(order_type, token_id, is_active, expires_at);

-- Composite index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_seaport_orders_marketplace 
    ON seaport_orders(is_active, order_type, created_at DESC) 
    WHERE is_active = true;

-- Index for fulfillment lookups
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order_hash 
    ON order_fulfillments(order_hash);

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_fulfiller 
    ON order_fulfillments(fulfiller);

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_tx_hash 
    ON order_fulfillments(transaction_hash);

-- Index for cancellation lookups
CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_hash 
    ON order_cancellations(order_hash);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_cancelled_by 
    ON order_cancellations(cancelled_by);

-- Index for event lookups
CREATE INDEX IF NOT EXISTS idx_order_events_order_hash 
    ON order_events(order_hash);

CREATE INDEX IF NOT EXISTS idx_order_events_event_type 
    ON order_events(event_type);

CREATE INDEX IF NOT EXISTS idx_order_events_created_at 
    ON order_events(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seaport_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_seaport_orders_updated_at ON seaport_orders;
CREATE TRIGGER trigger_update_seaport_orders_updated_at
    BEFORE UPDATE ON seaport_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_seaport_orders_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify seaport_orders table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'seaport_orders'
ORDER BY ordinal_position;

-- Verify foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('seaport_orders', 'order_fulfillments', 'order_cancellations');

-- Verify indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('seaport_orders', 'order_fulfillments', 'order_cancellations', 'order_events')
ORDER BY tablename, indexname;

-- Summary
SELECT 'Migration 002: Seaport Orderbook Tables Created Successfully' AS status;
