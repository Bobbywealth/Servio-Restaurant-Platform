-- Additional Production Performance Indexes
-- Date: 2026-01-20
-- Purpose: Critical indexes for production launch as per Day 6-8 requirements
-- Refactored to match actual schema columns and tables

-- ============================================================================
-- ORDERS PERFORMANCE (High Priority)
-- ============================================================================

-- Index for orders by restaurant and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_status
  ON orders(restaurant_id, status);

-- Index for recent orders (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_desc
  ON orders(created_at DESC);

-- Index for order channel analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_channel_created
  ON orders(restaurant_id, channel, created_at DESC);

-- ============================================================================
-- MENU ITEMS PERFORMANCE
-- ============================================================================

-- Index for active menu items by restaurant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_restaurant_active
  ON menu_items(restaurant_id, is_available);

-- Index for menu items by category (for quick filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_restaurant_category
  ON menu_items(restaurant_id, category);

-- ============================================================================
-- INVENTORY PERFORMANCE
-- ============================================================================

-- Index for low stock items (critical for alerts)
-- Refactored: current_quantity -> on_hand_qty, reorder_point -> low_stock_threshold
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock
  ON inventory_items(restaurant_id, on_hand_qty);

-- Index for inventory by name (for quick search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_restaurant_name
  ON inventory_items(restaurant_id, LOWER(name));

-- ============================================================================
-- TASKS PERFORMANCE
-- ============================================================================

-- Index for assigned tasks with status and due date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_status_due
  ON tasks(assigned_to, status, due_date);

-- Index for restaurant tasks by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_restaurant_status
  ON tasks(restaurant_id, status);

-- ============================================================================
-- TIME ENTRIES PERFORMANCE
-- ============================================================================

-- Index for user time entries by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_date_desc
  ON time_entries(user_id, clock_in_time DESC);

-- Index for active clock-ins (users currently working)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_active_shifts
  ON time_entries(restaurant_id, user_id)
  WHERE clock_out_time IS NULL;

-- ============================================================================
-- AUDIT LOGS PERFORMANCE
-- ============================================================================

-- Index for audit logs by entity type and ID
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_created
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- Index for audit logs by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs(user_id, created_at DESC);

-- Index for audit logs by action type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs(action, created_at DESC);

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

-- Index for user lookup by email (login)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower_unique
  ON users(LOWER(email));

-- Index for active users by restaurant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_restaurant_active_role
  ON users(restaurant_id, is_active, role);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- Index for unread notifications by user (via recipients)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_recipients_user_type
  ON notification_recipients(recipient_user_id, recipient_type);

-- Index for notifications by type and creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type_created
  ON notifications(type, created_at DESC);

-- ============================================================================
-- BOOKINGS
-- ============================================================================

-- Index for demo bookings by date and time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_demo_bookings_date_time_status
  ON demo_bookings(booking_date, booking_time, status);

-- ============================================================================
-- MARKETING & ANALYTICS
-- ============================================================================

-- Index for customer profiles by restaurant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_restaurant_created
  ON customers(restaurant_id, created_at DESC);

-- Index for marketing campaigns by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_restaurant_status
  ON marketing_campaigns(restaurant_id, status, scheduled_at DESC);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Composite index for order analytics (revenue, count by date range)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_analytics
  ON orders(restaurant_id, status, created_at DESC, total_amount);

-- Composite index for menu item popularity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_analytics
  ON order_items(menu_item_id, created_at DESC, quantity);

-- Composite index for inventory transaction tracking
-- Refactored: transaction_type -> type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_transactions_analytics
  ON inventory_transactions(
    restaurant_id, 
    inventory_item_id, 
    type, 
    created_at DESC
  );

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Partial index for pending orders only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_pending
  ON orders(restaurant_id, created_at DESC)
  WHERE status = 'NEW';

-- Partial index for active menu items only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_active_partial
  ON menu_items(restaurant_id, name, price)
  WHERE is_available = true;

-- Partial index for overdue tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_overdue
  ON tasks(restaurant_id, assigned_to, due_date)
  WHERE status NOT IN ('completed', 'cancelled') 
    AND due_date < NOW();

-- ============================================================================
-- STATISTICS UPDATE
-- ============================================================================

-- Analyze tables to update query planner statistics
ANALYZE orders;
ANALYZE menu_items;
ANALYZE inventory_items;
ANALYZE tasks;
ANALYZE time_entries;
ANALYZE audit_logs;
ANALYZE users;
ANALYZE order_items;
ANALYZE inventory_transactions;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Production performance indexes created successfully';
END $$;
