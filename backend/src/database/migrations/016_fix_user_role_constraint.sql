-- Migration to fix users role check constraint
-- Ensures platform-admin role is valid in the database

DO $$
BEGIN
    -- Drop the existing constraint if it exists
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    
    -- Add the updated constraint including platform-admin
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('staff', 'manager', 'owner', 'admin', 'platform-admin'));
END $$;
