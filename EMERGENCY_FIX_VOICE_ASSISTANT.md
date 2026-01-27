# Emergency Fix for Voice Assistant Database Error

## Problem
The voice assistant is failing with: `error: column "completed" does not exist`

This is blocking all voice/text commands to the assistant.

## Root Cause
Migration 023 (`023_verify_and_fix_completed_column.sql`) hasn't been applied to the production database on Render. The migration system runs on backend startup, but the service needs to be restarted to pick up new migrations.

## Solutions (in order of preference)

### Option 1: Restart Backend on Render (RECOMMENDED)
1. Go to https://dashboard.render.com
2. Find your `servio-backend` service
3. Click "Restart" or "Manual Deploy" → "Deploy latest commit"
4. Wait for deployment to complete (check logs for "Migration 023 applied successfully")
5. Test the voice assistant again

**Expected log output after restart:**
```
🔍 Checking X migrations in...
📄 Migration files found: ..., 023_verify_and_fix_completed_column.sql, ...
🚀 Running migration: 023_verify_and_fix_completed_column.sql
✅ Migration 023_verify_and_fix_completed_column.sql applied successfully
🏁 All migrations verified/applied
```

### Option 2: Manual Database Fix (Faster)
If you can't restart the backend immediately, run this SQL directly on your PostgreSQL database:

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed TEXT;
```

**How to run:**
1. Go to https://dashboard.render.com → Your Database → "PSQL" button
2. Or use a PostgreSQL GUI tool (TablePlus, DBeaver, pgAdmin)
3. Run the SQL command above
4. Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks';`

### Option 3: Force Migration on Next Startup
I've created an additional migration `024_EMERGENCY_HOTFIX_COMPLETED_COLUMN.sql` that will run on next backend restart.

## After Fix
Once the migration is applied, the assistant should work. Test with:
- "What is the store status?"
- "Show me pending tasks"
- Any voice command

## Other Console Errors (Not Critical)
The console also shows:
- **503 /api/auth/me** - Backend is recovering from restart
- **CORS error** - Expected during backend restart
- **WebSocket errors** - Reconnecting after backend restart
- **404 /api/settings** - Endpoint doesn't exist (not critical)

These are temporary and will resolve once the backend is stable.

## Prevention
To prevent this in the future:
1. Always restart the backend after deploying new migrations
2. Monitor the startup logs for migration status
3. Test in staging before production

## Rollback (If Needed)
If you need to rollback the migration:
```sql
ALTER TABLE tasks DROP COLUMN IF EXISTS completed;
```

But note: This may break other features that expect the column.
