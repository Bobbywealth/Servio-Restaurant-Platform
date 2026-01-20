"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantService = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const DatabaseService_1 = require("./DatabaseService");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
class AssistantService {
    constructor() {
        this._db = null;
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY || ''
        });
    }
    get db() {
        if (!this._db) {
            this._db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        }
        return this._db;
    }
    async processAudio(audioBuffer, userId) {
        const startTime = Date.now();
        try {
            // 1. Speech-to-Text
            const transcript = await this.transcribeAudio(audioBuffer);
            logger_1.logger.info(`Transcribed audio: "${transcript}"`);
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
        }
        catch (error) {
            logger_1.logger.error('Failed to process audio:', error);
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
    async processText(text, userId) {
        const startTime = Date.now();
        try {
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
            const actions = [];
            // Process tool calls
            if (message.tool_calls) {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to process text:', error);
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
    async transcribeAudio(audioBuffer) {
        try {
            // Save buffer to temporary file in OS temp directory
            const tempPath = path_1.default.join(os_1.default.tmpdir(), `servio_audio_${Date.now()}_${(0, uuid_1.v4)()}.webm`);
            fs_1.default.writeFileSync(tempPath, audioBuffer);
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs_1.default.createReadStream(tempPath),
                model: 'whisper-1',
                language: 'en'
            });
            // Clean up temp file
            fs_1.default.unlinkSync(tempPath);
            return transcription.text;
        }
        catch (error) {
            logger_1.logger.error('Transcription failed:', error);
            throw new Error('Failed to transcribe audio');
        }
    }
    async generateSpeech(text) {
        try {
            if (!process.env.OPENAI_API_KEY) {
                return '';
            }
            // Keep responses bounded for latency/cost.
            const input = text.length > 2000 ? text.slice(0, 2000) : text;
            const model = process.env.OPENAI_TTS_MODEL || 'tts-1';
            const voice = (process.env.OPENAI_TTS_VOICE || 'alloy');
            const speech = await this.openai.audio.speech.create({
                model,
                voice,
                input,
                response_format: 'mp3'
            });
            const arrayBuffer = await speech.arrayBuffer();
            const audioBuffer = Buffer.from(arrayBuffer);
            const ttsDir = path_1.default.join(process.cwd(), 'uploads', 'tts');
            await fs_1.default.promises.mkdir(ttsDir, { recursive: true });
            const fileName = `tts_${Date.now()}_${(0, uuid_1.v4)()}.mp3`;
            const outPath = path_1.default.join(ttsDir, fileName);
            await fs_1.default.promises.writeFile(outPath, audioBuffer);
            // Served by backend static route: /uploads/*
            return `/uploads/tts/${fileName}`;
        }
        catch (error) {
            logger_1.logger.error('TTS generation failed:', error);
            return '';
        }
    }
    async getSystemPrompt(userId) {
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        // Get current restaurant context
        const orders = await this.db.all('SELECT * FROM orders WHERE restaurant_id = ? AND status != "completed" ORDER BY created_at DESC LIMIT 10', [restaurantId]);
        const unavailableItems = await this.db.all('SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 0', [restaurantId]);
        const lowStockItems = await this.db.all('SELECT * FROM inventory_items WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold', [restaurantId]);
        const pendingTasks = await this.db.all('SELECT * FROM tasks WHERE restaurant_id = ? AND status = "pending" LIMIT 5', [restaurantId]);
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
    getTools() {
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
    async executeTool(toolCall, userId) {
        const { name, arguments: args } = toolCall.function;
        try {
            const parsedArgs = JSON.parse(args);
            logger_1.logger.info(`Executing tool: ${name} with args:`, parsedArgs);
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
        }
        catch (error) {
            logger_1.logger.error(`Tool execution failed for ${name}:`, error);
            return {
                type: name,
                status: 'error',
                description: `Failed to execute ${name}`,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async handleGetOrders(args, userId) {
        const { status, limit = 10 } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        let query = 'SELECT * FROM orders WHERE restaurant_id = ?';
        const params = [restaurantId];
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        const orders = await this.db.all(query, params);
        // Parse items JSON for each order
        const formattedOrders = orders.map((order) => ({
            ...order,
            items: JSON.parse(order.items || '[]')
        }));
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'get_orders', 'orders', 'multiple', { status, count: orders.length });
        return {
            type: 'get_orders',
            status: 'success',
            description: `Found ${orders.length} orders${status ? ` with status ${status}` : ''}`,
            details: formattedOrders
        };
    }
    async handleUpdateOrderStatus(args, userId) {
        const { orderId, status } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        const result = await this.db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?', [status, orderId, restaurantId]);
        if (result.changes === 0) {
            throw new Error(`Order ${orderId} not found`);
        }
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'update_order_status', 'order', orderId, { newStatus: status });
        return {
            type: 'update_order_status',
            status: 'success',
            description: `Order ${orderId} marked as ${status}`,
            details: { orderId, status }
        };
    }
    async handleSetItemAvailability(args, userId) {
        const { itemName, available, channels = ['all'] } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        // Find the menu item
        const item = await this.db.get('SELECT * FROM menu_items WHERE name LIKE ? AND restaurant_id = ?', [`%${itemName}%`, restaurantId]);
        if (!item) {
            throw new Error(`Menu item "${itemName}" not found`);
        }
        // Update availability
        await this.db.run('UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?', [available ? 1 : 0, item.id, restaurantId]);
        const action = available ? 'restored' : '86\'d';
        const channelText = channels.includes('all') ? 'all platforms' : channels.join(', ');
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'set_item_availability', 'menu_item', item.id, { itemName, available, channels });
        return {
            type: 'set_item_availability',
            status: 'success',
            description: `${item.name} ${action} on ${channelText}`,
            details: { itemId: item.id, itemName: item.name, available, channels }
        };
    }
    async handleGetInventory(args, userId) {
        const { search, lowStock } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        let query = 'SELECT * FROM inventory_items WHERE restaurant_id = ?';
        const params = [restaurantId];
        const conditions = [];
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
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'get_inventory', 'inventory', 'multiple', { search, lowStock, count: items.length });
        return {
            type: 'get_inventory',
            status: 'success',
            description: `Found ${items.length} inventory items`,
            details: items
        };
    }
    async handleAdjustInventory(args, userId) {
        const { itemName, quantity, reason } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        // Find the inventory item
        const item = await this.db.get('SELECT * FROM inventory_items WHERE name LIKE ? AND restaurant_id = ?', [`%${itemName}%`, restaurantId]);
        if (!item) {
            throw new Error(`Inventory item "${itemName}" not found`);
        }
        const newQuantity = item.on_hand_qty + quantity;
        if (newQuantity < 0) {
            throw new Error(`Cannot reduce ${itemName} below 0. Current: ${item.on_hand_qty}, Requested: ${quantity}`);
        }
        await this.db.run('UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?', [newQuantity, item.id, restaurantId]);
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'adjust_inventory', 'inventory', item.id, { itemName, previousQuantity: item.on_hand_qty, adjustment: quantity, newQuantity, reason });
        const action = quantity > 0 ? 'Added' : 'Removed';
        const absQuantity = Math.abs(quantity);
        return {
            type: 'adjust_inventory',
            status: 'success',
            description: `${action} ${absQuantity} ${item.unit} ${quantity > 0 ? 'to' : 'from'} ${item.name}. New total: ${newQuantity} ${item.unit}`,
            details: { itemId: item.id, itemName: item.name, adjustment: quantity, newQuantity, reason }
        };
    }
    async handleGetTasks(args, userId) {
        const { status, type } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        let query = 'SELECT * FROM tasks WHERE restaurant_id = ?';
        const params = [restaurantId];
        const conditions = [];
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
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'get_tasks', 'tasks', 'multiple', { status, type, count: tasks.length });
        return {
            type: 'get_tasks',
            status: 'success',
            description: `Found ${tasks.length} tasks`,
            details: tasks
        };
    }
    async handleCompleteTask(args, userId) {
        const { taskId } = args;
        const user = await this.db.get('SELECT restaurant_id FROM users WHERE id = ?', [userId]);
        const restaurantId = user?.restaurant_id || 'demo-restaurant-1';
        const task = await this.db.get('SELECT * FROM tasks WHERE id = ? AND restaurant_id = ?', [taskId, restaurantId]);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        await this.db.run('UPDATE tasks SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?', ['completed', new Date().toISOString(), taskId, restaurantId]);
        await DatabaseService_1.DatabaseService.getInstance().logAudit(restaurantId, userId, 'complete_task', 'task', taskId, { taskTitle: task.title });
        return {
            type: 'complete_task',
            status: 'success',
            description: `Completed task: ${task.title}`,
            details: { taskId, taskTitle: task.title }
        };
    }
}
exports.AssistantService = AssistantService;
exports.default = AssistantService;
//# sourceMappingURL=AssistantService.js.map