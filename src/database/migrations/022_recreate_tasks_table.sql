-- Migration 022: Recreate Tasks Table with Correct Schema (PostgreSQL)
-- Date: 2026-01-26
-- Purpose: Drop and recreate tasks table with proper completed column
-- WARNING: This will delete all existing task data

DO $$
BEGIN
    -- Drop the tasks table and recreate it with the correct schema
    DROP TABLE IF EXISTS tasks CASCADE;

    CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        type TEXT DEFAULT 'one_time',
        assigned_to TEXT,
        due_date TIMESTAMP,
        completed TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tasks_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
        CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    -- Create indexes for performance
    CREATE INDEX idx_tasks_restaurant ON tasks(restaurant_id);
    CREATE INDEX idx_tasks_status ON tasks(status);
    CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

    RAISE NOTICE 'Tasks table recreated with completed column';
END $$;
