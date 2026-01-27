import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import { ensureUploadsDir } from '../utils/uploads';
import { v4 as uuidv4 } from 'uuid';

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

interface StreamChunk {
  type: 'content' | 'tool_call' | 'action' | 'audio' | 'done' | 'error';
  content?: string;
  action?: AssistantResponse['actions'][0];
  audioUrl?: string;
  error?: string;
  processingTime?: number;
}



export class AssistantService {
  private openai: OpenAI;
  private _db: any = null;

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
      logger.info('[assistant] processText start', { userId, textPreview: text?.slice?.(0, 200) });
      // Get system prompt with current context
      const systemPrompt = await this.getSystemPrompt(userId);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        tools: this.getTools(),
        tool_choice: 'auto',
        temperature: 0.3
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      let response = message.content || "I understand, let me help with that.";
      const actions: AssistantResponse['actions'] = [];

      // Process tool calls
      if (message.tool_calls) {
        logger.info('[assistant] tool_calls received', { userId, count: message.tool_calls.length });
        for (const toolCall of message.tool_calls) {
          const action = await this.executeTool(toolCall, userId);
          actions.push(action);
        }
      }

      // Generate TTS audio
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

  async *processTextStream(text: string, userId: string): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      logger.info('[assistant] processTextStream start', { userId, textPreview: text?.slice?.(200) });

