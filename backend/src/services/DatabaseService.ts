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

        this.pgPool = new Pool({
          connectionString: databaseUrl,
          ssl
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

    // Note: keep schema intentionally close to existing SQLite schema; later todos will expand it.
    const tables = isPg
      ? [
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            pin TEXT,
            role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner')),
            permissions TEXT NOT NULL DEFAULT '[]',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            external_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'received',
            items TEXT NOT NULL DEFAULT '[]',
            customer_name TEXT,
            customer_phone TEXT,
            total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            category TEXT NOT NULL,
            current_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
            unit TEXT NOT NULL,
            low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 5,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price DOUBLE PRECISION NOT NULL,
            category TEXT NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            channel_availability TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL DEFAULT 'daily',
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT,
            due_date TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            clock_in_time TIMESTAMPTZ NOT NULL,
            clock_out_time TIMESTAMPTZ,
            break_minutes INTEGER NOT NULL DEFAULT 0,
            total_hours DOUBLE PRECISION,
            position TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS time_entry_breaks (
            id TEXT PRIMARY KEY,
            time_entry_id TEXT NOT NULL,
            break_start TIMESTAMPTZ NOT NULL,
            break_end TIMESTAMPTZ,
            duration_minutes INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            refresh_token_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '{}',
            source TEXT NOT NULL DEFAULT 'web',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS sync_jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            channels TEXT NOT NULL DEFAULT '[]',
            details TEXT NOT NULL DEFAULT '{}',
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
          )`
        ]
      : [
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            pin TEXT,
            role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner')),
            permissions TEXT NOT NULL DEFAULT '[]',
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            external_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'received',
            items TEXT NOT NULL DEFAULT '[]',
            customer_name TEXT,
            customer_phone TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            category TEXT NOT NULL,
            current_quantity REAL NOT NULL DEFAULT 0,
            unit TEXT NOT NULL,
            low_stock_threshold REAL NOT NULL DEFAULT 5,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT 1,
            channel_availability TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL DEFAULT 'daily',
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT,
            due_date TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            clock_in_time TEXT NOT NULL,
            clock_out_time TEXT,
            break_minutes INTEGER NOT NULL DEFAULT 0,
            total_hours REAL,
            position TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS time_entry_breaks (
            id TEXT PRIMARY KEY,
            time_entry_id TEXT NOT NULL,
            break_start TEXT NOT NULL,
            break_end TEXT,
            duration_minutes INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            refresh_token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '{}',
            source TEXT NOT NULL DEFAULT 'web',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS sync_jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            channels TEXT NOT NULL DEFAULT '[]',
            details TEXT NOT NULL DEFAULT '{}',
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT
          )`
        ];

    for (const tableSQL of tables) {
      await db.exec(tableSQL);
    }

    // Lightweight “migration” safety: if tables existed before, ensure new columns exist.
    // SQLite/Postgres both support ADD COLUMN; we ignore failures when column already exists.
    const ensureColumn = async (table: string, columnSql: string) => {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`);
      } catch {
        // ignore
      }
    };
    await ensureColumn('users', 'email TEXT');
    await ensureColumn('users', 'password_hash TEXT');
    await ensureColumn('users', 'pin TEXT');
    await ensureColumn('users', 'is_active BOOLEAN');

    logger.info('Database tables created/verified');
  }

  private async seedData(): Promise<void> {
    const db = this.getDatabase();

    // Check if we already have data
    const userCount = await db.get<{ count: any }>('SELECT COUNT(*) as count FROM users');
    if (asNumber(userCount?.count) > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    // Sample users
    const users = [
      {
        id: 'user-1',
        name: 'Demo Staff',
        email: 'staff@demo.servio',
        password: 'password',
        pin: '1111',
        role: 'staff',
        permissions: JSON.stringify(['orders.read', 'orders.update', 'inventory.read', 'inventory.adjust'])
      },
      {
        id: 'user-2',
        name: 'Demo Manager',
        email: 'manager@demo.servio',
        password: 'password',
        pin: '2222',
        role: 'manager',
        permissions: JSON.stringify(['*'])
      }
    ];

    // Sample menu items
    const menuItems = [
      {
        id: 'item-1',
        name: 'Jerk Chicken Plate',
        description: 'Spicy jerk chicken with rice and peas',
        price: 15.99,
        category: 'Entrees',
        channel_availability: JSON.stringify({ doordash: true, ubereats: true, grubhub: true })
      },
      {
        id: 'item-2',
        name: 'Curry Goat',
        description: 'Tender curry goat with rice',
        price: 18.99,
        category: 'Entrees',
        channel_availability: JSON.stringify({ doordash: true, ubereats: true, grubhub: false })
      },
      {
        id: 'item-3',
        name: 'Oxtail Dinner',
        description: 'Braised oxtail with vegetables',
        price: 22.99,
        category: 'Entrees',
        channel_availability: JSON.stringify({ doordash: true, ubereats: true, grubhub: true })
      }
    ];

    // Sample inventory
    const inventory = [
      {
        id: 'inv-1',
        name: 'Chicken (whole)',
        sku: 'CHICKEN-001',
        category: 'Proteins',
        current_quantity: 25,
        unit: 'pieces',
        low_stock_threshold: 5
      },
      {
        id: 'inv-2',
        name: 'Rice (bags)',
        sku: 'RICE-001',
        category: 'Grains',
        current_quantity: 8,
        unit: 'bags',
        low_stock_threshold: 2
      },
      {
        id: 'inv-3',
        name: 'Goat Meat',
        sku: 'GOAT-001',
        category: 'Proteins',
        current_quantity: 12,
        unit: 'lbs',
        low_stock_threshold: 3
      }
    ];

    // Sample orders
    const orders = [
      {
        id: 'order-214',
        external_id: 'DD-214',
        channel: 'doordash',
        status: 'preparing',
        items: JSON.stringify([{ id: 'item-1', name: 'Jerk Chicken Plate', quantity: 1 }]),
        customer_name: 'John Smith',
        total_amount: 15.99
      },
      {
        id: 'order-215',
        external_id: 'UE-215',
        channel: 'ubereats',
        status: 'ready',
        items: JSON.stringify([{ id: 'item-2', name: 'Curry Goat', quantity: 1 }]),
        customer_name: 'Jane Doe',
        total_amount: 18.99
      }
    ];

    // Sample tasks
    const tasks = [
      {
        id: 'task-1',
        title: 'Clean fryer filter',
        description: 'Replace or clean the fryer filter',
        type: 'daily',
        status: 'pending',
        assigned_to: 'user-1'
      },
      {
        id: 'task-2',
        title: 'Check inventory levels',
        description: 'Count and update inventory quantities',
        type: 'daily',
        status: 'completed',
        assigned_to: 'user-1',
        completed_at: new Date().toISOString()
      }
    ];

    // Insert sample data
    for (const user of users) {
      const passwordHash = bcrypt.hashSync(user.password, 10);
      await db.run(
        'INSERT INTO users (id, name, email, password_hash, pin, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, passwordHash, user.pin, user.role, user.permissions, 1]
      );
    }

    for (const item of menuItems) {
      await db.run(
        'INSERT INTO menu_items (id, name, description, price, category, channel_availability) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.description, item.price, item.category, item.channel_availability]
      );
    }

    for (const item of inventory) {
      await db.run(
        'INSERT INTO inventory (id, name, sku, category, current_quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.sku, item.category, item.current_quantity, item.unit, item.low_stock_threshold]
      );
    }

    for (const order of orders) {
      await db.run(
        'INSERT INTO orders (id, external_id, channel, status, items, customer_name, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [order.id, order.external_id, order.channel, order.status, order.items, order.customer_name, order.total_amount]
      );
    }

    for (const task of tasks) {
      await db.run(
        'INSERT INTO tasks (id, title, description, type, status, assigned_to, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [task.id, task.title, task.description, task.type, task.status, task.assigned_to, task.completed_at]
      );
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
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: any = {},
    source: string = 'assistant'
  ): Promise<void> {
    const db = this.getDatabase();

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.run(
      'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [auditId, userId, action, entityType, entityId, JSON.stringify(details), source]
    );
  }
}

export default DatabaseService;