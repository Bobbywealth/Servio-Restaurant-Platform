-- Marketing and Restaurant Profile Enhancement Migration
-- Version: 1.1.0
-- Date: 2026-01-19

-- ============================================================================
-- CUSTOMER MANAGEMENT FOR MARKETING
-- ============================================================================

-- Add new columns to existing customers table (SQLite compatible)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferences TEXT DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opt_in_sms BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opt_in_email BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_customers_restaurant ON customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_opt_in ON customers(opt_in_sms, opt_in_email);

-- ============================================================================
-- MARKETING CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('sms', 'email')), -- 'sms' or 'email'
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    message TEXT NOT NULL,
    subject VARCHAR(255), -- For email campaigns
    target_criteria TEXT DEFAULT '{}', -- JSON string for targeting rules
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_restaurant ON marketing_campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_scheduled ON marketing_campaigns(scheduled_at);

-- ============================================================================
-- MARKETING SEND TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_sends (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES marketing_campaigns(id),
    customer_id TEXT REFERENCES customers(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('sms', 'email')),
    recipient VARCHAR(255) NOT NULL, -- Phone number or email address
    subject VARCHAR(255), -- For emails
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
    external_id VARCHAR(255), -- Twilio SID or email message ID
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign ON marketing_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_customer ON marketing_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_status ON marketing_sends(status);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_type ON marketing_sends(type);

-- ============================================================================
-- ENHANCED RESTAURANT PROFILES
-- ============================================================================

-- Add new columns to existing restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(100);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS price_range VARCHAR(20);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS social_links TEXT DEFAULT '{}'; -- JSON for social media links
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_pdf_url VARCHAR(500);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS online_ordering_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_radius INTEGER DEFAULT 0; -- in miles
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS minimum_order DECIMAL(10,2) DEFAULT 0;

-- ============================================================================
-- RESTAURANT THEMES AND CUSTOMIZATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS restaurant_themes (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL DEFAULT 'Default',
    primary_color VARCHAR(7) DEFAULT '#ff6b35', -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#f7931e',
    text_color VARCHAR(7) DEFAULT '#333333',
    background_color VARCHAR(7) DEFAULT '#ffffff',
    custom_css TEXT,
    font_family VARCHAR(100) DEFAULT 'Inter',
    layout_style VARCHAR(50) DEFAULT 'modern', -- 'modern', 'classic', 'minimal'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_themes_restaurant ON restaurant_themes(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_themes_unique ON restaurant_themes(restaurant_id);

-- ============================================================================
-- RESTAURANT LINKS AND QR CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS restaurant_links (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url_path VARCHAR(255) NOT NULL, -- e.g., 'menu', 'order', 'specials'
    target_url VARCHAR(500), -- External URL if redirecting
    link_type VARCHAR(50) DEFAULT 'menu', -- 'menu', 'order', 'contact', 'custom'
    is_active BOOLEAN DEFAULT TRUE,
    click_count INTEGER DEFAULT 0,
    qr_code_url VARCHAR(500), -- Generated QR code image URL
    custom_styling TEXT DEFAULT '{}', -- JSON for custom link styling
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, url_path)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_links_restaurant ON restaurant_links(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_links_path ON restaurant_links(url_path);
CREATE INDEX IF NOT EXISTS idx_restaurant_links_active ON restaurant_links(is_active);

-- ============================================================================
-- UPDATE EXISTING MENU TABLES FOR ENHANCED FEATURES
-- ============================================================================

-- Add additional fields to menu_items if they don't exist
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0; -- Cost of the item
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]'; -- JSON array of image URLs
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens TEXT DEFAULT '[]'; -- JSON array of allergens
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS nutritional_info TEXT; -- JSON object with nutrition facts
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 0; -- minutes
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS channel_availability TEXT DEFAULT '{}'; -- JSON for platform availability

-- Add category field directly to menu_items for backward compatibility
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category VARCHAR(255);

-- Add unique constraint for menu items (restaurant_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_unique ON menu_items(restaurant_id, name);

-- Create menu_categories table if it doesn't exist (SQLite compatible)
CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories(sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_categories_unique ON menu_categories(restaurant_id, name);

-- category_id already exists in menu_items from migration 001

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert default restaurant theme
INSERT INTO restaurant_themes (restaurant_id, name, primary_color, secondary_color)
SELECT id, 'Default Theme', '#ff6b35', '#f7931e'
FROM restaurants
WHERE slug = 'demo-restaurant'
ON CONFLICT (restaurant_id) DO NOTHING;

-- Insert default menu categories
INSERT INTO menu_categories (restaurant_id, name, description, sort_order)
SELECT r.id, 'Appetizers', 'Start your meal with our delicious appetizers', 1
FROM restaurants r WHERE r.slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, description, sort_order)
SELECT r.id, 'Main Courses', 'Our signature main dishes', 2
FROM restaurants r WHERE r.slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, description, sort_order)
SELECT r.id, 'Beverages', 'Refreshing drinks to complement your meal', 3
FROM restaurants r WHERE r.slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, description, sort_order)
SELECT r.id, 'Desserts', 'Sweet treats to end your meal perfectly', 4
FROM restaurants r WHERE r.slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- Insert some sample menu items with enhanced data
INSERT INTO menu_items (
    restaurant_id, category_id, name, description, price, cost, images, allergens,
    preparation_time, sort_order, is_available, category
)
SELECT 
    r.id,
    c.id,
    'Jerk Chicken Wings',
    'Spicy Caribbean-style chicken wings with our house jerk seasoning',
    12.99,
    4.50,
    '[]',
    '["gluten"]',
    15,
    1,
    TRUE,
    'Appetizers'
FROM restaurants r
JOIN menu_categories c ON c.restaurant_id = r.id
WHERE r.slug = 'demo-restaurant' AND c.name = 'Appetizers'
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO menu_items (
    restaurant_id, category_id, name, description, price, cost, images, allergens,
    preparation_time, sort_order, is_available, category
)
SELECT 
    r.id,
    c.id,
    'Curry Goat',
    'Traditional Caribbean curry goat served with rice and peas',
    18.99,
    7.25,
    '[]',
    '[]',
    25,
    1,
    TRUE,
    'Main Courses'
FROM restaurants r
JOIN menu_categories c ON c.restaurant_id = r.id
WHERE r.slug = 'demo-restaurant' AND c.name = 'Main Courses'
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO menu_items (
    restaurant_id, category_id, name, description, price, cost, images, allergens,
    preparation_time, sort_order, is_available, category
)
SELECT 
    r.id,
    c.id,
    'Oxtail Dinner',
    'Slow-cooked oxtail in rich gravy with vegetables',
    22.99,
    8.75,
    '[]',
    '[]',
    35,
    2,
    TRUE,
    'Main Courses'
FROM restaurants r
JOIN menu_categories c ON c.restaurant_id = r.id
WHERE r.slug = 'demo-restaurant' AND c.name = 'Main Courses'
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- Insert default restaurant links
INSERT INTO restaurant_links (restaurant_id, name, description, url_path, link_type)
SELECT id, 'View Menu', 'Browse our full menu online', 'menu', 'menu'
FROM restaurants WHERE slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, url_path) DO NOTHING;

INSERT INTO restaurant_links (restaurant_id, name, description, url_path, link_type)
SELECT id, 'Order Online', 'Place your order for pickup or delivery', 'order', 'order'
FROM restaurants WHERE slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, url_path) DO NOTHING;

INSERT INTO restaurant_links (restaurant_id, name, description, url_path, link_type)
SELECT id, 'Contact Us', 'Get in touch with our restaurant', 'contact', 'contact'
FROM restaurants WHERE slug = 'demo-restaurant'
ON CONFLICT (restaurant_id, url_path) DO NOTHING;