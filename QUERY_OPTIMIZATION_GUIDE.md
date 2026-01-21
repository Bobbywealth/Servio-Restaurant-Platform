# Query Optimization Guide

## Overview
This guide provides best practices for optimizing database queries in the Servio platform to ensure sub-100ms p95 query times.

## Quick Reference

### Performance Targets
- **p50**: < 50ms
- **p95**: < 100ms
- **p99**: < 500ms
- **Max**: < 1000ms

### Common Issues
1. Missing indexes
2. N+1 queries
3. SELECT * queries
4. No pagination
5. Inefficient joins
6. Missing WHERE clauses

---

## Indexes

### When to Add an Index

✅ **Add index when**:
- Column is used in WHERE clause frequently
- Column is used in ORDER BY frequently
- Column is used in JOIN conditions
- Column is used in GROUP BY
- Query is slow (>100ms)

❌ **Don't add index when**:
- Table has <1000 rows
- Column has low cardinality (few unique values)
- Column is rarely queried
- Table has heavy write operations

### Index Types

#### B-Tree Index (Default)
Best for equality and range queries.

```sql
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
```

#### Composite Index
For queries with multiple WHERE conditions.

```sql
-- Good: For queries filtering by restaurant AND status
CREATE INDEX idx_orders_restaurant_status 
  ON orders(restaurant_id, status);

-- Order matters! Put most selective column first
```

#### Partial Index
For queries with constant WHERE conditions.

```sql
-- Index only active, non-deleted orders
CREATE INDEX idx_orders_active 
  ON orders(restaurant_id, created_at DESC)
  WHERE deleted_at IS NULL AND status != 'cancelled';
```

#### Expression Index
For queries on transformed columns.

```sql
-- For case-insensitive searches
CREATE INDEX idx_menu_items_name_lower 
  ON menu_items(restaurant_id, LOWER(name));
```

### Verify Index Usage

```sql
-- Check if query uses index
EXPLAIN ANALYZE
SELECT * FROM orders 
WHERE restaurant_id = '...' AND status = 'pending';

-- Look for:
-- ✅ "Index Scan" or "Index Only Scan"
-- ❌ "Seq Scan" (means no index used)
```

---

## N+1 Query Problem

### Bad Example ❌

```typescript
// Fetches orders
const orders = await db.all('SELECT * FROM orders WHERE restaurant_id = ?', [restaurantId]);

// N+1: Fetches items for each order (N additional queries)
for (const order of orders) {
  order.items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
}

// Total queries: 1 + N (if 100 orders, 101 queries!)
```

### Good Example ✅

```typescript
// Single query with JOIN
const orders = await db.all(`
  SELECT 
    o.*,
    json_group_array(json_object(
      'id', oi.id,
      'menuItemId', oi.menu_item_id,
      'quantity', oi.quantity,
      'price', oi.price
    )) as items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = ?
  GROUP BY o.id
`, [restaurantId]);

// Total queries: 1 (regardless of number of orders)
```

### Detecting N+1 Queries

```typescript
// Enable query logging in development
import { withQueryPerformance } from './middleware/performance';

// Wrap database calls
const result = await withQueryPerformance('getOrders', async () => {
  return db.all('SELECT * FROM orders WHERE restaurant_id = ?', [restaurantId]);
});

// Check logs for multiple similar queries
```

---

## Query Best Practices

### 1. Only Select Needed Columns

❌ **Bad**: SELECT *
```sql
SELECT * FROM orders WHERE id = ?;
-- Fetches all 20+ columns even if you need 3
```

✅ **Good**: Specify columns
```sql
SELECT id, status, total_amount, created_at 
FROM orders 
WHERE id = ?;
-- Fetches only what you need
```

### 2. Always Use Pagination

❌ **Bad**: No limit
```sql
SELECT * FROM orders WHERE restaurant_id = ?;
-- Could return thousands of rows
```

✅ **Good**: With limit and offset
```sql
SELECT * FROM orders 
WHERE restaurant_id = ?
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
-- Returns manageable chunk
```

### 3. Use Appropriate JOIN Types

```sql
-- INNER JOIN: Only matching rows
SELECT o.*, c.name 
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id;

-- LEFT JOIN: All left rows + matching right rows
SELECT o.*, c.name 
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id;

-- Prefer INNER JOIN when possible (faster)
```

### 4. Filter Early with WHERE

❌ **Bad**: Filter in application
```typescript
const allOrders = await db.all('SELECT * FROM orders');
const pendingOrders = allOrders.filter(o => o.status === 'pending');
```

✅ **Good**: Filter in database
```typescript
const pendingOrders = await db.all('SELECT * FROM orders WHERE status = ?', ['pending']);
```

### 5. Use Transactions for Multiple Writes

```typescript
// Start transaction
await db.run('BEGIN TRANSACTION');

try {
  // Multiple operations
  await db.run('INSERT INTO orders (...) VALUES (...)', []);
  await db.run('INSERT INTO order_items (...) VALUES (...)', []);
  await db.run('UPDATE inventory_items SET quantity = ...', []);
  
  // Commit if all successful
  await db.run('COMMIT');
} catch (error) {
  // Rollback on error
  await db.run('ROLLBACK');
  throw error;
}
```

