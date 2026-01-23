-- Migration 016: Modifier groups and options
-- Date: 2026-01-23
-- Adds reusable modifier groups, options, and item attachments.

-- ============================================================================
-- ENUM/TYPE NOTES
-- selection_type will be stored as TEXT for compatibility (single|multiple|quantity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS modifier_groups (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  description TEXT,
  selection_type TEXT NOT NULL DEFAULT 'single',
  min_selections INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Safety for partially-created tables
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS selection_type TEXT NOT NULL DEFAULT 'single';
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS min_selections INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS max_selections INTEGER;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_modifier_groups_restaurant_name_unique
  ON modifier_groups(restaurant_id, name)
  WHERE deleted_at IS NULL;

-- Deduplicate existing modifier_groups before enforcing unique index
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY restaurant_id, name ORDER BY created_at DESC, id DESC) AS rn
  FROM modifier_groups
  WHERE deleted_at IS NULL
)
DELETE FROM modifier_groups
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_restaurant
  ON modifier_groups(restaurant_id);

-- If you want options reusable across groups, add a separate join table.
-- For now, options belong to a single group.
CREATE TABLE IF NOT EXISTS modifier_options (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  price_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Safety for partially-created tables
ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS price_delta DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE modifier_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_modifier_options_group_name_unique
  ON modifier_options(group_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_modifier_options_group
  ON modifier_options(group_id);

CREATE INDEX IF NOT EXISTS idx_modifier_options_restaurant
  ON modifier_options(restaurant_id);

-- Join table to attach groups to items (per-item overrides)
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES menu_items(id),
  group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  override_min INTEGER,
  override_max INTEGER,
  override_required BOOLEAN,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Safety for partially-created tables
ALTER TABLE item_modifier_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE item_modifier_groups ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_modifier_groups ADD COLUMN IF NOT EXISTS override_min INTEGER;
ALTER TABLE item_modifier_groups ADD COLUMN IF NOT EXISTS override_max INTEGER;
ALTER TABLE item_modifier_groups ADD COLUMN IF NOT EXISTS override_required BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_modifier_groups_unique
  ON item_modifier_groups(item_id, group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_modifier_groups_item
  ON item_modifier_groups(item_id);

CREATE INDEX IF NOT EXISTS idx_item_modifier_groups_group
  ON item_modifier_groups(group_id);

-- Order items already have modifiers_json (see migration 011). No schema change needed here,
-- but ensure application code stores snapshots of modifier selections.
