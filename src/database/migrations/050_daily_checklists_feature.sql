-- Migration 050: Daily checklist templates and instances
-- Date: 2026-03-31

CREATE TABLE IF NOT EXISTS checklist_templates (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  recurrence VARCHAR(20) NOT NULL DEFAULT 'daily',
  recurrence_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,0],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_sections (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  emoji VARCHAR(10),
  sort_order INTEGER NOT NULL DEFAULT 0,
  assigned_to TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES checklist_sections(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS checklist_instances (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, date)
);

CREATE TABLE IF NOT EXISTS checklist_completions (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  completed_by TEXT REFERENCES users(id),
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(instance_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_restaurant ON checklist_templates(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_template ON checklist_sections(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_checklist_items_section ON checklist_items(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_lookup ON checklist_instances(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_checklist_completions_instance ON checklist_completions(instance_id);

DO $$
DECLARE
  target_restaurant_id TEXT;
  target_owner_id TEXT;
  template_id TEXT := 'checklist_template_sashey_daily_operations';
BEGIN
  SELECT id INTO target_restaurant_id
  FROM restaurants
  WHERE id = 'demo-restaurant-1'
     OR LOWER(name) LIKE '%sashey%'
  ORDER BY CASE WHEN id = 'demo-restaurant-1' THEN 0 ELSE 1 END
  LIMIT 1;

  IF target_restaurant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO target_owner_id
  FROM users
  WHERE restaurant_id = target_restaurant_id
    AND (
      LOWER(name) LIKE '%sashey%'
      OR LOWER(role) = 'owner'
    )
  LIMIT 1;

  INSERT INTO checklist_templates (id, restaurant_id, name, description, recurrence, recurrence_days, is_active)
  VALUES (
    template_id,
    target_restaurant_id,
    'Sashey''s Kitchen - Daily Operations',
    'Recurring daily opening, service, and closing procedures.',
    'daily',
    ARRAY[1,2,3,4,5,6,0],
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO checklist_sections (id, template_id, name, emoji, sort_order, assigned_to)
  VALUES
    ('checklist_section_kitchen_prep', template_id, 'Kitchen Preparation', '🛠️', 0, target_owner_id),
    ('checklist_section_store_settings', template_id, 'Store Settings', '🏪', 1, target_owner_id),
    ('checklist_section_steam_setup', template_id, 'Steam Table Setup', '🍽️', 2, target_owner_id),
    ('checklist_section_steam_settings', template_id, 'Steam Table Settings', '🌡️', 3, target_owner_id),
    ('checklist_section_closing', template_id, 'Closing Checklist', '🔒', 4, target_owner_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO checklist_items (id, section_id, text, sort_order, is_critical)
  VALUES
    ('checklist_item_1_1', 'checklist_section_kitchen_prep', 'Take out all meat, rice, and gravy from fridge', 0, FALSE),
    ('checklist_item_1_2', 'checklist_section_kitchen_prep', 'Bring food to the steam tables', 1, FALSE),
    ('checklist_item_1_3', 'checklist_section_kitchen_prep', 'Remove rice and peas from pot and bring to steam table', 2, FALSE),
    ('checklist_item_1_4', 'checklist_section_kitchen_prep', 'Debone the oxtail patty', 3, FALSE),
    ('checklist_item_1_5', 'checklist_section_kitchen_prep', 'Make at least 10 oxtail patties and put in warmer', 4, FALSE),
    ('checklist_item_1_6', 'checklist_section_kitchen_prep', 'Help organize the kitchen tables', 5, FALSE),
    ('checklist_item_1_7', 'checklist_section_kitchen_prep', 'Put pots that need washing in the sink', 6, FALSE),
    ('checklist_item_1_8', 'checklist_section_kitchen_prep', 'Warm up meat and put in containers', 7, FALSE),
    ('checklist_item_1_9', 'checklist_section_kitchen_prep', 'Put patties in oven', 8, FALSE),
    ('checklist_item_1_10', 'checklist_section_kitchen_prep', 'Get all meat and rice from previous night out of the fridge', 9, FALSE),

    ('checklist_item_2_1', 'checklist_section_store_settings', 'Ensure each table has something on it', 0, FALSE),
    ('checklist_item_2_2', 'checklist_section_store_settings', 'Set front and back warmers to desired temperature', 1, FALSE),
    ('checklist_item_2_3', 'checklist_section_store_settings', 'Turn steam table temperature to appropriate setting', 2, FALSE),
    ('checklist_item_2_4', 'checklist_section_store_settings', 'Load steam table with food from the back', 3, FALSE),
    ('checklist_item_2_5', 'checklist_section_store_settings', 'Fill front and back warmers to the top with water', 4, FALSE),
    ('checklist_item_2_6', 'checklist_section_store_settings', 'Plug in the open sign', 5, FALSE),
    ('checklist_item_2_7', 'checklist_section_store_settings', 'Make sure Uber Eats app is on the tablets', 6, FALSE),
    ('checklist_item_2_8', 'checklist_section_store_settings', 'Make sure Grubhub app is on the tablets', 7, FALSE),
    ('checklist_item_2_9', 'checklist_section_store_settings', 'Make sure DoorDash app is on the tablets', 8, FALSE),
    ('checklist_item_2_10', 'checklist_section_store_settings', 'Make sure phone app is on the tablets', 9, FALSE),
    ('checklist_item_2_11', 'checklist_section_store_settings', 'Put a music app on any desk', 10, FALSE),
    ('checklist_item_2_12', 'checklist_section_store_settings', 'Turn on all TVs in the front', 11, FALSE),
    ('checklist_item_2_13', 'checklist_section_store_settings', 'Check if there is water in all steam tables', 12, FALSE),
    ('checklist_item_2_14', 'checklist_section_store_settings', 'Check warmers are warm and have water', 13, FALSE),

    ('checklist_item_3_1', 'checklist_section_steam_setup', 'Proteins: Stew Chicken, Jerk Pork, Curry Goat, Stew Beef, Honey Jerk Wings, Jerk Chicken, Fried Dumplings, Oxtails, Curry Chicken', 0, TRUE),
    ('checklist_item_3_2', 'checklist_section_steam_setup', 'Sides: Mac & Cheese, Steam Cabbage, Boiled Food, Rice & Peas, White Rice', 1, TRUE),
    ('checklist_item_3_3', 'checklist_section_steam_setup', 'Sauces: Honey Jerk Gravy, Fried Chicken Gravy, Jerk Gravy', 2, TRUE),

    ('checklist_item_4_1', 'checklist_section_steam_settings', 'Set temperature for all steam tables to 165°F', 0, FALSE),
    ('checklist_item_4_2', 'checklist_section_steam_settings', 'Set steam table dial to 6.5', 1, FALSE),
    ('checklist_item_4_3', 'checklist_section_steam_settings', 'Set steam table #1 to 2', 2, FALSE),

    ('checklist_item_5_1', 'checklist_section_closing', 'Remove extra patties from warmer and turn it off', 0, FALSE),
    ('checklist_item_5_2', 'checklist_section_closing', 'Take out all garbage bags and replace with new ones', 1, FALSE),
    ('checklist_item_5_3', 'checklist_section_closing', 'Turn off all steam tables (turn knobs left until they stop)', 2, FALSE),
    ('checklist_item_5_4', 'checklist_section_closing', 'Turn off warmers (press button and empty them)', 3, FALSE),
    ('checklist_item_5_5', 'checklist_section_closing', 'Sweep the kitchen floor', 4, FALSE),
    ('checklist_item_5_6', 'checklist_section_closing', 'Clean the kitchen table', 5, FALSE)
  ON CONFLICT (id) DO NOTHING;
END $$;
