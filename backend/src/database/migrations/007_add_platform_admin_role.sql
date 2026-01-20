-- Add platform-admin role for internal admin dashboard
-- Version: 1.1.1
-- Date: 2026-01-20

-- Update the role CHECK constraint to include platform-admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('staff', 'manager', 'owner', 'admin', 'platform-admin'));

-- Create initial platform admin user (password: admin123)
-- Note: This should be changed immediately in production
INSERT INTO restaurants (id, name, slug, address, settings, is_active, created_at, updated_at) 
VALUES (
    'platform-admin-org',
    'Servio Platform Administration',
    'servio-platform-admin',
    'Internal Admin Organization',
    '{"type": "platform"}',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Hash for 'admin123' - MUST BE CHANGED IN PRODUCTION
INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (
    'platform-admin-user',
    'platform-admin-org', 
    'Platform Administrator',
    'admin@servio.com',
    '$2b$10$rZ8qJqE7qW8kC5vP2hN5G.YvP8CZ3FJ4HqT2wR9L6nE8K3mC1gX7O', -- admin123
    'platform-admin',
    '["platform:read", "restaurants:read", "orders:read", "inventory:read", "timeclock:read", "audit:read"]',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;