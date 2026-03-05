-- AI Kitchen Assistant Recipe Database
-- Servio AI Kitchen Assistant Module

-- Recipe categories table
CREATE TABLE IF NOT EXISTS recipe_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    dish_name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES recipe_categories(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    batch_size INTEGER DEFAULT 1,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER DEFAULT 1,
    difficulty VARCHAR(50) DEFAULT 'medium',
    cuisine_type VARCHAR(100),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipe ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2),
    unit VARCHAR(50),
    notes TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipe steps table
CREATE TABLE IF NOT EXISTS recipe_steps (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    timer_seconds INTEGER,
    halfway_reminder BOOLEAN DEFAULT FALSE,
    temperature VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active cooking sessions (for multi-dish management)
CREATE TABLE IF NOT EXISTS cooking_sessions (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    current_step INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    scaled_servings INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Cooking timers table
CREATE TABLE IF NOT EXISTS cooking_timers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES cooking_sessions(id) ON DELETE CASCADE NOT NULL,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    step_number INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    remaining_seconds INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'running',
    halfway_completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Recipe scaling history
CREATE TABLE IF NOT EXISTS recipe_scaling_log (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    original_servings INTEGER NOT NULL,
    new_servings INTEGER NOT NULL,
    scaled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training mode sessions
CREATE TABLE IF NOT EXISTS training_sessions (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    current_step INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- AI Kitchen Assistant settings per company
CREATE TABLE IF NOT EXISTS ai_kitchen_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    voice_enabled BOOLEAN DEFAULT TRUE,
    continuous_listening BOOLEAN DEFAULT FALSE,
    push_to_talk BOOLEAN DEFAULT TRUE,
    default_difficulty VARCHAR(50) DEFAULT 'medium',
    training_mode_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_company ON recipes(company_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_company ON cooking_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_status ON cooking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cooking_timers_session ON cooking_timers(session_id);
CREATE INDEX IF NOT EXISTS idx_cooking_timers_status ON cooking_timers(status);

-- Insert default recipe categories
INSERT INTO recipe_categories (name, description, is_default) VALUES
    ('Appetizers', 'Starter dishes and appetizers', TRUE),
    ('Main Courses', 'Primary dishes and entrees', TRUE),
    ('Sides', 'Side dishes and accompaniments', TRUE),
    ('Desserts', 'Sweet treats and desserts', TRUE),
    ('Beverages', 'Drinks and beverages', TRUE)
ON CONFLICT DO NOTHING;

-- Insert sample recipes (will be customized by restaurants)
INSERT INTO recipes (dish_name, description, batch_size, prep_time_minutes, cook_time_minutes, servings, difficulty, cuisine_type) VALUES
    ('Jerk Chicken', 'Classic Jamaican jerk chicken with authentic spices', 20, 30, 45, 20, 'medium', 'Jamaican'),
    ('Rice and Peas', 'Traditional Jamaican rice and peas with coconut milk', 20, 15, 35, 20, 'easy', 'Jamaican'),
    ('Curry Goat', 'Aromatic curry goat with potatoes', 15, 45, 120, 15, 'medium', 'Jamaican'),
    ('Fried Rice', 'Classic fried rice with vegetables and eggs', 10, 15, 20, 10, 'easy', 'Asian'),
    ('Pad Thai', 'Traditional Thai stir-fried noodles', 10, 20, 15, 10, 'medium', 'Thai')
ON CONFLICT DO NOTHING;

-- Get the recipe IDs and insert sample ingredients
DO $$
DECLARE
    jerk_chicken_id INTEGER;
    rice_peas_id INTEGER;
    curry_goat_id INTEGER;
BEGIN
    SELECT id INTO jerk_chicken_id FROM recipes WHERE dish_name = 'Jerk Chicken' LIMIT 1;
    SELECT id INTO rice_peas_id FROM recipes WHERE dish_name = 'Rice and Peas' LIMIT 1;
    SELECT id INTO curry_goat_id FROM recipes WHERE dish_name = 'Curry Goat' LIMIT 1;

    -- Jerk Chicken ingredients
    IF jerk_chicken_id IS NOT NULL THEN
        INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, order_index) VALUES
            (jerk_chicken_id, 'Chicken pieces', 20, 'lbs', 1),
            (jerk_chicken_id, 'Salt', 3, 'tbsp', 2),
            (jerk_chicken_id, 'Garlic powder', 2, 'tbsp', 3),
            (jerk_chicken_id, 'Onion powder', 2, 'tbsp', 4),
            (jerk_chicken_id, 'Thyme', 1, 'tbsp', 5),
            (jerk_chicken_id, 'Allspice', 2, 'tbsp', 6),
            (jerk_chicken_id, 'Cayenne pepper', 1, 'tbsp', 7),
            (jerk_chicken_id, 'Paprika', 1, 'tbsp', 8),
            (jerk_chicken_id, 'Brown sugar', 2, 'tbsp', 9),
            (jerk_chicken_id, 'Soy sauce', 4, 'tbsp', 10),
            (jerk_chicken_id, 'Vegetable oil', 4, 'tbsp', 11),
            (jerk_chicken_id, 'Lime juice', 3, 'tbsp', 12)
        ON CONFLICT DO NOTHING;

        -- Jerk Chicken steps
        INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds, halfway_reminder) VALUES
            (jerk_chicken_id, 1, 'Wash and clean the chicken pieces thoroughly', NULL, FALSE),
            (jerk_chicken_id, 2, 'Pat dry with paper towels', NULL, FALSE),
            (jerk_chicken_id, 3, 'Mix all dry spices in a bowl: salt, garlic powder, onion powder, thyme, allspice, cayenne, paprika, and brown sugar', NULL, FALSE),
            (jerk_chicken_id, 4, 'Add soy sauce, vegetable oil, and lime juice to the spice mix to form a paste', NULL, FALSE),
            (jerk_chicken_id, 5, 'Coat chicken pieces evenly with the jerk marinade', NULL, FALSE),
            (jerk_chicken_id, 6, 'Marinate chicken in the refrigerator', 7200, FALSE),
            (jerk_chicken_id, 7, 'Preheat oven to 375°F (190°C)', NULL, FALSE),
            (jerk_chicken_id, 8, 'Place chicken on a baking sheet or grill', 1500, TRUE),
            (jerk_chicken_id, 9, 'Flip chicken halfway through cooking', NULL, FALSE),
            (jerk_chicken_id, 10, 'Check internal temperature reaches 165°F (74°C)', NULL, FALSE),
            (jerk_chicken_id, 11, 'Let rest for 5 minutes before serving', 300, FALSE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Rice and Peas ingredients
    IF rice_peas_id IS NOT NULL THEN
        INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, order_index) VALUES
            (rice_peas_id, 'Long grain rice', 10, 'cups', 1),
            (rice_peas_id, 'Coconut milk', 4, 'cups', 2),
            (rice_peas_id, 'Kidney beans', 4, 'cups', 3),
            (rice_peas_id, 'Scotch bonnet pepper', 2, 'whole', 4),
            (rice_peas_id, 'Garlic', 6, 'cloves', 5),
            (rice_peas_id, 'Thyme', 1, 'tbsp', 6),
            (rice_peas_id, 'Salt', 2, 'tbsp', 7),
            (rice_peas_id, 'Butter', 4, 'tbsp', 8)
        ON CONFLICT DO NOTHING;

        -- Rice and Peas steps
        INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds, halfway_reminder) VALUES
            (rice_peas_id, 1, 'Rinse rice thoroughly until water runs clear', NULL, FALSE),
            (rice_peas_id, 2, 'Drain kidney beans and set aside', NULL, FALSE),
            (rice_peas_id, 3, 'In a large pot, combine coconut milk, kidney beans, scotch bonnet peppers, garlic, thyme, and salt', NULL, FALSE),
            (rice_peas_id, 4, 'Bring to a boil over high heat', NULL, FALSE),
            (rice_peas_id, 5, 'Add rice and stir well', NULL, FALSE),
            (rice_peas_id, 6, 'Reduce heat to low, cover tightly', 1800, FALSE),
            (rice_peas_id, 7, 'Cook until rice is tender and liquid is absorbed', NULL, FALSE),
            (rice_peas_id, 8, 'Remove scotch bonnet peppers, add butter and fluff with fork', NULL, FALSE)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Curry Goat ingredients
    IF curry_goat_id IS NOT NULL THEN
        INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, order_index) VALUES
            (curry_goat_id, 'Goat meat', 15, 'lbs', 1),
            (curry_goat_id, 'Curry powder', 4, 'tbsp', 2),
            (curry_goat_id, 'Onions', 4, 'large', 3),
            (curry_goat_id, 'Garlic', 8, 'cloves', 4),
            (curry_goat_id, 'Ginger', 3, 'inches', 5),
            (curry_goat_id, 'Tomatoes', 4, 'large', 6),
            (curry_goat_id, 'Potatoes', 6, 'medium', 7),
            (curry_goat_id, 'Vegetable oil', 6, 'tbsp', 8),
            (curry_goat_id, 'Thyme', 2, 'tbsp', 9),
            (curry_goat_id, 'Salt', 2, 'tbsp', 10),
            (curry_goat_id, 'Scotch bonnet', 2, 'whole', 11),
            (curry_goat_id, 'Coconut milk', 2, 'cups', 12)
        ON CONFLICT DO NOTHING;

        -- Curry Goat steps
        INSERT INTO recipe_steps (recipe_id, step_number, instruction, timer_seconds, halfway_reminder) VALUES
            (curry_goat_id, 1, 'Cut goat meat into 2-inch cubes and wash thoroughly', NULL, FALSE),
            (curry_goat_id, 2, 'Pat meat dry with paper towels', NULL, FALSE),
            (curry_goat_id, 3, 'Season with curry powder, salt, and half the thyme', NULL, FALSE),
            (curry_goat_id, 4, 'Heat oil in a large pot over high heat', NULL, FALSE),
            (curry_goat_id, 5, 'Brown goat meat in batches, about 3-4 minutes per side', 1200, FALSE),
            (curry_goat_id, 6, 'Remove meat and sauté onions until softened', 300, FALSE),
            (curry_goat_id, 7, 'Add garlic, ginger, and tomatoes, cook for 2 minutes', 120, FALSE),
            (curry_goat_id, 8, 'Return meat to pot, add remaining thyme and scotch bonnet', NULL, FALSE),
            (curry_goat_id, 9, 'Add coconut milk and bring to a boil', NULL, FALSE),
            (curry_goat_id, 10, 'Reduce heat, cover and simmer until meat is tender', 5400, TRUE),
            (curry_goat_id, 11, 'Add potatoes and cook until tender', 1200, FALSE),
            (curry_goat_id, 12, 'Adjust seasoning and serve hot', NULL, FALSE)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
