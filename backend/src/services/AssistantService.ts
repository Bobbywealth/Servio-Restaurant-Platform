import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { distance } from 'fastest-levenshtein';

// Tool interfaces
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface AssistantResponse {
  transcript?: string;
  response: string;
  actions: Array<{
    type: string;
    status: 'pending' | 'success' | 'error';
    description: string;
    details?: any;
    error?: string;
  }>;
  audioUrl?: string;
  confidence?: number;
  processingTime: number;
}



// Restaurant context cache interface
interface RestaurantContextCache {
  data: {
    orders: any[];
    unavailableItems: any[];
    lowStockItems: any[];
    pendingTasks: any[];
    menuItems: any[];
    urgentOrders: any[];
  };
  expires: number;
}

// Circuit breaker for OpenAI API resilience
class OpenAICircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly maxFailures: number;
  private readonly resetTimeout: number;

  constructor(maxFailures = 3, resetTimeoutMs = 60000) {
    this.maxFailures = maxFailures;
    this.resetTimeout = resetTimeoutMs;
  }

  private isCircuitOpen(): boolean {
    return this.failures >= this.maxFailures && 
           (Date.now() - this.lastFailure) < this.resetTimeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.lastFailure = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    logger.warn(`Circuit breaker failure count: ${this.failures}/${this.maxFailures}`);
  }

  async execute<T>(apiCall: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.isCircuitOpen()) {
      logger.warn('Circuit breaker is open, using fallback');
      return fallback();
    }

    try {
      const result = await apiCall();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (this.failures >= this.maxFailures) {
        logger.error('Circuit breaker tripped - switching to fallback mode');
      }
      
      throw error;
    }
  }
}

export class AssistantService {
  private openai: OpenAI;
  private _db: any = null;
  private conversationHistory: Map<string, Array<{role: 'user' | 'assistant' | 'system', content: string}>> = new Map();
  private readonly MAX_HISTORY_LENGTH = parseInt(process.env.ASSISTANT_MAX_HISTORY_LENGTH || '15'); // Reduced from 50 for faster LLM processing
  private readonly CONVERSATION_TIMEOUT = parseInt(process.env.ASSISTANT_CONVERSATION_TIMEOUT || '1800000'); // 30 minutes
  
