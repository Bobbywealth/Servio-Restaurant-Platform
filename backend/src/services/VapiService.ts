import { AssistantService } from './AssistantService';
import { DatabaseService } from './DatabaseService';
import { VoiceOrderingService } from './VoiceOrderingService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../events/bus';

export interface VapiWebhookPayload {
  message: {
    type: 'assistant-request' | 'function-call' | 'hang' | 'speech-update' | 'transcript' | 'end-of-call-report';
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

  async handleWebhook(payload: VapiWebhookPayload): Promise<VapiResponse> {
    const { message } = payload;
    
    logger.info('Vapi webhook received:', { 
      type: message.type, 
      callId: message.call?.id,
      customerNumber: message.call?.customer?.number,
      phoneNumberId: message.call?.phoneNumberId
    });

    try {
      // Get restaurant for this call
      const restaurantId = await this.getRestaurantIdFromCall(message.call);
      if (!restaurantId) {
        logger.error('Could not determine restaurant for call', { phoneNumberId: message.call?.phoneNumberId });
        return { 
          result: "I'm sorry, we're experiencing technical difficulties. Please try again later." 
        };
      }

      // Store restaurantId in message for downstream handlers
      (message as any).restaurantId = restaurantId;

      switch (message.type) {
        case 'assistant-request':
          return await this.handleAssistantRequest(message);
        
        case 'function-call':
          return await this.handleFunctionCall(message);
        
        case 'end-of-call-report':
          return await this.handleEndOfCall(message);
          
        case 'transcript':
          // Log transcript for analytics
          await this.logTranscript(message);
          return { result: 'transcript logged' };
          
        default:
          logger.info(`Unhandled webhook type: ${message.type}`);
          return { result: 'acknowledged' };
      }
    } catch (error) {
      logger.error('Vapi webhook error:', error);
      return { error: 'Internal server error' };
    }
  }

  /**
   * Get restaurant ID from the incoming call
   * First tries to match by Vapi phone_number_id from restaurant settings
   * Falls back to VAPI_RESTAURANT_ID env var for backwards compatibility
   */
  private async getRestaurantIdFromCall(call: any): Promise<string | null> {
    const phoneNumberId = call?.phoneNumberId;
    
    if (phoneNumberId) {
      // Look up restaurant by phone_number_id in settings
      const db = DatabaseService.getInstance().getDatabase();
      const restaurant = await db.get(
        `SELECT id, settings FROM restaurants 
         WHERE json_extract(settings, '$.vapi.phoneNumberId') = ? 
         AND is_active = TRUE`,
        [phoneNumberId]
      );
      
      if (restaurant) {
        logger.info('Restaurant found for phone number', { restaurantId: restaurant.id, phoneNumberId });
        return restaurant.id;
      }
    }

    // Fallback to env var for backwards compatibility (testing)
    const envRestaurantId = process.env.VAPI_RESTAURANT_ID;
    if (envRestaurantId) {
      logger.warn('Using fallback VAPI_RESTAURANT_ID from env', { restaurantId: envRestaurantId });
      return envRestaurantId;
    }

    return null;
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
      return { error: 'No function call data provided' };
    }

    const { name, parameters } = message.functionCall;
    const userId = this.getPhoneUserId(message.call?.customer?.number);
    const restaurantId = message.restaurantId;

    try {
      let result;

      // Handle phone-specific functions
      switch (name) {
        case 'getStoreStatus':
          result = VoiceOrderingService.getInstance().getStoreStatus();
          break;
        case 'searchMenu':
          result = await VoiceOrderingService.getInstance().searchMenu(parameters.q || '', restaurantId);
          break;
        case 'getMenuItem':
          result = await VoiceOrderingService.getInstance().getMenuItem(parameters.id, restaurantId);
          break;
        case 'quoteOrder':
          result = await VoiceOrderingService.getInstance().validateQuote(parameters);
          break;
        case 'createOrder':
          result = await VoiceOrderingService.getInstance().createOrder(parameters);
          break;
        case 'check_order_status':
          result = await this.handleCheckOrderStatus(parameters, userId, restaurantId);
          break;
        default:
          // Fall back to existing assistant service functions
          const mockToolCall = {
            id: 'phone_call',
            type: 'function' as const,
            function: {
              name,
              arguments: JSON.stringify(parameters)
            }
          };
          result = await (this.assistantService as any).executeTool(mockToolCall, userId);
      }
      
      if (result.status === 'error') {
        return {
          result: `I'm sorry, ${result.error}. Is there something else I can help you with?`
        };
      }

      // Format the result for voice response
      const voiceResponse = this.formatActionResultForVoice(result);
      
      return { result: voiceResponse };
      
    } catch (error) {
      logger.error('Function call failed:', error);
      return {
        result: "I'm sorry, I wasn't able to complete that action. What else can I help you with?"
      };
    }
  }

