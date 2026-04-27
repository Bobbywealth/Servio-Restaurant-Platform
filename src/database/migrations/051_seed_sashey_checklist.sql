-- Seed Data: Sashey's Kitchen Daily Operations Checklist
-- Migration: 011_seed_sashey_checklist.sql

-- Insert Sashey's Kitchen template
INSERT INTO checklist_templates (restaurant_id, name, description, recurrence, recurrence_days, is_active)
VALUES (
  (SELECT id FROM restaurants WHERE slug = 'demo-restaurant' LIMIT 1),
  'Sashey''s Kitchen - Daily Operations',
  'Daily kitchen operations and preparation checklist',
  'daily',
  '{1,2,3,4,5,6,0}', -- All days
  true
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the template ID for section references
DO $$
DECLARE
  template_id_var INTEGER;
  section1_id INTEGER;
  section2_id INTEGER;
  section3_id INTEGER;
  section4_id INTEGER;
  section5_id INTEGER;
BEGIN
  SELECT id INTO template_id_var FROM checklist_templates WHERE name = 'Sashey''s Kitchen - Daily Operations' LIMIT 1;
  
  IF template_id_var IS NOT NULL THEN
    -- Section 1: Kitchen Preparation
    INSERT INTO checklist_sections (template_id, name, emoji, sort_order)
    VALUES (template_id_var, 'Kitchen Preparation', '🛠️', 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO section1_id;
    
    -- Section 2: Store Settings
    INSERT INTO checklist_sections (template_id, name, emoji, sort_order)
    VALUES (template_id_var, 'Store Settings', '🏪', 2)
    ON CONFLICT DO NOTHING
    RETURNING id INTO section2_id;
    
    -- Section 3: Steam Table Setup (Critical)
    INSERT INTO checklist_sections (template_id, name, emoji, sort_order)
    VALUES (template_id_var, 'Steam Table Setup', '🍽️', 3)
    ON CONFLICT DO NOTHING
    RETURNING id INTO section3_id;
    
    -- Section 4: Steam Table Settings
    INSERT INTO checklist_sections (template_id, name, emoji, sort_order)
    VALUES (template_id_var, 'Steam Table Settings', '🌡️', 4)
    ON CONFLICT DO NOTHING
    RETURNING id INTO section4_id;
    
    -- Section 5: Closing Checklist
    INSERT INTO checklist_sections (template_id, name, emoji, sort_order)
    VALUES (template_id_var, 'Closing Checklist', '🔒', 5)
    ON CONFLICT DO NOTHING
    RETURNING id INTO section5_id;
    
    -- Items for Section 1: Kitchen Preparation
    INSERT INTO checklist_items (section_id, text, sort_order, is_critical) VALUES
    (section1_id, 'Take out all meat, rice, and gravy from fridge', 1, false),
    (section1_id, 'Bring food to the steam tables', 2, false),
    (section1_id, 'Remove rice and peas from pot and bring to steam table', 3, false),
    (section1_id, 'Debone the oxtail patty', 4, false),
    (section1_id, 'Make at least 10 oxtail patties and put in warmer', 5, false),
    (section1_id, 'Help organize the kitchen tables', 6, false),
    (section1_id, 'Put pots that need washing in the sink', 7, false),
    (section1_id, 'Warm up meat and put in containers', 8, false),
    (section1_id, 'Put patties in oven', 9, false),
    (section1_id, 'Get all meat and rice from previous night out of the fridge', 10, false);
    
    -- Items for Section 2: Store Settings
    INSERT INTO checklist_items (section_id, text, sort_order, is_critical) VALUES
    (section2_id, 'Ensure each table has something on it', 1, false),
    (section2_id, 'Set front and back warmers to desired temperature', 2, false),
    (section2_id, 'Turn steam table temperature to appropriate setting', 3, false),
    (section2_id, 'Load steam table with food from the back', 4, false),
    (section2_id, 'Fill front and back warmers to the top with water', 5, false),
    (section2_id, 'Plug in the open sign', 6, false),
    (section2_id, 'Make sure Uber Eats app is on the tablets', 7, false),
    (section2_id, 'Make sure Grubhub app is on the tablets', 8, false),
    (section2_id, 'Make sure DoorDash app is on the tablets', 9, false),
    (section2_id, 'Make sure phone app is on the tablets', 10, false),
    (section2_id, 'Put a music app on any desk', 11, false),
    (section2_id, 'Turn on all TVs in the front', 12, false),
    (section2_id, 'Check if there is water in all steam tables', 13, false),
    (section2_id, 'Check warmers are warm and have water', 14, false);
    
    -- Items for Section 3: Steam Table Setup (All Critical)
    INSERT INTO checklist_items (section_id, text, sort_order, is_critical) VALUES
    (section3_id, 'Stew Chicken', 1, true),
    (section3_id, 'Jerk Pork', 2, true),
    (section3_id, 'Curry Goat', 3, true),
    (section3_id, 'Stew Beef', 4, true),
    (section3_id, 'Honey Jerk Wings', 5, true),
    (section3_id, 'Jerk Chicken', 6, true),
    (section3_id, 'Fried Dumplings', 7, true),
    (section3_id, 'Oxtails', 8, true),
    (section3_id, 'Curry Chicken', 9, true),
    (section3_id, 'Mac & Cheese', 10, true),
    (section3_id, 'Steam Cabbage', 11, true),
    (section3_id, 'Boiled Food', 12, true),
    (section3_id, 'Rice & Peas', 13, true),
    (section3_id, 'White Rice', 14, true),
    (section3_id, 'Honey Jerk Gravy', 15, true),
    (section3_id, 'Fried Chicken Gravy', 16, true),
    (section3_id, 'Jerk Gravy', 17, true);
    
    -- Items for Section 4: Steam Table Settings
    INSERT INTO checklist_items (section_id, text, sort_order, is_critical) VALUES
    (section4_id, 'Set temperature for all steam tables to 165°F', 1, false),
    (section4_id, 'Set steam table dial to 6.5', 2, false),
    (section4_id, 'Set steam table #1 to 2', 3, false);
    
    -- Items for Section 5: Closing Checklist
    INSERT INTO checklist_items (section_id, text, sort_order, is_critical) VALUES
    (section5_id, 'Remove extra patties from warmer and turn it off', 1, false),
    (section5_id, 'Take out all garbage bags and replace with new ones', 2, false),
    (section5_id, 'Turn off all steam tables (turn knobs left until they stop)', 3, false),
    (section5_id, 'Turn off warmers (press button and empty them)', 4, false),
    (section5_id, 'Sweep the kitchen floor', 5, false),
    (section5_id, 'Clean the kitchen table', 6, false);
  END IF;
END $$;
