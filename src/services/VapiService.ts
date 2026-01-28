import { AssistantService } from './AssistantService';
import { DatabaseService } from './DatabaseService';
import { VoiceOrderingService } from './VoiceOrderingService';
import { logger } from '../utils/logger';

export interface VapiWebhookPayload {
  message: {
    type: 'assistant-request' | 'function-call' | 'tool-calls' | 'hang' | 'speech-update' | 'transcript' | 'end-of-call-report' | 'conversation-update' | 'status-update';
    call?: {
      id: string;
      orgId: string;
      createdAt: string;
      updatedAt: string;
      type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
      phoneNumberId?: string;
      customer?: {
        number: string;
      };
      status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
    };
    transcript?: string;
    functionCall?: {
      name: string;
      parameters: Record<string, any>;
    };
    toolCalls?: Array<{
      name: string;
      parameters: Record<string, any>;
    }>;
    endedReason?: 'assistant-error' | 'pipeline-error-openai-llm-failed' | 'db-error' | 'assistant-not-found' | 'license-check-failed' | 'pipeline-error-voice-model-failed' | 'assistant-not-invalid' | 'assistant-request-failed' | 'unknown-error' | 'vonage-disconnected' | 'vonage-failed-to-connect-call' | 'phone-call-provider-bypass-enabled-but-no-call-received' | 'vapid-not-found' | 'assistant-ended-call' | 'customer-ended-call' | 'customer-did-not-answer' | 'customer-did-not-give-microphone-permission' | 'assistant-said-end-call-phrase' | 'customer-was-idle' | 'reached-max-duration' | 'reached-max-function-calls' | 'exceeded-max-duration' | 'cancelled' | 'pipeline-error-exceeded-tokens' | 'sip-gateway-failed-to-connect-call' | 'twilio-failed-to-connect-call' | 'assistant-said-message-with-end-call-enabled' | 'silence-timed-out';
  };
}

export interface VapiResponse {
  result?: string | Record<string, any>;
  error?: string;
  forwardToNumber?: string;
}

export class VapiService {
  private assistantService: AssistantService;

  constructor() {
    this.assistantService = new AssistantService();
  }

  private normalizeToolName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '';

    const stripped = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    const lower = stripped.toLowerCase();
    const aliases: Record<string, string> = {
      getstorestatus: 'getStoreStatus',
      searchmenu: 'searchMenu',
      getmenuitem: 'getMenuItem',
      getmenuitembyname: 'getMenuItemByName',
      getitemmodifiers: 'getItemModifiers',
      quoteorder: 'quoteOrder',
      createorder: 'createOrder',
      checkorderstatus: 'checkOrderStatus',
      lookupcustomer: 'lookupCustomer'
    };

    if (aliases[lower]) {
      return aliases[lower];
    }

    if (lower.includes('store') && lower.includes('status')) {
      return 'getStoreStatus';
    }
    if (lower.includes('menu') && lower.includes('search')) {
      return 'searchMenu';
    }
    if (lower.includes('menu') && lower.includes('item')) {
      return 'getMenuItem';
    }
    if (lower.includes('item') && lower.includes('modifier')) {
      return 'getItemModifiers';
    }
    if (lower.includes('order') && lower.includes('quote')) {
      return 'quoteOrder';
    }
    if (lower.includes('order') && (lower.includes('create') || lower.includes('place') || lower.includes('submit'))) {
      return 'createOrder';
    }
    if (lower.includes('order') && lower.includes('status')) {
      return 'checkOrderStatus';
    }