---

## Common Query Patterns

### Pattern 1: Get Active Orders with Items

```sql
-- Optimized query
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  json_group_array(
    json_object(
      'id', oi.id,
      'name', mi.name,
      'quantity', oi.quantity,
      'price', oi.price
    )
  ) as items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.restaurant_id = ?
  AND o.deleted_at IS NULL
  AND o.status IN ('pending', 'confirmed', 'preparing')
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 50;

-- Uses indexes:
-- - idx_orders_restaurant_status_not_deleted
-- - idx_order_items_order_id
```

### Pattern 2: Get Low Stock Items

```sql
-- Optimized query
SELECT 
  id,
  name,
  current_quantity,
  reorder_point,
  unit
FROM inventory_items
WHERE restaurant_id = ?
  AND deleted_at IS NULL
  AND current_quantity < reorder_point
  AND is_active = true
ORDER BY (reorder_point - current_quantity) DESC
LIMIT 20;

-- Uses index: idx_inventory_low_stock_active
```

### Pattern 3: Get Tasks by Status with Assignee

```sql
-- Optimized query
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  json_object(
    'id', u.id,
    'name', u.name,
    'email', u.email
  ) as assignee
FROM tasks t
LEFT JOIN users u ON u.id = t.assigned_to
WHERE t.restaurant_id = ?
  AND t.deleted_at IS NULL
  AND t.status IN ('pending', 'in-progress')
ORDER BY 
  CASE t.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  t.due_date ASC NULLS LAST
LIMIT 50;

-- Uses index: idx_tasks_restaurant_priority_status
```

### Pattern 4: Get Menu Items with Categories

```sql
-- Optimized query with caching
SELECT 
  mi.id,
  mi.name,
  mi.description,
  mi.price,
  mi.category,
  mi.is_available,
  mi.image_url
FROM menu_items mi
WHERE mi.restaurant_id = ?
  AND mi.deleted_at IS NULL
  AND mi.is_available = true
ORDER BY mi.category, mi.name;

-- Uses index: idx_menu_items_active
-- Cache this query (TTL: 5 minutes)
```

---

## Caching Strategy

### What to Cache

✅ **Good candidates**:
- Menu items (change infrequently)
- Restaurant settings (change rarely)
- User permissions (change occasionally)
- Category lists (static)

❌ **Bad candidates**:
- Orders (change constantly)
- Inventory (real-time important)
- Active tasks (need up-to-date)

### Implementation

```typescript
import { getCacheService, CacheKeys, CacheTTL } from './services/CacheService';

const cache = getCacheService();

// Get with cache
const menuItems = await cache.getOrSet(
  CacheKeys.menuItems(restaurantId),
  CacheTTL.MENU_ITEMS, // 5 minutes
  async () => {
    // Fetch from database
    return await db.all('SELECT * FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  }
);

// Invalidate cache when data changes
await db.run('UPDATE menu_items SET price = ? WHERE id = ?', [newPrice, itemId]);
await cache.invalidateByPrefix(`menu:${restaurantId}`);
```

---

## Monitoring Slow Queries

### Enable pg_stat_statements

```sql
-- In postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

-- Restart PostgreSQL
```

### Find Slow Queries

```sql
-- Top 10 slowest queries by average time
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  rows
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking >100ms on average
ORDER BY mean_time DESC
LIMIT 10;

-- Queries with most total time (biggest impact)
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### Application-Level Monitoring

```typescript
// Already implemented in performance middleware
import { withQueryPerformance } from './middleware/performance';

const result = await withQueryPerformance(
  'getOrders', // query name
  async () => db.all('SELECT * FROM orders WHERE restaurant_id = ?', [restaurantId]),
  'SELECT * FROM orders WHERE restaurant_id = ?' // optional: query string
);

// Logs warning if query takes >500ms
// Logs to Sentry if query takes >1000ms
```

---

## Query Optimization Checklist

Before deploying a new query, verify:

- [ ] Uses appropriate indexes
- [ ] Has WHERE clause to limit rows
- [ ] Has LIMIT for list queries
- [ ] Selects only needed columns (no SELECT *)
- [ ] Uses proper JOIN type
- [ ] Avoids N+1 pattern
- [ ] Has soft delete filter (WHERE deleted_at IS NULL)
- [ ] Tested with realistic data volume
- [ ] Execution time < 100ms (p95)
- [ ] Uses caching if appropriate

---

## Tools

### Explain Analyze

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE restaurant_id = ? AND status = 'pending';

-- Read the output:
-- 1. Execution time (should be <100ms)
-- 2. Scan type (Index Scan is good, Seq Scan is bad)
-- 3. Rows processed vs rows returned
-- 4. Cost estimates
```

### pgAdmin Query Tool

- Visual EXPLAIN
- Query profiler
- Execution plan viewer

### Application Monitoring

- Sentry APM: Query performance
- Grafana: Query metrics dashboard
- Health endpoint: `/health/database/stats`

---

## Additional Resources

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Use The Index, Luke](https://use-the-index-luke.com/)
- [Postgres EXPLAIN Visualizer](https://explain.dalibo.com/)
