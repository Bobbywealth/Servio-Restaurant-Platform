import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export interface VoiceConversation {
  id: string;
  restaurant_id: string;
  session_id: string;
  phone_number?: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: Date;
  last_activity_at: Date;
  ended_at?: Date;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface VoiceConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audio_url?: string;
  metadata: any;
  created_at: Date;
}

export interface VoiceConversationFilters {
  status?: 'active' | 'completed' | 'abandoned';
  phoneNumber?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface VoiceConversationWithMessages extends VoiceConversation {
  messages: VoiceConversationMessage[];
  message_count: number;
}

export class VoiceConversationService {
  private static instance: VoiceConversationService;
  private _db: any = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly DEFAULT_RETENTION_DAYS = 30;
  private readonly INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_MESSAGES_PER_CONVERSATION = 100;

  private constructor() {
    // Start background cleanup job
    this.startCleanupJob();
  }

  public static getInstance(): VoiceConversationService {
    if (!VoiceConversationService.instance) {
      VoiceConversationService.instance = new VoiceConversationService();
    }
    return VoiceConversationService.instance;
  }

  private get db() {
    if (!this._db) {
      this._db = DatabaseService.getInstance().getDatabase();
    }
    return this._db;
  }

  // ==================== Conversation Management ====================

  /**
   * Create a new voice conversation
   */
  async createConversation(data: {
    restaurantId: string;
    sessionId: string;
    phoneNumber?: string;
    metadata?: any;
  }): Promise<VoiceConversation> {
    const conversationId = `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(
      `INSERT INTO voice_conversations (
        id, restaurant_id, session_id, phone_number, status,
        started_at, last_activity_at, metadata
      ) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [
        conversationId,
        data.restaurantId,
        data.sessionId,
        data.phoneNumber || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    return {
      id: conversationId,
      restaurant_id: data.restaurantId,
      session_id: data.sessionId,
      phone_number: data.phoneNumber,
      status: 'active',
      started_at: new Date(),
      last_activity_at: new Date(),
      metadata: data.metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Get a conversation by ID
   */
  async getConversationById(conversationId: string, restaurantId: string): Promise<VoiceConversation | null> {
    const conversation = await this.db.get(
      'SELECT * FROM voice_conversations WHERE id = ? AND restaurant_id = ?',
      [conversationId, restaurantId]
    );
    return conversation ? this.parseConversation(conversation) : null;
  }

  /**
   * Get a conversation by session ID
   */
  async getConversationBySessionId(sessionId: string, restaurantId: string): Promise<VoiceConversation | null> {
    const conversation = await this.db.get(
      'SELECT * FROM voice_conversations WHERE session_id = ? AND restaurant_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId, restaurantId]
    );
    return conversation ? this.parseConversation(conversation) : null;
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'completed' | 'abandoned'
  ): Promise<void> {
    const updateFields: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];

    if (status !== 'active') {
      updateFields.push('ended_at = CURRENT_TIMESTAMP');
    }

    await this.db.run(
      `UPDATE voice_conversations SET ${updateFields.join(', ')} WHERE id = ?`,
      [...params, conversationId]
    );
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity(conversationId: string): Promise<void> {
    await this.db.run(
      'UPDATE voice_conversations SET last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );
  }

  /**
   * Delete a conversation (soft delete via cascade from messages)
   */
  async deleteConversation(conversationId: string, restaurantId: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM voice_conversations WHERE id = ? AND restaurant_id = ?',
      [conversationId, restaurantId]
    );
    return (result.changes || 0) > 0;
  }

  // ==================== Message Management ====================

  /**
   * Add a message to a conversation
   */
  async addMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    audioUrl?: string;
    metadata?: any;
  }): Promise<VoiceConversationMessage> {
    const messageId = `vcm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(
      `INSERT INTO voice_conversation_messages (
        id, conversation_id, role, content, audio_url, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        data.conversationId,
        data.role,
        data.content,
        data.audioUrl || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    // Update conversation activity timestamp
    await this.updateActivity(data.conversationId);

    return {
      id: messageId,
      conversation_id: data.conversationId,
      role: data.role,
      content: data.content,
      audio_url: data.audioUrl,
      metadata: data.metadata || {},
      created_at: new Date()
    };
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, limit?: number): Promise<VoiceConversationMessage[]> {
    const limitClause = limit ? `LIMIT ${Math.min(limit, this.MAX_MESSAGES_PER_CONVERSATION)}` : '';
    const messages = await this.db.all(
      `SELECT * FROM voice_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC ${limitClause}`,
      [conversationId]
    );
    return messages.map((m: any) => this.parseMessage(m));
  }

  /**
   * Get message count for a conversation
   */
  async getMessageCount(conversationId: string): Promise<number> {
    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM voice_conversation_messages WHERE conversation_id = ?',
      [conversationId]
    );
    return result?.count || 0;
  }

  /**
   * Get last N messages for a conversation
   */
  async getLastMessages(conversationId: string, count: number): Promise<VoiceConversationMessage[]> {
    // Get the total count first
    const total = await this.getMessageCount(conversationId);
    const offset = Math.max(0, total - count);

    const messages = await this.db.all(
      `SELECT * FROM voice_conversation_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC 
       LIMIT ? OFFSET ?`,
      [conversationId, count, offset]
    );
    return messages.map((m: any) => this.parseMessage(m));
  }

  // ==================== List & Query Methods ====================

  /**
   * List conversations for a restaurant with filtering
   */
  async listConversations(
    restaurantId: string,
    filters: VoiceConversationFilters = {}
  ): Promise<{ conversations: VoiceConversation[]; total: number }> {
    const { status, phoneNumber, from, to, limit = 50, offset = 0 } = filters;

    let whereClauses: string[] = ['restaurant_id = ?'];
    const params: any[] = [restaurantId];

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (phoneNumber) {
      whereClauses.push('phone_number = ?');
      params.push(phoneNumber);
    }

    if (from) {
      whereClauses.push('last_activity_at >= ?');
      params.push(from.toISOString());
    }

    if (to) {
      whereClauses.push('last_activity_at <= ?');
      params.push(to.toISOString());
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countResult = await this.db.get(
      `SELECT COUNT(*) as total FROM voice_conversations WHERE ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Get conversations
    const conversations = await this.db.all(
      `SELECT * FROM voice_conversations 
       WHERE ${whereClause} 
       ORDER BY last_activity_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      conversations: conversations.map((c: any) => this.parseConversation(c)),
      total
    };
  }

  /**
   * Get conversation with all messages
   */
  async getConversationWithMessages(
    conversationId: string,
    restaurantId: string
  ): Promise<VoiceConversationWithMessages | null> {
    const conversation = await this.getConversationById(conversationId, restaurantId);
    if (!conversation) return null;

    const [messages, messageCount] = await Promise.all([
      this.getMessages(conversationId),
      this.getMessageCount(conversationId)
    ]);

    return {
      ...conversation,
      messages,
      message_count: messageCount
    };
  }

  /**
   * Get active conversations (for resuming)
   */
  async getActiveConversations(restaurantId: string): Promise<VoiceConversation[]> {
    const conversations = await this.db.all(
      `SELECT * FROM voice_conversations 
       WHERE restaurant_id = ? AND status = 'active'
       ORDER BY last_activity_at DESC`,
      [restaurantId]
    );
    return conversations.map((c: any) => this.parseConversation(c));
  }

  // ==================== Background Cleanup ====================

  /**
   * Start the background cleanup job
   */
  private startCleanupJob(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(err => {
        logger.error('Voice conversation cleanup failed:', err);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the cleanup job
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Run cleanup for expired conversations
   */
  async runCleanup(): Promise<{ cleaned: number }> {
    try {
      const retentionDays = parseInt(process.env.VOICE_CONVERSATION_RETENTION_DAYS || String(this.DEFAULT_RETENTION_DAYS), 10);
      
      // Mark expired conversations as abandoned
      const expiredResult = await this.db.run(
        `UPDATE voice_conversations 
         SET status = 'abandoned', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE status = 'active' 
         AND last_activity_at < CURRENT_TIMESTAMP - INTERVAL '${this.INACTIVITY_TIMEOUT_MS} milliseconds'`,
      );

      // Delete old completed/abandoned conversations
      const oldResult = await this.db.run(
        `DELETE FROM voice_conversations 
         WHERE status IN ('completed', 'abandoned')
         AND created_at < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'`,
      );

      const totalCleaned = (expiredResult.changes || 0) + (oldResult.changes || 0);
      
      if (totalCleaned > 0) {
        logger.info(`Voice conversation cleanup: ${totalCleaned} records cleaned`);
      }

      return { cleaned: totalCleaned };
    } catch (error) {
      logger.error('Error during voice conversation cleanup:', error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Parse conversation from database row
   */
  private parseConversation(row: any): VoiceConversation {
    return {
      id: row.id,
      restaurant_id: row.restaurant_id,
      session_id: row.session_id,
      phone_number: row.phone_number,
      status: row.status,
      started_at: new Date(row.started_at),
      last_activity_at: new Date(row.last_activity_at),
      ended_at: row.ended_at ? new Date(row.ended_at) : undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  /**
   * Parse message from database row
   */
  private parseMessage(row: any): VoiceConversationMessage {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      audio_url: row.audio_url,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      created_at: new Date(row.created_at)
    };
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(restaurantId: string): Promise<{
    total: number;
    active: number;
    completed: number;
    abandoned: number;
    avgMessages: number;
  }> {
    const stats = await this.db.get(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned
       FROM voice_conversations 
       WHERE restaurant_id = ?`,
      [restaurantId]
    );

    const avgResult = await this.db.get(
      `SELECT AVG(msg_count) as avg_messages
       FROM (
         SELECT COUNT(*) as msg_count
         FROM voice_conversation_messages
         WHERE conversation_id IN (SELECT id FROM voice_conversations WHERE restaurant_id = ?)
         GROUP BY conversation_id
       ) as counts`,
      [restaurantId]
    );

    return {
      total: stats?.total || 0,
      active: stats?.active || 0,
      completed: stats?.completed || 0,
      abandoned: stats?.abandoned || 0,
      avgMessages: Number(avgResult?.avg_messages) || 0
    };
  }
}

export default VoiceConversationService;