    return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  }

  async handleWebhook(payload: VapiWebhookPayload): Promise<VapiResponse> {
    console.log('🔵 [VAPI WEBHOOK] Type:', payload?.message?.type || (payload as any)?.type);
    console.log('🔵 [VAPI WEBHOOK] Full payload:', JSON.stringify(payload, null, 2));
    const { message } = payload;
    
    logger.info('Vapi webhook received:', {
      type: message.type,
      callId: message.call?.id
    });
    logger.info('[vapi] webhook_type', { type: message.type });
    logger.info('[vapi] webhook_payload', { payload: this.safeStringify(payload) });

    try {
      switch (message.type) {
        case 'assistant-request':
          return await this.handleAssistantRequest(message);
        
        case 'function-call':
          logger.info('[vapi] webhook_route', { type: message.type, route: 'function-call' });
          return await this.handleFunctionCall(message);

        case 'tool-calls':
          logger.info('[vapi] webhook_route', { type: message.type, route: 'tool-calls' });
          return await this.handleToolCalls(message);
        
        case 'end-of-call-report':
          return await this.handleEndOfCall(message);
          
        case 'transcript':
          // Log transcript for analytics
          await this.logTranscript(message);
          return { result: 'transcript logged' };

        case 'conversation-update':
        case 'speech-update':
        case 'status-update':
          return { result: 'acknowledged' };
          
        default:
          logger.info(`Unhandled webhook type: ${message.type}`);
          return { result: 'acknowledged' };
      }
    } catch (error) {
      logger.error('Vapi webhook error:', error);
      return { error: 'Internal server error' };
    }
  }

  private safeStringify(value: any, maxLength = 8000): string {
    try {
      const json = JSON.stringify(value, null, 2);
      if (json.length <= maxLength) {
        return json;
      }
      return `${json.slice(0, maxLength)}...`;
    } catch (error) {
      return `[unserializable payload: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  private async handleAssistantRequest(message: any): Promise<VapiResponse> {
    if (!message.transcript) {
      return {
        result: "Hi! Welcome to our restaurant. I'm Servio, your AI assistant. I can help you place an order, check our menu, or answer questions about our food. What would you like today?"
      };
    }

    // Use existing assistant service but with phone-specific context
    const userId = this.getPhoneUserId(message.call?.customer?.number);
    
    try {
      const result = await this.assistantService.processText(message.transcript, userId);
      
      // Format response for voice (remove visual references)
      const phoneResponse = this.formatForVoice(result.response);
      
      return {
        result: phoneResponse
      };
    } catch (error) {
      logger.error('Assistant request failed:', error);
      return {
        result: "I'm sorry, I'm having trouble right now. Let me transfer you to someone who can help."
      };
    }
  }

  private async handleFunctionCall(message: any): Promise<VapiResponse> {
    if (!message.functionCall) {
      logger.warn('[vapi] function-call missing functionCall data', { callId: message.call?.id });
      return { error: 'No function call data provided' };
    }

    const { name, parameters } = message.functionCall;
    const res = await this.executeToolCall(name, parameters, message);
    return res.error ? { error: res.error } : { result: this.formatActionResultForVoice(res.result) };
  }

  /**
   * Handle Vapi "tool-calls" server message.
   *
   * Docs expect a response like:
   *   { results: [{ name, toolCallId, result: "<json-string>" }] }
   * where toolCallId is the id from the incoming tool call.
   */
  private async handleToolCalls(message: any): Promise<any> {
    const normalizeToolCall = (raw: any) => {
      if (!raw || typeof raw !== 'object') return null;
      const toolCall = raw.toolCall || raw;
      const toolFunction = toolCall?.function || raw?.function || raw?.toolCall?.function;
      const name =
        raw?.name ||
        toolCall?.name ||
        toolFunction?.name ||
        toolCall?.toolName ||
        raw?.toolName;
      const parameters =
        toolCall?.parameters ??
        toolCall?.arguments ??
        toolFunction?.arguments ??
        raw?.parameters ??
        raw?.arguments;
      const id = toolCall?.id || raw?.id;
      return { id, name, parameters };
    };

    const toolCallList: Array<{ id?: string; name?: string; parameters?: any }> =
      (Array.isArray(message.toolCallList)
        ? message.toolCallList.map(normalizeToolCall).filter(Boolean)
        : null) ||
      (Array.isArray(message.toolCalls)
        ? message.toolCalls.map(normalizeToolCall).filter(Boolean)
        : null) ||
      (Array.isArray(message.toolWithToolCallList)
        ? message.toolWithToolCallList
            .map((t: any) => normalizeToolCall({ toolCall: t?.toolCall, name: t?.name }))
            .filter(Boolean)
        : []);

    if (!toolCallList.length) {
      logger.warn('[vapi] tool-calls missing toolCallList', {
        callId: message.call?.id,
        keys: message && typeof message === 'object' ? Object.keys(message) : undefined
      });
      // For tool-calls, returning an empty results array is safer than an arbitrary "ack".
      return { results: [] };
    }

    const results: Array<{ name: string; toolCallId?: string; result: string; error?: string }> = [];

    for (const tc of toolCallList) {
      const name = String(tc?.name || '').trim();
      const toolCallId = typeof tc?.id === 'string' ? tc.id : undefined;
      const params = tc?.parameters || {};
      const exec = name
        ? await this.executeToolCall(name, params, message)
        : { error: 'Missing tool name' };

      // Vapi expects `result` to be a string (often JSON-stringified).
      const payload = exec.error ? { ok: false, error: exec.error } : exec.result ?? { ok: true };
      results.push({
        name: name || 'unknown',
        toolCallId,
        result: JSON.stringify(payload),
        ...(exec.error ? { error: exec.error } : {})
      });
    }

    return { results };
  }

  private async getRestaurantIdFromParams(
    parameters: any,
    message?: any
  ): Promise<{ restaurantId: string | null; restaurantSlug: string | null; source: string }> {
    const safeGet = (root: any, path: string[]): any => {
      return path.reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), root);
    };
    // 1) explicit tool parameters (preferred)
    const fromParams =
      (parameters && (parameters as any).restaurantId) ||
      (parameters && (parameters as any).restaurant_id) ||
      safeGet(parameters, ['restaurant', 'id']) ||
      safeGet(parameters, ['restaurant', 'restaurantId']);
    if (typeof fromParams === 'string' && fromParams.trim()) {
      return { restaurantId: fromParams.trim(), restaurantSlug: null, source: 'parameters.restaurantId' };
    }

    // 2) webhook payload metadata (no JWT for Vapi)
    const fromPayload =
      (message && (message as any).restaurantId) ||
      safeGet(message, ['metadata', 'restaurantId']) ||
      safeGet(message, ['call', 'restaurantId']) ||
      safeGet(message, ['call', 'metadata', 'restaurantId']);
    if (typeof fromPayload === 'string' && fromPayload.trim()) {
      return { restaurantId: fromPayload.trim(), restaurantSlug: null, source: 'payload.metadata' };
    }

    // 3) map phoneNumberId -> restaurantId (optional)
    const phoneNumberId = safeGet(message, ['call', 'phoneNumberId']);
    const mapRaw = process.env.VAPI_PHONE_NUMBER_RESTAURANT_MAP;
    if (phoneNumberId && mapRaw) {
      try {
        const parsed = JSON.parse(mapRaw) as Record<string, string>;
        const mapped = parsed?.[String(phoneNumberId)];
        if (mapped) {
          return { restaurantId: String(mapped), restaurantSlug: null, source: 'env.VAPI_PHONE_NUMBER_RESTAURANT_MAP' };
        }
      } catch {
        // ignore map parse errors
      }
    }

    // 4) look up phoneNumberId in restaurant settings (db)
    if (phoneNumberId) {
      try {
        const db = DatabaseService.getInstance().getDatabase();
        const rows = await db.all('SELECT id, settings FROM restaurants');
        for (const row of rows || []) {
          const rawSettings = row?.settings;
          if (!rawSettings) continue;
          let parsed: any = null;
          if (typeof rawSettings === 'object') {
            parsed = rawSettings;
          } else if (typeof rawSettings === 'string') {
            try {
              parsed = JSON.parse(rawSettings);
            } catch {
              parsed = null;
            }
          }
          const storedPhoneNumberId = parsed?.vapi?.phoneNumberId;
          if (storedPhoneNumberId && String(storedPhoneNumberId) === String(phoneNumberId)) {
            return { restaurantId: String(row.id), restaurantSlug: null, source: 'db.vapi.phoneNumberId' };
          }
        }
      } catch (error) {
        logger.warn('[vapi] phoneNumberId lookup failed', {
          callId: message?.call?.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 5) assistant config fallback (environment)
    const fromEnv = process.env.VAPI_RESTAURANT_ID;
    if (typeof fromEnv === 'string' && fromEnv.trim()) {
      return { restaurantId: fromEnv.trim(), restaurantSlug: null, source: 'env.VAPI_RESTAURANT_ID' };
    }

    const fromSlug =
      (parameters && (parameters as any).restaurantSlug) ||
      (parameters && (parameters as any).restaurant_slug) ||
      safeGet(parameters, ['restaurant', 'slug']) ||
      (parameters && (parameters as any).slug) ||
      parameters?.restaurantSlug ??
      parameters?.restaurant_slug ??
      parameters?.restaurant?.slug ??
      parameters?.slug ??
      process.env.VAPI_RESTAURANT_SLUG;
    if (typeof fromSlug === 'string' && fromSlug.trim()) {
      return { restaurantId: null, restaurantSlug: fromSlug.trim(), source: 'parameters.restaurantSlug' };
    }

    return { restaurantId: null, restaurantSlug: null, source: 'missing' };
  }

  private normalizeToolParameters(raw: any): Record<string, any> {
    if (!raw) return {};

    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return { q: raw };
      }
    }

    const unwrapIfString = (value: any) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };

    const fromArguments = unwrapIfString((raw as any)?.arguments);
    if (fromArguments && typeof fromArguments === 'object') {
      return fromArguments;
    }

    const fromParameters = unwrapIfString((raw as any)?.parameters);
    if (fromParameters && typeof fromParameters === 'object') {
      return fromParameters;
    }

    const fromInput = unwrapIfString((raw as any)?.input);
    if (fromInput && typeof fromInput === 'object') {
      return { ...raw, input: fromInput };
    }

    return raw;
  }

  private async executeToolCall(name: string, parameters: any, message: any): Promise<{ result?: any; error?: string }> {
    if (!name || !name.trim()) {
      return { error: 'Missing tool name' };
    }
    const callId = message.call?.id;
    const requestId = callId || `vapi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const normalizedParameters = this.normalizeToolParameters(parameters);
    const { restaurantId: rawRestaurantId, restaurantSlug, source: restaurantIdSource } =
      await this.getRestaurantIdFromParams(normalizedParameters, message);
    const resolvedFromSlug = !rawRestaurantId && restaurantSlug
      ? await VoiceOrderingService.getInstance().resolveRestaurantIdFromSlug(restaurantSlug)
      : null;
    const restaurantId = rawRestaurantId || resolvedFromSlug;
    const resolvedRestaurantIdSource = rawRestaurantId
      ? restaurantIdSource
      : resolvedFromSlug
        ? 'db.slug_lookup'
        : restaurantIdSource;
    const startedAt = Date.now();

    logger.info('[vapi] tool_call_start', { requestId, callId, toolName: name });

    const normalizedName = this.normalizeToolName(name);
    if (!normalizedName) {
      return { error: 'Missing tool name' };
    }

    try {
      let result;
      switch (normalizedName) {
        case 'getStoreStatus':
          result = await VoiceOrderingService.getInstance().getStoreStatus(restaurantId);
          break;
        case 'searchMenu': {
          // Log raw parameters to diagnose what Vapi is actually sending
          logger.info('[vapi] searchMenu raw_params', { requestId, callId, params: JSON.stringify(normalizedParameters) });

          const q =
            normalizedParameters?.q ??
            normalizedParameters?.query ??
            normalizedParameters?.text ??
            normalizedParameters?.name ??
            normalizedParameters?.itemName ??
            normalizedParameters?.search ??
            normalizedParameters?.searchQuery ??
            normalizedParameters?.searchTerm ??
            normalizedParameters?.term ??
            normalizedParameters?.item ??
            normalizedParameters?.menuItem ??
            normalizedParameters?.menuItemName ??
            normalizedParameters?.food ??
            normalizedParameters?.menu ??
            normalizedParameters?.input?.query ??
            normalizedParameters?.input?.text ??
            '';
          const query = String(q || '').trim();
          logger.info('[vapi] searchMenu', {
            requestId,
            callId,
            restaurantId,
            restaurantIdSource: resolvedRestaurantIdSource,
            restaurantSlug,
            query
          });

          if (!query) {
            logger.warn('[vapi] searchMenu empty_query', {
              requestId,
              callId,
              restaurantId,
              restaurantIdSource: resolvedRestaurantIdSource
            });
            result = {
              ok: false,
              reason: 'empty_query',
              message: 'Please provide a menu item or category to search.',
              query
            };
            break;
          }

          // Requirement: restaurantId must be present.
          if (!restaurantId) {
            result = {
              ok: false,
              reason: 'bad_restaurant_id',
              message: 'restaurantId is required for searchMenu',
              query
            };
            break;
          }

          const { items, debug } = await VoiceOrderingService.getInstance().searchMenuLiveWithDebug(query, restaurantId);
          const reason =
            !debug.rowsBeforeFiltering
              ? 'no_rows'
              : items.length
                ? null
                : 'no_match';

          result = {
            ok: true,
            restaurantId,
            query,
            count: items.length,
            items,
            ...(reason ? { reason } : {}),
            debug
          };
          break;
        }
        case 'getMenuItem': {
          const idOrName =
            normalizedParameters?.id ??
            normalizedParameters?.itemId ??
            normalizedParameters?.menuItemId ??
            normalizedParameters?.name ??
            normalizedParameters?.itemName ??
            normalizedParameters?.input?.id ??
            normalizedParameters?.input?.name ??
            '';
          const item = await VoiceOrderingService.getInstance().getMenuItemLive(String(idOrName || ''), restaurantId);
          // Always return an object so Vapi never reports "No result returned".
          result = item
            ? { ok: true, found: true, item }
            : { ok: true, found: false, message: 'Menu item not found', idOrName: String(idOrName || '') };
          break;
        }
        case 'getMenuItemByName': {
          const idOrName =
            normalizedParameters?.name ??
            normalizedParameters?.id ??
            normalizedParameters?.itemId ??
            normalizedParameters?.input?.name ??
            normalizedParameters?.input?.id ??
            '';
          const item = await VoiceOrderingService.getInstance().getMenuItemLive(String(idOrName || ''), restaurantId);
          result = item
            ? { ok: true, found: true, item }
            : { ok: true, found: false, message: 'Menu item not found', idOrName: String(idOrName || '') };
          break;
        }
        case 'getItemModifiers': {
          const itemId =
            normalizedParameters?.itemId ??
            normalizedParameters?.id ??
            normalizedParameters?.menuItemId ??
            normalizedParameters?.input?.itemId ??
            normalizedParameters?.input?.id ??
            '';

          if (!itemId) {
            result = { ok: false, error: 'itemId is required' };
            break;
          }

          if (!restaurantId) {
            result = { ok: false, error: 'restaurantId is required' };
            break;
          }

          const voiceService = VoiceOrderingService.getInstance();
          const modifiers = await voiceService.getItemModifiersForVapi(String(itemId), restaurantId);
          const autoApplied = await voiceService.getAutoAppliedModifiers(String(itemId), restaurantId);

          result = {
            ok: true,
            itemId: String(itemId),
            hasModifiers: modifiers.length > 0,
            modifierCount: modifiers.length,
            modifiers,
            // Auto-applied defaults (like gravy type) - include these in the order without asking
            autoAppliedDefaults: autoApplied,
            autoAppliedCount: autoApplied.length
          };
          break;
        }
        case 'lookupCustomer': {
          const phone = normalizedParameters?.phone || message.call?.customer?.number;
          if (!phone) {
            result = {
              found: false,
              message: 'Phone number is required for customer lookup'
            };
            break;
          }
          if (!restaurantId) {
            result = {
              found: false,
              message: 'Restaurant ID is required for customer lookup'
            };
            break;
          }
          const lookupResult = await VoiceOrderingService.getInstance().lookupCustomerByPhone(phone, restaurantId);
          result = lookupResult;
          break;
        }
        case 'quoteOrder':
          normalizedParameters.restaurantId = restaurantId;
          result = await VoiceOrderingService.getInstance().validateQuote(normalizedParameters);
          break;
        case 'createOrder': {
          normalizedParameters.callId = normalizedParameters.callId || message.call?.id;
          normalizedParameters.source = normalizedParameters.source || 'vapi';
          if (!normalizedParameters.customer) normalizedParameters.customer = {};

          // Handle top-level customerName and phoneNumber fields (for backward compatibility with VAPI AI)
          if (normalizedParameters.customerName && !normalizedParameters.customer.name) {
            normalizedParameters.customer.name = normalizedParameters.customerName;
            delete normalizedParameters.customerName;
          }
          if (normalizedParameters.phoneNumber && !normalizedParameters.customer.phone) {
            normalizedParameters.customer.phone = normalizedParameters.phoneNumber;
            delete normalizedParameters.phoneNumber;
          }

          normalizedParameters.customer.phone =
            normalizedParameters.customer.phone || message.call?.customer?.number;
          if (!normalizedParameters.customer.lastInitial && normalizedParameters.customer.name) {
            const parts = String(normalizedParameters.customer.name).trim().split(/\s+/);
            const last = parts[parts.length - 1];
            normalizedParameters.customer.lastInitial = last ? last[0]?.toUpperCase() : undefined;
          }
          normalizedParameters.restaurantId = restaurantId;
          result = await VoiceOrderingService.getInstance().createOrder(normalizedParameters);
          break;
        }
        case 'check_order_status':
        case 'checkOrderStatus':
          result = await this.handleCheckOrderStatus(
            normalizedParameters,
            this.getPhoneUserId(message.call?.customer?.number)
          );
          break;
        default: {
          logger.warn('[vapi] unknown_tool', { requestId, callId, toolName: name, normalizedName });
          const mockToolCall = {
            id: 'phone_call',
            type: 'function' as const,
            function: {
              name,
              arguments: JSON.stringify(normalizedParameters)
            }
          };
          result = await (this.assistantService as any).executeTool(mockToolCall, this.getPhoneUserId(message.call?.customer?.number));
        }
      }

      const durationMs = Date.now() - startedAt;
      if (result?.status === 'error') {
        logger.warn('[vapi] tool_call_error_result', { requestId, callId, toolName: name });
        return { result };
      }
      if (result === null || result === undefined) {
        logger.warn('[vapi] tool_call_empty_result', { requestId, callId, toolName: name, durationMs });
        return { result: { message: 'no result' } };
      }

      logger.info('[vapi] tool_call_success', { requestId, callId, toolName: name, durationMs });
      return { result };
    } catch (error) {
      logger.error('[vapi] tool_call_error', { callId, requestId, toolName: name, error: error instanceof Error ? error.message : String(error) });
      return { error: 'Internal server error' };
    }
  }

  public async executeToolRequest(
    toolName: string,
    parameters: any,
    context?: {
      callId?: string | null;
      customerNumber?: string | null;
      phoneNumberId?: string | null;
    }
  ): Promise<{ result?: any; error?: string }> {
    const callId = context?.callId || undefined;
    const customerNumber = context?.customerNumber || undefined;
    const phoneNumberId = context?.phoneNumberId || undefined;
    const message = {
      call: callId || customerNumber || phoneNumberId
        ? {
            id: callId,
            phoneNumberId,
            customer: customerNumber ? { number: customerNumber } : undefined
          }
        : undefined
    };

    return this.executeToolCall(toolName, parameters, message);
  }

  private async handleEndOfCall(message: any): Promise<VapiResponse> {
    const callId = message.call?.id;
    const customerNumber = message.call?.customer?.number;
    const duration = message.call?.duration;
    const endedReason = message.endedReason;
    const direction = message.call?.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';
    const startedAt = message.call?.startedAt ? new Date(message.call.startedAt) : new Date();
    const restaurantId = process.env.VAPI_RESTAURANT_ID || 'demo-restaurant-1';

    // Log the call for analytics
    await DatabaseService.getInstance().logAudit(
      restaurantId,
      null,
      'phone_call_ended',
      'call',
      callId,
      { duration, endedReason, customerNumber }
    );

    logger.info(`Call ${callId} ended: ${endedReason}, duration: ${duration}s`);

    // Create session in call_sessions table for Conversation Intelligence
    try {
      const { ConversationService } = await import('./ConversationService');
      const existingSession = await ConversationService.getInstance().getSessionByProviderCallId('vapi', callId);
      
      if (!existingSession) {
        // Create new session
        const session = await ConversationService.getInstance().createSession({
          restaurantId,
          provider: 'vapi',
          providerCallId: callId,
          direction,
          fromNumber: customerNumber,
          startedAt,
          endedAt: new Date(),
          durationSeconds: duration,
          status: 'transcript_pending',
          audioUrl: undefined
        });
        logger.info(`Created conversation session: ${session.id}`);
      } else {
        // Update existing session
        await ConversationService.getInstance().updateSessionStatus(existingSession.id, 'completed');
        logger.info(`Updated existing session: ${existingSession.id}`);
      }
    } catch (error) {
      logger.error(`Failed to create/update session for call ${callId}:`, error);
    }

    // Persist a call log row (used by Voice Hub to match inbound calls to orders)
    if (callId) {
      await VoiceOrderingService.getInstance().logCall({
        callId,
        fromPhone: customerNumber,
        transcript: message.transcript,
        summary: {
          duration,
          endedReason,
          customerNumber
        }
      });
    }
    
    return { result: 'call logged' };
  }

  private async logTranscript(message: any): Promise<void> {
    const callId = message.call?.id;
    const customerNumber = message.call?.customer?.number;
    const transcript = message.transcript;

    // Log for training/improvement purposes
    logger.info(`Call ${callId} transcript:`, transcript);
    
    // Store transcript so Voice Hub can show it (and match to orders)
    if (callId && transcript) {
      await VoiceOrderingService.getInstance().logCall({
        callId,
        fromPhone: customerNumber,
        transcript
      });

      // Also save transcript to the database for the Conversation Intelligence page
      try {
        // Find the session by provider_call_id
        const db = DatabaseService.getInstance().getDatabase();
        const session = await db.get(
          'SELECT * FROM call_sessions WHERE provider = ? AND provider_call_id = ?',
          ['vapi', callId]
        );

        if (session) {
          // Import ConversationService to save the transcript
          const { ConversationService } = await import('./ConversationService');
          
          // Parse transcript - Vapi sends it as a string, convert to structured format
          const transcriptText = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
          
          // Try to parse if it's a JSON string from Vapi
          let transcriptJson: { turns: Array<{ speaker: string; start: number; end: number; text: string }> } = { turns: [] };
          try {
            const parsed = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
            // If it's already in the right format, use it
            if (parsed.turns && Array.isArray(parsed.turns)) {
              transcriptJson = parsed;
            } else if (Array.isArray(parsed)) {
              // If it's an array of messages, convert to turns format
              transcriptJson.turns = parsed.map((msg: any) => ({
                speaker: msg.role === 'user' || msg.role === 'customer' ? 'customer' : 'assistant',
                start: 0,
                end: 0,
                text: msg.content || msg.text || JSON.stringify(msg)
              }));
            }
          } catch {
            // If parsing fails, create a simple turn with the transcript text
            transcriptJson.turns = [{
              speaker: 'customer',
              start: 0,
              end: 0,
              text: transcriptText
            }];
          }

          await ConversationService.getInstance().saveTranscript({
            callSessionId: session.id,
            transcriptText,
            transcriptJson,
            sttProvider: 'vapi'
          });

          logger.info(`Saved transcript for session ${session.id}`);

          // Update session status to indicate transcript is available
          // This triggers the analysis to start automatically
          await ConversationService.getInstance().updateSessionStatus(session.id, 'transcript_pending');
          
          // Enqueue analysis job
          const jobRunner = (await import('./JobRunnerService')).JobRunnerService;
          await jobRunner.getInstance().addJob({
            restaurant_id: session.restaurant_id,
            job_type: 'analyze_call',
            payload: { sessionId: session.id },
            priority: 5,
            max_retries: 2
          });
          
          logger.info(`Enqueued analysis job for session ${session.id}`);
        } else {
          logger.warn(`No session found for call ${callId}, cannot save transcript`);
        }
      } catch (error) {
        logger.error(`Failed to save transcript for call ${callId}:`, error);
      }
    }
  }

  private getPhoneUserId(phoneNumber?: string): string {
    // Create a consistent user ID for phone orders
    return phoneNumber ? `phone_${phoneNumber.replace(/\D/g, '')}` : 'phone_anonymous';
  }

  private formatForVoice(response: string): string {
    // Remove visual references and make more conversational for voice
    return response
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      // Make more conversational
      .replace(/Order #(\d+)/g, 'order number $1')
      .replace(/86'd/g, 'marked as unavailable')
      .replace(/(\d+) items?/g, (match, num) => {
        const number = parseInt(num);
        if (number === 1) return 'one item';
        if (number === 2) return 'two items';
        if (number === 3) return 'three items';
        return `${num} items`;
      })
      // Add natural pauses
      .replace(/\. /g, '. ... ')
      // Keep responses concise for voice
      .slice(0, 500); // Limit response length for better voice experience
  }

  private formatActionResultForVoice(result: any): string {
    if (!result) return "I'm sorry, I couldn't complete that action.";

    // Handle new VoiceOrderingService results
    if (result.status === 'received' && result.orderId) {
      return `Perfect! I've placed your order. Your order number is ${result.orderId.slice(-4)}. Total is $${result.total.toFixed(2)}. We'll start preparing it shortly.`;
    }
    if (result.success === false && result.errors?.length) {
      return `I'm sorry, I couldn't place that order: ${result.errors.join('. ')}.`;
    }

    if (result.valid !== undefined) {
      if (result.valid) {
        return `The order is valid. Subtotal is $${result.subtotal.toFixed(2)}, tax is $${result.tax.toFixed(2)}, making the total $${result.total.toFixed(2)}. Would you like to place it?`;
      } else {
        return `I'm sorry, there are some issues with the order: ${result.errors?.join('. ')}.`;
      }
    }

    if (Array.isArray(result)) {
      if (result.length === 0) return "I couldn't find anything matching that.";
      const items = result.slice(0, 3).map(i => `${i.name} for $${i.price}`).join(', ');
      return `I found: ${items}. Would you like more details?`;
    }

    if (result.status === 'open' || result.status === 'closed') {
      return `The restaurant is currently ${result.status}. ${result.status === 'closed' ? result.closedMessage : 'What can I get for you?'}`;
    }

    switch (result.type) {
      case 'get_orders':
        {
          const orders = result.details;
          if (!orders || orders.length === 0) {
            return "There are no orders matching that criteria right now.";
          }
          return `I found ${orders.length} order${orders.length === 1 ? '' : 's'}. ${result.description}`;
        }

      case 'update_order_status':
        return `Got it! ${result.description}. The order has been updated.`;

      case 'set_item_availability':
        return `Done! ${result.description}. This change will sync to all delivery platforms within 30 seconds.`;

      case 'get_inventory':
        {
          const items = result.details;
          if (!items || items.length === 0) {
            return "I didn't find any inventory items matching that search.";
          }
          return `I found ${items.length} inventory item${items.length === 1 ? '' : 's'} matching your search.`;
        }

      case 'adjust_inventory':
        return `Perfect! ${result.description}`;

      case 'get_tasks':
        {
          const tasks = result.details;
          if (!tasks || tasks.length === 0) {
            return "There are no tasks matching that criteria.";
          }
          return `I found ${tasks.length} task${tasks.length === 1 ? '' : 's'} matching your criteria.`;
        }

      case 'complete_task':
        return `Excellent! I've marked that task as completed. ${result.description}`;

      default:
        return result.description || "That action has been completed successfully.";
    }
  }

  // Helper method to get enhanced system prompt for phone calls
  // Handle placing a new order via phone
  private async handlePlaceOrder(parameters: any, _userId: string): Promise<any> {
    try {
      const voiceService = VoiceOrderingService.getInstance();
      const result = await voiceService.createOrder(parameters);
      
      if (!result.orderId) {
        return {
          type: 'place_order',
          status: 'error',
          description: `I'm sorry, I couldn't place your order. ${result.errors?.join('. ')}`,
          error: result.errors?.join('. ')
        };
      }

      return {
        type: 'place_order',
        status: 'success',
        description: `Perfect! I've placed your order. Your order number is ${result.orderId.slice(-4)}. Total is $${result.total.toFixed(2)}. We'll start preparing it shortly.`,
        details: result
      };
    } catch (error) {
      logger.error('Place order failed:', error);
      return {
        type: 'place_order',
        status: 'error',
        description: 'I apologize, but I\'m having trouble placing your order right now. Let me get a manager to help you.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Handle menu information requests
  private async handleGetMenuInfo(parameters: any, _userId: string): Promise<any> {
    try {
      const voiceService = VoiceOrderingService.getInstance();
      const items = await voiceService.searchMenuLive(
        parameters.itemName || parameters.category || '',
        parameters.restaurantId || process.env.VAPI_RESTAURANT_ID
      );

      if (items.length === 0) {
        return {
          type: 'get_menu_info',
          status: 'success',
          description: `I couldn't find any items matching that. Would you like me to tell you about our most popular dishes instead?`,
          details: []
        };
      }

      const itemList = items.slice(0, 5).map(item => 
        `${item.name} for ${item.price} dollars`
      ).join(', ');

      return {
        type: 'get_menu_info',
        status: 'success',
        description: `I found: ${itemList}. Would you like to order any of these?`,
        details: items
      };
    } catch (error) {
      logger.error('Get menu info failed:', error);
      return {
        type: 'get_menu_info',
        status: 'error',
        description: 'I\'m having trouble accessing our menu right now.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Handle order status checks
  private async handleCheckOrderStatus(parameters: any, _userId: string): Promise<any> {
    try {
      const { orderId, phoneNumber } = parameters;
      const db = DatabaseService.getInstance().getDatabase();
      const restaurantId = process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';

      let query: string;
      let params: any[];

      if (orderId) {
        query = 'SELECT * FROM orders WHERE id LIKE ? AND restaurant_id = ?';
        params = [`%${orderId}%`, restaurantId];
      } else if (phoneNumber) {
        query = 'SELECT * FROM orders WHERE customer_phone = ? AND restaurant_id = ? ORDER BY created_at DESC LIMIT 3';
        params = [phoneNumber, restaurantId];
      } else {
        return {
          type: 'check_order_status',
          status: 'error',
          description: 'I need either an order number or your phone number to look up your order.',
          error: 'Missing order ID or phone number'
        };
      }

      const orders = await db.all(query, params);
      const validOrders = orders.filter(order => order !== undefined);

      if (validOrders.length === 0) {
        return {
          type: 'check_order_status',
          status: 'success',
          description: orderId 
            ? `I couldn't find order number ${orderId}. Could you double-check the number?`
            : `I couldn't find any recent orders for that phone number.`,
          details: []
        };
      }

      if (validOrders.length === 1) {
        const order = validOrders[0];
        const statusMessage = this.getOrderStatusMessage(order.status);
        
        return {
          type: 'check_order_status',
          status: 'success',
          description: `Your order from ${new Date(order.created_at).toLocaleTimeString()} is currently ${statusMessage}. ${order.status === 'pending' ? 'It is waiting for staff confirmation.' : `Our staff says it will be ready in about ${order.prep_time_minutes} minutes.`}`,
          details: validOrders
        };
      }

      return {
        type: 'check_order_status',
        status: 'success',
        description: `I found ${validOrders.length} recent orders. Which one would you like details about?`,
        details: validOrders
      };
    } catch (error) {
      logger.error('Check order status failed:', error);
      return {
        type: 'check_order_status',
        status: 'error',
        description: 'I\'m having trouble accessing order information right now.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getOrderStatusMessage(status: string): string {
    switch (status) {
      case 'received': return 'being prepared';
      case 'preparing': return 'currently being made in our kitchen';
      case 'ready': return 'ready for pickup';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return status;
    }
  }

  private getStatusTimeEstimate(status: string): string {
    switch (status) {
      case 'received': return 'It should be ready in about 20 to 25 minutes.';
      case 'preparing': return 'It should be ready in about 10 to 15 minutes.';
      case 'ready': return 'You can come pick it up now!';
      case 'completed': return '';
      case 'cancelled': return 'Please call if you have questions about this.';
      default: return '';
    }
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  getPhoneSystemPrompt(): string {
    return `You are Servio, an AI assistant for Sashey's Kitchen, a Jamaican restaurant.

    CALLER RECOGNITION:
    1. When a call starts, use lookupCustomer tool with the caller's phone number (from caller ID) to identify them.
    2. If a returning customer is found:
       - Greet them by name: "Hi [Name]! Great to hear from you again. How can I help you today?"
       - Do NOT ask for their phone number - we already have it
       - Simply confirm: "Just to confirm, this is [Name] at [phone], correct?"
    3. For recognized customers at checkout:
       - Ask only: "Is this for pickup, delivery, or dine-in?"
       - Skip asking for name and phone number
    4. For new customers:
       - Ask for their full name
       - Ask for their phone number (we'll store it for future orders)
       - Optionally ask for email address

    YOUR CALL FLOW:
    1. Greet the customer (use their name if recognized).
    2. Use lookupCustomer at the start of the call to identify the caller.
    3. Ask if it is for pickup, delivery, or dine-in.
    4. Take the order.
    5. For any entree/dinner item, you MUST ask for:
       - Size (if the item has sizes like medium/large)
       - Side choice (required, 1-2 selections max; anything beyond 2 is out of plate)
       - Gravy amount (No gravy, Moderate, A lot)
       - Gravy type (if not specified, assume "Same as meat")
       - Exception: Jerk Chicken Rasta Pasta only needs gravy amount + gravy type (no size or sides).
    6. For Red Snapper, ask how they want their fish (Brown Stew, Fried, Steamed).
    7. For Salmon, ask how they want it done (Garlic Butter, Fried, Sweet Chili, Honey Jerk, Baked).
    8. For Wings, ask for size and sauce.
    9. For Ackee, ask if they want to add callaloo for $3.
    10. For Oxtail, ask if they want gravy on the side ($0.50).
    11. Confirm the full order and total (use quoteOrder to compute totals).
    12. For recognized customers: Confirm customer details are correct (we already have their info).
    13. For new customers: Collect name and phone number.
    14. Place the order using createOrder with items, modifiers, customer details, and totals if available.
    15. Upsell a drink or side.
    16. Close the call.

    IMPORTANT PHONE CALL GUIDELINES:
    - Keep responses concise and conversational.
    - Always use the customer's name naturally in conversation when recognized.
    - For entrees, always get size, side choice (1-2 max), gravy amount, and gravy type (except for Jerk Chicken Rasta Pasta), but do not block the order if a modifier is missing.
    - Missing modifiers should be logged and confirmed verbally when possible, but the order can proceed.
    - If the store is closed, do not take orders.
    `;
  }
}