      // Get system prompt with current context
      const systemPrompt = await this.getSystemPrompt(userId);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        tools: this.getTools(),
        tool_choice: 'auto',
        temperature: 0.3,
        stream: true
      });

      let fullResponse = '';
      let toolCalls: any[] = [];

      // Stream the response
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta;

        if (!delta) continue;

        // Handle content streaming
        if (delta.content) {
          fullResponse += delta.content;
          yield {
            type: 'content',
            content: delta.content
          };
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;

            // Find or create tool call
            let toolCall = toolCalls.find(tc => tc.index === index);
            if (!toolCall) {
              toolCall = {
                index,
                id: toolCallDelta.id || '',
                type: 'function',
                function: {
                  name: '',
                  arguments: ''
                }
              };
              toolCalls.push(toolCall);
            }

            // Update tool call
            if (toolCallDelta.function?.name) {
              toolCall.function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCall.function.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      // Process tool calls after streaming is complete
      const actions: AssistantResponse['actions'] = [];
      if (toolCalls.length > 0) {
        logger.info('[assistant] processing tool calls', { userId, count: toolCalls.length });

        for (const toolCall of toolCalls) {
          if (!toolCall.id) continue;

          const action = await this.executeTool(toolCall, userId);
          actions.push(action);
          yield {
            type: 'action',
            action
          };
        }
      }

      // Generate TTS audio
      const audioUrl = await this.generateSpeech(fullResponse);

      yield {
        type: 'done',
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Failed to process text stream:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async resolveRestaurantId(userId: string): Promise<string> {
    const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
    const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
    logger.info('[assistant] resolved restaurantId', {
      userId,
      restaurantId,
      hasUserRow: Boolean(user),
      hasRestaurantId: Boolean(user?.restaurant_id)
    });
    return restaurantId;
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
      const input = text.length > 2000 ? text.slice(0, 2000) : text;
      const model = process.env.OPENAI_TTS_MODEL || 'tts-1';
      const voice = (process.env.OPENAI_TTS_VOICE || 'alloy') as any;

      const speech = await this.openai.audio.speech.create({
        model,
        voice,
        input,
        response_format: 'mp3'
      });

      const arrayBuffer = await speech.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Use configurable UPLOADS_DIR for Render persistent disk support
      const ttsDir = await ensureUploadsDir('tts');

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
    const restaurantId = await this.resolveRestaurantId(userId);

    // Get current restaurant context - NOTE: Using single quotes for string literals (PostgreSQL compatible)
    const orders = await this.db.all("SELECT * FROM orders WHERE restaurant_id = ? AND status != 'completed' ORDER BY created_at DESC LIMIT 10", [restaurantId]);
    const unavailableItems = await this.db.all('SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 0', [restaurantId]);
    const lowStockItems = await this.db.all('SELECT * FROM inventory_items WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold', [restaurantId]);
    const pendingTasks = await this.db.all("SELECT * FROM tasks WHERE restaurant_id = ? AND status = 'pending' LIMIT 5", [restaurantId]);

    const context = {
      activeOrders: orders.length,
      unavailableItems: unavailableItems.length,
      lowStockItems: lowStockItems.length,
      pendingTasks: pendingTasks.length
    };

    return `You are Servio, an AI assistant for restaurant staff. You help with orders, inventory, menu availability (86ing items), and tasks.

CURRENT RESTAURANT STATUS:
- Active orders: ${context.activeOrders}
- Unavailable items (86'd): ${context.unavailableItems}
- Low stock items: ${context.lowStockItems}
- Pending tasks: ${context.pendingTasks}

YOUR CAPABILITIES:
1. Orders: Check status, update progress, view wait times
2. Menu/86: Mark items unavailable/available on delivery platforms
3. Inventory: Record receipts, adjust quantities, check levels
4. Tasks: View daily tasks, mark as complete
5. General info: Provide restaurant operational assistance

SAFETY RULES:
1. Always confirm destructive actions (86ing items, large inventory changes)
2. If multiple items match a request, ask for clarification
3. Log all actions for audit purposes
4. For 86 operations, confirm which channels (DoorDash, Uber Eats, GrubHub)

RESPONSE STYLE:
- Be concise and actionable
- Use restaurant terminology naturally
- Confirm actions taken with specific details
- If you need clarification, ask direct questions

Examples:
- "I'm marking Jerk Chicken unavailable on all platforms. This will take about 30 seconds to sync."
- "I found 3 orders waiting over 15 minutes: #214, #215, #217. Which one do you want to update?"
- "Added 2 cases of chicken to inventory. Current level: 27 pieces."

Use the available tools to perform actions. Always be helpful and professional.`;
  }

  private getTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_store_status',
          description: 'Get a quick operational status snapshot for the current restaurant (orders, 86d items, low stock, pending tasks)',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
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

  private async executeTool(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    userId: string
  ): Promise<AssistantResponse['actions'][0]> {
    if (toolCall.type !== 'function' || !('function' in toolCall)) {
      return {
        type: 'tool_call',
        status: 'error',
        description: 'Unsupported tool call type',
        error: `Unsupported tool call type: ${String((toolCall as any)?.type)}`
      };
    }

    const { name, arguments: args } = toolCall.function;

    try {
      const parsedArgs = args ? JSON.parse(args) : {};
      logger.info('[assistant] executing tool', {
        name,
        userId,
        toolCallId: (toolCall as any)?.id,
        args: parsedArgs
      });

      switch (name) {
        case 'get_store_status':
          return await this.handleGetStoreStatus(parsedArgs, userId);
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

  private async handleGetStoreStatus(_args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const restaurantId = await this.resolveRestaurantId(userId);

    const activeOrders = await this.db.all(
      "SELECT id, status, created_at FROM orders WHERE restaurant_id = ? AND status != 'completed' ORDER BY created_at DESC LIMIT 25",
      [restaurantId]
    );
    const unavailableItems = await this.db.all(
      'SELECT id, name FROM menu_items WHERE restaurant_id = ? AND is_available = 0 ORDER BY name LIMIT 50',
      [restaurantId]
    );
    const lowStockItems = await this.db.all(
      'SELECT id, name, on_hand_qty, low_stock_threshold FROM inventory_items WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold ORDER BY on_hand_qty ASC LIMIT 50',
      [restaurantId]
    );
    const pendingTasks = await this.db.all(
      "SELECT id, title, status FROM tasks WHERE restaurant_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 25",
      [restaurantId]
    );

    const snapshot = {
      activeOrders: activeOrders.length,
      unavailableItems: unavailableItems.length,
      lowStockItems: lowStockItems.length,
      pendingTasks: pendingTasks.length
    };

    await DatabaseService.getInstance().logAudit(
      restaurantId,
      userId,
      'get_store_status',
      'store',
      'snapshot',
      snapshot
    );

    return {
      type: 'get_store_status',
      status: 'success',
      description: `Store status: ${snapshot.activeOrders} active orders, ${snapshot.unavailableItems} 86'd items, ${snapshot.lowStockItems} low stock items, ${snapshot.pendingTasks} pending tasks.`,
      details: { snapshot, activeOrders, unavailableItems, lowStockItems, pendingTasks }
    };
  }

  private async handleGetOrders(args: any, userId: string): Promise<AssistantResponse['actions'][0]> {
    const { status, limit = 10 } = args;
    const restaurantId = await this.resolveRestaurantId(userId);

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
    const restaurantId = await this.resolveRestaurantId(userId);

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
    const restaurantId = await this.resolveRestaurantId(userId);

    // Find the menu item
    const item = await this.db.get(
      'SELECT * FROM menu_items WHERE name LIKE ? AND restaurant_id = ?',
      [`%${itemName}%`, restaurantId]
    );

    if (!item) {
      throw new Error(`Menu item "${itemName}" not found`);
    }

    // Update availability
    await this.db.run(
      'UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [available ? 1 : 0, item.id, restaurantId]
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
    const restaurantId = await this.resolveRestaurantId(userId);

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
    const restaurantId = await this.resolveRestaurantId(userId);

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
    const restaurantId = await this.resolveRestaurantId(userId);

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
      query += ' AND ' + conditions.join(' AND ');
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
    const restaurantId = await this.resolveRestaurantId(userId);

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