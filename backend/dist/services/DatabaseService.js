"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("../utils/logger");
function convertQMarksToDollars(sql) {
    let idx = 0;
    return sql.replace(/\?/g, () => {
        idx += 1;
        return `$${idx}`;
    });
}
function asNumber(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string' && value.trim().length > 0)
        return Number(value);
    return Number(value ?? 0);
}
class DatabaseService {
    constructor() {
        this._dialect = null;
        this.sqliteDb = null;
        this.pgPool = null;
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    static async initialize() {
        const service = DatabaseService.getInstance();
        await service.connect();
        await service.createTables();
        await service.seedData();
    }
    static async close() {
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
        logger_1.logger.info('Database connection closed');
    }
    async connect() {
        try {
            const databaseUrl = process.env.DATABASE_URL;
            if (databaseUrl && databaseUrl.startsWith('postgres')) {
                this._dialect = 'postgres';
                const ssl = process.env.DATABASE_SSL === 'true'
                    ? { rejectUnauthorized: false }
                    : undefined;
                // OPTIMIZED CONNECTION POOL CONFIGURATION
                this.pgPool = new pg_1.Pool({
                    connectionString: databaseUrl,
                    ssl,
                    // CONNECTION POOL OPTIMIZATION
                    max: 20, // Maximum pool size
                    min: 2, // Minimum connections
                    idleTimeoutMillis: 30000, // Close idle connections after 30s
                    connectionTimeoutMillis: 5000, // Connection timeout
                    // PERFORMANCE TUNING
                    query_timeout: 10000, // 10s query timeout
                    statement_timeout: 15000, // 15s statement timeout
                    idle_in_transaction_session_timeout: 10000 // 10s idle transaction timeout
                });
                // sanity query
                await this.pgPool.query('SELECT 1 as ok');
                logger_1.logger.info('Connected to PostgreSQL database via DATABASE_URL');
                return;
            }
            // Default: SQLite (local/dev)
            this._dialect = 'sqlite';
            const dbDir = path_1.default.join(__dirname, '../../data');
            if (!fs_1.default.existsSync(dbDir)) {
                fs_1.default.mkdirSync(dbDir, { recursive: true });
            }
            const dbPath = path_1.default.join(dbDir, 'servio.db');
            this.sqliteDb = await (0, sqlite_1.open)({
                filename: dbPath,
                driver: sqlite3_1.default.Database
            });
            logger_1.logger.info(`Connected to SQLite database at ${dbPath}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to database:', error);
            throw error;
        }
    }
    async createTables() {
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
          )`,
                `CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            api_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'error')),
            protocol TEXT DEFAULT 'json' CHECK (protocol IN ('json', 'xml', 'rest', 'webhook')),
            protocol_version TEXT DEFAULT 'v1',
            endpoint TEXT,
            contact_email TEXT,
            description TEXT,
            reference_id TEXT UNIQUE NOT NULL,
            restaurant_key TEXT NOT NULL,
            master_key TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            last_sync TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
          )`,
                `CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            api_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'error')),
            protocol TEXT DEFAULT 'json' CHECK (protocol IN ('json', 'xml', 'rest', 'webhook')),
            protocol_version TEXT DEFAULT 'v1',
            endpoint TEXT,
            contact_email TEXT,
            description TEXT,
            reference_id TEXT UNIQUE NOT NULL,
            restaurant_key TEXT NOT NULL,
            master_key TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            last_sync TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
            ];
        for (const tableSQL of tables) {
            await db.exec(tableSQL);
        }
        // Lightweight “migration” safety: if tables existed before, ensure new columns exist.
        // SQLite/Postgres both support ADD COLUMN; we ignore failures when column already exists.
        const ensureColumn = async (table, columnSql) => {
            try {
                await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`);
            }
            catch {
                // ignore
            }
        };
        await ensureColumn('users', 'email TEXT');
        await ensureColumn('users', 'password_hash TEXT');
        await ensureColumn('users', 'pin TEXT');
        await ensureColumn('users', 'is_active BOOLEAN');
        // LIGHTNING FAST INDEXES FOR OPTIMAL PERFORMANCE
        const indexes = [
            // USER INDEXES
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin)',
            // ORDER INDEXES
            'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
            'CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel)',
            'CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(external_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)',
            // INVENTORY INDEXES
            'CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(current_quantity, low_stock_threshold)',
            // MENU INDEXES
            'CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category)',
            'CREATE INDEX IF NOT EXISTS idx_menu_available ON menu_items(is_available)',
            'CREATE INDEX IF NOT EXISTS idx_menu_name ON menu_items(name)',
            // TASK INDEXES
            'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
            'CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)',
            'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)',
            'CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)',
            // TIME ENTRY INDEXES
            'CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in_time)',
            'CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, clock_out_time)',
            // SESSION INDEXES
            'CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at)',
            // AUDIT LOG INDEXES
            'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)',
            // SYNC JOB INDEXES
            'CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_jobs(status)',
            'CREATE INDEX IF NOT EXISTS idx_sync_type ON sync_jobs(type)',
            'CREATE INDEX IF NOT EXISTS idx_sync_created ON sync_jobs(created_at)',
            // INTEGRATION INDEXES
            'CREATE INDEX IF NOT EXISTS idx_integrations_name ON integrations(name)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_api_type ON integrations(api_type)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_reference_id ON integrations(reference_id)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_restaurant_key ON integrations(restaurant_key)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_created ON integrations(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_integrations_last_sync ON integrations(last_sync)',
            // BREAK INDEXES
            'CREATE INDEX IF NOT EXISTS idx_breaks_entry ON time_entry_breaks(time_entry_id)',
            'CREATE INDEX IF NOT EXISTS idx_breaks_start ON time_entry_breaks(break_start)'
        ];
        console.log('⚡ Creating performance indexes...');
        for (const indexSQL of indexes) {
            try {
                await db.exec(indexSQL);
            }
            catch (error) {
                // Ignore if index already exists
                if (!error?.message?.includes('already exists')) {
                    logger_1.logger.warn(`Index creation warning: ${error?.message || error}`);
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
            }
            catch (error) {
                logger_1.logger.warn('PostgreSQL performance tuning skipped:', error?.message || error);
            }
        }
        else {
            // SQLite optimizations
            try {
                await db.exec('PRAGMA journal_mode = WAL');
                await db.exec('PRAGMA synchronous = NORMAL');
                await db.exec('PRAGMA cache_size = 10000');
                await db.exec('PRAGMA temp_store = MEMORY');
                await db.exec('PRAGMA mmap_size = 268435456'); // 256MB
                await db.exec('PRAGMA optimize');
            }
            catch (error) {
                logger_1.logger.warn('SQLite optimization warning:', error?.message || error);
            }
        }
        logger_1.logger.info('⚡ Database tables created/verified with TURBO optimizations!');
    }
    async seedData() {
        const db = this.getDatabase();
        // Check if we already have data
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        if (asNumber(userCount?.count) > 0) {
            logger_1.logger.info('Database already seeded, skipping...');
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
            const passwordHash = bcryptjs_1.default.hashSync(user.password, 10);
            await db.run('INSERT INTO users (id, name, email, password_hash, pin, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [user.id, user.name, user.email, passwordHash, user.pin, user.role, user.permissions, 1]);
        }
        for (const item of menuItems) {
            await db.run('INSERT INTO menu_items (id, name, description, price, category, channel_availability) VALUES (?, ?, ?, ?, ?, ?)', [item.id, item.name, item.description, item.price, item.category, item.channel_availability]);
        }
        for (const item of inventory) {
            await db.run('INSERT INTO inventory (id, name, sku, category, current_quantity, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.id, item.name, item.sku, item.category, item.current_quantity, item.unit, item.low_stock_threshold]);
        }
        for (const order of orders) {
            await db.run('INSERT INTO orders (id, external_id, channel, status, items, customer_name, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)', [order.id, order.external_id, order.channel, order.status, order.items, order.customer_name, order.total_amount]);
        }
        for (const task of tasks) {
            await db.run('INSERT INTO tasks (id, title, description, type, status, assigned_to, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [task.id, task.title, task.description, task.type, task.status, task.assigned_to, task.completed_at]);
        }
        logger_1.logger.info('Database seeded with sample data');
    }
    getDialect() {
        if (!this._dialect)
            throw new Error('Database not connected');
        return this._dialect;
    }
    getDatabase() {
        if (!this._dialect)
            throw new Error('Database not connected');
        if (this._dialect === 'sqlite') {
            if (!this.sqliteDb)
                throw new Error('SQLite database not connected');
            const sqliteDb = this.sqliteDb;
            return {
                dialect: 'sqlite',
                all: (sql, params = []) => sqliteDb.all(sql, params),
                get: (sql, params = []) => sqliteDb.get(sql, params),
                run: async (sql, params = []) => {
                    const result = await sqliteDb.run(sql, params);
                    return { changes: asNumber(result?.changes) };
                },
                exec: (sql) => sqliteDb.exec(sql)
            };
        }
        if (!this.pgPool)
            throw new Error('PostgreSQL pool not connected');
        const pool = this.pgPool;
        const query = async (sql, params = []) => {
            const pgSql = convertQMarksToDollars(sql);
            return pool.query(pgSql, params);
        };
        return {
            dialect: 'postgres',
            all: async (sql, params = []) => {
                const res = await query(sql, params);
                return res.rows;
            },
            get: async (sql, params = []) => {
                const res = await query(sql, params);
                return res.rows[0];
            },
            run: async (sql, params = []) => {
                const res = await query(sql, params);
                return { changes: asNumber(res.rowCount) };
            },
            exec: async (sql) => {
                await pool.query(sql);
            }
        };
    }
    // Helper method to log audit events
    async logAudit(userId, action, entityType, entityId, details = {}, source = 'assistant') {
        const db = this.getDatabase();
        const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.run('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, source) VALUES (?, ?, ?, ?, ?, ?, ?)', [auditId, userId, action, entityType, entityId, JSON.stringify(details), source]);
    }
}
exports.DatabaseService = DatabaseService;
exports.default = DatabaseService;
//# sourceMappingURL=DatabaseService.js.map