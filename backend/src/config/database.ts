import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

/**
 * Production-ready PostgreSQL connection pool configuration
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Connection pool configuration
export const poolConfig: PoolConfig = {
  // Connection string from environment
  connectionString: process.env.DATABASE_URL,
  
  // SSL configuration (required for most production databases)
  ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : undefined,
  
  // Pool size configuration
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum pool size
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum pool size
  
  // Connection timeout
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  
  // Idle timeout - how long a connection can remain idle before being closed
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  
  // Max uses - close connection after this many queries (helps prevent memory leaks)
  maxUses: parseInt(process.env.DB_MAX_USES || '7500'),
  
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
  
  // Statement timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  
  // Application name (visible in pg_stat_activity)
  application_name: 'servio-backend',
  
  // Keep alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Create pool
let pool: Pool | null = null;

/**
 * Get or create database pool
 */
export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(poolConfig);
    
    // Log pool events
    pool.on('connect', (client) => {
      logger.debug('New database client connected', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount
      });
    });

    pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount
      });
    });

    pool.on('remove', (client) => {
      logger.debug('Client removed from pool', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount
      });
    });

    pool.on('error', (err, client) => {
      logger.error('Unexpected database error', { error: err.message, stack: err.stack });
    });

    logger.info('Database connection pool created', {
      max: poolConfig.max,
      min: poolConfig.min,
      connectionTimeout: poolConfig.connectionTimeoutMillis,
      idleTimeout: poolConfig.idleTimeoutMillis,
      environment: process.env.NODE_ENV
    });
  }
  
  return pool;
};

/**
 * Test database connection
 */
export const testConnection = async (): Promise<boolean> => {
  const testPool = getPool();
  
  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    client.release();
    
    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });
    
    return true;
  } catch (error: any) {
    logger.error('Database connection test failed', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

/**
 * Get pool statistics
 */
export const getPoolStats = () => {
  if (!pool) return null;
  
  return {
    totalCount: pool.totalCount,      // Total number of clients in pool
    idleCount: pool.idleCount,        // Number of idle clients
    waitingCount: pool.waitingCount,  // Number of queued requests waiting for a client
    max: poolConfig.max,
    min: poolConfig.min
  };
};

/**
 * Execute query with automatic connection management
 */
export const query = async <T = any>(
  text: string, 
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> => {
  const startTime = Date.now();
  const client = await getPool().connect();
  
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        query: text.substring(0, 200),
        duration,
        rowCount: result.rowCount
      });
    }
    
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0
    };
  } catch (error: any) {
    logger.error('Query execution failed', {
      error: error.message,
      query: text.substring(0, 200),
      params: params?.length
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Execute transaction
 */
export const transaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close database pool (for graceful shutdown)
 */
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};

/**
 * Health check query
 */
export const healthCheck = async (): Promise<{
  healthy: boolean;
  latency: number;
  stats: ReturnType<typeof getPoolStats>;
}> => {
  const startTime = Date.now();
  
  try {
    await query('SELECT 1');
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency,
      stats: getPoolStats()
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      stats: getPoolStats()
    };
  }
};

/**
 * Database maintenance operations
 */
export const maintenance = {
  /**
   * Vacuum analyze (improve performance)
   */
  async vacuum(tableName?: string): Promise<void> {
    const queryText = tableName 
      ? `VACUUM ANALYZE ${tableName};`
      : 'VACUUM ANALYZE;';
    
    await query(queryText);
    logger.info('Vacuum analyze completed', { tableName: tableName || 'all tables' });
  },

  /**
   * Reindex table
   */
  async reindex(tableName: string): Promise<void> {
    await query(`REINDEX TABLE ${tableName};`);
    logger.info('Reindex completed', { tableName });
  },

  /**
   * Get table sizes
   */
  async getTableSizes(): Promise<Array<{ table: string; size: string }>> {
    const result = await query<{ table: string; size: string }>(`
      SELECT 
        schemaname || '.' || tablename AS table,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 20;
    `);
    
    return result.rows;
  },

  /**
   * Get slow queries
   */
  async getSlowQueries(): Promise<Array<any>> {
    const result = await query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time
      FROM pg_stat_statements
      WHERE mean_time > 100
      ORDER BY mean_time DESC
      LIMIT 20;
    `);
    
    return result.rows;
  }
};

export default {
  poolConfig,
  getPool,
  testConnection,
  getPoolStats,
  query,
  transaction,
  closePool,
  healthCheck,
  maintenance
};
