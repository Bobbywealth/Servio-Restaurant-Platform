-- Add platform-admin role for internal admin dashboard
-- Version: 1.1.1
-- Date: 2026-01-20

-- Note: Role validation is handled in the application layer

-- Create initial platform admin user (password: admin123)
-- Note: This should be changed immediately in production
INSERT INTO restaurants (id, name, slug, address, settings, is_active, created_at, updated_at) 
VALUES (
    'platform-admin-org',
    'Servio Platform Administration',
    'servio-platform-admin',
    'Internal Admin Organization',
    '{"type": "platform"}',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- Hash for 'admin123' - MUST BE CHANGED IN PRODUCTION
-- Generated with: bcrypt.hash('admin123', 10)
INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (
    'platform-admin-user',
    'platform-admin-org', 
    'Platform Administrator',
    'admin@servio.com',
    '$2a$10$0ksuNKXM4yj7vIu49Gy.ROXbXpDBqmJ1P3GpEmTl1CZmRIjGa12Iy', -- admin123
    'platform-admin',
    '["platform:read", "restaurants:read", "orders:read", "inventory:read", "timeclock:read", "audit:read"]',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
    password_hash = excluded.password_hash,
    is_active = TRUE;
