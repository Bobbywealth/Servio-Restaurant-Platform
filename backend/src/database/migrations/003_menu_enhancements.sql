-- Menu Enhancements Migration
-- Version: 1.1.0
-- Date: 2026-01-19
-- Add support for category images, modifiers, and enhanced menu management

-- ============================================================================
-- MENU CATEGORY ENHANCEMENTS
-- ============================================================================

-- Add image field to menu categories
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS image VARCHAR(500);
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS image_alt_text VARCHAR(255);

-- ============================================================================
-- MENU MODIFIER ENHANCEMENTS
-- ============================================================================

-- Drop and recreate item_modifications with enhanced structure
DROP TABLE IF EXISTS item_modifications CASCADE;

-- Create modifier groups (e.g., "Size", "Toppings", "Sides")
CREATE TABLE modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create modifier options (e.g., "Large +$2", "Extra Cheese +$1")
CREATE TABLE modifier_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_modifier DECIMAL(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Link menu items to modifier groups
CREATE TABLE menu_item_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(menu_item_id, modifier_group_id)
);

-- ============================================================================
-- MENU IMPORT/EXPORT TRACKING
-- ============================================================================

CREATE TABLE menu_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'excel', 'csv', 'json'
    status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    processed_data JSONB,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Modifier Groups
CREATE INDEX idx_modifier_groups_restaurant ON modifier_groups(restaurant_id);
CREATE INDEX idx_modifier_groups_active ON modifier_groups(is_active);

-- Modifier Options
CREATE INDEX idx_modifier_options_group ON modifier_options(modifier_group_id);
CREATE INDEX idx_modifier_options_available ON modifier_options(is_available);

-- Menu Item Modifiers
CREATE INDEX idx_menu_item_modifiers_item ON menu_item_modifiers(menu_item_id);
CREATE INDEX idx_menu_item_modifiers_group ON menu_item_modifiers(modifier_group_id);

-- Menu Imports
CREATE INDEX idx_menu_imports_restaurant ON menu_imports(restaurant_id);
CREATE INDEX idx_menu_imports_status ON menu_imports(status);
CREATE INDEX idx_menu_imports_created ON menu_imports(created_at);

-- Menu Categories Image
CREATE INDEX idx_menu_categories_image ON menu_categories(image);

-- ============================================================================
-- SAMPLE DATA FOR MODIFIERS
-- ============================================================================

-- Get the default restaurant ID
DO $$
DECLARE
    default_restaurant_id UUID;
    size_group_id UUID;
    toppings_group_id UUID;
    sides_group_id UUID;
BEGIN
    -- Get the default restaurant ID
    SELECT id INTO default_restaurant_id FROM restaurants LIMIT 1;
    
    IF default_restaurant_id IS NOT NULL THEN
        -- Create sample modifier groups
        
        -- Size modifier group
        INSERT INTO modifier_groups (id, restaurant_id, name, description, min_selections, max_selections, is_required, sort_order)
        VALUES (uuid_generate_v4(), default_restaurant_id, 'Size', 'Choose your portion size', 1, 1, true, 1)
        RETURNING id INTO size_group_id;
        
        -- Add size options
        INSERT INTO modifier_options (modifier_group_id, name, price_modifier, sort_order) VALUES
        (size_group_id, 'Small', 0.00, 1),
        (size_group_id, 'Medium', 2.00, 2),
        (size_group_id, 'Large', 4.00, 3);
        
        -- Toppings modifier group
        INSERT INTO modifier_groups (id, restaurant_id, name, description, min_selections, max_selections, is_required, sort_order)
        VALUES (uuid_generate_v4(), default_restaurant_id, 'Extra Toppings', 'Add extra toppings to your dish', 0, 5, false, 2)
        RETURNING id INTO toppings_group_id;
        
        -- Add topping options
        INSERT INTO modifier_options (modifier_group_id, name, price_modifier, sort_order) VALUES
        (toppings_group_id, 'Extra Cheese', 1.50, 1),
        (toppings_group_id, 'Bacon', 2.00, 2),
        (toppings_group_id, 'Mushrooms', 1.00, 3),
        (toppings_group_id, 'Pepperoni', 1.50, 4),
        (toppings_group_id, 'Olives', 1.00, 5);
        
        -- Sides modifier group
        INSERT INTO modifier_groups (id, restaurant_id, name, description, min_selections, max_selections, is_required, sort_order)
        VALUES (uuid_generate_v4(), default_restaurant_id, 'Side Options', 'Choose your side dish', 0, 2, false, 3)
        RETURNING id INTO sides_group_id;
        
        -- Add side options
        INSERT INTO modifier_options (modifier_group_id, name, price_modifier, sort_order) VALUES
        (sides_group_id, 'French Fries', 0.00, 1),
        (sides_group_id, 'Sweet Potato Fries', 2.00, 2),
        (sides_group_id, 'Onion Rings', 1.50, 3),
        (sides_group_id, 'Side Salad', 1.00, 4),
        (sides_group_id, 'Coleslaw', 1.00, 5);
    END IF;
END $$;