-- Migration: Receipt Analysis Storage
-- Date: 2026-02-01
-- Purpose: Add tables for storing AI-analyzed receipt data

-- Create table for storing receipt analysis results
CREATE TABLE IF NOT EXISTS receipt_analyses (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    supplier_name TEXT,
    total_amount DOUBLE PRECISION,
    currency TEXT DEFAULT 'USD',
    items TEXT NOT NULL, -- JSON array of analyzed items
    raw_text TEXT,
    image_url TEXT,
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    analyzed_by TEXT DEFAULT 'openai', -- 'openai', 'minimax', 'manual'
    analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_receipt_analyses_restaurant ON receipt_analyses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_receipt_analyses_date ON receipt_analyses(analyzed_at DESC);

-- Create table for tracking which inventory items came from which receipt analysis
CREATE TABLE IF NOT EXISTS inventory_from_receipts (
    id TEXT PRIMARY KEY,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
    receipt_analysis_id TEXT NOT NULL REFERENCES receipt_analyses(id),
    source_quantity DOUBLE PRECISION NOT NULL,
    source_unit_cost DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (receipt_analysis_id) REFERENCES receipt_analyses(id) ON DELETE CASCADE
);

-- Create index for tracking
CREATE INDEX IF NOT EXISTS idx_inventory_from_receipts_inventory ON inventory_from_receipts(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_from_receipts_analysis ON inventory_from_receipts(receipt_analysis_id);