  private async handleEndOfCall(message: any): Promise<VapiResponse> {
    const callId = message.call?.id;
    const customerNumber = message.call?.customer?.number;
    const duration = message.call?.duration;
    const endedReason = message.endedReason;
    const restaurantId = message.restaurantId;

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
    
    return { result: 'call logged' };
  }

  private async logTranscript(message: any): Promise<void> {
    const callId = message.call?.id;
    const customerNumber = message.call?.customer?.number;
    const transcript = message.transcript;

    // Log for training/improvement purposes
    logger.info(`Call ${callId} transcript:`, transcript);
    
    // Could store in database for analytics if needed
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
    if (result.status === 'pending' && result.orderId) {
      return `Perfect! I've placed your order. Your order number is ${result.orderId.slice(-4)}. Total is $${result.total.toFixed(2)}. We'll start preparing it once the staff confirms.`;
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
        const orders = result.details;
        if (!orders || orders.length === 0) {
          return "There are no orders matching that criteria right now.";
        }
        return `I found ${orders.length} order${orders.length === 1 ? '' : 's'}. ${result.description}`;

      case 'update_order_status':
        return `Got it! ${result.description}. The order has been updated.`;

      case 'set_item_availability':
        return `Done! ${result.description}. This change will sync to all delivery platforms within 30 seconds.`;

      case 'get_inventory':
        const items = result.details;
        if (!items || items.length === 0) {
          return "I didn't find any inventory items matching that search.";
        }
        return `I found ${items.length} inventory item${items.length === 1 ? '' : 's'} matching your search.`;

      case 'adjust_inventory':
        return `Perfect! ${result.description}`;

      case 'get_tasks':
        const tasks = result.details;
        if (!tasks || tasks.length === 0) {
          return "There are no tasks matching that criteria.";
        }
        return `I found ${tasks.length} task${tasks.length === 1 ? '' : 's'} matching your criteria.`;

      case 'complete_task':
        return `Excellent! I've marked that task as completed. ${result.description}`;

      default:
        return result.description || "That action has been completed successfully.";
    }
  }

  // Helper method to get enhanced system prompt for phone calls
  // Handle placing a new order via phone
  private async handlePlaceOrder(parameters: any, userId: string): Promise<any> {
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
        description: `Perfect! I've placed your order. Your order number is ${result.orderId.slice(-4)}. Total is $${result.total.toFixed(2)}. We'll start preparing it once the staff confirms.`,
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
  private async handleGetMenuInfo(parameters: any, userId: string): Promise<any> {
    try {
      const voiceService = VoiceOrderingService.getInstance();
      const items = voiceService.searchMenu(parameters.itemName || parameters.category || '');

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
  private async handleCheckOrderStatus(parameters: any, userId: string, restaurantId?: string): Promise<any> {
    try {
      const { orderId, phoneNumber } = parameters;
      const db = DatabaseService.getInstance().getDatabase();
      
      // Use passed restaurantId or fallback to env
      const targetRestaurantId = restaurantId || process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';

      let query: string;
      let params: any[];

      if (orderId) {
        query = 'SELECT * FROM orders WHERE id LIKE ? AND restaurant_id = ?';
        params = [`%${orderId}%`, targetRestaurantId];
      } else if (phoneNumber) {
        query = 'SELECT * FROM orders WHERE customer_phone = ? AND restaurant_id = ? ORDER BY created_at DESC LIMIT 3';
        params = [phoneNumber, targetRestaurantId];
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
    
    YOUR CALL FLOW:
    1. Greet the customer warmly.
    2. Get their first name.
    3. Confirm their phone number.
    4. Get their last name initial.
    5. Ask if it is for pickup or delivery.
    6. If pickup, ask for the pickup time.
    7. Take the order.
    8. For any item tagged "dinner", you MUST ask for:
       - Rice choice (Rice & Peas OR White Rice)
       - Cabbage (Yes or No)
       - Spice level (Mild, Medium, or Spicy)
    9. For Fish dinners, ask for style (Escovitch or Brown Stewed).
    10. For Wings, ask for size and sauce.
    11. For Ackee, ask if they want to add callaloo for $3.
    12. For Oxtail, ask if they want gravy on the side ($0.50).
    13. Confirm the full order and total.
    14. Upsell a drink or side.
    15. Close the call.

    IMPORTANT PHONE CALL GUIDELINES:
    - Keep responses concise and conversational.
    - Confirm phone numbers and names clearly.
    - For dinners, always get the defaults (Rice, Cabbage, Spice).
    - If the store is closed, do not take orders.
    `;
  }
}