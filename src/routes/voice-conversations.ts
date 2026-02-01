// @ts-nocheck
import { Router, Request, Response } from 'express';
import { VoiceConversationService } from '../services/VoiceConversationService';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const isString = (value: unknown): value is string => typeof value === 'string';
const asRestaurantId = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  if (isString(value)) {
    return value;
  }
  return '';
};

const router = Router();
const voiceConversationService = VoiceConversationService.getInstance();

const getRequestId = (req: Request) => {
  const headerId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-amzn-trace-id'] as string);
  return headerId || uuidv4();
};

/**
 * GET /api/voice-conversations
 * List voice conversations with filtering and pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = asRestaurantId(req.user?.restaurantId);

  logger.info(`[voice-conversations.list] entry ${JSON.stringify({ requestId, restaurantId, query: req.query })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversations lookup');
  }

  const {
    status,
    phoneNumber,
    from,
    to,
    limit = '50',
    offset = '0'
  } = req.query;

  const filters = {
    status: status as 'active' | 'completed' | 'abandoned' | undefined,
    phoneNumber: phoneNumber as string | undefined,
    from: from ? new Date(from as string) : undefined,
    to: to ? new Date(to as string) : undefined,
    limit: Math.min(100, Math.max(1, Number(limit))),
    offset: Math.max(0, Number(offset))
  };

  const result = await voiceConversationService.listConversations(restaurantId, filters);

  // Format conversations for response
  const conversations = result.conversations.map((conv) => ({
    id: conv.id,
    sessionId: conv.session_id,
    phoneNumber: conv.phone_number,
    status: conv.status,
    startedAt: conv.started_at,
    lastActivityAt: conv.last_activity_at,
    endedAt: conv.ended_at,
    messageCount: 0, // Will be fetched separately if needed
    createdAt: conv.created_at,
    updatedAt: conv.updated_at
  }));

  res.json({
    success: true,
    data: {
      conversations,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    }
  });
}));

/**
 * GET /api/voice-conversations/stats
 * Get conversation statistics for the restaurant
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = asRestaurantId(req.user?.restaurantId);

  logger.info(`[voice-conversations.stats] entry ${JSON.stringify({ requestId, restaurantId })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversations stats');
  }

  const stats = await voiceConversationService.getStatistics(restaurantId);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/voice-conversations/active
 * Get active conversations for the restaurant
 */
router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = asRestaurantId(req.user?.restaurantId);

  logger.info(`[voice-conversations.active] entry ${JSON.stringify({ requestId, restaurantId })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for active voice conversations');
  }

  const conversations = await voiceConversationService.getActiveConversations(restaurantId);

  const formattedConversations = conversations.map((conv) => ({
    id: conv.id,
    sessionId: conv.session_id,
    phoneNumber: conv.phone_number,
    status: conv.status,
    startedAt: conv.started_at,
    lastActivityAt: conv.last_activity_at,
    messageCount: 0,
    createdAt: conv.created_at
  }));

  res.json({
    success: true,
    data: {
      conversations: formattedConversations,
      count: formattedConversations.length
    }
  });
}));

/**
 * GET /api/voice-conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const { id } = req.params;
  const restaurantId = asRestaurantId(req.user?.restaurantId);

  logger.info(`[voice-conversations.get] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversation lookup');
  }

  if (!id) {
    throw new BadRequestError('Missing conversation ID');
  }

  // @ts-ignore
  const conversation = await voiceConversationService.getConversationWithMessages(id, asRestaurantId(restaurantId) as string);

  if (!conversation) {
    throw new NotFoundError('Voice conversation not found');
  }

  // Format messages for response
  const messages = conversation.messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    audioUrl: msg.audio_url,
    createdAt: msg.created_at
  }));

  res.json({
    success: true,
    data: {
      id: conversation.id,
      sessionId: conversation.session_id,
      phoneNumber: conversation.phone_number,
      status: conversation.status,
      startedAt: conversation.started_at,
      lastActivityAt: conversation.last_activity_at,
      endedAt: conversation.ended_at,
      messageCount: conversation.message_count,
      messages,
      metadata: conversation.metadata,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at
    }
  });
}));

