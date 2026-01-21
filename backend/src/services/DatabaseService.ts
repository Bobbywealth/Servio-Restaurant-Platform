import path from 'path';
import fs from 'fs';
import { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

type DatabaseDialect = 'postgres';

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
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const prev = sql[i - 1];
    const next = sql[i + 1];

    if (char === "'" && prev !== '\\' && !inDoubleQuote && !inDollarQuote) {
      inSingleQuote = !inSingleQuote;
    }
    if (char === '"' && prev !== '\\' && !inSingleQuote && !inDollarQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
    // Handle Postgres dollar quoting $$
    if (char === '$' && next === '$' && !inSingleQuote && !inDoubleQuote) {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 1;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
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

export class DatabaseService {
  private static instance: DatabaseService;
  private pgPool: Pool | null = null;

  private constructor() {}

  public static readonly DEFAULT_RESTAURANT_ID = 'sasheyskitchen-union';
  public static readonly DEFAULT_RESTAURANT_SLUG = 'sasheyskitchen-union';
  public static readonly DEFAULT_RESTAURANT_NAME = 'Sasheyskitchen';

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

    // 1. Ensure migrations table exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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

      try {
        // Split by semicolon but be careful with functions/triggers if any
        // For simplicity, we run the whole block or split by common patterns
        // Some migrations might have multiple statements

        // Postgres can handle multiple statements in one query often.
        // However, CREATE INDEX CONCURRENTLY cannot run inside a transaction block
        // and multiple statements in one call are often treated as an implicit transaction.
        const hasConcurrent = sql.toUpperCase().includes('CONCURRENTLY');
        if (!hasConcurrent) {
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
          // Concurrent index creation must be run statement by statement outside of any transaction
          logger.info(`📝 detected CONCURRENTLY in ${file} - splitting into statements`);
          const cleanedSql = stripSqlComments(sql);
          const statements = splitSqlStatements(cleanedSql);
          logger.info(`📑 split into ${statements.length} statements`);

          for (const statement of statements) {
            const trimmed = statement.trim();
            if (!trimmed) continue;
            try {
              await db.exec(trimmed);
            } catch (err: any) {
              if (String(err?.message || '').includes('already exists')) {
                logger.warn(`Index already exists, skipping: ${trimmed.substring(0, 50)}...`);
                continue;
              }
              logger.error(`❌ Statement failed: ${trimmed.substring(0, 100)}...`);
              throw err;
            }
          }

          await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
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
        // Apply optimizations
        await this.optimizeDatabase();
        return;
      }

      throw new Error('DATABASE_URL is required and must be a postgres connection string.');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  private async optimizeDatabase(): Promise<void> {
    const db = this.getDatabase();
    try {
      await db.exec('SET work_mem = "64MB"');
      await db.exec('SET maintenance_work_mem = "256MB"');
      await db.exec('SET effective_cache_size = "1GB"');
      await db.exec('SET random_page_cost = 1.1');
      await db.exec('SET checkpoint_completion_target = 0.9');
    } catch (error: any) {
      logger.warn('PostgreSQL performance tuning skipped:', error?.message || error);
    }
  }

  private async seedData(): Promise<void> {
    const db = this.getDatabase();

    // Ensure there is at least one business in fresh databases (no users are seeded).
    // This keeps environments functional without shipping demo credentials.
    try {
      const existingAny = await db.get<{ count: number }>('SELECT COUNT(1) as count FROM restaurants');
      if (!existingAny || Number(existingAny.count) === 0) {
        await db.run(
          `INSERT INTO restaurants (id, name, slug, is_active, created_at, updated_at)
           VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            DatabaseService.DEFAULT_RESTAURANT_ID,
            DatabaseService.DEFAULT_RESTAURANT_NAME,
            DatabaseService.DEFAULT_RESTAURANT_SLUG
          ]
        );
        logger.info('Created initial restaurant', {
          id: DatabaseService.DEFAULT_RESTAURANT_ID,
          name: DatabaseService.DEFAULT_RESTAURANT_NAME
        });
      }
    } catch (err) {
      logger.warn('Initial restaurant ensure failed:', err);
    }
  }

  public getDatabase(): DbClient {
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