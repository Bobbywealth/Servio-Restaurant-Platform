import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import {
  ApiKey,
  ApiKeyScope,
  ApiKeyUsage,
  ApiKeyDailyStats,
  ApiKeyWebhook,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  UpdateApiKeyRequest,
  ApiKeyUsageQuery,
  ApiKeyStatsResponse,
  WebhookEventType,
} from '../types/apiKey';

// API Key configuration
const API_KEY_PREFIX = 'sk_live_';
const API_KEY_TEST_PREFIX = 'sk_test_';
const API_KEY_LENGTH = 32;
const KEY_PREFIX_LENGTH = 8;

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
  rateLimitExceeded?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

class ApiKeyServiceClass {
  private rateLimitCache: Map<string, { count: number; resetAt: Date }> = new Map();

  private parseApiKey(row: any): ApiKey {
    return {
      ...row,
      companyId: row.companyId ?? row.company_id ?? undefined,
      restaurantId: row.restaurantId ?? row.restaurant_id ?? undefined,
      keyPrefix: row.keyPrefix ?? row.key_prefix,
      keyHash: row.keyHash ?? row.key_hash,
      rateLimit: row.rateLimit ?? row.rate_limit ?? 1000,
      isActive: row.isActive ?? row.is_active,
      expiresAt: row.expiresAt
        ? new Date(row.expiresAt)
        : (row.expires_at ? new Date(row.expires_at) : undefined),
      lastUsedAt: row.lastUsedAt
        ? new Date(row.lastUsedAt)
        : (row.last_used_at ? new Date(row.last_used_at) : undefined),
      createdBy: row.createdBy ?? row.created_by ?? undefined,
      createdAt: new Date(row.createdAt ?? row.created_at),
      updatedAt: new Date(row.updatedAt ?? row.updated_at),
      scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes,
    };
  }

  private parseWebhook(row: any): ApiKeyWebhook {
    return {
      ...row,
      apiKeyId: row.apiKeyId ?? row.api_key_id,
      isActive: row.isActive ?? row.is_active,
      failureCount: row.failureCount ?? row.failure_count ?? 0,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
      lastTriggeredAt: row.lastTriggeredAt
        ? new Date(row.lastTriggeredAt)
        : (row.last_triggered_at ? new Date(row.last_triggered_at) : undefined),
      createdAt: new Date(row.createdAt ?? row.created_at),
      updatedAt: new Date(row.updatedAt ?? row.updated_at),
    };
  }

  /**
   * Generate a new API key with secure random bytes
   */
  private generateKeyString(test: boolean = false): string {
    const prefix = test ? API_KEY_TEST_PREFIX : API_KEY_PREFIX;
    const randomBytes = crypto.randomBytes(API_KEY_LENGTH).toString('base64url');
    return `${prefix}${randomBytes}`;
  }

