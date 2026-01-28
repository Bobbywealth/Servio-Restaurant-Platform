import { DatabaseService } from './DatabaseService';
import { JobRunnerService } from './JobRunnerService';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface CallSession {
  id: string;
  restaurant_id: string;
  provider: string;
  provider_call_id: string;
  direction: 'inbound' | 'outbound';
  from_number?: string;
  to_number?: string;
  started_at: Date;
  ended_at?: Date;
  duration_seconds?: number;
  status: string;
  audio_url?: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface CallTranscript {
  id: string;
  call_session_id: string;
  transcript_text: string;
  transcript_json: {
    turns: Array<{
      speaker: string;
      start: number;
      end: number;
      text: string;
    }>;
  };
  language: string;
  stt_provider: string;
  stt_confidence?: number;
  created_at: Date;
}

export interface CallInsights {
  id: string;
  call_session_id: string;
  summary?: string;
  intent_primary?: string;
  intents_secondary?: string[];
  outcome?: string;
  sentiment?: string;
  friction_points?: Array<{
    type: string;
    detail: string;
    timestamp: number;
  }>;
  improvement_suggestions?: Array<{
    type: string;
    title: string;
    proposed_change?: string;
    item?: string;
  }>;
  extracted_entities?: {
    items_mentioned?: string[];
    modifiers_mentioned?: string[];
    prices_discussed?: string[];
    names_captured?: string[];
  };
  quality_score?: number;
  created_at: Date;
}

export interface CallReview {
  id: string;
  call_session_id: string;
  reviewed_by?: string;
  reviewed_at?: Date;
  internal_notes?: string;
  tags?: string[];
  follow_up_action?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationFilters {
  from?: string;
  to?: string;
  intent?: string;
  outcome?: string;
  sentiment?: string;
  durationMin?: number;
  durationMax?: number;
  reviewed?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class ConversationService {
  private static instance: ConversationService;
  private openai: OpenAI;
  private _db: any = null;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
  }

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  private get db() {
    if (!this._db) {
      this._db = DatabaseService.getInstance().getDatabase();
    }
    return this._db;
  }

  // ==================== Session Management ====================

  /**
   * Create or update a call session from Vapi webhook data
   */
  async createSession(data: {
    restaurantId: string;
    provider: string;
    providerCallId: string;
    direction: 'inbound' | 'outbound';
    fromNumber?: string;
    toNumber?: string;
    startedAt: Date;
    endedAt?: Date;
    durationSeconds?: number;
    status?: string;
    audioUrl?: string;
    metadata?: any;
  }): Promise<CallSession> {
    const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Try to find existing session first
    const existing = await this.db.get(
      'SELECT * FROM call_sessions WHERE provider = ? AND provider_call_id = ?',
      [data.provider, data.providerCallId]
    );

    if (existing) {
      // Update existing session
      await this.db.run(
        `UPDATE call_sessions SET
          ended_at = ?, duration_seconds = ?, status = ?, audio_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE provider = ? AND provider_call_id = ?`,
        [
          data.endedAt?.toISOString() || null,
          data.durationSeconds || null,
          data.status || 'completed',
          data.audioUrl || null,
          data.provider,
          data.providerCallId
        ]
      );

      return {
        ...existing,
        ended_at: data.endedAt,
        duration_seconds: data.durationSeconds,
        status: data.status || 'completed',
        audio_url: data.audioUrl,
        updated_at: new Date()
      } as CallSession;
    }

    // Insert new session
    await this.db.run(
      `INSERT INTO call_sessions (
        id, restaurant_id, provider, provider_call_id, direction,
        from_number, to_number, started_at, ended_at, duration_seconds,
        status, audio_url, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        data.restaurantId,
        data.provider,
        data.providerCallId,
        data.direction,
        data.fromNumber || null,
        data.toNumber || null,
        data.startedAt.toISOString(),
        data.endedAt?.toISOString() || null,
        data.durationSeconds || null,
        data.status || 'completed',
        data.audioUrl || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    return {
      id: sessionId,
      restaurant_id: data.restaurantId,
      provider: data.provider,
      provider_call_id: data.providerCallId,
      direction: data.direction,
      from_number: data.fromNumber,
      to_number: data.toNumber,
      started_at: data.startedAt,
      ended_at: data.endedAt,
      duration_seconds: data.durationSeconds,
      status: data.status || 'completed',
      audio_url: data.audioUrl,
      metadata: data.metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Get a call session by ID
   */
  async getSessionById(sessionId: string, restaurantId: string): Promise<CallSession | null> {
    const session = await this.db.get(
      'SELECT * FROM call_sessions WHERE id = ? AND restaurant_id = ?',
      [sessionId, restaurantId]
    );
    return session || null;
  }

  /**
   * Get session by provider call ID
   */
  async getSessionByProviderCallId(provider: string, providerCallId: string): Promise<CallSession | null> {
    const session = await this.db.get(
      'SELECT * FROM call_sessions WHERE provider = ? AND provider_call_id = ?',
      [provider, providerCallId]
    );
    return session || null;
  }

  // ==================== Transcript Management ====================

  /**
   * Save a transcript for a call session
   */
  async saveTranscript(data: {
    callSessionId: string;
    transcriptText: string;
    transcriptJson?: {
      turns: Array<{
        speaker: string;
        start: number;
        end: number;
        text: string;
      }>;
    };
    language?: string;
    sttProvider?: string;
    sttConfidence?: number;
  }): Promise<CallTranscript> {
    const transcriptId = `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for existing transcript
    const existing = await this.db.get(
      'SELECT * FROM call_transcripts WHERE call_session_id = ?',
      [data.callSessionId]
    );

    if (existing) {
      // Update existing
      await this.db.run(
        `UPDATE call_transcripts SET
          transcript_text = ?, transcript_json = ?, stt_provider = ?, stt_confidence = ?
         WHERE call_session_id = ?`,
        [
          data.transcriptText,
          JSON.stringify(data.transcriptJson || { turns: [] }),
          data.sttProvider || 'vapi',
          data.sttConfidence || null,
          data.callSessionId
        ]
      );

      return {
        ...existing,
        transcript_text: data.transcriptText,
        transcript_json: data.transcriptJson || { turns: [] },
        stt_provider: data.sttProvider || 'vapi',
        stt_confidence: data.sttConfidence
      } as CallTranscript;
    }

    // Insert new transcript
    await this.db.run(
      `INSERT INTO call_transcripts (
        id, call_session_id, transcript_text, transcript_json,
        language, stt_provider, stt_confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transcriptId,
        data.callSessionId,
        data.transcriptText,
        JSON.stringify(data.transcriptJson || { turns: [] }),
        data.language || 'en',
        data.sttProvider || 'vapi',
        data.sttConfidence || null
      ]
    );

    return {
      id: transcriptId,
      call_session_id: data.callSessionId,
      transcript_text: data.transcriptText,
      transcript_json: data.transcriptJson || { turns: [] },
      language: data.language || 'en',
      stt_provider: data.sttProvider || 'vapi',
      stt_confidence: data.sttConfidence,
      created_at: new Date()
    };
  }

  /**
   * Get transcript for a session
   */
  async getTranscriptBySessionId(callSessionId: string): Promise<CallTranscript | null> {
    const transcript = await this.db.get(
      'SELECT * FROM call_transcripts WHERE call_session_id = ?',
      [callSessionId]
    );

    if (transcript) {
      if (typeof transcript.transcript_json === 'string') {
        transcript.transcript_json = JSON.parse(transcript.transcript_json);
      }
    }

    return transcript || null;
  }

  // ==================== Insights Management ====================

  /**
   * Save AI-generated insights for a call session
   */
  async saveInsights(data: {
    callSessionId: string;
    summary?: string;
    intentPrimary?: string;
    intentsSecondary?: string[];
    outcome?: string;
    sentiment?: string;
    frictionPoints?: Array<{
      type: string;
      detail: string;
      timestamp: number;
    }>;
    improvementSuggestions?: Array<{
      type: string;
      title: string;
      proposed_change?: string;
      item?: string;
    }>;
    extractedEntities?: {
      items_mentioned?: string[];
      modifiers_mentioned?: string[];
      prices_discussed?: string[];
      names_captured?: string[];
    };
    qualityScore?: number;
    analysisRaw?: string;
  }): Promise<CallInsights> {
    const insightsId = `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for existing insights
    const existing = await this.db.get(
      'SELECT * FROM call_insights WHERE call_session_id = ?',
      [data.callSessionId]
    );

    if (existing) {
      // Update existing
      await this.db.run(
        `UPDATE call_insights SET
          summary = ?, intent_primary = ?, intents_secondary = ?,
          outcome = ?, sentiment = ?, friction_points = ?,
          improvement_suggestions = ?, extracted_entities = ?,
          quality_score = ?, analysis_raw = ?
         WHERE call_session_id = ?`,
        [
          data.summary || null,
          data.intentPrimary || null,
          JSON.stringify(data.intentsSecondary || []),
          data.outcome || null,
          data.sentiment || null,
          JSON.stringify(data.frictionPoints || []),
          JSON.stringify(data.improvementSuggestions || []),
          JSON.stringify(data.extractedEntities || {}),
          data.qualityScore || null,
          data.analysisRaw || null,
          data.callSessionId
        ]
      );

      return {
        ...existing,
        summary: data.summary,
        intent_primary: data.intentPrimary,
        intents_secondary: data.intentsSecondary,
        outcome: data.outcome,
        sentiment: data.sentiment,
        friction_points: data.frictionPoints,
        improvement_suggestions: data.improvementSuggestions,
        extracted_entities: data.extractedEntities,
        quality_score: data.qualityScore
      } as CallInsights;
    }

    // Insert new insights
    await this.db.run(
      `INSERT INTO call_insights (
        id, call_session_id, summary, intent_primary, intents_secondary,
        outcome, sentiment, friction_points, improvement_suggestions,
        extracted_entities, quality_score, analysis_raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insightsId,
        data.callSessionId,
        data.summary || null,
        data.intentPrimary || null,
        JSON.stringify(data.intentsSecondary || []),
        data.outcome || null,
        data.sentiment || null,
        JSON.stringify(data.frictionPoints || []),
        JSON.stringify(data.improvementSuggestions || []),
        JSON.stringify(data.extractedEntities || {}),
        data.qualityScore || null,
        data.analysisRaw || null
      ]
    );

    return {
      id: insightsId,
      call_session_id: data.callSessionId,
      summary: data.summary,
      intent_primary: data.intentPrimary,
      intents_secondary: data.intentsSecondary,
      outcome: data.outcome,
      sentiment: data.sentiment,
      friction_points: data.frictionPoints,
      improvement_suggestions: data.improvementSuggestions,
      extracted_entities: data.extractedEntities,
      quality_score: data.qualityScore,
      created_at: new Date()
    };
  }

  /**
   * Get insights for a session
   */
  async getInsightsBySessionId(callSessionId: string): Promise<CallInsights | null> {
    const insights = await this.db.get(
      'SELECT * FROM call_insights WHERE call_session_id = ?',
      [callSessionId]
    );

    if (insights) {
      if (typeof insights.intents_secondary === 'string') {
        insights.intents_secondary = JSON.parse(insights.intents_secondary);
      }
      if (typeof insights.friction_points === 'string') {
        insights.friction_points = JSON.parse(insights.friction_points);
      }
      if (typeof insights.improvement_suggestions === 'string') {
        insights.improvement_suggestions = JSON.parse(insights.improvement_suggestions);
      }
      if (typeof insights.extracted_entities === 'string') {
        insights.extracted_entities = JSON.parse(insights.extracted_entities);
      }
    }

    return insights || null;
  }

  // ==================== Review Management ====================

  /**
   * Add or update a review for a call session
   */
  async addReview(data: {
    callSessionId: string;
    reviewedBy: string;
    internalNotes?: string;
    tags?: string[];
    followUpAction?: string;
  }): Promise<CallReview> {
    // Check for existing review
    const existing = await this.db.get(
      'SELECT * FROM call_reviews WHERE call_session_id = ?',
      [data.callSessionId]
    );

    if (existing) {
      // Update existing
      await this.db.run(
        `UPDATE call_reviews SET
          reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, internal_notes = ?,
          tags = ?, follow_up_action = ?, updated_at = CURRENT_TIMESTAMP
         WHERE call_session_id = ?`,
        [
          data.reviewedBy,
          data.internalNotes || null,
          JSON.stringify(data.tags || []),
          data.followUpAction || null,
          data.callSessionId
        ]
      );

      return {
        ...existing,
        reviewed_by: data.reviewedBy,
        reviewed_at: new Date(),
        internal_notes: data.internalNotes,
        tags: data.tags,
        follow_up_action: data.followUpAction,
        updated_at: new Date()
      } as CallReview;
    }

    // Insert new review
    const reviewId = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.run(
      `INSERT INTO call_reviews (
        id, call_session_id, reviewed_by, reviewed_at, internal_notes, tags, follow_up_action
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [
        reviewId,
        data.callSessionId,
        data.reviewedBy,
        data.internalNotes || null,
        JSON.stringify(data.tags || []),
        data.followUpAction || null
      ]
    );

    return {
      id: reviewId,
      call_session_id: data.callSessionId,
      reviewed_by: data.reviewedBy,
      reviewed_at: new Date(),
      internal_notes: data.internalNotes,
      tags: data.tags,
      follow_up_action: data.followUpAction,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Get review for a session
   */
  async getReviewBySessionId(callSessionId: string): Promise<CallReview | null> {
    const review = await this.db.get(
      'SELECT * FROM call_reviews WHERE call_session_id = ?',
      [callSessionId]
    );

    if (review) {
      if (typeof review.tags === 'string') {
        review.tags = JSON.parse(review.tags);
      }
    }

    return review || null;
  }

  // ==================== List & Query Methods ====================

  /**
   * List call sessions with filtering and pagination
   */
  async listSessions(
    restaurantId: string,
    filters: ConversationFilters = {}
  ): Promise<{ sessions: CallSession[]; total: number }> {
    const { from, to, intent, outcome, sentiment, durationMin, durationMax, reviewed, search, limit = 50, offset = 0 } = filters;

    let whereClauses: string[] = ['restaurant_id = ?'];
    const params: any[] = [restaurantId];

    if (from) {
      whereClauses.push('started_at >= ?');
      params.push(new Date(from).toISOString());
    }

    if (to) {
      whereClauses.push('started_at <= ?');
      params.push(new Date(to).toISOString());
    }

    if (intent) {
      whereClauses.push(`id IN (SELECT call_session_id FROM call_insights WHERE intent_primary = ?)`);
      params.push(intent);
    }

    if (outcome) {
      whereClauses.push(`id IN (SELECT call_session_id FROM call_insights WHERE outcome = ?)`);
      params.push(outcome);
    }

    if (sentiment) {
      whereClauses.push(`id IN (SELECT call_session_id FROM call_insights WHERE sentiment = ?)`);
      params.push(sentiment);
    }

    if (durationMin !== undefined) {
      whereClauses.push('duration_seconds >= ?');
      params.push(durationMin);
    }

    if (durationMax !== undefined) {
      whereClauses.push('duration_seconds <= ?');
      params.push(durationMax);
    }

    if (reviewed !== undefined) {
      if (reviewed) {
        whereClauses.push(`id IN (SELECT call_session_id FROM call_reviews WHERE reviewed_at IS NOT NULL)`);
      } else {
        whereClauses.push(`id NOT IN (SELECT call_session_id FROM call_reviews WHERE reviewed_at IS NOT NULL)`);
      }
    }

    if (search) {
      whereClauses.push(`(from_number LIKE ? OR to_number LIKE ? OR id IN (SELECT call_session_id FROM call_transcripts WHERE transcript_text ILIKE ?))`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countResult = await this.db.get(
      `SELECT COUNT(*) as total FROM call_sessions WHERE ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    // Get sessions with latest insights
    const sessions = await this.db.all(
      `SELECT cs.*,
        (SELECT json_build_object(
          'summary', ci.summary,
          'intent_primary', ci.intent_primary,
          'outcome', ci.outcome,
          'sentiment', ci.sentiment,
          'quality_score', ci.quality_score
         ) FROM call_insights ci WHERE ci.call_session_id = cs.id) as insights,
        (SELECT json_build_object(
          'id', cr.id,
          'reviewed_at', cr.reviewed_at
         ) FROM call_reviews cr WHERE cr.call_session_id = cs.id) as review
       FROM call_sessions cs
       WHERE ${whereClause}
       ORDER BY cs.started_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { sessions, total };
  }

  /**
   * Get full session details with transcript, insights, and review
   */
  async getSessionDetails(sessionId: string, restaurantId: string): Promise<{
    session: CallSession | null;
    transcript: CallTranscript | null;
    insights: CallInsights | null;
    review: CallReview | null;
  }> {
    const session = await this.getSessionById(sessionId, restaurantId);

    if (!session) {
      return { session: null, transcript: null, insights: null, review: null };
    }

    const [transcript, insights, review] = await Promise.all([
      this.getTranscriptBySessionId(sessionId),
      this.getInsightsBySessionId(sessionId),
      this.getReviewBySessionId(sessionId)
    ]);

    return { session, transcript, insights, review };
  }

  // ==================== Background Jobs ====================

  /**
   * Enqueue a transcription job
   */
  async enqueueTranscription(sessionId: string, restaurantId: string, audioUrl?: string): Promise<string> {
    return JobRunnerService.getInstance().addJob({
      restaurant_id: restaurantId,
      job_type: 'transcribe_call',
      payload: { sessionId, audioUrl },
      priority: 10,
      max_retries: 3
    });
  }

  /**
   * Enqueue an analysis job
   */
  async enqueueAnalysis(sessionId: string, restaurantId: string): Promise<string> {
    return JobRunnerService.getInstance().addJob({
      restaurant_id: restaurantId,
      job_type: 'analyze_call',
      payload: { sessionId },
      priority: 5,
      max_retries: 2
    });
  }

  /**
   * Handle transcription job
   */
  async handleTranscribeJob(job: any): Promise<any> {
    const { sessionId, audioUrl } = job.payload;
    const session = await this.getSessionById(sessionId, job.restaurant_id);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logger.info(`Processing transcription for session: ${sessionId}`);

    try {
      // If we have a transcript from Vapi already, skip
      const existingTranscript = await this.getTranscriptBySessionId(sessionId);
      if (existingTranscript) {
        logger.info(`Transcript already exists for session: ${sessionId}`);
        return { success: true, message: 'Transcript already exists' };
      }

      // If no audio URL and no existing transcript, mark as failed
      if (!audioUrl && !session.audio_url) {
        await this.updateSessionStatus(sessionId, 'transcript_failed');
        throw new Error('No audio URL available for transcription');
      }

      // Use Vapi's transcript if available, otherwise use OpenAI Whisper
      const finalAudioUrl = audioUrl || session.audio_url;

      if (!finalAudioUrl) {
        await this.updateSessionStatus(sessionId, 'transcript_failed');
        throw new Error('No audio URL available');
      }

      // For MVP, assume Vapi provides transcript or we use a placeholder
      // In production, this would call OpenAI Whisper or a transcription service
      logger.info(`Would transcribe audio from: ${finalAudioUrl}`);

      // For now, mark as having transcript pending status
      await this.updateSessionStatus(sessionId, 'transcript_pending');

      return { success: true, message: 'Transcription job created', audioUrl: finalAudioUrl };
    } catch (error: any) {
      logger.error(`Transcription failed for session ${sessionId}:`, error);
      await this.updateSessionStatus(sessionId, 'transcript_failed');
      throw error;
    }
  }

  /**
   * Handle analysis job
   */
  async handleAnalyzeJob(job: any): Promise<any> {
    const { sessionId } = job.payload;
    const session = await this.getSessionById(sessionId, job.restaurant_id);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    logger.info(`Processing analysis for session: ${sessionId}`);

    try {
      // Get transcript
      const transcript = await this.getTranscriptBySessionId(sessionId);

      if (!transcript) {
        // No transcript yet, retry later
        logger.warn(`No transcript available for session: ${sessionId}, will retry`);
        throw new Error('Transcript not available yet');
      }

      // Perform analysis using OpenAI
      const analysisResult = await this.analyzeTranscript(
        transcript.transcript_text,
        transcript.transcript_json
      );

      // Save insights
      await this.saveInsights({
        callSessionId: sessionId,
        ...analysisResult
      });

      // Update session status
      await this.updateSessionStatus(sessionId, 'completed');

      logger.info(`Analysis completed for session: ${sessionId}`);
      return { success: true, analysis: analysisResult };
    } catch (error: any) {
      logger.error(`Analysis failed for session ${sessionId}:`, error);

      // Check if it's a "transcript not ready" error vs actual analysis failure
      if (error.message === 'Transcript not available yet') {
        throw error; // Let the job retry
      }

      await this.updateSessionStatus(sessionId, 'analysis_failed');
      throw error;
    }
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    await this.db.run(
      'UPDATE call_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, sessionId]
    );
  }

  // ==================== AI Analysis ====================

  /**
   * Analyze a transcript using OpenAI
   */
  async analyzeTranscript(
    transcriptText: string,
    transcriptJson?: {
      turns: Array<{
        speaker: string;
        start: number;
        end: number;
        text: string;
      }>;
    }
  ): Promise<{
    summary: string;
    intentPrimary: string;
    intentsSecondary: string[];
    outcome: string;
    sentiment: string;
    frictionPoints: Array<{
      type: string;
      detail: string;
      timestamp: number;
    }>;
    improvementSuggestions: Array<{
      type: string;
      title: string;
      proposed_change?: string;
      item?: string;
    }>;
    extractedEntities: {
      items_mentioned: string[];
      modifiers_mentioned: string[];
      prices_discussed: string[];
      names_captured: string[];
    };
    qualityScore: number;
  }> {
    const analysisPrompt = `You are an AI assistant analyzing a restaurant phone call conversation.
Your task is to extract structured insights from the transcript.

# Transcript
${transcriptText}

${transcriptJson?.turns ? `
# Structured Turns
${transcriptJson.turns.map((turn, _i) => `[${turn.start}s - ${turn.end}s] ${turn.speaker}: ${turn.text}`).join('\n')}
` : ''}

# Analysis Required

Provide a JSON response with the following structure:

{
  "summary": "2-4 sentence summary of the call",
  "intent_primary": "order_placement|menu_inquiry|pricing|hours|complaint|catering|reservation|feedback|other",
  "intents_secondary": ["list", "of", "secondary", "intents"],
  "outcome": "success|abandoned|escalated|unresolved",
  "sentiment": "positive|neutral|negative",
  "friction_points": [
    {
      "type": "menu_confusion|tool_failure|long_pause|pricing_objection|policy_issue|handoff_needed|other",
      "detail": "Description of the friction point",
      "timestamp": 123.4
    }
  ],
  "improvement_suggestions": [
    {
      "type": "script|menu_data|tooling|training",
      "title": "Brief title for the suggestion",
      "proposed_change": "Description of the proposed change"
    }
  ],
  "extracted_entities": {
    "items_mentioned": ["menu items mentioned"],
    "modifiers_mentioned": ["modifiers like 'extra', 'no', 'add"],
    "prices_discussed": ["prices mentioned"],
    "names_captured": ["customer or staff names if mentioned"]
  },
  "quality_score": 0
}

# Quality Score Guidelines
- 90-100: Excellent - smooth conversation, clear outcome, no issues
- 70-89: Good - minor issues, successful outcome
- 50-69: Fair - some friction, resolved or partially resolved
- 0-49: Poor - significant issues, abandoned, or escalations

Return ONLY valid JSON, no additional text.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a restaurant call analysis expert. Always return valid JSON.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);

      // Validate and normalize the response
      return {
        summary: result.summary || 'No summary available',
        intentPrimary: result.intent_primary || 'other',
        intentsSecondary: result.intents_secondary || [],
        outcome: result.outcome || 'unresolved',
        sentiment: result.sentiment || 'neutral',
        frictionPoints: (result.friction_points || []).map((fp: any) => ({
          type: fp.type || 'other',
          detail: fp.detail || '',
          timestamp: fp.timestamp || 0
        })),
        improvementSuggestions: (result.improvement_suggestions || []).map((is: any) => ({
          type: is.type || 'script',
          title: is.title || '',
          proposed_change: is.proposed_change || '',
          item: is.item
        })),
        extractedEntities: {
          items_mentioned: result.extracted_entities?.items_mentioned || [],
          modifiers_mentioned: result.extracted_entities?.modifiers_mentioned || [],
          prices_discussed: result.extracted_entities?.prices_discussed || [],
          names_captured: result.extracted_entities?.names_captured || []
        },
        qualityScore: Math.max(0, Math.min(100, result.quality_score || 0))
      };
    } catch (error: any) {
      logger.error('OpenAI analysis failed:', error);

      // Return a minimal valid result on failure
      return {
        summary: 'Analysis failed - unable to process transcript',
        intentPrimary: 'other',
        intentsSecondary: [],
        outcome: 'unresolved',
        sentiment: 'neutral',
        frictionPoints: [],
        improvementSuggestions: [],
        extractedEntities: {
          items_mentioned: [],
          modifiers_mentioned: [],
          prices_discussed: [],
          names_captured: []
        },
        qualityScore: 0
      };
    }
  }

  // ==================== Analytics ====================

  /**
   * Get conversation analytics summary
   */
  async getAnalyticsSummary(restaurantId: string, from?: Date, to?: Date): Promise<{
    totalCalls: number;
    completedCalls: number;
    abandonedCalls: number;
    averageDuration: number;
    intentBreakdown: Record<string, number>;
    outcomeBreakdown: Record<string, number>;
    sentimentBreakdown: Record<string, number>;
    averageQualityScore: number;
  }> {
    let dateFilter = '';
    const params: any[] = [restaurantId];

    if (from) {
      dateFilter += ' AND started_at >= ?';
      params.push(from.toISOString());
    }
    if (to) {
      dateFilter += ' AND started_at <= ?';
      params.push(to.toISOString());
    }

    // Total calls
    const totalResult = await this.db.get(
      `SELECT COUNT(*) as count, AVG(duration_seconds) as avg_duration FROM call_sessions WHERE restaurant_id = ?${dateFilter}`,
      params
    );

    // Outcomes from insights
    const outcomeResult = await this.db.all(
      `SELECT outcome, COUNT(*) as count
       FROM call_insights
       WHERE call_session_id IN (SELECT id FROM call_sessions WHERE restaurant_id = ?${dateFilter.replace('started_at', 'started_at').replace('started_at', 'started_at')})
       GROUP BY outcome`,
      [restaurantId]
    );

    // Intents from insights
    const intentResult = await this.db.all(
      `SELECT intent_primary, COUNT(*) as count
       FROM call_insights
       WHERE call_session_id IN (SELECT id FROM call_sessions WHERE restaurant_id = ?${dateFilter.replace('started_at', 'started_at').replace('started_at', 'started_at')})
       GROUP BY intent_primary`,
      [restaurantId]
    );

    // Sentiment from insights
    const sentimentResult = await this.db.all(
      `SELECT sentiment, COUNT(*) as count
       FROM call_insights
       WHERE call_session_id IN (SELECT id FROM call_sessions WHERE restaurant_id = ?${dateFilter.replace('started_at', 'started_at').replace('started_at', 'started_at')})
       GROUP BY sentiment`,
      [restaurantId]
    );

    // Average quality score
    const qualityResult = await this.db.get(
      `SELECT AVG(quality_score) as avg_quality
       FROM call_insights
       WHERE call_session_id IN (SELECT id FROM call_sessions WHERE restaurant_id = ?${dateFilter.replace('started_at', 'started_at').replace('started_at', 'started_at')})
       AND quality_score IS NOT NULL`,
      [restaurantId]
    );

    // Count completed vs abandoned
    let completedCalls = 0;
    let abandonedCalls = 0;
    for (const row of outcomeResult) {
      if (row.outcome === 'success') completedCalls = row.count;
      if (row.outcome === 'abandoned') abandonedCalls = row.count;
    }

    const outcomeBreakdown: Record<string, number> = {};
    for (const row of outcomeResult) {
      outcomeBreakdown[row.outcome || 'unknown'] = row.count;
    }

    const intentBreakdown: Record<string, number> = {};
    for (const row of intentResult) {
      intentBreakdown[row.intent_primary || 'unknown'] = row.count;
    }

    const sentimentBreakdown: Record<string, number> = {};
    for (const row of sentimentResult) {
      sentimentBreakdown[row.sentiment || 'unknown'] = row.count;
    }

    return {
      totalCalls: totalResult?.count || 0,
      completedCalls,
      abandonedCalls,
      averageDuration: Number(totalResult?.avg_duration) || 0,
      intentBreakdown,
      outcomeBreakdown,
      sentimentBreakdown,
      averageQualityScore: Number(qualityResult?.avg_quality) || 0
    };
  }
}

export default ConversationService;
