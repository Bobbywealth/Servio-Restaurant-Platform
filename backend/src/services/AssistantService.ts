import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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



export class AssistantService {
  private openai: OpenAI;
  private _db: any = null;
  private conversationHistory: Map<string, Array<{role: string, content: string}>> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
  }

  private get db() {
    if (!this._db) {
      this._db = DatabaseService.getInstance().getDatabase();
    }
    return this._db;
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

      // Get conversation history for this user (keep last 6 messages for context)
      if (!this.conversationHistory.has(userId)) {
        this.conversationHistory.set(userId, []);
      }
      const history = this.conversationHistory.get(userId)!;
      
      // Add current message to history
      history.push({ role: 'user', content: text });
      
      // Keep only last 6 messages (3 exchanges) for speed
      if (history.length > 6) {
        history.splice(0, history.length - 6);
      }

      const completion = await this.openai.chat.completions.create({
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
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      let response = message.content || "I understand, let me help with that.";
      const actions: AssistantResponse['actions'] = [];

      // Process tool calls
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          const action = await this.executeTool(toolCall, userId);
          actions.push(action);
        }
      }

      // Add assistant response to history for natural conversation flow
      history.push({ role: 'assistant', content: response });

      // Generate TTS audio (in parallel for speed)
      const audioUrl = await this.generateSpeech(response);

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

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en'
      });

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

      const speech = await this.openai.audio.speech.create({
        model,
        voice,
        input,
        response_format: 'mp3',
        speed
      });

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

  private async getSystemPrompt(userId: string): Promise<string> {
    const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Get comprehensive restaurant context
    const orders = await this.db.all('SELECT * FROM orders WHERE restaurant_id = ? AND status != "completed" ORDER BY created_at DESC LIMIT 10', [restaurantId]);
    const unavailableItems = await this.db.all('SELECT name, updated_at FROM menu_items WHERE restaurant_id = ? AND is_available = FALSE ORDER BY updated_at DESC', [restaurantId]);
    const lowStockItems = await this.db.all('SELECT name, on_hand_qty, unit, low_stock_threshold FROM inventory_items WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold', [restaurantId]);
    const pendingTasks = await this.db.all('SELECT title FROM tasks WHERE restaurant_id = ? AND status = "pending" LIMIT 5', [restaurantId]);
    const menuItems = await this.db.all('SELECT name FROM menu_items WHERE restaurant_id = ? AND is_available = TRUE LIMIT 20', [restaurantId]);
    
    // Get time context
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeOfDay = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'late night';

    // Build detailed context strings
    const unavailableList = unavailableItems.map(item => item.name).join(', ') || 'None';
    const lowStockList = lowStockItems.map(item => `${item.name} (${item.on_hand_qty} ${item.unit})`).join(', ') || 'None';
    const urgentOrders = orders.filter((o: any) => {
      const createdTime = new Date(o.created_at).getTime();
      const now = Date.now();
      return (now - createdTime) > 15 * 60 * 1000; // Over 15 minutes
    });

    return `You are Servio, an intelligent AI assistant specifically designed for restaurant operations. You have deep knowledge of restaurant workflows, terminology, and best practices.

CURRENT CONTEXT:
Time: ${dayOfWeek}, ${timeOfDay} service (${hour}:00)
Restaurant: ${user?.name || 'Restaurant'}'s location
Active Orders: ${orders.length} ${orders.length > 5 ? '⚠️ (High volume)' : ''}
Urgent Orders (>15min): ${urgentOrders.length}
Currently 86'd Items: ${unavailableList}
Low Stock Items: ${lowStockList}
Pending Tasks: ${pendingTasks.length}

YOUR ADVANCED CAPABILITIES:
1. 📦 Order Management:
   - Track order status and timing
   - Identify bottlenecks and urgent orders
   - Update order progression (received → preparing → ready → completed)
   - Calculate wait times and provide ETAs

2. 🍽️ Menu & 86 Operations:
   - Mark items unavailable ("86") across all delivery platforms
   - Restore item availability when back in stock
   - Sync with DoorDash, Uber Eats, GrubHub automatically
   - Track which items are currently unavailable

3. 📊 Inventory Intelligence:
   - Monitor stock levels in real-time
   - Alert on low inventory before it runs out
   - Record receipts and deliveries
   - Adjust quantities for waste, prep, or corrections
   - Predict when items need reordering

4. ✅ Task Management:
   - View daily, weekly, and monthly tasks
   - Mark tasks complete
   - Prioritize urgent items
   - Track completion rates

5. 🎯 Proactive Assistance:
   - Anticipate needs based on time of day and order volume
   - Suggest actions when detecting issues
   - Provide operational insights and recommendations
   - Remember context from previous interactions

INTELLIGENT BEHAVIOR:
- Understand natural language and restaurant slang ("86", "in the weeds", "fire", "on the fly")
- Infer intent from context (e.g., "we're out of chicken" → mark chicken items as 86'd)
- **ALWAYS ASK FOR CLARIFICATION when ambiguous** - Don't guess!
- If multiple items match, list them and ask which one
- Provide relevant suggestions based on current situation
- Learn from patterns and remember context from conversation
- Be proactive: warn about potential issues before they escalate

**DISAMBIGUATION EXAMPLES:**
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
${menuItems.map(i => i.name).slice(0, 10).join(', ')}${menuItems.length > 10 ? '...' : ''}

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

  private async handleSetItemAvailability(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { itemName, available, channels = ['all'] } = args;
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';

    // Search for ALL matching items to detect ambiguity
    let matchingItems: any[] = [];
    
    // Strategy 1: Exact partial match - find ALL matches
    matchingItems = await this.db.all(
      'SELECT * FROM menu_items WHERE name LIKE ? AND restaurant_id = ?',
      [`%${itemName}%`, restaurantId]
    );
    
    // Strategy 2: If no exact matches, try word-by-word search
    if (matchingItems.length === 0) {
      const words = itemName.split(/\s+/).filter(w => w.length > 2);
      for (const word of words) {
        const wordMatches = await this.db.all(
          'SELECT * FROM menu_items WHERE name LIKE ? AND restaurant_id = ?',
          [`%${word}%`, restaurantId]
        );
        if (wordMatches.length > 0) {
          matchingItems = wordMatches;
          logger.info(`Found ${wordMatches.length} items by word match: "${word}"`);
          break;
        }
      }
    }
    
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

    // Find the inventory item
    const item = await this.db.get(
      'SELECT * FROM inventory_items WHERE name LIKE ? AND restaurant_id = ?',
      [`%${itemName}%`, restaurantId]
    );

    if (!item) {
      throw new Error(`Inventory item "${itemName}" not found`);
    }

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