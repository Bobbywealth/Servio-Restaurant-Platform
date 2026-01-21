// INTELLIGENT QUERY OPTIMIZATION SERVICE
import { performance } from 'perf_hooks';

export interface QueryStats {
  query: string;
  executionTime: number;
  timestamp: Date;
  params?: any[];
  rowCount?: number;
  planCost?: number;
}

export interface OptimizationHint {
  type: 'INDEX' | 'REWRITE' | 'CACHE' | 'BATCH' | 'PAGINATION';
  suggestion: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedImprovement: string;
}

export class QueryOptimizer {
  private queryStats: Map<string, QueryStats[]> = new Map();
  private slowQueryThreshold: number = 1000; // 1 second
  private optimizationCache: Map<string, string> = new Map();
  
  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }
  
  // Track query execution
  async trackQuery<T>(
    query: string,
    executor: () => Promise<T>,
    params?: any[]
  ): Promise<T> {
    const startTime = performance.now();
    const normalizedQuery = this.normalizeQuery(query);
    
    try {
      const result = await executor();
      const executionTime = performance.now() - startTime;
      
      // Store query stats
      this.recordQueryStats({
        query: normalizedQuery,
        executionTime,
        timestamp: new Date(),
        params,
        rowCount: Array.isArray(result) ? result.length : undefined,
      });
      
      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        console.warn(`🐌 Slow query detected (${executionTime.toFixed(2)}ms):`, normalizedQuery);
        this.generateOptimizationHints(normalizedQuery, executionTime);
      }
      
      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Record failed query stats
      this.recordQueryStats({
        query: normalizedQuery,
        executionTime,
        timestamp: new Date(),
        params,
      });
      
      console.error(`❌ Query failed after ${executionTime.toFixed(2)}ms:`, normalizedQuery, error);
      throw error;
    }
  }
  
  // Normalize query for consistent tracking
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?') // Replace parameterized placeholders
      .replace(/\b\d+\b/g, '?') // Replace numeric literals
      .replace(/'[^']*'/g, '?') // Replace string literals
      .trim()
      .toLowerCase();
  }
  
  // Record query statistics
  private recordQueryStats(stats: QueryStats) {
    const { query } = stats;
    
    if (!this.queryStats.has(query)) {
      this.queryStats.set(query, []);
    }
    
    const queryStatsArray = this.queryStats.get(query)!;
    queryStatsArray.push(stats);
    
    // Keep only last 100 executions per query
    if (queryStatsArray.length > 100) {
      queryStatsArray.shift();
    }
  }
  
  // Generate optimization hints for slow queries
  private generateOptimizationHints(query: string, executionTime: number): OptimizationHint[] {
    const hints: OptimizationHint[] = [];
    
    // Check for missing indexes
    if (query.includes('where') && !query.includes('order by')) {
      hints.push({
        type: 'INDEX',
        suggestion: 'Consider adding an index on WHERE clause columns',
        impact: 'HIGH',
        estimatedImprovement: '50-90% faster'
      });
    }
    
    // Check for N+1 queries
    const stats = this.queryStats.get(query);
    if (stats && stats.length > 10) {
      const recentExecutions = stats.slice(-10);
      const avgTime = recentExecutions.reduce((sum, s) => sum + s.executionTime, 0) / recentExecutions.length;
      
      if (avgTime > 100 && recentExecutions.length > 5) {
        hints.push({
          type: 'BATCH',
          suggestion: 'Potential N+1 query detected. Consider batching or using JOINs',
          impact: 'HIGH',
          estimatedImprovement: '80-95% faster'
        });
      }
    }
    
    // Check for SELECT *
    if (query.includes('select *')) {
      hints.push({
        type: 'REWRITE',
        suggestion: 'Avoid SELECT * - specify only needed columns',
        impact: 'MEDIUM',
        estimatedImprovement: '20-40% faster'
      });
    }
    
    // Check for missing LIMIT on large result sets
    if (!query.includes('limit') && executionTime > 2000) {
      hints.push({
        type: 'PAGINATION',
        suggestion: 'Add LIMIT clause or implement pagination for large result sets',
        impact: 'HIGH',
        estimatedImprovement: '70-90% faster'
      });
    }
    
    // Check for cacheable queries
    if (query.includes('select') && !query.includes('created_at') && !query.includes('updated_at')) {
      hints.push({
        type: 'CACHE',
        suggestion: 'This query appears cacheable - consider Redis caching',
        impact: 'MEDIUM',
        estimatedImprovement: '90-99% faster'
      });
    }
    
    console.log(`💡 Optimization hints for query:`, hints);
    return hints;
  }
  
  // Get query performance report
  getPerformanceReport(): {
    slowQueries: Array<{ query: string; avgTime: number; executions: number }>;
    topQueries: Array<{ query: string; totalTime: number; executions: number }>;
    recommendations: OptimizationHint[];
  } {
    const slowQueries: Array<{ query: string; avgTime: number; executions: number }> = [];
    const topQueries: Array<{ query: string; totalTime: number; executions: number }> = [];
    const recommendations: OptimizationHint[] = [];
    
    for (const [query, stats] of this.queryStats.entries()) {
      const avgTime = stats.reduce((sum, s) => sum + s.executionTime, 0) / stats.length;
      const totalTime = stats.reduce((sum, s) => sum + s.executionTime, 0);
      
      if (avgTime > this.slowQueryThreshold) {
        slowQueries.push({ query, avgTime, executions: stats.length });
      }
      
      topQueries.push({ query, totalTime, executions: stats.length });
    }
    
    // Sort by performance impact
    slowQueries.sort((a, b) => b.avgTime - a.avgTime);
    topQueries.sort((a, b) => b.totalTime - a.totalTime);
    
    // Generate recommendations for top slow queries
    slowQueries.slice(0, 5).forEach(({ query }) => {
      recommendations.push(...this.generateOptimizationHints(query, 0));
    });
    
    return {
      slowQueries: slowQueries.slice(0, 10),
      topQueries: topQueries.slice(0, 10),
      recommendations
    };
  }
  
  // Optimize common query patterns
  optimizeQuery(query: string): string {
    const cacheKey = this.normalizeQuery(query);
    
    if (this.optimizationCache.has(cacheKey)) {
      return this.optimizationCache.get(cacheKey)!;
    }
    
    let optimizedQuery = query;
    
    // Add query hints for PostgreSQL
    if (query.toLowerCase().includes('select')) {
      // Add index hints where appropriate
      if (query.toLowerCase().includes('where') && query.toLowerCase().includes('restaurant_id')) {
        optimizedQuery = optimizedQuery.replace(
          /FROM\s+(\w+)/gi,
          'FROM $1 /*+ INDEX(restaurant_id) */'
        );
      }
      
      // Optimize ORDER BY with LIMIT
      if (query.toLowerCase().includes('order by') && query.toLowerCase().includes('limit')) {
        optimizedQuery = optimizedQuery.replace(
          /ORDER BY/gi,
          'ORDER BY'
        );
      }
    }
    
    this.optimizationCache.set(cacheKey, optimizedQuery);
    return optimizedQuery;
  }
  
  // Clear old statistics
  clearOldStats(olderThanHours: number = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [query, stats] of this.queryStats.entries()) {
      const filteredStats = stats.filter(s => s.timestamp > cutoff);
      
      if (filteredStats.length === 0) {
        this.queryStats.delete(query);
      } else {
        this.queryStats.set(query, filteredStats);
      }
    }
    
    console.log(`🧹 Cleared old query statistics (older than ${olderThanHours}h)`);
  }
  
  // Get query execution plan (PostgreSQL specific)
  async explainQuery(query: string, db: any): Promise<any> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await db.execute(explainQuery);
      
      if (result && result[0] && result[0]['QUERY PLAN']) {
        const plan = result[0]['QUERY PLAN'][0];
        
        // Analyze plan for optimization opportunities
        this.analyzePlan(plan, query);
        
        return plan;
      }
    } catch (error) {
      console.error('Failed to get query plan:', error);
    }
    
    return null;
  }
  
  // Analyze query execution plan
  private analyzePlan(plan: any, query: string) {
    if (!plan || !plan.Plan) return;
    
    const { Plan } = plan;
    const totalCost = Plan['Total Cost'];
    const actualTime = Plan['Actual Total Time'];
    
    // Check for expensive operations
    if (Plan['Node Type'] === 'Seq Scan' && totalCost > 1000) {
      console.warn(`🔍 Expensive sequential scan detected in query: ${query}`);
      console.warn(`Consider adding an index on scanned columns`);
    }
    
    if (Plan['Node Type'] === 'Sort' && totalCost > 500) {
      console.warn(`🔄 Expensive sort operation detected in query: ${query}`);
      console.warn(`Consider adding an index to avoid sorting or reducing result set`);
    }
    
    if (Plan['Node Type'] === 'Nested Loop' && totalCost > 1000) {
      console.warn(`🔗 Expensive nested loop detected in query: ${query}`);
      console.warn(`Consider rewriting with JOINs or adding indexes`);
    }
  }
}

// Global query optimizer instance
export const queryOptimizer = new QueryOptimizer();

// Decorator for automatic query tracking
export function TrackQuery(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const query = args[0]; // Assume first argument is the query
    const params = args[1]; // Second argument might be parameters
    
    if (typeof query === 'string') {
      return queryOptimizer.trackQuery(
        query,
        () => originalMethod.apply(this, args),
        params
      );
    } else {
      return originalMethod.apply(this, args);
    }
  };
  
  return descriptor;
}

export default QueryOptimizer;