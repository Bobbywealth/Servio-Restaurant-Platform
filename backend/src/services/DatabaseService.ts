import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
  permissions: string;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  external_id: string;
  channel: string;
  status: string;
  items: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  current_quantity: number;
  unit: string;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
  channel_availability: string;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'one_time';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  source: string;
  created_at: string;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;

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
    if (service.db) {
      await service.db.close();
      service.db = null;
      logger.info('Database connection closed');
    }
  }

  private async connect(): Promise<void> {
    try {
      // Ensure uploads directory exists
      const dbDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const dbPath = path.join(dbDir, 'servio.db');
      this.db = await open({
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
    if (!this.db) throw new Error('Database not connected');

    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'owner')),
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // Orders table
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

      // Inventory table
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

      // Menu items table
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

      // Tasks table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'daily',
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_to TEXT,
        due_date TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // Audit log table
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

      // Sync jobs table
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
      await this.db.exec(tableSQL);
    }

    logger.info('Database tables created/verified');
  }

  private async seedData(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    // Check if we already have data
    const userCount = await this.db.get('SELECT COUNT(*) as count FROM users');
    if (userCount.count > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    // Sample users
    const users = [
      {
        id: 'user-1',
        name: 'Demo Staff',
        role: 'staff',
        permissions: JSON.stringify(['orders.read', 'orders.update', 'inventory.read', 'inventory.adjust'])
      },
      {
        id: 'user-2',
        name: 'Demo Manager',
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
      await this.db.run(
        'INSERT INTO users (id, name, role, permissions) VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.role, user.permissions]
      );
    }

    for (const item of menuItems) {
      await this.db.run(
        'INSERT INTO menu_items (id, name, description, price, category, channel_availability) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.description, item.price, item.category, item.channel_availability]
      );
    }

    for (const item of inventory) {
      await this.db.run(
        'INSERT INTO inventory (id, name, sku, category, current_quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.name, item.sku, item.category, item.current_quantity, item.unit, item.low_stock_threshold]
      );
    }

    for (const order of orders) {
      await this.db.run(
        'INSERT INTO orders (id, external_id, channel, status, items, customer_name, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [order.id, order.external_id, order.channel, order.status, order.items, order.customer_name, order.total_amount]
      );
    }

    for (const task of tasks) {
      await this.db.run(
        'INSERT INTO tasks (id, title, description, type, status, assigned_to, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [task.id, task.title, task.description, task.type, task.status, task.assigned_to, task.completed_at]
      );
    }

    logger.info('Database seeded with sample data');
  }

  public getDatabase(): Database {
    if (!this.db) throw new Error('Database not connected');
    return this.db;
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
    if (!this.db) return;

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.run(
      'INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [auditId, userId, action, entityType, entityId, JSON.stringify(details), source]
    );
  }
}

export default DatabaseService;