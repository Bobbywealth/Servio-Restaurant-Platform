import path from 'path';
import fs from 'fs';
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface RunResult {
  changes: number;
}

export interface DbClient {
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

export class DatabaseService {
  private static instance: DatabaseService;
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
    if (service.pgPool) {
      await service.pgPool.end();
      service.pgPool = null;
    }
    logger.info('Database connection closed');
  }

  private async runMigrations(): Promise<void> {
    const db = this.getDatabase();

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

    // Ensure migrations table exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const appliedRows = await db.all<{ name: string }>('SELECT name FROM _migrations');
    const appliedMigrations = new Set(appliedRows.map(r => r.name));

    // Read and sort migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`🔍 Checking ${files.length} migrations in ${migrationsDir}...`);
    logger.info(`📄 Migration files found: ${files.join(', ')}`);

    // SQLite-only migrations to skip on PostgreSQL
    const sqliteOnlyMigrations = new Set([
      '009_fix_missing_columns.sql'
    ]);

    for (const file of files) {
      if (appliedMigrations.has(file)) continue;

      // Skip SQLite-only migrations
      if (sqliteOnlyMigrations.has(file)) {
        logger.info(`⏭️ Skipping SQLite-only migration: ${file}`);
        await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        continue;
      }

      logger.info(`🚀 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        // PostgreSQL can handle multiple statements in one query with transactions
        await db.exec('BEGIN');
        try {
          await db.exec(sql);
          await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
          await db.exec('COMMIT');
        } catch (err) {
          await db.exec('ROLLBACK');
          throw err;
        }
        logger.info(`✅ Migration ${file} applied successfully`);
      } catch (error: any) {
        logger.error(`❌ Migration ${file} failed:`, error.message);
        throw error;
      }
    }

    logger.info('🏁 All migrations verified/applied');
  }

  private async connect(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
      throw new Error('DATABASE_URL is required and must be a PostgreSQL connection string');
    }

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
      connectionTimeoutMillis: 10000, // Connection timeout (increased for Render cold starts)
      // PERFORMANCE TUNING
      query_timeout: 10000,       // 10s query timeout
      statement_timeout: 15000,   // 15s statement timeout
      idle_in_transaction_session_timeout: 10000 // 10s idle transaction timeout
    });

    // Retry logic for database connection (handles Render cold starts and temporary network issues)
    const maxRetries = 5;
    const retryDelayMs = 2000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // sanity query
        await this.pgPool.query('SELECT 1 as ok');
        logger.info('Connected to PostgreSQL database via DATABASE_URL');

        // Apply optimizations
        await this.optimizeDatabase();
        return; // Success - exit function
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const errorMessage = error?.message || String(error);
        
        if (isLastAttempt) {
          logger.error(`Failed to connect to database after ${maxRetries} attempts:`, errorMessage);
          throw error;
        }
        
        logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${errorMessage}. Retrying in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  private async optimizeDatabase(): Promise<void> {
    const db = this.getDatabase();

    try {
      await db.exec('SET work_mem = \'64MB\'');
      await db.exec('SET maintenance_work_mem = \'256MB\'');
      await db.exec('SET effective_cache_size = \'1GB\'');
      await db.exec('SET random_page_cost = 1.1');
      await db.exec('SET checkpoint_completion_target = 0.9');
    } catch (error: any) {
      logger.warn('PostgreSQL performance tuning skipped:', error?.message || error);
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
        "We're temporarily closed right now..."
      ]
    );

    // Platform admin users (for Servio company management)
    const platformAdmins = [
      {
        id: 'platform-admin-1',
        restaurant_id: 'platform-admin-org',
        name: 'System Admin',
        email: 'admin@servio.com',
        password: 'password',
        role: 'platform-admin',
        permissions: JSON.stringify(['*'])
      },
      {
        id: 'platform-admin-2',
        restaurant_id: 'platform-admin-org',
        name: 'Super Admin',
        email: 'superadmin@servio.com',
        password: 'password',
        role: 'platform-admin',
        permissions: JSON.stringify(['*'])
      }
    ];

    // Seed platform admins
    for (const admin of platformAdmins) {
      try {
        const passwordHash = bcrypt.hashSync(admin.password, 10);
        await db.run(
          `INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
           ON CONFLICT (email) DO UPDATE SET
             restaurant_id = excluded.restaurant_id,
             name = excluded.name,
             password_hash = excluded.password_hash,
             role = excluded.role,
             permissions = excluded.permissions,
             is_active = TRUE`,
          [admin.id, admin.restaurant_id, admin.name, admin.email, passwordHash, admin.role, admin.permissions]
        );
      } catch (err) {
        logger.warn('Platform admin seed/update failed:', err);
      }
    }

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
        permissions: JSON.stringify(['inventory.read', 'inventory.adjust'])
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
      } catch {
        // Ignore duplicate seed entries.
      }
    }

    for (const item of inventory) {
      try {
        await db.run(
          'INSERT INTO inventory_items (id, restaurant_id, name, sku, unit, on_hand_qty, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [item.id, item.restaurant_id, item.name, item.sku, item.unit, item.on_hand_qty, item.low_stock_threshold]
        );
      } catch {
        // Ignore duplicate seed entries.
      }
    }

    for (const order of orders) {
      try {
        await db.run(
          'INSERT INTO orders (id, restaurant_id, channel, status, total_amount) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [order.id, order.restaurant_id, order.channel, order.status, order.total_amount]
        );
      } catch {
        // Ignore duplicate seed entries.
      }
    }

    logger.info('Database seeded with sample data');
  }

  public getDatabase(): DbClient {
    if (!this.pgPool) throw new Error('PostgreSQL pool not connected');
    const pool = this.pgPool;

    const query = async (sql: string, params: any[] = []): Promise<QueryResult<any>> => {
      const pgSql = convertQMarksToDollars(sql);
      return pool.query(pgSql, params);
    };

    return {
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