  /**
   * Hash an API key using SHA-256
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Extract the prefix from an API key for identification
   */
  private getKeyPrefix(key: string): string {
    // Extract first 8 chars after prefix (e.g., "sk_live_1a2b3c4d")
    const prefixMatch = key.match(/^(sk_(?:live|test)_)(.{8})/);
    if (prefixMatch) {
      return `${prefixMatch[1]}${prefixMatch[2]}`;
    }
    return key.substring(0, KEY_PREFIX_LENGTH + 8); // Fallback
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    request: CreateApiKeyRequest,
    createdBy?: string
  ): Promise<CreateApiKeyResponse> {
    const db = DatabaseService.getInstance().getDatabase();
    const id = uuidv4();
    const keyString = this.generateKeyString(false);
    const keyHash = this.hashKey(keyString);
    const keyPrefix = this.getKeyPrefix(keyString);

    await db.run(
      `INSERT INTO api_keys (
        id, company_id, restaurant_id, name, description, key_prefix, key_hash,
        scopes, rate_limit, is_active, expires_at, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id,
        request.companyId || null,
        request.restaurantId || null,
        request.name,
        request.description || null,
        keyPrefix,
        keyHash,
        JSON.stringify(request.scopes),
        request.rateLimit || 1000,
        true,
        request.expiresAt || null,
        createdBy || null,
      ]
    );

    logger.info(`API key created: ${keyPrefix} for ${request.name}`);

    return {
      id,
      name: request.name,
      key: keyString, // Only returned once during creation
      keyPrefix,
      scopes: request.scopes,
      expiresAt: request.expiresAt,
      createdAt: new Date(),
    };
  }

  /**
   * Validate an API key and return the key details
   */
  async validateApiKey(
    keyString: string,
    requiredScopes?: ApiKeyScope[]
  ): Promise<ApiKeyValidationResult> {
    const db = DatabaseService.getInstance().getDatabase();
    const keyHash = this.hashKey(keyString);

    try {
      const row = await db.get<ApiKey>(
        `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE`,
        [keyHash]
      );

      if (!row) {
        return { valid: false, error: 'Invalid API key' };
      }

      // Parse scopes from JSONB
      const apiKey = this.parseApiKey(row);

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return { valid: false, error: 'API key has expired' };
      }

      // Check required scopes
      if (requiredScopes && requiredScopes.length > 0) {
        const hasAdminFull = apiKey.scopes.includes('admin:full');
        const hasAllScopes = requiredScopes.every(scope =>
          apiKey.scopes.includes(scope as ApiKeyScope)
        );

        if (!hasAdminFull && !hasAllScopes) {
          return { valid: false, error: 'Insufficient permissions' };
        }
      }

      // Update last used timestamp (async, don't wait)
      this.updateLastUsed(apiKey.id).catch(err =>
        logger.error(`Failed to update last used for API key ${apiKey.id}:`, err)
      );

      return { valid: true, apiKey };
    } catch (error) {
      logger.error('Error validating API key:', error);
      return { valid: false, error: 'Internal server error' };
    }
  }

  /**
   * Check rate limit for an API key
   */
  async checkRateLimit(apiKeyId: string, limit?: number): Promise<RateLimitInfo> {
    const db = DatabaseService.getInstance().getDatabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour window

    // Get or create rate limit entry
    let cached = this.rateLimitCache.get(apiKeyId);

    if (!cached || cached.resetAt < now) {
      // Query actual usage from database
      const result = await db.get<{ count: string }>(
        `SELECT COUNT(*) as count FROM api_key_usage 
         WHERE api_key_id = $1 AND created_at > $2`,
        [apiKeyId, windowStart]
      );

      const count = parseInt(result?.count || '0', 10);
      cached = {
        count,
        resetAt: new Date(now.getTime() + 60 * 60 * 1000),
      };
      this.rateLimitCache.set(apiKeyId, cached);
    }

    const effectiveLimit = limit || 1000;
    const remaining = Math.max(0, effectiveLimit - cached.count);

    return {
      limit: effectiveLimit,
      remaining,
      resetAt: cached.resetAt,
    };
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(apiKeyId: string): Promise<void> {
    const cached = this.rateLimitCache.get(apiKeyId);
    if (cached) {
      cached.count += 1;
    }
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [apiKeyId]
    );
  }

  /**
   * Record API key usage
   */
  async recordUsage(usage: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs?: number;
    ipAddress?: string;
    userAgent?: string;
    requestSizeBytes?: number;
    responseSizeBytes?: number;
    errorMessage?: string;
  }): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const id = uuidv4();

    try {
      await db.run(
        `INSERT INTO api_key_usage (
          id, api_key_id, endpoint, method, status_code, response_time_ms,
          ip_address, user_agent, request_size_bytes, response_size_bytes,
          error_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          id,
          usage.apiKeyId,
          usage.endpoint,
          usage.method,
          usage.statusCode,
          usage.responseTimeMs || null,
          usage.ipAddress || null,
          usage.userAgent || null,
          usage.requestSizeBytes || null,
          usage.responseSizeBytes || null,
          usage.errorMessage || null,
        ]
      );

      // Increment rate limit cache
      await this.incrementRateLimit(usage.apiKeyId);

      // Update daily stats (async)
      this.updateDailyStats(usage).catch(err =>
        logger.error(`Failed to update daily stats for API key ${usage.apiKeyId}:`, err)
      );
    } catch (error) {
      logger.error('Error recording API key usage:', error);
    }
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(usage: {
    apiKeyId: string;
    statusCode: number;
    responseTimeMs?: number;
    requestSizeBytes?: number;
    responseSizeBytes?: number;
    ipAddress?: string;
  }): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const isSuccess = usage.statusCode >= 200 && usage.statusCode < 400;

    // Try to update existing stats
    const existing = await db.get<{ id: string }>(
      `SELECT id FROM api_key_daily_stats WHERE api_key_id = $1 AND date = $2`,
      [usage.apiKeyId, today]
    );

