#!/usr/bin/env node

/**
 * Simple database initialization script
 * This runs the migrations to set up the database
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function initDatabase() {
  console.log('🚀 Initializing database...');

  // Create data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
  }

  // Open database
  const dbPath = path.join(dataDir, 'servio.db');
  console.log(`📂 Database path: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log('✅ Database opened');

  // Create migrations table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Migrations table ready');

  // Get applied migrations
  const appliedRows = await db.all('SELECT name FROM _migrations');
  const appliedMigrations = new Set(appliedRows.map(r => r.name));

  // Read migration files
  const migrationsDir = path.join(__dirname, 'src/database/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📋 Found ${files.length} migration files`);

  // Run migrations
  for (const file of files) {
    if (appliedMigrations.has(file)) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`🔄 Running migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, 'utf8');

    // SQLite compatibility fixes
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '-- Extension skipped for SQLite');
    sql = sql.replace(/DEFAULT NOW\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
    sql = sql.replace(/TIMESTAMPTZ/gi, 'TEXT');

    try {
      // Split and run statements
      const statements = sql
        .replace(/--.*$/gm, '') // Remove comments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await db.exec(statement);
        } catch (err) {
          // Ignore "duplicate column" errors (idempotent migrations)
          if (!err.message.includes('duplicate column name') &&
              !err.message.includes('already exists')) {
            throw err;
          }
        }
      }

      // Mark as applied
      await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
      console.log(`✅ Migration ${file} completed`);

    } catch (err) {
      console.error(`❌ Error running migration ${file}:`, err.message);
      process.exit(1);
    }
  }

  await db.close();
  console.log('✅ Database initialized successfully!');
  console.log(`📊 Database location: ${dbPath}`);
}

initDatabase().catch(err => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
