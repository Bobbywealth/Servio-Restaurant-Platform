"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VapiService = void 0;
const AssistantService_1 = require("./AssistantService");
const DatabaseService_1 = require("./DatabaseService");
const logger_1 = require("../utils/logger");
class VapiService {
    constructor() {
        this.assistantService = new AssistantService_1.AssistantService();
    }
    async handleWebhook(payload) {
        const { message } = payload;
        logger_1.logger.info('Vapi webhook received:', {
            type: message.type,
            callId: message.call?.id,
            customerNumber: message.call?.customer?.number
        });
        try {
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
                    logger_1.logger.info(`Unhandled webhook type: ${message.type}`);
                    return { result: 'acknowledged' };
            }
        }
        catch (error) {
            logger_1.logger.error('Vapi webhook error:', error);
            return { error: 'Internal server error' };
        }
    }
    async handleAssistantRequest(message) {
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
        }
        catch (error) {
            logger_1.logger.error('Assistant request failed:', error);
            return {
                result: "I'm sorry, I'm having trouble right now. Let me transfer you to someone who can help."
            };
        }
    }
    async handleFunctionCall(message) {
        if (!message.functionCall) {
            return { error: 'No function call data provided' };
        }
        const { name, parameters } = message.functionCall;
        const userId = this.getPhoneUserId(message.call?.customer?.number);
        try {
            let result;
            // Handle phone-specific functions
            switch (name) {
                case 'place_order':
                    result = await this.handlePlaceOrder(parameters, userId);
                    break;
                case 'get_menu_info':
                    result = await this.handleGetMenuInfo(parameters, userId);
                    break;
                case 'check_order_status':
                    result = await this.handleCheckOrderStatus(parameters, userId);
                    break;
                default:
                    // Fall back to existing assistant service functions
                    const mockToolCall = {
                        id: 'phone_call',
                        type: 'function',
                        function: {
                            name,
                            arguments: JSON.stringify(parameters)
                        }
                    };
                    result = await this.assistantService.executeTool(mockToolCall, userId);
            }
            if (result.status === 'error') {
                return {
                    result: `I'm sorry, ${result.error}. Is there something else I can help you with?`
                };
            }
            // Format the result for voice response
            const voiceResponse = this.formatActionResultForVoice(result);
            return { result: voiceResponse };
        }
        catch (error) {
            logger_1.logger.error('Function call failed:', error);
            return {
                result: "I'm sorry, I wasn't able to complete that action. What else can I help you with?"
            };
        }
    }
    async handleEndOfCall(message) {
        const callId = message.call?.id;
        const customerNumber = message.call?.customer?.number;
        const duration = message.call?.duration;
        const endedReason = message.endedReason;
        // Log the call for analytics
        await DatabaseService_1.DatabaseService.getInstance().logAudit(this.getPhoneUserId(customerNumber), 'phone_call_ended', 'call', callId, { duration, endedReason, customerNumber });
        logger_1.logger.info(`Call ${callId} ended: ${endedReason}, duration: ${duration}s`);
        return { result: 'call logged' };
    }
    async logTranscript(message) {
        const callId = message.call?.id;
        const customerNumber = message.call?.customer?.number;
        const transcript = message.transcript;
        // Log for training/improvement purposes
        logger_1.logger.info(`Call ${callId} transcript:`, transcript);
        // Could store in database for analytics if needed
    }
    getPhoneUserId(phoneNumber) {
        // Create a consistent user ID for phone orders
        return phoneNumber ? `phone_${phoneNumber.replace(/\D/g, '')}` : 'phone_anonymous';
    }
    formatForVoice(response) {
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
            if (number === 1)
                return 'one item';
            if (number === 2)
                return 'two items';
            if (number === 3)
                return 'three items';
            return `${num} items`;
        })
            // Add natural pauses
            .replace(/\. /g, '. ... ')
            // Keep responses concise for voice
            .slice(0, 500); // Limit response length for better voice experience
    }
    formatActionResultForVoice(result) {
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
    async handlePlaceOrder(parameters, userId) {
        try {
            const { items, customerInfo, deliveryAddress, orderType } = parameters;
            const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
            // Validate items against menu
            const validItems = [];
            let totalAmount = 0;
            for (const item of items) {
                const menuItem = await db.get('SELECT * FROM menu_items WHERE name LIKE ? AND is_available = 1', [`%${item.name}%`]);
                if (!menuItem) {
                    return {
                        type: 'place_order',
                        status: 'error',
                        description: `I'm sorry, "${item.name}" is not available on our menu right now.`,
                        error: `Menu item "${item.name}" not found or unavailable`
                    };
                }
                validItems.push({
                    id: menuItem.id,
                    name: menuItem.name,
                    price: menuItem.price,
                    quantity: item.quantity,
                    specialInstructions: item.specialInstructions || null
                });
                totalAmount += menuItem.price * item.quantity;
            }
            // Create the order
            const orderIdValue = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.run(`INSERT INTO orders (
          id, customer_name, customer_phone, customer_email, 
          items, total_amount, order_type, status, 
          delivery_address, special_instructions, 
          source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [
                orderIdValue,
                customerInfo.name,
                customerInfo.phone,
                customerInfo.email || null,
                JSON.stringify(validItems),
                totalAmount,
                orderType,
                'received',
                deliveryAddress ? JSON.stringify(deliveryAddress) : null,
                validItems.map(i => i.specialInstructions).filter(Boolean).join('; ') || null,
                'phone_vapi'
            ]);
            // Log the audit
            await DatabaseService_1.DatabaseService.getInstance().logAudit(userId, 'place_order', 'order', orderIdValue, { customerInfo, items: validItems, orderType, totalAmount });
            const itemSummary = validItems.map(item => `${item.quantity} ${item.name}${item.specialInstructions ? ' (' + item.specialInstructions + ')' : ''}`).join(', ');
            return {
                type: 'place_order',
                status: 'success',
                description: `Perfect! I've placed your order for ${itemSummary}. Your order number is ${orderIdValue}. Total is $${totalAmount.toFixed(2)} for ${orderType}. ${orderType === 'delivery' ? 'We\'ll have that delivered to you' : orderType === 'pickup' ? 'You can pick it up' : 'We\'ll have that ready for you'} in about 20 to 25 minutes.`,
                details: { orderId: orderIdValue, items: validItems, totalAmount, orderType }
            };
        }
        catch (error) {
            logger_1.logger.error('Place order failed:', error);
            return {
                type: 'place_order',
                status: 'error',
                description: 'I apologize, but I\'m having trouble placing your order right now. Let me get a manager to help you.',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    // Handle menu information requests
    async handleGetMenuInfo(parameters, userId) {
        try {
            const { category, itemName } = parameters;
            const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
            let query = 'SELECT * FROM menu_items WHERE is_available = 1';
            const params = [];
            if (itemName) {
                query += ' AND name LIKE ?';
                params.push(`%${itemName}%`);
            }
            if (category) {
                query += ' AND category LIKE ?';
                params.push(`%${category}%`);
            }
            query += ' ORDER BY name LIMIT 10';
            const items = await db.all(query, params);
            await DatabaseService_1.DatabaseService.getInstance().logAudit(userId, 'get_menu_info', 'menu', 'multiple', { category, itemName, resultCount: items.length });
            if (items.length === 0) {
                return {
                    type: 'get_menu_info',
                    status: 'success',
                    description: `I couldn't find any items matching that search. Would you like me to tell you about our most popular dishes instead?`,
                    details: []
                };
            }
            if (items.length === 1) {
                const item = items[0];
                return {
                    type: 'get_menu_info',
                    status: 'success',
                    description: `${item.name} is ${item.price} dollars. ${item.description || 'It\'s one of our popular items.'}`,
                    details: items
                };
            }
            const itemList = items.slice(0, 5).map(item => `${item.name} for ${item.price} dollars`).join(', ');
            return {
                type: 'get_menu_info',
                status: 'success',
                description: `I found several options: ${itemList}. Would you like more details about any of these?`,
                details: items
            };
        }
        catch (error) {
            logger_1.logger.error('Get menu info failed:', error);
            return {
                type: 'get_menu_info',
                status: 'error',
                description: 'I\'m having trouble accessing our menu right now. Let me get someone to help you.',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    // Handle order status checks
    async handleCheckOrderStatus(parameters, userId) {
        try {
            const { orderId, phoneNumber } = parameters;
            const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
            let query;
            let params;
            if (orderId) {
                query = 'SELECT * FROM orders WHERE id = ?';
                params = [orderId];
            }
            else if (phoneNumber) {
                query = 'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 3';
                params = [phoneNumber];
            }
            else {
                return {
                    type: 'check_order_status',
                    status: 'error',
                    description: 'I need either an order number or your phone number to look up your order.',
                    error: 'Missing order ID or phone number'
                };
            }
            const orders = orderId ? [await db.get(query, params)] : await db.all(query, params);
            const validOrders = orders.filter(order => order !== undefined);
            await DatabaseService_1.DatabaseService.getInstance().logAudit(userId, 'check_order_status', 'order', orderId || 'by_phone', { orderId, phoneNumber, foundOrders: validOrders.length });
            if (validOrders.length === 0) {
                return {
                    type: 'check_order_status',
                    status: 'success',
                    description: orderId
                        ? `I couldn't find order number ${orderId}. Could you double-check the number?`
                        : `I couldn't find any recent orders for that phone number. Could you check the number or provide your order number?`,
                    details: []
                };
            }
            if (validOrders.length === 1) {
                const order = validOrders[0];
                const statusMessage = this.getOrderStatusMessage(order.status);
                const timeAgo = this.getTimeAgo(new Date(order.created_at));
                return {
                    type: 'check_order_status',
                    status: 'success',
                    description: `Your order number ${order.id} from ${timeAgo} is currently ${statusMessage}. ${this.getStatusTimeEstimate(order.status)}`,
                    details: validOrders
                };
            }
            // Multiple orders found
            const orderSummary = validOrders.map(order => `Order ${order.id} is ${this.getOrderStatusMessage(order.status)}`).join(', ');
            return {
                type: 'check_order_status',
                status: 'success',
                description: `I found ${validOrders.length} recent orders: ${orderSummary}. Which one would you like details about?`,
                details: validOrders
            };
        }
        catch (error) {
            logger_1.logger.error('Check order status failed:', error);
            return {
                type: 'check_order_status',
                status: 'error',
                description: 'I\'m having trouble accessing order information right now. Let me get someone to check on that for you.',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    getOrderStatusMessage(status) {
        switch (status) {
            case 'received': return 'being prepared';
            case 'preparing': return 'currently being made in our kitchen';
            case 'ready': return 'ready for pickup';
            case 'completed': return 'completed';
            case 'cancelled': return 'cancelled';
            default: return status;
        }
    }
    getStatusTimeEstimate(status) {
        switch (status) {
            case 'received': return 'It should be ready in about 20 to 25 minutes.';
            case 'preparing': return 'It should be ready in about 10 to 15 minutes.';
            case 'ready': return 'You can come pick it up now!';
            case 'completed': return '';
            case 'cancelled': return 'Please call if you have questions about this.';
            default: return '';
        }
    }
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        if (diffMins < 1)
            return 'just now';
        if (diffMins < 60)
            return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        const diffHours = Math.round(diffMins / 60);
        if (diffHours < 24)
            return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    getPhoneSystemPrompt() {
        return `You are Servio, an AI assistant for a restaurant, speaking to customers and staff over the phone.

IMPORTANT PHONE CALL GUIDELINES:
- Keep responses concise and conversational (under 500 characters)
- Speak naturally as if talking to someone face-to-face
- Don't use visual references (no "click here", "see below", etc.)
- For numbers, use words when possible (say "order number two fourteen" not "order #214")
- Add natural pauses with "..." for better voice flow
- Confirm actions clearly ("Got it, I've updated that for you")
- If you need clarification, ask direct questions
- For complex information, offer to transfer to a human

VOICE ORDERING CAPABILITIES:
1. Take new orders - ask about items, quantities, special instructions
2. Check order status - by order number or customer phone
3. Handle menu questions - availability, prices, descriptions  
4. Process changes - add/remove items, modify orders
5. Handle complaints or issues professionally

CONVERSATION FLOW:
- Greet warmly and offer help immediately
- Listen for the customer's main need first
- Ask clarifying questions one at a time
- Confirm important details before proceeding
- End with clear next steps

Remember: You're representing the restaurant's brand. Be friendly, helpful, and professional.`;
    }
}
exports.VapiService = VapiService;
//# sourceMappingURL=VapiService.js.map