  // Restaurant context cache with 5-minute TTL
  private contextCache = new Map<string, RestaurantContextCache>();
  private readonly CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Circuit breaker for API resilience
  private circuitBreaker = new OpenAICircuitBreaker();

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60000, // 60 seconds
    });

    // Clean up expired conversations and context cache periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanupExpiredConversations();
        this.cleanupExpiredContextCache();
      }, 300000); // Every 5 minutes
    }
  }

  private get db() {
    if (!this._db) {
      this._db = DatabaseService.getInstance().getDatabase();
    }
    return this._db;
  }

  private cleanupExpiredConversations(): void {
    const now = Date.now();
    for (const [userId, history] of this.conversationHistory.entries()) {
      // Remove conversations older than timeout
      if (history.length === 0 || now - this.getLastActivityTime(userId) > this.CONVERSATION_TIMEOUT) {
        this.conversationHistory.delete(userId);
        logger.debug(`Cleaned up expired conversation for user ${userId}`);
      }
    }
  }

  private cleanupExpiredContextCache(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [restaurantId, cache] of this.contextCache.entries()) {
      if (cache.expires <= now) {
        this.contextCache.delete(restaurantId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired context cache entries`);
    }
  }

  private getLastActivityTime(userId: string): number {
    const history = this.conversationHistory.get(userId) || [];
    // For simplicity, we'll use current time minus conversation timeout
    // In a real implementation, you'd store timestamps with each message
    return Date.now();
  }

  private trimConversationHistory(userId: string): void {
    const history = this.conversationHistory.get(userId);
    if (history && history.length > this.MAX_HISTORY_LENGTH) {
      // Keep system prompt and trim older messages
      const systemPrompts = history.filter(msg => msg.role === 'system');
      const nonSystemMessages = history.filter(msg => msg.role !== 'system');
      
      // Keep the most recent messages
      const trimmedNonSystem = nonSystemMessages.slice(-this.MAX_HISTORY_LENGTH + systemPrompts.length);
      
      this.conversationHistory.set(userId, [...systemPrompts, ...trimmedNonSystem]);
      logger.debug(`Trimmed conversation history for user ${userId}`);
    }
  }

  async processAudio(audioBuffer: Buffer, userId: string): Promise<AssistantResponse> {
    const startTime = Date.now();

    try {
      // 1. Speech-to-Text
      const transcript = await this.transcribeAudio(audioBuffer);
      logger.info(`Transcribed audio: "${transcript}"`);

      if (!transcript || transcript.trim().length === 0) {
        return {
          response: "I didn't catch that. Could you please repeat?",
          actions: [],
          processingTime: Date.now() - startTime
        };
      }

      // 2. Process the text with LLM
      const result = await this.processText(transcript, userId);

      return {
        transcript,
        ...result,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to process audio:', error);
      return {
        response: "I'm having trouble processing your request right now. Please try again.",
        actions: [{
          type: 'error',
          status: 'error',
          description: 'Audio processing failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        processingTime: Date.now() - startTime
      };
    }
  }

  async processText(text: string, userId: string): Promise<Omit<AssistantResponse, 'transcript'>> {
    const startTime = Date.now();

    try {
      // Get system prompt with current context
      const systemPrompt = await this.getSystemPrompt(userId);

      // Get or create conversation history
      let history = this.conversationHistory.get(userId) || [];
      if (history.length === 0) {
        history.push({ role: 'system', content: systemPrompt });
      }

      // Add user input to history
      history.push({ role: 'user', content: text });

      // Trim history if it's getting too long
      this.trimConversationHistory(userId);

      const completion = await this.circuitBreaker.execute(
        () => this.openai.chat.completions.create({
          model: 'gpt-4o-mini', // Much faster than gpt-4-turbo, still very capable
          messages: [
            { role: 'system', content: systemPrompt },
            ...history // Include conversation history for natural flow
          ],
          tools: this.getTools(),
          tool_choice: 'auto',
          temperature: 0.5, // Slightly more natural
          max_tokens: 300, // Shorter responses for faster processing
          stream: false
        }),
        () => ({
          choices: [{
            message: {
              content: "I'm experiencing technical difficulties. Please try your request again in a moment, or use the text commands below.",
              tool_calls: null
            }
          }]
        } as any)
      );

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      let response = message.content || "I understand, let me help with that.";
      const actions: AssistantResponse['actions'] = [];

      // Start TTS generation in parallel with tool execution for faster response
      const ttsPromise = this.generateSpeech(response);

      // Process tool calls
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          const action = await this.executeTool(toolCall, userId);
          actions.push(action);
        }
      }

      // Add assistant response to history for natural conversation flow
      history.push({ role: 'assistant', content: response });

      // Wait for TTS to complete (should be done by now due to parallel execution)
      const audioUrl = await ttsPromise;

      return {
        response,
        actions,
        audioUrl,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to process text:', error);
      return {
        response: "I'm having trouble understanding your request. Could you try rephrasing it?",
        actions: [{
          type: 'error',
          status: 'error',
          description: 'Text processing failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        processingTime: Date.now() - startTime
      };
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Save buffer to temporary file in OS temp directory
      const tempPath = path.join(os.tmpdir(), `servio_audio_${Date.now()}_${uuidv4()}.webm`);

      fs.writeFileSync(tempPath, audioBuffer);

      const transcription = await this.circuitBreaker.execute(
        () => this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          language: 'en'
        }),
        () => ({ text: '' }) // Empty fallback - will be handled upstream
      );

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return transcription.text;
    } catch (error) {
      logger.error('Transcription failed:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  private async generateSpeech(text: string): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return '';
      }

      // Keep responses bounded for latency/cost.
      const input = text.length > 500 ? text.slice(0, 500) : text; // Shorter for faster TTS
      const model = 'tts-1'; // Fast model (not tts-1-hd)
      const voice = (process.env.OPENAI_TTS_VOICE || 'nova') as any; // Nova is clearer and faster
      const speed = 1.1; // Slightly faster speech

      const speech = await this.circuitBreaker.execute(
        () => this.openai.audio.speech.create({
          model,
          voice,
          input,
          response_format: 'mp3',
          speed
        }),
        () => null // No TTS fallback - will skip audio generation
      );

      if (!speech) {
        logger.warn('TTS circuit breaker active - skipping audio generation');
        return '';
      }

      const arrayBuffer = await speech.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const ttsDir = path.join(process.cwd(), 'uploads', 'tts');
      await fs.promises.mkdir(ttsDir, { recursive: true });

      const fileName = `tts_${Date.now()}_${uuidv4()}.mp3`;
      const outPath = path.join(ttsDir, fileName);
      await fs.promises.writeFile(outPath, audioBuffer);

      // Served by backend static route: /uploads/*
      return `/uploads/tts/${fileName}`;
    } catch (error) {
      logger.error('TTS generation failed:', error);
      return '';
    }
  }

  // Get cached restaurant context or fetch fresh data
  private async getRestaurantContext(restaurantId: string): Promise<RestaurantContextCache['data']> {
    const cached = this.contextCache.get(restaurantId);
    if (cached && cached.expires > Date.now()) {
      logger.debug(`Using cached restaurant context for ${restaurantId}`);
      return cached.data;
    }

    logger.debug(`Fetching fresh restaurant context for ${restaurantId}`);
    
    // Fetch all context data in parallel for better performance
    const [orders, unavailableItems, lowStockItems, pendingTasks, menuItems] = await Promise.all([
      this.db.all('SELECT * FROM orders WHERE restaurant_id = ? AND status != "completed" ORDER BY created_at DESC LIMIT 10', [restaurantId]),
      this.db.all('SELECT name, updated_at FROM menu_items WHERE restaurant_id = ? AND is_available = FALSE ORDER BY updated_at DESC', [restaurantId]),
      this.db.all('SELECT name, on_hand_qty, unit, low_stock_threshold FROM inventory_items WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold', [restaurantId]),
      this.db.all('SELECT title FROM tasks WHERE restaurant_id = ? AND status = "pending" LIMIT 5', [restaurantId]),
      this.db.all('SELECT name FROM menu_items WHERE restaurant_id = ? AND is_available = TRUE LIMIT 20', [restaurantId])
    ]);

    // Calculate urgent orders
    const urgentOrders = orders.filter((o: any) => {
      const createdTime = new Date(o.created_at).getTime();
      const now = Date.now();
      return (now - createdTime) > 15 * 60 * 1000; // Over 15 minutes
    });

    const contextData = {
      orders,
      unavailableItems,
      lowStockItems,
      pendingTasks,
      menuItems,
      urgentOrders
    };

    // Cache the data
    this.contextCache.set(restaurantId, {
      data: contextData,
      expires: Date.now() + this.CONTEXT_CACHE_TTL
    });

    return contextData;
  }

  // Generate smart, context-aware suggestions based on current restaurant state
  private generateSmartSuggestions(context: RestaurantContextCache['data'], timeContext: { hour: number, dayOfWeek: string, timeOfDay: string }): string[] {
    const suggestions: string[] = [];
    const { orders, unavailableItems, lowStockItems, urgentOrders } = context;
    const { hour, timeOfDay } = timeContext;

    // Urgent order management
    if (urgentOrders.length > 0) {
      suggestions.push(`⚠️ URGENT: ${urgentOrders.length} orders over 15 minutes old need immediate attention`);
    }

    // High volume management
    if (orders.length > 8) {
      suggestions.push(`📈 HIGH VOLUME: ${orders.length} active orders. Consider 86'ing slow items to reduce ticket times`);
    }

    // Low stock alerts with timing context
    if (lowStockItems.length > 0) {
      const criticalItems = lowStockItems.filter((item: any) => item.on_hand_qty <= 1);
      if (criticalItems.length > 0) {
        suggestions.push(`🚨 CRITICAL STOCK: ${criticalItems.map((i: any) => i.name).join(', ')} almost depleted`);
      } else if (timeOfDay === 'breakfast' || timeOfDay === 'lunch') {
        suggestions.push(`📊 Stock watch: ${lowStockItems.slice(0, 2).map((i: any) => i.name).join(', ')} running low for ${timeOfDay} rush`);
      }
    }

    // Time-based operational suggestions
    if (timeOfDay === 'breakfast' && hour >= 8 && orders.length < 3) {
      suggestions.push(`☀️ Slow breakfast service - good time for prep work or cleaning tasks`);
    }

    if (timeOfDay === 'lunch' && hour >= 11 && hour <= 13 && orders.length < 5) {
      suggestions.push(`🍽️ Pre-lunch lull - perfect time to prep popular lunch items`);
    }

    if (timeOfDay === 'dinner' && hour >= 17 && orders.length < 4) {
      suggestions.push(`🌆 Dinner prep time - ensure dinner specials are ready`);
    }

    // 86'd items management
    if (unavailableItems.length > 3) {
      suggestions.push(`📝 Menu management: ${unavailableItems.length} items currently 86'd. Review availability status`);
    }

    // End of day suggestions
    if (hour >= 20 && orders.length < 3) {
      suggestions.push(`🌙 Winding down - consider closing prep and inventory count`);
    }

    return suggestions.slice(0, 3); // Limit to top 3 most relevant suggestions
  }

  private async getSystemPrompt(userId: string): Promise<string> {
    const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Get cached restaurant context
    const context = await this.getRestaurantContext(restaurantId);
    const { orders, unavailableItems, lowStockItems, pendingTasks, menuItems, urgentOrders } = context;
    
    // Get time context
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeOfDay = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'late night';

    // Build detailed context strings
    const unavailableList = unavailableItems.map((item: any) => item.name).join(', ') || 'None';
    const lowStockList = lowStockItems.map((item: any) => `${item.name} (${item.on_hand_qty} ${item.unit})`).join(', ') || 'None';
    
    // Generate smart suggestions based on current context
    const smartSuggestions = this.generateSmartSuggestions(context, { hour, dayOfWeek, timeOfDay });

    return `You are Servio, an intelligent AI assistant specifically designed for restaurant operations. You have deep knowledge of restaurant workflows, terminology, and best practices.

CURRENT CONTEXT:
Time: ${dayOfWeek}, ${timeOfDay} service (${hour}:00)
Restaurant: ${user?.name || 'Restaurant'}'s location
Active Orders: ${orders.length} ${orders.length > 5 ? '⚠️ (High volume)' : ''}
Urgent Orders (>15min): ${urgentOrders.length}
Currently 86'd Items: ${unavailableList}
Low Stock Items: ${lowStockList}
Pending Tasks: ${pendingTasks.length}

SMART OPERATIONAL INSIGHTS:
${smartSuggestions.length > 0 ? smartSuggestions.map(s => `• ${s}`).join('\n') : '• All systems running smoothly'}

YOUR ADVANCED CAPABILITIES:
1. 📦 Order Management:
   - Track order status and timing
   - Identify bottlenecks and urgent orders
   - Update order progression (received → preparing → ready → completed)
   - Calculate wait times and provide ETAs

2. 🍽️ Menu & Customer Service:
   - Help customers explore menu items with full details
   - Ask about modifiers (spice level, rice type, size, etc.)
   - Suggest popular items and combinations
   - Handle special requests and dietary restrictions
   - Mark items unavailable ("86") across all delivery platforms
   - Restore item availability when back in stock

3. 💬 Conversational Order Taking:
   - Ask follow-up questions about modifiers and preferences
   - Confirm customer details (name, phone, pickup time)
   - Calculate totals including modifier prices
   - Guide customers through the complete ordering process
   - Remember customer preferences from the conversation

4. 📊 Inventory Intelligence:
   - Monitor stock levels in real-time
   - Alert on low inventory before it runs out
   - Record receipts and deliveries
   - Adjust quantities for waste, prep, or corrections
   - Predict when items need reordering

5. ✅ Task Management:
   - View daily, weekly, and monthly tasks
   - Mark tasks complete
   - Prioritize urgent items
   - Track completion rates

6. 🎯 Proactive Assistance:
   - Anticipate needs based on time of day and order volume
   - Suggest actions when detecting issues
   - Provide operational insights and recommendations
   - Remember context from previous interactions

INTELLIGENT BEHAVIOR:
- Understand natural language and restaurant slang ("86", "in the weeds", "fire", "on the fly")
- Infer intent from context (e.g., "we're out of chicken" → mark chicken items as 86'd)
- **ALWAYS ASK FOR CLARIFICATION when ambiguous** - Don't guess!
- If multiple items match, list them and ask which one
- **ASK ABOUT MODIFIERS** when customers mention menu items
- Provide relevant suggestions based on current situation
- Learn from patterns and remember context from conversation
- Be proactive: warn about potential issues before they escalate

**MENU & ORDERING EXAMPLES:**
User: "Tell me about the jerk chicken"
You: "Our Jerk Chicken Plate is $15.99 with rice and beans. What spice level would you like? We have mild, medium, hot, or extra hot (+$0.50). And what rice type - white rice, brown rice (+$1), or rice & peas (+$1.50)?"

User: "I want curry goat"
You: "Great choice! Curry Goat is $18.99. What size - small (-$2), regular, or large (+$3)? And for your rice: white rice, brown rice (+$1), or rice & peas (+$1.50)?"

User: "What do you recommend?"
You: "Our most popular items are the Jerk Chicken Plate and Curry Goat. Both come with your choice of rice and spice level. What sounds good to you?"

**OPERATIONAL DISAMBIGUATION EXAMPLES:**
User: "86 the jerk"
You: "I found 2 items: Jerk Chicken Plate, Jerk Pork Ribs. Which one?"

User: "we're out of chicken"
You: "I see 3 chicken items: Jerk Chicken Plate, Fried Chicken, Chicken Wings. All of them or specific ones?"

User: "restore the rice"
You: "Which rice dish? I have: Rice and Peas, Fried Rice, Yellow Rice."

SAFETY & CONFIRMATION:
- Confirm destructive actions: "Are you sure you want to 86 ALL chicken items?"
- List affected items before bulk changes
- Always log actions for audit trail
- For 86 operations, default to all channels unless specified
- Never assume quantities for inventory adjustments

RESPONSE STYLE:
- **Conversational and Natural**: Talk like a helpful coworker, not a robot
- **Ultra-Fast Responses**: Keep it brief - one or two sentences max
- **Action-Oriented**: Lead with what you're doing, not pleasantries
- **Restaurant Terminology**: Use "86'd", "fired", "in the weeds" naturally
- **Skip Formalities**: No "I understand" or "let me help" - just do it and confirm
- **Emoji Sparingly**: Only when it adds value
- **Remember Context**: Reference previous parts of the conversation

FAST RESPONSE EXAMPLES:
User: "no more jerk chicken"
You: "Got it, marking Jerk Chicken as 86'd on all platforms now."

User: "check orders"
You: "1 active order right now. All looking good."

User: "what's low?"
You: "Chicken is running low - 5 pieces left."

User: "tell me about jerk chicken"
You: "Jerk Chicken Plate is $15.99 with rice and beans. What spice level - mild, medium, hot, or extra hot (+$0.50)? And rice type - white, brown rice (+$1), or rice & peas (+$1.50)?"

User: "what can I order?"
You: "Our popular items are Jerk Chicken Plate ($15.99) and Curry Goat ($18.99). Both come with choice of rice and spice level. What sounds good?"

User: "thanks"
You: "No problem! Anything else?"

SMART EXAMPLES:
User: "no more jerk chicken"
You: "Got it! Marking Jerk Chicken as 86'd on all platforms (DoorDash, Uber Eats, GrubHub). Syncing now..."
[Takes action, then confirms with specifics]

User: "check orders"
You: "You have ${orders.length} active orders. ${urgentOrders.length > 0 ? `⚠️ ${urgentOrders.length} have been waiting over 15 minutes and need attention.` : 'All orders are within normal timing.'}"

User: "what's low?"
You: "Low stock items: ${lowStockList}. ${lowStockItems.length > 3 ? 'You might want to place orders soon.' : ''}"

User: "we're slammed"
You: "I see ${orders.length} active orders. ${urgentOrders.length > 0 ? `Prioritize these urgent ones first: [list]. ` : ''}Need me to check if any items should be 86'd to reduce ticket times?"

MENU ITEMS AVAILABLE (for context):
${menuItems.map((i: any) => i.name).slice(0, 10).join(', ')}${menuItems.length > 10 ? '...' : ''}

UNAVAILABLE ITEMS (Currently 86'd):
${unavailableList}

IMPORTANT NOTES ON MENU ITEMS:
- When marking items available/unavailable, use the exact item name when possible
- If you're unsure about the exact name, use key words like "chicken" or "jerk"
- If restoring availability, check the unavailable items list above
- The system will try to match partial names intelligently
- Always confirm what item was actually modified in your response

Remember: You're not just executing commands - you're a smart restaurant assistant that understands context, anticipates needs, and provides valuable operational support. Be helpful, be smart, and help the team succeed during service!`;
  }

  private getTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_orders',
          description: 'Get current orders with optional status filter',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['received', 'preparing', 'ready', 'completed', 'cancelled'],
                description: 'Filter orders by status'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of orders to return',
                default: 10
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_order_status',
          description: 'Update the status of a specific order',
          parameters: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'The order ID to update'
              },
              status: {
                type: 'string',
                enum: ['received', 'preparing', 'ready', 'completed', 'cancelled'],
                description: 'New status for the order'
              }
            },
            required: ['orderId', 'status']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'set_item_availability',
          description: '86 (make unavailable) or restore availability of menu items',
          parameters: {
            type: 'object',
            properties: {
              itemName: {
                type: 'string',
                description: 'Name of the menu item to update'
              },
              available: {
                type: 'boolean',
                description: 'true to make available, false to 86 (unavailable)'
              },
              channels: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['doordash', 'ubereats', 'grubhub', 'all']
                },
                description: 'Which delivery channels to update',
                default: ['all']
              }
            },
            required: ['itemName', 'available']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_inventory',
          description: 'Get current inventory levels',
          parameters: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search for specific items by name'
              },
              lowStock: {
                type: 'boolean',
                description: 'Only show items below threshold'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'adjust_inventory',
          description: 'Add or remove inventory items',
          parameters: {
            type: 'object',
            properties: {
              itemName: {
                type: 'string',
                description: 'Name of the inventory item'
              },
              quantity: {
                type: 'number',
                description: 'Positive to add, negative to remove'
              },
              reason: {
                type: 'string',
                description: 'Reason for adjustment (received, wasted, sold, etc.)'
              }
            },
            required: ['itemName', 'quantity', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_tasks',
          description: 'Get tasks for today or by status',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'Filter tasks by status'
              },
              type: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly', 'one_time'],
                description: 'Filter tasks by type'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'complete_task',
          description: 'Mark a task as completed',
          parameters: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'ID of the task to complete'
              }
            },
            required: ['taskId']
          }
        }
      }
    ];
  }

  private async executeTool(toolCall: ToolCall, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { name, arguments: args } = toolCall.function;

    try {
      const parsedArgs = JSON.parse(args);
      logger.info(`Executing tool: ${name} with args:`, parsedArgs);

      switch (name) {
        case 'get_orders':
          return await this.handleGetOrders(parsedArgs, userId);
        case 'update_order_status':
          return await this.handleUpdateOrderStatus(parsedArgs, userId);
        case 'get_menu_item_details':
          return await this.handleGetMenuItemDetails(parsedArgs, userId);
        case 'search_menu_with_modifiers':
          return await this.handleSearchMenuWithModifiers(parsedArgs, userId);
        case 'set_item_availability':
          return await this.handleSetItemAvailability(parsedArgs, userId);
        case 'get_inventory':
          return await this.handleGetInventory(parsedArgs, userId);
        case 'adjust_inventory':
          return await this.handleAdjustInventory(parsedArgs, userId);
        case 'get_tasks':
          return await this.handleGetTasks(parsedArgs, userId);
        case 'complete_task':
          return await this.handleCompleteTask(parsedArgs, userId);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed for ${name}:`, error);
      return {
        type: name,
        status: 'error',
        description: `Failed to execute ${name}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleGetOrders(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { status, limit = 10 } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    let query = 'SELECT * FROM orders WHERE restaurant_id = ?';
    const params: any[] = [restaurantId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const orders = await this.db.all(query, params);

    // Parse items JSON for each order
    const formattedOrders = orders.map((order: any) => ({
      ...order,
      items: JSON.parse(order.items || '[]')
    }));

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'get_orders', 'orders', 'multiple', { status, count: orders.length }
    );

    return {
      type: 'get_orders',
      status: 'success',
      description: `Found ${orders.length} orders${status ? ` with status ${status}` : ''}`,
      details: formattedOrders
    };
  }

  private async handleGetMenuItemDetails(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { itemName } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Find menu item with fuzzy matching
    const allMenuItems = await this.db.all(
      'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = TRUE',
      [restaurantId]
    );

    const matchResults = this.findBestMatches(itemName, allMenuItems);
    if (matchResults.length === 0) {
      return {
        type: 'get_menu_item_details',
        status: 'error',
        description: `I couldn't find "${itemName}" on the menu. Try asking about our popular items instead.`,
        details: {}
      };
    }

    const item = matchResults[0].item;
    
    // Get modifiers for this item
    const modifierGroups = await this.db.all(`
      SELECT 
        mg.id,
        mg.name,
        mg.min_selection,
        mg.max_selection,
        mg.is_required,
        GROUP_CONCAT(mo.name || ' (+$' || COALESCE(mo.price_modifier, 0) || ')') as options
      FROM modifier_groups mg
      LEFT JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
      LEFT JOIN modifier_options mo ON mg.id = mo.modifier_group_id AND mo.is_available = TRUE
      WHERE mim.menu_item_id = ? AND mg.restaurant_id = ?
      GROUP BY mg.id, mg.name, mg.min_selection, mg.max_selection, mg.is_required
      ORDER BY mg.sort_order ASC, mg.name ASC
    `, [item.id, restaurantId]);

    const modifierText = modifierGroups.length > 0 
      ? modifierGroups.map((mg: any) => `${mg.name}: ${mg.options || 'No options available'}`).join('; ')
      : 'No modifiers available';

    return {
      type: 'get_menu_item_details',
      status: 'success',
      description: `${item.name} - $${parseFloat(item.price).toFixed(2)}. ${item.description || ''}. Available modifiers: ${modifierText}`,
      details: {
        item: {
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          description: item.description
        },
        modifiers: modifierGroups.map((mg: any) => ({
          group: mg.name,
          required: !!mg.is_required,
          options: (mg.options || '').split(',').filter(Boolean)
        }))
      }
    };
  }

  private async handleSearchMenuWithModifiers(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { query, includeModifiers = true } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Search menu items
    const q = `%${query.toLowerCase().trim()}%`;
    const items = await this.db.all(`
      SELECT 
        mi.id,
        mi.name,
        mi.description,
        mi.price,
        mc.name as category
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.restaurant_id = ?
        AND mi.is_available = TRUE
        AND (LOWER(mi.name) LIKE ? OR LOWER(mi.description) LIKE ?)
      ORDER BY 
        CASE 
          WHEN LOWER(mi.name) LIKE ? THEN 1
          ELSE 2
        END,
        mi.sort_order ASC,
        mi.name ASC
      LIMIT 5
    `, [restaurantId, q, q, q]);

    if (items.length === 0) {
      return {
        type: 'search_menu_with_modifiers',
        status: 'error',
        description: `I couldn't find any items matching "${query}". Try asking about our popular dishes!`,
        details: {}
      };
    }

    const itemsWithModifiers = await Promise.all(items.map(async (item: any) => {
      if (!includeModifiers) {
        return {
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          description: item.description,
          category: item.category
        };
      }

      // Get modifier groups for this item
      const modifiers = await this.db.all(`
        SELECT 
          mg.name as groupName,
          mg.is_required,
          GROUP_CONCAT(mo.name || ' (+$' || COALESCE(mo.price_modifier, 0) || ')') as options
        FROM modifier_groups mg
        LEFT JOIN menu_item_modifiers mim ON mg.id = mim.modifier_group_id
        LEFT JOIN modifier_options mo ON mg.id = mo.modifier_group_id AND mo.is_available = TRUE
        WHERE mim.menu_item_id = ? AND mg.restaurant_id = ?
        GROUP BY mg.id, mg.name, mg.is_required
      `, [item.id, restaurantId]);

      return {
        id: item.id,
        name: item.name,
        price: parseFloat(item.price),
        description: item.description,
        category: item.category,
        modifiers: modifiers.map((m: any) => ({
          group: m.groupName,
          required: !!m.is_required,
          options: (m.options || '').split(',').filter(Boolean)
        }))
      };
    }));

    const itemsList = itemsWithModifiers.map(item => {
      let desc = `${item.name} ($${item.price.toFixed(2)})`;
      if (item.description) desc += ` - ${item.description}`;
      if (includeModifiers && item.modifiers && item.modifiers.length > 0) {
        const modText = item.modifiers.map((m: any) => `${m.group}: ${m.options.slice(0, 3).join(', ')}${m.options.length > 3 ? '...' : ''}`).join('; ');
        desc += `. Options: ${modText}`;
      }
      return desc;
    }).join('\n\n');

    return {
      type: 'search_menu_with_modifiers',
      status: 'success',
      description: `Found ${items.length} items matching "${query}":\n\n${itemsList}`,
      details: { items: itemsWithModifiers, query }
    };
  }

  private async handleUpdateOrderStatus(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { orderId, status } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    const result = await this.db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [status, orderId, restaurantId]
    );

    if (result.changes === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'update_order_status', 'order', orderId, { newStatus: status }
    );

    return {
      type: 'update_order_status',
      status: 'success',
      description: `Order ${orderId} marked as ${status}`,
      details: { orderId, status }
    };
  }

  // Fuzzy string matching helper for menu items
  private findBestMatches(query: string, menuItems: any[]): Array<{item: any, score: number}> {
    const queryLower = query.toLowerCase().trim();
    
    return menuItems
      .map(item => {
        const nameLower = item.name.toLowerCase();
        const exactMatch = nameLower.includes(queryLower);
        const fuzzyScore = distance(queryLower, nameLower);
        
        // Prioritize exact substring matches, then fuzzy matches
        let finalScore = exactMatch ? 0 : fuzzyScore;
        
        // Boost score for matches at word boundaries
        if (nameLower.split(' ').some((word: string) => word.startsWith(queryLower))) {
          finalScore = finalScore * 0.5; // Better score
        }
        
        return { item, score: finalScore };
      })
      .filter(match => match.score <= 3 || match.item.name.toLowerCase().includes(queryLower))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5); // Top 5 matches
  }

  private async handleSetItemAvailability(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { itemName, available, channels = ['all'] } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Get all menu items for fuzzy matching
    const allMenuItems = await this.db.all(
      'SELECT * FROM menu_items WHERE restaurant_id = ?',
      [restaurantId]
    );

    // Use fuzzy matching to find best matches
    const matchResults = this.findBestMatches(itemName, allMenuItems);
    let matchingItems = matchResults.map(r => r.item);
    
    logger.info(`Fuzzy search for "${itemName}" found ${matchingItems.length} matches:`, 
      matchResults.slice(0, 3).map(r => `${r.item.name} (score: ${r.score})`));
    
    
    // Strategy 3: If trying to restore, search unavailable items
    if (matchingItems.length === 0 && available === true) {
      matchingItems = await this.db.all(
        'SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = FALSE ORDER BY updated_at DESC',
        [restaurantId]
      );
      
      if (matchingItems.length > 1) {
        const itemNames = matchingItems.map((i: any) => i.name).join(', ');
        throw new Error(`Which item? Currently 86'd: ${itemNames}`);
      }
    }

    // **DISAMBIGUATION: Multiple matches found**
    if (matchingItems.length > 1) {
      const itemNames = matchingItems.map((i: any) => i.name).join(', ');
      const action = available ? 'restore' : '86';
      throw new Error(`I found ${matchingItems.length} items matching "${itemName}": ${itemNames}. Which one did you mean?`);
    }

    // No matches found
    if (matchingItems.length === 0) {
      const allItems = await this.db.all(
        'SELECT name FROM menu_items WHERE restaurant_id = ? LIMIT 10',
        [restaurantId]
      );
      const suggestions = allItems.map((i: any) => i.name).join(', ');
      throw new Error(`I couldn't find "${itemName}". Available items: ${suggestions}`);
    }

    // Single match - proceed with the action
    const item = matchingItems[0];

    // Update availability
    await this.db.run(
      'UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [available ? true : false, item.id, restaurantId]
    );

    const action = available ? 'restored' : '86\'d';
    const channelText = channels.includes('all') ? 'all platforms' : channels.join(', ');

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'set_item_availability', 'menu_item', item.id,
      { itemName, available, channels }
    );

    return {
      type: 'set_item_availability',
      status: 'success',
      description: `${item.name} ${action} on ${channelText}`,
      details: { itemId: item.id, itemName: item.name, available, channels }
    };
  }

  private async handleGetInventory(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { search, lowStock } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    let query = 'SELECT * FROM inventory_items WHERE restaurant_id = ?';
    const params: any[] = [restaurantId];

    const conditions: string[] = [];

    if (search) {
      conditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }

    if (lowStock) {
      conditions.push('on_hand_qty <= low_stock_threshold');
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY name';

    const items = await this.db.all(query, params);

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'get_inventory', 'inventory', 'multiple', { search, lowStock, count: items.length }
    );

    return {
      type: 'get_inventory',
      status: 'success',
      description: `Found ${items.length} inventory items`,
      details: items
    };
  }

  private async handleAdjustInventory(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { itemName, quantity, reason } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Get all inventory items for fuzzy matching
    const allInventoryItems = await this.db.all(
      'SELECT * FROM inventory_items WHERE restaurant_id = ?',
      [restaurantId]
    );

    // Use fuzzy matching to find the best match
    const matchResults = this.findBestMatches(itemName, allInventoryItems);
    
    if (matchResults.length === 0) {
      const availableItems = allInventoryItems.slice(0, 5).map((i: any) => i.name).join(', ');
      throw new Error(`Inventory item "${itemName}" not found. Available items: ${availableItems}`);
    }

    // If multiple good matches, ask for clarification
    if (matchResults.length > 1 && matchResults[0].score > 0) {
      const suggestions = matchResults.slice(0, 3).map((r: any) => r.item.name).join(', ');
      throw new Error(`Multiple inventory items match "${itemName}": ${suggestions}. Please be more specific.`);
    }

    const item = matchResults[0].item;
    logger.info(`Fuzzy matched inventory item "${itemName}" to "${item.name}" (score: ${matchResults[0].score})`);
    

    const newQuantity = item.on_hand_qty + quantity;

    if (newQuantity < 0) {
      throw new Error(`Cannot reduce ${itemName} below 0. Current: ${item.on_hand_qty}, Requested: ${quantity}`);
    }

    await this.db.run(
      'UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [newQuantity, item.id, restaurantId]
    );

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'adjust_inventory', 'inventory', item.id,
      { itemName, previousQuantity: item.on_hand_qty, adjustment: quantity, newQuantity, reason }
    );

    const action = quantity > 0 ? 'Added' : 'Removed';
    const absQuantity = Math.abs(quantity);

    return {
      type: 'adjust_inventory',
      status: 'success',
      description: `${action} ${absQuantity} ${item.unit} ${quantity > 0 ? 'to' : 'from'} ${item.name}. New total: ${newQuantity} ${item.unit}`,
      details: { itemId: item.id, itemName: item.name, adjustment: quantity, newQuantity, reason }
    };
  }

  private async handleGetTasks(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { status, type } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    let query = 'SELECT * FROM tasks WHERE restaurant_id = ?';
    const params: any[] = [restaurantId];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const tasks = await this.db.all(query, params);

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'get_tasks', 'tasks', 'multiple', { status, type, count: tasks.length }
    );

    return {
      type: 'get_tasks',
      status: 'success',
      description: `Found ${tasks.length} tasks`,
      details: tasks
    };
  }

  private async handleCompleteTask(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { taskId } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    const task = await this.db.get('SELECT * FROM tasks WHERE id = ? AND restaurant_id = ?', [taskId, restaurantId]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await this.db.run(
      'UPDATE tasks SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      ['completed', new Date().toISOString(), taskId, restaurantId]
    );

    await DatabaseService.getInstance().logAudit(
      restaurantId, userId, 'complete_task', 'task', taskId, { taskTitle: task.title }
    );

    return {
      type: 'complete_task',
      status: 'success',
      description: `Completed task: ${task.title}`,
      details: { taskId, taskTitle: task.title }
    };
  }
}

export default AssistantService;