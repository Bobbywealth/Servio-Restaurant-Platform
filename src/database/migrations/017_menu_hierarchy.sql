-- Migration 017: Menu hierarchy (category visibility, item sizes, category-level modifier groups)
-- Date: 2026-01-23
-- Adds:
--  - menu_categories.is_hidden
--  - item_sizes table (size variations per menu item)
--  - category_modifier_groups pivot (category-level modifier groups)
--  - modifier_options.is_sold_out + modifier_options.is_preselected

-- ============================================================================
-- MENU CATEGORY: VISIBILITY
-- ============================================================================

ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_menu_categories_hidden
  ON menu_categories(is_hidden);

-- ============================================================================
-- ITEM SIZES (SIZE VARIATIONS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_sizes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES menu_items(id),
  size_name TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  is_preselected BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_sizes_item
  ON item_sizes(item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_sizes_item_name_unique
  ON item_sizes(item_id, size_name);

-- ============================================================================
-- CATEGORY-LEVEL MODIFIER GROUP ASSIGNMENTS (INHERITED BY ITEMS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_modifier_groups (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_modifier_groups_category
  ON category_modifier_groups(category_id);

CREATE INDEX IF NOT EXISTS idx_category_modifier_groups_group
  ON category_modifier_groups(group_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_modifier_groups_unique
  ON category_modifier_groups(category_id, group_id);

-- ============================================================================
-- MODIFIER OPTIONS: SOLD OUT + PRESELECTED
-- ============================================================================

ALTER TABLE modifier_options
  ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE modifier_options
  ADD COLUMN IF NOT EXISTS is_preselected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_modifier_options_sold_out
  ON modifier_options(is_sold_out);

