-- Performance Indexes for AI Assistant Operations
-- Version: 1.1.0
-- Date: 2026-01-20
-- Purpose: Optimize frequently queried restaurant operations for AI assistant

-- ============================================================================
-- RESTAURANT CONTEXT QUERIES (Most Critical for Assistant Performance)
-- ============================================================================

-- Index for active orders query (used in every system prompt)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created 
ON orders(restaurant_id, status, created_at DESC);

-- Index for menu item availability queries (used for 86 operations)
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available_name
ON menu_items(restaurant_id, is_available, name);

-- Index for low stock inventory queries
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant_stock_threshold
ON inventory_items(restaurant_id, on_hand_qty, low_stock_threshold);

-- Index for pending tasks queries
CREATE INDEX IF NOT EXISTS idx_tasks_restaurant_status_created
ON tasks(restaurant_id, status, created_at DESC);

-- ============================================================================
-- FUZZY MATCHING PERFORMANCE
-- ============================================================================

-- Index for menu item fuzzy matching (speeds up name searches)
CREATE INDEX IF NOT EXISTS idx_menu_items_name_lower
ON menu_items(restaurant_id, LOWER(name));

-- Index for inventory item fuzzy matching
CREATE INDEX IF NOT EXISTS idx_inventory_name_lower
ON inventory_items(restaurant_id, LOWER(name));

-- ============================================================================
-- AUTHENTICATION & USER CONTEXT
-- ============================================================================

-- Index for user restaurant lookup (every assistant request)
CREATE INDEX IF NOT EXISTS idx_users_restaurant_active
ON users(restaurant_id, is_active);

-- Index for auth sessions cleanup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
ON auth_sessions(expires_at);

-- ============================================================================
-- AUDIT & MONITORING
-- ============================================================================

-- Index for audit log queries (for monitoring dashboard)
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_action_created
ON audit_logs(restaurant_id, action, created_at DESC);

-- Index for time-based audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

-- ============================================================================
-- ORDER MANAGEMENT PERFORMANCE
-- ============================================================================

-- Index for order items lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

-- Index for customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
ON orders(customer_id, created_at DESC);

-- ============================================================================
-- INVENTORY TRANSACTION PERFORMANCE
-- ============================================================================

-- Index for inventory transaction history
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_created
ON inventory_transactions(inventory_item_id, created_at DESC);

-- Index for inventory transaction by restaurant
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_restaurant_created
ON inventory_transactions(restaurant_id, created_at DESC);

-- ============================================================================
-- TIME CLOCK PERFORMANCE (For staff management insights)
-- ============================================================================

-- Index for active time entries
CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_out
ON time_entries(user_id, clock_out_time);

-- Index for time entries by restaurant and date
CREATE INDEX IF NOT EXISTS idx_time_entries_restaurant_date
ON time_entries(restaurant_id, clock_in_time DESC);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Composite index for urgent orders detection
CREATE INDEX IF NOT EXISTS idx_orders_urgent_detection
ON orders(restaurant_id, status, created_at DESC, updated_at);

-- Composite index for menu availability with category
CREATE INDEX IF NOT EXISTS idx_menu_items_category_available
ON menu_items(restaurant_id, category_id, is_available);

-- Composite index for inventory with SKU lookup
CREATE INDEX IF NOT EXISTS idx_inventory_sku_restaurant
ON inventory_items(restaurant_id, sku, is_active);