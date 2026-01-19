-- Enhanced Servio Database Schema Migration
-- Version: 1.0.0
-- Date: 2026-01-19

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Types
CREATE TYPE user_role AS ENUM ('staff', 'manager', 'owner', 'admin');
CREATE TYPE order_channel AS ENUM ('dine_in', 'takeout', 'delivery', 'phone', 'website', 'doordash', 'ubereats', 'grubhub');
CREATE TYPE order_type AS ENUM ('dine_in', 'takeout', 'delivery');
CREATE TYPE order_status AS ENUM ('received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_frequency AS ENUM ('once', 'daily', 'weekly', 'monthly');
CREATE TYPE inventory_transaction_type AS ENUM ('purchase', 'sale', 'adjustment', 'waste', 'transfer', 'count');
CREATE TYPE integration_status AS ENUM ('inactive', 'connecting', 'active', 'error', 'suspended');
CREATE TYPE sync_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Drop existing tables if they exist
DROP TABLE IF EXISTS sync_jobs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    email_verified_at TIMESTAMP,
    phone_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- RESTAURANT & LOCATION MANAGEMENT
-- ============================================================================

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    address JSONB NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    settings JSONB DEFAULT '{}',
    operating_hours JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE restaurant_users (
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '[]',
    hourly_rate DECIMAL(10,2),
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (restaurant_id, user_id)
);

-- ============================================================================
-- MENU MANAGEMENT
-- ============================================================================

CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    sku VARCHAR(100),
    images JSONB DEFAULT '[]',
    nutritional_info JSONB,
    allergens JSONB DEFAULT '[]',
    is_available BOOLEAN DEFAULT true,
    availability_schedule JSONB,
    channel_settings JSONB DEFAULT '{}',
    preparation_time INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE item_modifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price_modifier DECIMAL(10,2) DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    options JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ORDER MANAGEMENT
-- ============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    channel order_channel NOT NULL,
    type order_type DEFAULT 'delivery',
    status order_status DEFAULT 'received',
    customer_info JSONB NOT NULL,
    items JSONB NOT NULL,
    pricing JSONB NOT NULL,
    delivery_info JSONB,
    payment_info JSONB,
    special_instructions TEXT,
    estimated_ready_time TIMESTAMP,
    actual_ready_time TIMESTAMP,
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason VARCHAR(255),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

CREATE TABLE inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES inventory_categories(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    unit_type VARCHAR(50) NOT NULL,
    current_quantity DECIMAL(10,3) DEFAULT 0,
    par_level DECIMAL(10,3) DEFAULT 0,
    reorder_point DECIMAL(10,3) DEFAULT 0,
    max_level DECIMAL(10,3),
    unit_cost DECIMAL(10,4),
    supplier_info JSONB,
    is_tracked BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type inventory_transaction_type NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,4),
    total_cost DECIMAL(10,2),
    reference_id UUID,
    reference_type VARCHAR(50),
    reason VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- STAFF & TIME MANAGEMENT
-- ============================================================================

CREATE TABLE staff_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position VARCHAR(100),
    break_duration INTEGER DEFAULT 0, -- minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clock_in_time TIMESTAMP NOT NULL,
    clock_out_time TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    total_hours DECIMAL(4,2),
    hourly_rate DECIMAL(10,2),
    total_pay DECIMAL(10,2),
    position VARCHAR(100),
    notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE time_entry_breaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    break_start TIMESTAMP NOT NULL,
    break_end TIMESTAMP,
    duration_minutes INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TASK MANAGEMENT
-- ============================================================================

CREATE TABLE task_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    frequency task_frequency NOT NULL,
    estimated_duration INTEGER, -- minutes
    instructions JSONB,
    required_role VARCHAR(50),
    checklist_items JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES task_templates(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'pending',
    priority task_priority DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    completion_notes TEXT,
    completion_data JSONB, -- checklist responses, photos, etc.
    estimated_duration INTEGER,
    actual_duration INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SYNC & INTEGRATION MANAGEMENT
-- ============================================================================

CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    status integration_status DEFAULT 'inactive',
    config JSONB NOT NULL DEFAULT '{}',
    credentials_encrypted TEXT,
    webhook_url VARCHAR(500),
    last_sync_at TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id),
    job_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    status sync_status DEFAULT 'pending',
    payload JSONB,
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- AUDIT & ANALYTICS
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    source VARCHAR(50) DEFAULT 'web',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- RECEIPTS & DOCUMENTS
-- ============================================================================

CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255),
    receipt_date DATE NOT NULL,
    total_amount DECIMAL(10,2),
    file_url VARCHAR(500),
    parsed_data JSONB,
    processing_status VARCHAR(50) DEFAULT 'pending',
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id),
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3),
    unit_price DECIMAL(10,4),
    total_price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- VOICE & COMMUNICATION
-- ============================================================================

CREATE TABLE voice_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    interaction_type VARCHAR(50) NOT NULL, -- 'voice_command', 'phone_call', 'text_input'
    input_text TEXT,
    response_text TEXT,
    confidence_score DECIMAL(3,2),
    actions_taken JSONB DEFAULT '[]',
    processing_time INTEGER, -- milliseconds
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE phone_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    call_id VARCHAR(255) UNIQUE NOT NULL,
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    status VARCHAR(50) NOT NULL,
    duration INTEGER, -- seconds
    recording_url VARCHAR(500),
    transcript TEXT,
    order_id UUID REFERENCES orders(id),
    handled_by VARCHAR(50) DEFAULT 'ai', -- 'ai', 'staff', 'voicemail'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Orders
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_external_id ON orders(external_id);

-- Menu Items
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);

-- Inventory
CREATE INDEX idx_inventory_restaurant ON inventory_items(restaurant_id);
CREATE INDEX idx_inventory_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_low_stock ON inventory_items(current_quantity, reorder_point);

-- Tasks
CREATE INDEX idx_tasks_restaurant ON tasks(restaurant_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Time Entries
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(clock_in_time);
CREATE INDEX idx_time_entries_restaurant ON time_entries(restaurant_id);

-- Audit Logs
CREATE INDEX idx_audit_restaurant ON audit_logs(restaurant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Sync Jobs
CREATE INDEX idx_sync_jobs_restaurant ON sync_jobs(restaurant_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_scheduled ON sync_jobs(scheduled_at);

-- Voice Interactions
CREATE INDEX idx_voice_restaurant ON voice_interactions(restaurant_id);
CREATE INDEX idx_voice_user ON voice_interactions(user_id);
CREATE INDEX idx_voice_created ON voice_interactions(created_at);

-- ============================================================================
-- INITIAL DATA SEED
-- ============================================================================

-- Create default restaurant
INSERT INTO restaurants (id, name, slug, address, phone, email, settings, operating_hours, timezone)
VALUES (
    uuid_generate_v4(),
    'Demo Restaurant',
    'demo-restaurant',
    '{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001", "country": "USA"}',
    '+1-555-0123',
    'demo@servio.com',
    '{"currency": "USD", "tax_rate": 0.0875, "tip_suggestions": [15, 18, 20, 22]}',
    '{"monday": {"open": "09:00", "close": "22:00"}, "tuesday": {"open": "09:00", "close": "22:00"}, "wednesday": {"open": "09:00", "close": "22:00"}, "thursday": {"open": "09:00", "close": "22:00"}, "friday": {"open": "09:00", "close": "23:00"}, "saturday": {"open": "09:00", "close": "23:00"}, "sunday": {"open": "10:00", "close": "21:00"}}',
    'America/New_York'
);

-- Get the restaurant ID for seeding
-- (This will be used in the application code for seeding)