    if (existing) {
      await db.run(
        `UPDATE api_key_daily_stats SET
          total_requests = total_requests + 1,
          successful_requests = successful_requests + $1,
          failed_requests = failed_requests + $2,
          avg_response_time_ms = (avg_response_time_ms * total_requests + $3) / (total_requests + 1),
          total_bytes_sent = total_bytes_sent + $4,
          total_bytes_received = total_bytes_received + $5,
          updated_at = NOW()
        WHERE api_key_id = $6 AND date = $7`,
        [
          isSuccess ? 1 : 0,
          isSuccess ? 0 : 1,
          usage.responseTimeMs || 0,
          usage.requestSizeBytes || 0,
          usage.responseSizeBytes || 0,
          usage.apiKeyId,
          today,
        ]
      );
    } else {
      const id = uuidv4();
      await db.run(
        `INSERT INTO api_key_daily_stats (
          id, api_key_id, date, total_requests, successful_requests, failed_requests,
          avg_response_time_ms, total_bytes_sent, total_bytes_received, unique_ips,
          created_at, updated_at
        ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, 1, NOW(), NOW())`,
        [
          id,
          usage.apiKeyId,
          today,
          isSuccess ? 1 : 0,
          isSuccess ? 0 : 1,
          usage.responseTimeMs || 0,
          usage.requestSizeBytes || 0,
          usage.responseSizeBytes || 0,
        ]
      );
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKey(apiKeyId: string): Promise<ApiKey | null> {
    const db = DatabaseService.getInstance().getDatabase();
    const row = await db.get<ApiKey>(`SELECT * FROM api_keys WHERE id = $1`, [apiKeyId]);

    if (!row) return null;

    return this.parseApiKey(row);
  }

  /**
   * List API keys for a company or restaurant
   */
  async listApiKeys(options: {
    companyId?: string;
    restaurantId?: string;
    includeInactive?: boolean;
  }): Promise<ApiKey[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.companyId) {
      conditions.push(`company_id = $${paramIndex++}`);
      params.push(options.companyId);
    }

    if (options.restaurantId) {
      conditions.push(`restaurant_id = $${paramIndex++}`);
      params.push(options.restaurantId);
    }

    if (!options.includeInactive) {
      conditions.push(`is_active = TRUE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.all<ApiKey>(
      `SELECT * FROM api_keys ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return rows.map(row => this.parseApiKey(row));
  }

  /**
   * Update an API key
   */
  async updateApiKey(apiKeyId: string, updates: UpdateApiKeyRequest): Promise<ApiKey | null> {
    const db = DatabaseService.getInstance().getDatabase();
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (updates.scopes !== undefined) {
      setClauses.push(`scopes = $${paramIndex++}`);
      params.push(JSON.stringify(updates.scopes));
    }

    if (updates.rateLimit !== undefined) {
      setClauses.push(`rate_limit = $${paramIndex++}`);
      params.push(updates.rateLimit);
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      params.push(updates.expiresAt);
    }

    params.push(apiKeyId);
    const sql = `UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;

    await db.run(sql, params);

    return this.getApiKey(apiKeyId);
  }

  /**
   * Delete (revoke) an API key
   */
  async deleteApiKey(apiKeyId: string): Promise<boolean> {
    const db = DatabaseService.getInstance().getDatabase();
    const result = await db.run(`DELETE FROM api_keys WHERE id = $1`, [apiKeyId]);
    return result.changes > 0;
  }

  /**
   * Get API key usage history
   */
  async getUsageHistory(query: ApiKeyUsageQuery): Promise<ApiKeyUsage[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const conditions: string[] = ['api_key_id = $1'];
    const params: any[] = [query.apiKeyId];
    let paramIndex = 2;

    if (query.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(query.endDate);
    }

    if (query.endpoint) {
      conditions.push(`endpoint LIKE $${paramIndex++}`);
      params.push(`%${query.endpoint}%`);
    }

    if (query.method) {
      conditions.push(`method = $${paramIndex++}`);
      params.push(query.method);
    }

    if (query.statusCode) {
      conditions.push(`status_code = $${paramIndex++}`);
      params.push(query.statusCode);
    }

    params.push(query.limit || 100);
    params.push(query.offset || 0);

    const rows = await db.all<ApiKeyUsage>(
      `SELECT * FROM api_key_usage 
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return rows.map(row => ({
      ...row,
      apiKeyId: (row as any).apiKeyId ?? (row as any).api_key_id,
      statusCode: row.statusCode ?? (row as any).status_code,
      responseTimeMs: row.responseTimeMs ?? (row as any).response_time_ms,
      ipAddress: row.ipAddress ?? (row as any).ip_address,
      createdAt: new Date((row as any).createdAt ?? (row as any).created_at),
    }));
  }

  /**
   * Get API key statistics
   */
  async getStats(apiKeyId: string, days: number = 30): Promise<ApiKeyStatsResponse> {
    const db = DatabaseService.getInstance().getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get overall stats
    const overallStats = await db.get<{
      total_requests: string;
      successful_requests: string;
      failed_requests: string;
      avg_response_time: string;
    }>(
      `SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status_code < 200 OR status_code >= 400 THEN 1 ELSE 0 END) as failed_requests,
        AVG(response_time_ms) as avg_response_time
       FROM api_key_usage 
       WHERE api_key_id = $1 AND created_at >= $2`,
      [apiKeyId, startDate]
    );

    // Get requests by endpoint
    const endpointStats = await db.all<{ endpoint: string; count: string }>(
      `SELECT endpoint, COUNT(*) as count 
       FROM api_key_usage 
       WHERE api_key_id = $1 AND created_at >= $2
       GROUP BY endpoint 
       ORDER BY count DESC 
       LIMIT 20`,
      [apiKeyId, startDate]
    );

    // Get requests by method
    const methodStats = await db.all<{ method: string; count: string }>(
      `SELECT method, COUNT(*) as count 
       FROM api_key_usage 
       WHERE api_key_id = $1 AND created_at >= $2
       GROUP BY method`,
      [apiKeyId, startDate]
    );

    // Get daily stats
    const dailyStats = await db.all<ApiKeyDailyStats>(
      `SELECT * FROM api_key_daily_stats 
       WHERE api_key_id = $1 AND date >= $2
       ORDER BY date DESC`,
      [apiKeyId, startDate]
    );

    // Get recent usage
    const recentUsage = await this.getUsageHistory({
      apiKeyId,
      limit: 50,
    });

    const totalRequests = parseInt(overallStats?.total_requests || '0', 10);
    const successfulRequests = parseInt(overallStats?.successful_requests || '0', 10);
    const failedRequests = parseInt(overallStats?.failed_requests || '0', 10);

    return {
      apiKeyId,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      avgResponseTimeMs: parseFloat(overallStats?.avg_response_time || '0'),
      requestsByEndpoint: endpointStats.reduce((acc, { endpoint, count }) => {
        acc[endpoint] = parseInt(count, 10);
        return acc;
      }, {} as Record<string, number>),
      requestsByMethod: methodStats.reduce((acc, { method, count }) => {
        acc[method] = parseInt(count, 10);
        return acc;
      }, {} as Record<string, number>),
      recentUsage,
      dailyStats: dailyStats.map(stat => ({
        ...stat,
        apiKeyId: (stat as any).apiKeyId ?? (stat as any).api_key_id,
        totalRequests: stat.totalRequests ?? (stat as any).total_requests,
        successfulRequests: stat.successfulRequests ?? (stat as any).successful_requests,
        failedRequests: stat.failedRequests ?? (stat as any).failed_requests,
        avgResponseTimeMs: stat.avgResponseTimeMs ?? (stat as any).avg_response_time_ms,
        totalBytesSent: stat.totalBytesSent ?? (stat as any).total_bytes_sent,
        totalBytesReceived: stat.totalBytesReceived ?? (stat as any).total_bytes_received,
        uniqueIps: stat.uniqueIps ?? (stat as any).unique_ips,
        date: new Date((stat as any).date),
        createdAt: new Date((stat as any).createdAt ?? (stat as any).created_at),
        updatedAt: new Date((stat as any).updatedAt ?? (stat as any).updated_at),
      })),
    };
  }

  // ==================== Webhook Methods ====================

  /**
   * Create a webhook for an API key
   */
  async createWebhook(
    apiKeyId: string,
    webhook: {
      name: string;
      url: string;
      secret?: string;
      events: WebhookEventType[];
    }
  ): Promise<ApiKeyWebhook> {
    const db = DatabaseService.getInstance().getDatabase();
    const id = uuidv4();

    await db.run(
      `INSERT INTO api_key_webhooks (
        id, api_key_id, name, url, secret, events, is_active, failure_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0, NOW(), NOW())`,
      [id, apiKeyId, webhook.name, webhook.url, webhook.secret || null, JSON.stringify(webhook.events)]
    );

    return {
      id,
      apiKeyId,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      isActive: true,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * List webhooks for an API key
   */
  async listWebhooks(apiKeyId: string): Promise<ApiKeyWebhook[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const rows = await db.all<ApiKeyWebhook>(
      `SELECT * FROM api_key_webhooks WHERE api_key_id = $1 ORDER BY created_at DESC`,
      [apiKeyId]
    );

    return rows.map(row => this.parseWebhook(row));
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: {
      name?: string;
      url?: string;
      secret?: string;
      events?: WebhookEventType[];
      isActive?: boolean;
    }
  ): Promise<ApiKeyWebhook | null> {
    const db = DatabaseService.getInstance().getDatabase();
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.url !== undefined) {
      setClauses.push(`url = $${paramIndex++}`);
      params.push(updates.url);
    }

    if (updates.secret !== undefined) {
      setClauses.push(`secret = $${paramIndex++}`);
      params.push(updates.secret);
    }

    if (updates.events !== undefined) {
      setClauses.push(`events = $${paramIndex++}`);
      params.push(JSON.stringify(updates.events));
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    params.push(webhookId);
    await db.run(
      `UPDATE api_key_webhooks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    const row = await db.get<ApiKeyWebhook>(
      `SELECT * FROM api_key_webhooks WHERE id = $1`,
      [webhookId]
    );

    if (!row) return null;

    return this.parseWebhook(row);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    const db = DatabaseService.getInstance().getDatabase();
    const result = await db.run(`DELETE FROM api_key_webhooks WHERE id = $1`, [webhookId]);
    return result.changes > 0;
  }

  /**
   * Trigger webhooks for an event
   */
  async triggerWebhooks(
    apiKeyId: string,
    eventType: WebhookEventType,
    payload: Record<string, any>
  ): Promise<void> {
    const webhooks = await this.listWebhooks(apiKeyId);
    const activeWebhooks = webhooks.filter(
      wh => wh.isActive && wh.events.includes(eventType)
    );

    for (const webhook of activeWebhooks) {
      this.deliverWebhook(webhook, eventType, payload).catch(err =>
        logger.error(`Failed to deliver webhook ${webhook.id}:`, err)
      );
    }
  }

  /**
   * Deliver a webhook
   */
  private async deliverWebhook(
    webhook: ApiKeyWebhook,
    eventType: WebhookEventType,
    payload: Record<string, any>
  ): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const deliveryId = uuidv4();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Servio-Event': eventType,
          'X-Servio-Signature': webhook.secret
            ? this.generateWebhookSignature(payload, webhook.secret)
            : '',
        },
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      });

      const responseBody = await response.text();

      // Record delivery
      await db.run(
        `INSERT INTO api_key_webhook_deliveries (
          id, webhook_id, event_type, payload, response_status, response_body,
          attempt_count, delivered_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())`,
        [
          deliveryId,
          webhook.id,
          eventType,
          JSON.stringify(payload),
          response.status,
          responseBody.substring(0, 1000), // Limit response body size
        ]
      );

      // Update webhook last triggered
      await db.run(
        `UPDATE api_key_webhooks SET last_triggered_at = NOW(), failure_count = 0 WHERE id = $1`,
        [webhook.id]
      );

      logger.info(`Webhook delivered: ${webhook.id} - ${eventType}`);
    } catch (error) {
      logger.error(`Webhook delivery failed: ${webhook.id}`, error);

      // Record failed delivery
      await db.run(
        `INSERT INTO api_key_webhook_deliveries (
          id, webhook_id, event_type, payload, attempt_count, next_retry_at, created_at
        ) VALUES ($1, $2, $3, $4, 1, NOW() + INTERVAL '5 minutes', NOW())`,
        [deliveryId, webhook.id, eventType, JSON.stringify(payload)]
      );

      // Increment failure count
      await db.run(
        `UPDATE api_key_webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      );
    }
  }

  /**
   * Generate webhook signature for verification
   */
  private generateWebhookSignature(payload: Record<string, any>, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature (utility for clients)
   */
  verifyWebhookSignature(
    payload: Record<string, any>,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Clean up old usage records (for maintenance)
   */
  async cleanupOldUsage(daysToKeep: number = 90): Promise<number> {
    const db = DatabaseService.getInstance().getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.run(
      `DELETE FROM api_key_usage WHERE created_at < $1`,
      [cutoffDate]
    );

    logger.info(`Cleaned up ${result.changes} old API key usage records`);
    return result.changes;
  }
}

// Export singleton instance
export const ApiKeyService = new ApiKeyServiceClass();

export default ApiKeyService;
