import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

type DatabaseDialect = 'sqlite' | 'postgres';

export interface RunResult {
  changes: number;
}

export interface DbClient {
  dialect: DatabaseDialect;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
}

function convertQMarksToDollars(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

function asNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number(value ?? 0);
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const prev = sql[i - 1];

    if (char === "'" && prev !== '\\' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }
    if (char === '"' && prev !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      statements.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

function normalizeIdentifier(value: string): string {
  return value.replace(/^[`"\[]/, '').replace(/[`\]"]$/, '');
}

function isIgnorableSqliteError(error: any, statement: string): boolean {
  const message = String(error?.message || error || '');
  const normalized = statement.trim().toUpperCase();

  if (message.includes('duplicate column name')) return true;
  if (message.includes('already exists')) return true;

  if (message.includes('no such column') || message.includes('no such table')) {
    return normalized.startsWith('CREATE INDEX') || normalized.startsWith('CREATE UNIQUE INDEX');
  }

  return false;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private _dialect: DatabaseDialect | null = null;
  private sqliteDb: any | null = null;
  private pgPool: Pool | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public static async initialize(): Promise<void> {
    const service = DatabaseService.getInstance();
    await service.connect();
    await service.runMigrations();
    await service.seedData();
  }

  public static async close(): Promise<void> {
    const service = DatabaseService.getInstance();
    if (service.sqliteDb) {
      await service.sqliteDb.close();
      service.sqliteDb = null;
    }
    if (service.pgPool) {
      await service.pgPool.end();
      service.pgPool = null;
    }
    service._dialect = null;
    logger.info('Database connection closed');
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDatabase();
    const isPg = db.dialect === 'postgres';
    
    // Try to find migrations directory in multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '../database/migrations'),        // After build: dist/database/migrations
      path.join(__dirname, '../../src/database/migrations'), // Development: src/database/migrations
      path.join(process.cwd(), 'src/database/migrations'),   // From project root
      path.join(process.cwd(), 'backend/src/database/migrations') // From workspace root
    ];
    
    let migrationsDir = '';
    logger.info(`📍 Current working directory: ${process.cwd()}`);
    logger.info(`📍 __dirname: ${__dirname}`);
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        migrationsDir = possiblePath;
        logger.info(`✅ Found migrations directory at ${migrationsDir}`);
        break;
      } else {
        logger.info(`❌ Not found: ${possiblePath}`);
      }
    }
    
    if (!migrationsDir) {
      logger.error(`🚨 Could not find migrations directory anywhere. Database setup will be skipped.`);
      logger.error(`Tried paths: ${possiblePaths.join(', ')}`);
      return;
    }

    // 1. Ensure migrations table exists
    if (isPg) {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } else {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // 2. Get applied migrations
    const appliedRows = await db.all<{ name: string }>('SELECT name FROM _migrations');
    const appliedMigrations = new Set(appliedRows.map(r => r.name));

    // 3. Read and sort migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`🔍 Checking ${files.length} migrations in ${migrationsDir}...`);
    logger.info(`📄 Migration files found: ${files.join(', ')}`);

    for (const file of files) {
      if (appliedMigrations.has(file)) continue;

      logger.info(`🚀 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      let sql = fs.readFileSync(filePath, 'utf8');

      // SQLite compatibility fixes
      if (!isPg) {
        // Remove PG-only extension creation
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '-- Extension skipped for SQLite');
        // Standardize NOW() to CURRENT_TIMESTAMP for SQLite
        sql = sql.replace(/DEFAULT NOW\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
        sql = sql.replace(/TIMESTAMPTZ/gi, 'TEXT');
      }

      try {
        // Split by semicolon but be careful with functions/triggers if any
        // For simplicity, we run the whole block or split by common patterns
        // Some migrations might have multiple statements
        
        if (isPg) {
          // PG can handle multiple statements in one query often, or we use a transaction
          await db.exec('BEGIN');
          try {
            await db.exec(sql);
            await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
            await db.exec('COMMIT');
          } catch (err) {
            await db.exec('ROLLBACK');
            throw err;
          }
        } else {
      // SQLite: run statements one by one to allow idempotent ALTERs
      const cleanedSql = stripSqlComments(sql);
      const statements = splitSqlStatements(cleanedSql);
      await db.exec('BEGIN TRANSACTION');
      try {
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (!trimmed) continue;

          const alterMatch = trimmed.match(/^ALTER TABLE\s+([^\s]+)\s+ADD COLUMN\s+([^\s]+)/i);
          if (alterMatch) {
            const tableName = normalizeIdentifier(alterMatch[1]);
            const columnName = normalizeIdentifier(alterMatch[2]);
            const columns = await db.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
            if (columns.some((col) => col.name === columnName)) {
              continue;
            }
          }

          try {
            await db.exec(trimmed);
          } catch (err) {
            if (isIgnorableSqliteError(err, trimmed)) {
              logger.warn(`SQLite migration warning (skipped): ${trimmed}`);
              continue;
            }
            throw err;
          }
        }

        await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
        }
        logger.info(`✅ Migration ${file} applied successfully`);
      } catch (error: any) {
        logger.error(`❌ Migration ${file} failed:`, error.message);
        // We don't want to continue if a migration fails
        throw error;
      }
    }

    logger.info('🏁 All migrations verified/applied');
  }

  private async connect(): Promise<void> {
    try {
      const databaseUrl = process.env.DATABASE_URL;

      if (databaseUrl && databaseUrl.startsWith('postgres')) {
        this._dialect = 'postgres';

        const ssl =
          process.env.DATABASE_SSL === 'true'
            ? { rejectUnauthorized: false }
            : undefined;

        // OPTIMIZED CONNECTION POOL CONFIGURATION
        this.pgPool = new Pool({
          connectionString: databaseUrl,
          ssl,
          // CONNECTION POOL OPTIMIZATION
          max: 20,                    // Maximum pool size
          min: 2,                     // Minimum connections
          idleTimeoutMillis: 30000,   // Close idle connections after 30s
          connectionTimeoutMillis: 5000, // Connection timeout
          // PERFORMANCE TUNING
          query_timeout: 10000,       // 10s query timeout
          statement_timeout: 15000,   // 15s statement timeout
          idle_in_transaction_session_timeout: 10000 // 10s idle transaction timeout
        });

        // sanity query
        await this.pgPool.query('SELECT 1 as ok');

        logger.info('Connected to PostgreSQL database via DATABASE_URL');
        return;
      }

      // Default: SQLite (local/dev)
      this._dialect = 'sqlite';

      const dbDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const dbPath = path.join(dbDir, 'servio.db');
      this.sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      logger.info(`Connected to SQLite database at ${dbPath}`);

      // Apply optimizations
      await this.optimizeDatabase();
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  private async optimizeDatabase(): Promise<void> {
    const db = this.getDatabase();
    const isPg = db.dialect === 'postgres';

    if (isPg) {
      try {
        await db.exec('SET work_mem = "64MB"');
        await db.exec('SET maintenance_work_mem = "256MB"');
        await db.exec('SET effective_cache_size = "1GB"');
        await db.exec('SET random_page_cost = 1.1');
        await db.exec('SET checkpoint_completion_target = 0.9');
      } catch (error: any) {
        logger.warn('PostgreSQL performance tuning skipped:', error?.message || error);
      }
    } else {
      try {
        await db.exec('PRAGMA journal_mode = WAL');
        await db.exec('PRAGMA synchronous = NORMAL');
        await db.exec('PRAGMA cache_size = 10000');
        await db.exec('PRAGMA temp_store = MEMORY');
        await db.exec('PRAGMA mmap_size = 268435456'); // 256MB
        await db.exec('PRAGMA optimize');
      } catch (error: any) {
        logger.warn('SQLite optimization warning:', error?.message || error);
      }
    }
  }

  private async seedData(): Promise<void> {
    const db = this.getDatabase();

    logger.info('Ensuring demo users exist with valid credentials...');
    const restaurantId = 'demo-restaurant-1';
    
    // Create demo restaurant if it doesn't exist
    await db.run(
      `INSERT INTO restaurants (
        id, name, slug, settings, operating_hours, timezone, closed_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [
        restaurantId,
        'Demo Restaurant',
        'demo-restaurant',
        JSON.stringify({ currency: 'USD' }),
        JSON.stringify({
          tue: ['09:00', '21:00'],
          wed: ['09:00', '21:00'],
          thu: ['09:00', '21:00'],
          fri: ['09:00', '21:00'],
          sat: ['09:00', '21:00']
        }),
        'America/New_York',
        'We’re temporarily closed right now...'
      ]
    );

    // Sample users
    const users = [
      {
        id: 'user-1',
        restaurant_id: restaurantId,
        name: 'Demo Staff',
        email: 'staff@demo.servio',
        password: 'password',
        pin: '1111',
        role: 'staff',
        permissions: JSON.stringify(['orders.read', 'orders.update', 'inventory.read', 'inventory.adjust'])
      },
      {
        id: 'user-2',
        restaurant_id: restaurantId,
        name: 'Demo Manager',
        email: 'manager@demo.servio',
        password: 'password',
        pin: '2222',
        role: 'manager',
        permissions: JSON.stringify(['*'])
      }
    ];

    // Sample menu categories
    const categories = [
      { id: 'cat-1', restaurant_id: restaurantId, name: 'Entrees' },
      { id: 'cat-2', restaurant_id: restaurantId, name: 'Sides' }
    ];

    for (const cat of categories) {
      try {
        await db.run(
          `INSERT INTO menu_categories (id, restaurant_id, name)
           VALUES (?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             restaurant_id = excluded.restaurant_id,
             name = excluded.name`,
          [cat.id, cat.restaurant_id, cat.name]
        );
      } catch (err) {
        logger.warn('Demo menu category seed/update failed:', err);
      }
    }

    // Sample menu items
    const menuItems = [
      {
        id: 'item-1',
        restaurant_id: restaurantId,
        category_id: 'cat-1',
        name: 'Jerk Chicken Plate',
        description: 'Spicy jerk chicken with rice and peas',
        price: 15.99,
        tags: ['dinner']
      },
      {
        id: 'item-2',
        restaurant_id: restaurantId,
        category_id: 'cat-1',
        name: 'Curry Goat',
        description: 'Tender curry goat with rice',
        price: 18.99,
        tags: ['dinner']
      }
    ];

    // Sample inventory
    const inventory = [
      {
        id: 'inv-1',
        restaurant_id: restaurantId,
        name: 'Chicken (whole)',
        sku: 'CHICKEN-001',
        unit: 'pieces',
        on_hand_qty: 25,
        low_stock_threshold: 5
      }
    ];

    // Sample orders
    const orders = [
      {
        id: 'order-1',
        restaurant_id: restaurantId,
        channel: 'website',
        status: 'NEW',
        total_amount: 15.99
      }
    ];

    // Insert sample data
    for (const user of users) {
      try {
        const passwordHash = bcrypt.hashSync(user.password, 10);
        await db.run(
          `INSERT INTO users (id, restaurant_id, name, email, password_hash, pin, role, permissions, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
           ON CONFLICT (email) DO UPDATE SET
             restaurant_id = excluded.restaurant_id,
             name = excluded.name,
             password_hash = excluded.password_hash,
             pin = excluded.pin,
             role = excluded.role,
             permissions = excluded.permissions,
             is_active = TRUE`,
          [user.id, user.restaurant_id, user.name, user.email, passwordHash, user.pin, user.role, user.permissions]
        );
      } catch (err) {
        logger.warn('Demo user seed/update failed:', err);
      }
    }

    for (const item of menuItems) {
      try {
        await db.run(
          `INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, price, tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.restaurant_id,
            item.category_id,
            item.name,
            item.description,
            item.price,
            JSON.stringify(item.tags || [])
          ]
        );
      } catch (err) {}
    }

    for (const item of inventory) {
      try {
        await db.run(
          'INSERT INTO inventory_items (id, restaurant_id, name, sku, unit, on_hand_qty, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [item.id, item.restaurant_id, item.name, item.sku, item.unit, item.on_hand_qty, item.low_stock_threshold]
        );
      } catch (err) {}
    }

    for (const order of orders) {
      try {
        await db.run(
          'INSERT INTO orders (id, restaurant_id, channel, status, total_amount) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [order.id, order.restaurant_id, order.channel, order.status, order.total_amount]
        );
      } catch (err) {}
    }

    logger.info('Database seeded with sample data');
  }

  public getDialect(): DatabaseDialect {
    if (!this._dialect) throw new Error('Database not connected');
    return this._dialect;
  }

  public getDatabase(): DbClient {
    if (!this._dialect) throw new Error('Database not connected');

    if (this._dialect === 'sqlite') {
      if (!this.sqliteDb) throw new Error('SQLite database not connected');

      const sqliteDb = this.sqliteDb;
      return {
        dialect: 'sqlite',
        all: (sql: string, params: any[] = []) => sqliteDb.all(sql, params),
        get: (sql: string, params: any[] = []) => sqliteDb.get(sql, params),
        run: async (sql: string, params: any[] = []) => {
          const result = await sqliteDb.run(sql, params);
          return { changes: asNumber(result?.changes) };
        },
        exec: (sql: string) => sqliteDb.exec(sql)
      };
    }

    if (!this.pgPool) throw new Error('PostgreSQL pool not connected');
    const pool = this.pgPool;

    const query = async (sql: string, params: any[] = []): Promise<QueryResult<any>> => {
      const pgSql = convertQMarksToDollars(sql);
      return pool.query(pgSql, params);
    };

    return {
      dialect: 'postgres',
      all: async (sql: string, params: any[] = []) => {
        const res = await query(sql, params);
        return res.rows;
      },
      get: async (sql: string, params: any[] = []) => {
        const res = await query(sql, params);
        return res.rows[0];
      },
      run: async (sql: string, params: any[] = []) => {
        const res = await query(sql, params);
        return { changes: asNumber(res.rowCount) };
      },
      exec: async (sql: string) => {
        await pool.query(sql);
      }
    };
  }

  // Helper method to log audit events
  public async logAudit(
    restaurantId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: any = {}
  ): Promise<void> {
    const db = this.getDatabase();

    const auditId = uuidv4();

    await db.run(
      'INSERT INTO audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [auditId, restaurantId, userId, action, entityType, entityId, JSON.stringify(details)]
    );
  }
}

export default DatabaseService;