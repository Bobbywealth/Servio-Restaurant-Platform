-- Migration 016: Modifier groups and options
-- Date: 2026-01-23
-- Adds reusable modifier groups, options, and item attachments.

-- ============================================================================
-- ENUM/TYPE NOTES
-- selection_type will be stored as TEXT for compatibility (single|multiple|quantity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS modifier_groups (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
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

-- Safety for partially-created tables: ensure all columns exist
DO $$
BEGIN
  -- Add restaurant_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
  END IF;
  
  -- Add other columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN deleted_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'selection_type'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN selection_type TEXT NOT NULL DEFAULT 'single';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'min_selections'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN min_selections INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'max_selections'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN max_selections INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'is_required'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'description'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN description TEXT;
  END IF;
END $$;

-- Backfill restaurant_id for legacy modifier_groups using menu_item_modifiers + menu_items
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_modifiers')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_item_modifiers' AND column_name = 'modifier_group_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'restaurant_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id')
  THEN
    UPDATE modifier_groups mg
    SET restaurant_id = mi.restaurant_id
    FROM menu_item_modifiers mim
    JOIN menu_items mi ON mi.id = mim.menu_item_id
    WHERE mim.modifier_group_id = mg.id
      AND mg.restaurant_id IS NULL;
  END IF;
END $$;

-- Create index on restaurant_id only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'modifier_groups' AND indexname = 'idx_modifier_groups_restaurant'
    ) THEN
      CREATE INDEX idx_modifier_groups_restaurant ON modifier_groups(restaurant_id);
    END IF;
  END IF;
END $$;

-- modifier_options table
CREATE TABLE IF NOT EXISTS modifier_options (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  group_id TEXT REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  price_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Safety for partially-created modifier_options table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN deleted_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'price_delta'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN price_delta DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
  END IF;
  
  -- Handle column rename: modifier_group_id -> group_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'modifier_group_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE modifier_options RENAME COLUMN modifier_group_id TO group_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE modifier_options ADD COLUMN group_id TEXT REFERENCES modifier_groups(id);
  END IF;
END $$;

-- Handle menu_item_modifiers column rename: modifier_group_id -> group_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_modifiers') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'menu_item_modifiers' AND column_name = 'modifier_group_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'menu_item_modifiers' AND column_name = 'group_id'
    ) THEN
      ALTER TABLE menu_item_modifiers RENAME COLUMN modifier_group_id TO group_id;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'menu_item_modifiers' AND column_name = 'group_id'
    ) THEN
      ALTER TABLE menu_item_modifiers ADD COLUMN group_id TEXT;
    END IF;
  END IF;
END $$;

-- Safely dedupe groups and dependent options (only if restaurant_id exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'group_id'
  ) THEN
    DELETE FROM modifier_options
    WHERE group_id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY restaurant_id, name ORDER BY created_at DESC, id DESC) AS rn
        FROM modifier_groups
        WHERE deleted_at IS NULL
      ) dupes WHERE rn > 1
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_modifiers'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_item_modifiers' AND column_name = 'group_id'
  ) THEN
    DELETE FROM menu_item_modifiers
    WHERE group_id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY restaurant_id, name ORDER BY created_at DESC, id DESC) AS rn
        FROM modifier_groups
        WHERE deleted_at IS NULL
      ) dupes WHERE rn > 1
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) THEN
    DELETE FROM modifier_groups
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY restaurant_id, name ORDER BY created_at DESC, id DESC) AS rn
        FROM modifier_groups
        WHERE deleted_at IS NULL
      ) dupes WHERE rn > 1
    );
  END IF;
END $$;

-- Create indexes only if required columns exist
DO $$
BEGIN
  -- idx_modifier_groups_restaurant_name_unique
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'restaurant_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'deleted_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'modifier_groups' AND indexname = 'idx_modifier_groups_restaurant_name_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_modifier_groups_restaurant_name_unique
        ON modifier_groups(restaurant_id, name)
        WHERE deleted_at IS NULL;
    END IF;
  END IF;
  
  -- idx_modifier_options_group_name_unique
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'group_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'deleted_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'modifier_options' AND indexname = 'idx_modifier_options_group_name_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_modifier_options_group_name_unique
        ON modifier_options(group_id, name)
        WHERE deleted_at IS NULL;
    END IF;
  END IF;
  
  -- idx_modifier_options_group
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'group_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'modifier_options' AND indexname = 'idx_modifier_options_group'
    ) THEN
      CREATE INDEX idx_modifier_options_group ON modifier_options(group_id);
    END IF;
  END IF;
  
  -- idx_modifier_options_restaurant
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_options' AND column_name = 'restaurant_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'modifier_options' AND indexname = 'idx_modifier_options_restaurant'
    ) THEN
      CREATE INDEX idx_modifier_options_restaurant ON modifier_options(restaurant_id);
    END IF;
  END IF;
END $$;

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

-- Safety for partially-created item_modifier_groups table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE item_modifier_groups ADD COLUMN deleted_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE item_modifier_groups ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'override_min'
  ) THEN
    ALTER TABLE item_modifier_groups ADD COLUMN override_min INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'override_max'
  ) THEN
    ALTER TABLE item_modifier_groups ADD COLUMN override_max INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'override_required'
  ) THEN
    ALTER TABLE item_modifier_groups ADD COLUMN override_required BOOLEAN;
  END IF;
END $$;

-- Create item_modifier_groups indexes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'item_modifier_groups' AND column_name = 'deleted_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'item_modifier_groups' AND indexname = 'idx_item_modifier_groups_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_item_modifier_groups_unique
        ON item_modifier_groups(item_id, group_id)
        WHERE deleted_at IS NULL;
    END IF;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'item_modifier_groups' AND indexname = 'idx_item_modifier_groups_item'
  ) THEN
    CREATE INDEX idx_item_modifier_groups_item ON item_modifier_groups(item_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'item_modifier_groups' AND indexname = 'idx_item_modifier_groups_group'
  ) THEN
    CREATE INDEX idx_item_modifier_groups_group ON item_modifier_groups(group_id);
  END IF;
END $$;

-- Order items already have modifiers_json (see migration 011). No schema change needed here,
-- but ensure application code stores snapshots of modifier selections.
