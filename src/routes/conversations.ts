import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { ConversationService } from '../services/ConversationService';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const conversationService = ConversationService.getInstance();

const getRequestId = (req: Request) => {
  const headerId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-amzn-trace-id'] as string);
  return headerId || uuidv4();
};

/**
 * GET /api/conversations
 * List conversations with filtering and pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = req.user?.restaurantId;

  logger.info(`[conversations.list] entry ${JSON.stringify({ requestId, restaurantId, query: req.query })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId for conversations lookup');
  }

  const {
    from,
    to,
    intent,
    outcome,
    sentiment,
    durationMin,
    durationMax,
    reviewed,
    search,
    limit = '50',
    offset = '0'
  } = req.query;

  const filters = {
    from: from as string,
    to: to as string,
    intent: intent as string,
    outcome: outcome as string,
    sentiment: sentiment as string,
    durationMin: durationMin ? Number(durationMin) : undefined,
    durationMax: durationMax ? Number(durationMax) : undefined,
    reviewed: reviewed === 'true' ? true : reviewed === 'false' ? false : undefined,
    search: search as string,
    limit: Math.min(100, Math.max(1, Number(limit))),
    offset: Math.max(0, Number(offset))
  };

  const result = await conversationService.listSessions(restaurantId, filters);

  // Format sessions for response
  const sessions = result.sessions.map((session: any) => ({
    id: session.id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    direction: session.direction,
    fromNumber: session.from_number ? `***-***-${session.from_number.slice(-4)}` : null,
    toNumber: session.to_number,
    status: session.status,
    audioUrl: session.audio_url,
    insights: session.insights || null,
    review: session.review || null
  }));

  res.json({
    success: true,
    data: {
      sessions,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    }
  });
}));

/**
 * GET /api/conversations/:id
 * Get conversation details with transcript, insights, and review
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = req.user?.restaurantId;
  const { id } = req.params;

  logger.info(`[conversations.get] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId');
  }

  const details = await conversationService.getSessionDetails(id, restaurantId);

  if (!details.session) {
    throw new NotFoundError('Conversation not found');
  }

  // Format the response
  res.json({
    success: true,
    data: {
      session: {
        id: details.session.id,
        provider: details.session.provider,
        providerCallId: details.session.provider_call_id,
        direction: details.session.direction,
        fromNumber: details.session.from_number ? `***-***-${details.session.from_number.slice(-4)}` : null,
        toNumber: details.session.to_number,
        startedAt: details.session.started_at,
        endedAt: details.session.ended_at,
        durationSeconds: details.session.duration_seconds,
        status: details.session.status,
        audioUrl: details.session.audio_url,
        metadata: details.session.metadata
      },
      transcript: details.transcript ? {
        id: details.transcript.id,
        transcriptText: details.transcript.transcript_text,
        transcriptJson: details.transcript.transcript_json,
        language: details.transcript.language,
        sttProvider: details.transcript.stt_provider,
        sttConfidence: details.transcript.stt_confidence
      } : null,
      insights: details.insights ? {
        id: details.insights.id,
        summary: details.insights.summary,
        intentPrimary: details.insights.intent_primary,
        intentsSecondary: details.insights.intents_secondary,
        outcome: details.insights.outcome,
        sentiment: details.insights.sentiment,
        frictionPoints: details.insights.friction_points,
        improvementSuggestions: details.insights.improvement_suggestions,
        extractedEntities: details.insights.extracted_entities,
        qualityScore: details.insights.quality_score
      } : null,
      review: details.review ? {
        id: details.review.id,
        reviewedBy: details.review.reviewed_by,
        reviewedAt: details.review.reviewed_at,
        internalNotes: details.review.internal_notes,
        tags: details.review.tags,
        followUpAction: details.review.follow_up_action
      } : null
    }
  });
}));

/**
 * POST /api/conversations/:id/review
 * Add or update a review for a conversation
 */
router.post('/:id/review', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = req.user?.restaurantId;
  const userId = req.user?.id;
  const { id } = req.params;

  logger.info(`[conversations.review] entry ${JSON.stringify({ requestId, restaurantId, conversationId: id, userId })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId');
  }

  if (!userId) {
    throw new BadRequestError('User ID required');
  }

  const { internalNotes, tags, followUpAction } = req.body;

  // Verify the session exists
  const session = await conversationService.getSessionById(id, restaurantId);
  if (!session) {
    throw new NotFoundError('Conversation not found');
  }

  const review = await conversationService.addReview({
    callSessionId: id,
    reviewedBy: userId,
    internalNotes,
    tags,
    followUpAction
  });

  // Log audit event
  await DatabaseService.getInstance().logAudit(
    restaurantId,
    userId,
    'conversation_review',
    'call_review',
    review.id,
    { conversationId: id, hasNotes: !!internalNotes, tags }
  );

  res.json({
    success: true,
    data: {
      id: review.id,
      reviewedAt: review.reviewed_at,
      internalNotes: review.internal_notes,
      tags: review.tags,
      followUpAction: review.follow_up_action
    }
  });
}));

/**
 * GET /api/conversations/analytics/summary
 * Get analytics summary for conversations
 */
router.get('/analytics/summary', asyncHandler(async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const restaurantId = req.user?.restaurantId;

  logger.info(`[conversations.analytics] entry ${JSON.stringify({ requestId, restaurantId, query: req.query })}`);

  if (!restaurantId) {
    throw new BadRequestError('Missing restaurantId');
  }

  const { from, to } = req.query;

  const fromDate = from ? new Date(from as string) : undefined;
  const toDate = to ? new Date(to as string) : undefined;

  const summary = await conversationService.getAnalyticsSummary(restaurantId, fromDate, toDate);

  res.json({
    success: true,
    data: summary
  });
}));

/**
 * POST /api/internal/conversations/:id/transcribe
 * Internal endpoint to trigger transcription (admin/system use)
 */
router.post('/internal/:id/transcribe', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { audioUrl } = req.body;

  logger.info(`[conversations.internal.transcribe] ${id}`);

  // Get the session first
  const db = DatabaseService.getInstance().getDatabase();
  const session = await db.get('SELECT * FROM call_sessions WHERE id = ?', [id]);

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Enqueue transcription job
  const jobId = await conversationService.enqueueTranscription(id, session.restaurant_id, audioUrl);

  // Update session status
  await db.run(
    'UPDATE call_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['transcript_pending', id]
  );

  res.json({
    success: true,
    data: { jobId, status: 'transcript_pending' }
  });
}));

/**
 * POST /api/internal/conversations/:id/analyze
 * Internal endpoint to trigger analysis (admin/system use)
 */
router.post('/internal/:id/analyze', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  logger.info(`[conversations.internal.analyze] ${id}`);

  // Get the session first
  const db = DatabaseService.getInstance().getDatabase();
  const session = await db.get('SELECT * FROM call_sessions WHERE id = ?', [id]);

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  // Enqueue analysis job
  const jobId = await conversationService.enqueueAnalysis(id, session.restaurant_id);

  // Update session status
  await db.run(
    'UPDATE call_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['analyzing', id]
  );

  res.json({
    success: true,
    data: { jobId, status: 'analyzing' }
  });
}));

export default router;
