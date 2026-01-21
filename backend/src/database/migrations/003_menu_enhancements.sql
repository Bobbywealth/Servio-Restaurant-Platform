-- Menu Enhancements Migration
-- Version: 1.1.0
-- Date: 2026-01-19
-- Add support for category images, modifiers, and enhanced menu management

-- ============================================================================
-- MENU CATEGORY ENHANCEMENTS
-- ============================================================================

-- Add image field to menu categories
ALTER TABLE menu_categories ADD COLUMN image VARCHAR(500);
ALTER TABLE menu_categories ADD COLUMN image_alt_text VARCHAR(255);

-- ============================================================================
-- MENU MODIFIER ENHANCEMENTS
-- ============================================================================

-- Drop and recreate item_modifications with enhanced structure
DROP TABLE IF EXISTS item_modifications;

-- Enhance existing modifier_groups table with additional columns
ALTER TABLE modifier_groups ADD COLUMN description TEXT;
ALTER TABLE modifier_groups ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE modifier_groups ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- Note: min_selections and max_selections columns already exist as min_selection and max_selection

-- Enhance existing modifier_options table with additional columns
ALTER TABLE modifier_options ADD COLUMN description TEXT;
ALTER TABLE modifier_options ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE modifier_options ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- Note: price_modifier and is_available columns already exist

-- Link menu items to modifier groups
CREATE TABLE menu_item_modifiers (
    id TEXT PRIMARY KEY,
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    modifier_group_id TEXT NOT NULL REFERENCES modifier_groups(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_item_id, modifier_group_id)
);

-- ============================================================================
-- MENU IMPORT/EXPORT TRACKING
-- ============================================================================

CREATE TABLE menu_imports (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'excel', 'csv', 'json'
    status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors TEXT DEFAULT '[]',
    processed_data TEXT,
    uploaded_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
-- TODO: Sample data creation removed
-- Can be added later using simple INSERT statements if needed