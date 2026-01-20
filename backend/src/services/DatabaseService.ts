import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';
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
    await service.createTables();
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
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const db = this.getDatabase();
    const isPg = db.dialect === 'postgres';

    // For a clean V1 state in Postgres, we sometimes need to force recreation 
    // if the user requested a fresh schema. We'll check for a RESET_DB env var.
    if (isPg && process.env.RESET_DB === 'true') {
      logger.info('RESET_DB is true, dropping existing tables...');
      const tablesToDrop = [
        'audit_logs', 'auth_sessions', 'receipt_line_items', 'receipts', 
        'time_entries', 'inventory_transactions', 'inventory_items', 
        'tasks', 'order_items', 'orders', 'customers', 'modifier_options', 
        'modifier_groups', 'menu_items', 'menu_categories', 'users', 'restaurants'
      ];
      for (const table of tablesToDrop) {
        await db.run(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
    }
    const tables = isPg
      ? [
          `CREATE TABLE IF NOT EXISTS restaurants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            settings TEXT NOT NULL DEFAULT '{}',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            pin TEXT,
            role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner', 'admin')),
            permissions TEXT NOT NULL DEFAULT '[]',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS menu_categories (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            category_id TEXT REFERENCES menu_categories(id),
            name TEXT NOT NULL,
            description TEXT,
            price DOUBLE PRECISION NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS modifier_groups (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            min_selection INTEGER DEFAULT 0,
            max_selection INTEGER,
            is_required BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS modifier_options (
            id TEXT PRIMARY KEY,
            modifier_group_id TEXT NOT NULL REFERENCES modifier_groups(id),
            name TEXT NOT NULL,
            price_modifier DOUBLE PRECISION DEFAULT 0,
            is_available BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            customer_id TEXT REFERENCES customers(id),
            external_id TEXT,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'unpaid',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id),
            menu_item_id TEXT REFERENCES menu_items(id),
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DOUBLE PRECISION NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT REFERENCES users(id),
            due_date TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS inventory_items (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            unit TEXT NOT NULL,
            on_hand_qty DOUBLE PRECISION NOT NULL DEFAULT 0,
            low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 5,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS inventory_transactions (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
            type TEXT NOT NULL,
            quantity DOUBLE PRECISION NOT NULL,
            reason TEXT,
            created_by TEXT REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            clock_in_time TIMESTAMPTZ NOT NULL,
            clock_out_time TIMESTAMPTZ,
            break_minutes INTEGER NOT NULL DEFAULT 0,
            total_hours DOUBLE PRECISION,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            supplier_name TEXT,
            total_amount DOUBLE PRECISION,
            status TEXT NOT NULL DEFAULT 'pending',
            file_url TEXT,
            storage_key TEXT,
            uploaded_by TEXT REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS receipt_line_items (
            id TEXT PRIMARY KEY,
            receipt_id TEXT NOT NULL REFERENCES receipts(id),
            inventory_item_id TEXT REFERENCES inventory_items(id),
            description TEXT NOT NULL,
            quantity DOUBLE PRECISION,
            unit_cost DOUBLE PRECISION,
            total_price DOUBLE PRECISION,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            user_id TEXT REFERENCES users(id),
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            refresh_token_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`
        ]
      : [
          `CREATE TABLE IF NOT EXISTS restaurants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            settings TEXT NOT NULL DEFAULT '{}',
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            pin TEXT,
            role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner', 'admin')),
            permissions TEXT NOT NULL DEFAULT '[]',
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS menu_categories (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            category_id TEXT REFERENCES menu_categories(id),
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS modifier_groups (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            min_selection INTEGER DEFAULT 0,
            max_selection INTEGER,
            is_required BOOLEAN DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS modifier_options (
            id TEXT PRIMARY KEY,
            modifier_group_id TEXT NOT NULL REFERENCES modifier_groups(id),
            name TEXT NOT NULL,
            price_modifier REAL DEFAULT 0,
            is_available BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            customer_id TEXT REFERENCES customers(id),
            external_id TEXT,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            total_amount REAL NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'unpaid',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id),
            menu_item_id TEXT REFERENCES menu_items(id),
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT REFERENCES users(id),
            due_date TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS inventory_items (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            unit TEXT NOT NULL,
            on_hand_qty REAL NOT NULL DEFAULT 0,
            low_stock_threshold REAL NOT NULL DEFAULT 5,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS inventory_transactions (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
            type TEXT NOT NULL,
            quantity REAL NOT NULL,
            reason TEXT,
            created_by TEXT REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            clock_in_time TEXT NOT NULL,
            clock_out_time TEXT,
            break_minutes INTEGER NOT NULL DEFAULT 0,
            total_hours REAL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            supplier_name TEXT,
            total_amount REAL,
            status TEXT NOT NULL DEFAULT 'pending',
            file_url TEXT,
            storage_key TEXT,
            uploaded_by TEXT REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS receipt_line_items (
            id TEXT PRIMARY KEY,
            receipt_id TEXT NOT NULL REFERENCES receipts(id),
            inventory_item_id TEXT REFERENCES inventory_items(id),
            description TEXT NOT NULL,
            quantity REAL,
            unit_cost REAL,
            total_price REAL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
            user_id TEXT REFERENCES users(id),
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            refresh_token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        ];

    for (const tableSQL of tables) {
      await db.exec(tableSQL);
    }

    // Lightweight “migration” safety
    const ensureColumn = async (table: string, columnSql: string) => {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`);
      } catch {
        // ignore
      }
    };
    await ensureColumn('users', 'restaurant_id TEXT');
    await ensureColumn('orders', 'payment_status TEXT DEFAULT \'unpaid\'');

    // LIGHTNING FAST INDEXES FOR OPTIMAL PERFORMANCE
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_restaurant ON inventory_items(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_restaurant ON tasks(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_restaurant ON audit_logs(restaurant_id)',
      'CREATE INDEX IF NOT EXISTS idx_time_entries_restaurant ON time_entries(restaurant_id)'
    ];

    console.log('⚡ Creating performance indexes...')
    for (const indexSQL of indexes) {
      try {
        await db.exec(indexSQL);
      } catch (error: any) {
        if (!error?.message?.includes('already exists')) {
          logger.warn(`Index creation warning: ${error?.message || error}`);
        }
      }
    }

    // DATABASE PERFORMANCE TUNING
    if (isPg) {
      // PostgreSQL optimizations
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
      // SQLite optimizations
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

    logger.info('⚡ Database tables created/verified with TURBO optimizations!');
  }

  private async seedData(): Promise<void> {
    const db = this.getDatabase();

    // Check if we already have data
    const restaurantCount = await db.get<{ count: any }>('SELECT COUNT(*) as count FROM restaurants');
    if (asNumber(restaurantCount?.count) > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    const restaurantId = 'demo-restaurant-1';
    
    // Create demo restaurant
    await db.run(
      'INSERT INTO restaurants (id, name, slug, settings) VALUES (?, ?, ?, ?)',
      [restaurantId, 'Demo Restaurant', 'demo-restaurant', JSON.stringify({ currency: 'USD' })]
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
      await db.run(
        'INSERT INTO menu_categories (id, restaurant_id, name) VALUES (?, ?, ?)',
        [cat.id, cat.restaurant_id, cat.name]
      );
    }

    // Sample menu items
    const menuItems = [
      {
        id: 'item-1',
        restaurant_id: restaurantId,
        category_id: 'cat-1',
        name: 'Jerk Chicken Plate',
        description: 'Spicy jerk chicken with rice and peas',
        price: 15.99
      },
      {
        id: 'item-2',
        restaurant_id: restaurantId,
        category_id: 'cat-1',
        name: 'Curry Goat',
        description: 'Tender curry goat with rice',
        price: 18.99
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
          'INSERT INTO users (id, restaurant_id, name, email, password_hash, pin, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [user.id, user.restaurant_id, user.name, user.email, passwordHash, user.pin, user.role, user.permissions]
        );
      } catch (err) {
        // Ignore duplicate key errors
      }
    }

    for (const item of menuItems) {
      try {
        await db.run(
          'INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
          [item.id, item.restaurant_id, item.category_id, item.name, item.description, item.price]
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