/**
 * GET /api/voice-conversations/:id/messages
 * Get messages for a specific conversation
 */
router.get('/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const { id } = req.params;
  const restaurantId = asRestaurantId(req.user?.restaurantId);
  const { limit = '100' } = req.query;

  logger.info(`[voice-conversations.messages] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversation messages lookup');
  }

  if (!id) {
    throw new BadRequestError('Missing conversation ID');
  }

  // Verify conversation exists and belongs to restaurant
  const conversation = await voiceConversationService.getConversationById(id, asRestaurantId(restaurantId) as string);

  if (!conversation) {
    throw new NotFoundError('Voice conversation not found');
  }

  const messages = await voiceConversationService.getMessages(id, Number(limit));

  const formattedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    audioUrl: msg.audio_url,
    createdAt: msg.created_at
  }));

  res.json({
    success: true,
    data: {
      conversationId: id,
      messages: formattedMessages,
      count: formattedMessages.length
    }
  });
}));

/**
 * PATCH /api/voice-conversations/:id/status
 * Update conversation status
 */
router.patch('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const { id } = req.params;
  const restaurantId = asRestaurantId(req.user?.restaurantId);
  const { status } = req.body;

  logger.info(`[voice-conversations.updateStatus] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id, status })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversation status update');
  }

  if (!id) {
    throw new BadRequestError('Missing conversation ID');
  }

  if (!status || !['active', 'completed', 'abandoned'].includes(status)) {
    throw new BadRequestError('Invalid status. Must be: active, completed, or abandoned');
  }

  // Verify conversation exists
  const conversation = await voiceConversationService.getConversationById(id, asRestaurantId(restaurantId) as string);

  if (!conversation) {
    throw new NotFoundError('Voice conversation not found');
  }

  await voiceConversationService.updateConversationStatus(id, status);

  res.json({
    success: true,
    data: {
      id,
      status,
      message: `Conversation status updated to ${status}`
    }
  });
}));

/**
 * DELETE /api/voice-conversations/:id
 * Delete a conversation
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const { id } = req.params;
  const restaurantId = asRestaurantId(req.user?.restaurantId);

  logger.info(`[voice-conversations.delete] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for voice conversation deletion');
  }

  if (!id) {
    throw new BadRequestError('Missing conversation ID');
  }

  const deleted = await voiceConversationService.deleteConversation(id, asRestaurantId(restaurantId) as string);

  if (!deleted) {
    throw new NotFoundError('Voice conversation not found');
  }

  res.json({
    success: true,
    data: {
      id,
      message: 'Conversation deleted successfully'
    }
  });
}));

/**
 * POST /api/voice-conversations/:id/messages
 * Add a message to a conversation (manual entry)
 */
router.post('/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const { id } = req.params;
  const restaurantId = asRestaurantId(req.user?.restaurantId);
  const { role, content, audioUrl } = req.body;

  logger.info(`[voice-conversations.addMessage] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id, role })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for adding message');
  }

  if (!id) {
    throw new BadRequestError('Missing conversation ID');
  }

  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    throw new BadRequestError('Invalid role. Must be: user, assistant, or system');
  }

  if (!content || typeof content !== 'string') {
    throw new BadRequestError('Message content is required');
  }

  // Verify conversation exists
  const conversation = await voiceConversationService.getConversationById(id, asRestaurantId(restaurantId) as string);

  if (!conversation) {
    throw new NotFoundError('Voice conversation not found');
  }

  const message = await voiceConversationService.addMessage({
    conversationId: id,
    role,
    content,
    audioUrl,
    metadata: { addedBy: req.user?.id || 'unknown' }
  });

  res.json({
    success: true,
    data: {
      id: message.id,
      role: message.role,
      content: message.content,
      audioUrl: message.audio_url,
      createdAt: message.created_at
    }
  });
}));

export default router;
