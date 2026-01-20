"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceOrderingService = void 0;
const DatabaseService_1 = require("./DatabaseService");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const SmsService_1 = require("./SmsService");
const bus_1 = require("../events/bus");
const logger_1 = require("../utils/logger");
const MENU_DATA_PATH = path_1.default.join(process.cwd(), 'backend/data/menu/sasheys_menu_vapi.json');
class VoiceOrderingService {
    constructor() {
        this.menuData = null;
        this.loadMenuData();
    }
    static getInstance() {
        if (!VoiceOrderingService.instance) {
            VoiceOrderingService.instance = new VoiceOrderingService();
        }
        return VoiceOrderingService.instance;
    }
    loadMenuData() {
        try {
            if (fs_1.default.existsSync(MENU_DATA_PATH)) {
                const raw = fs_1.default.readFileSync(MENU_DATA_PATH, 'utf8');
                this.menuData = JSON.parse(raw);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load menu data:', error);
        }
    }
    getStoreStatus() {
        if (!this.menuData)
            return null;
        return {
            status: "open", // Simplified for now, could be dynamic
            closedMessage: "We’re temporarily closed right now...",
            hours: {
                "tue": ["09:00", "21:00"],
                "wed": ["09:00", "21:00"],
                "thu": ["09:00", "21:00"],
                "fri": ["09:00", "21:00"],
                "sat": ["09:00", "21:00"]
            },
            timezone: "America/New_York"
        };
    }
    getFullMenu() {
        return this.menuData;
    }
    searchMenu(query) {
        if (!this.menuData)
            return [];
        const results = [];
        const q = query.toLowerCase();
        this.menuData.categories.forEach((cat) => {
            cat.items.forEach((item) => {
                if (item.name.toLowerCase().includes(q)) {
                    // Determine base price
                    let price = item.price || 0;
                    if (!price && item.modifierGroups) {
                        const sizeGroup = item.modifierGroups.find((g) => g.id === 'size' || g.name.toLowerCase().includes('size'));
                        if (sizeGroup && sizeGroup.options?.[0]) {
                            price = sizeGroup.options[0].priceDelta || 0;
                        }
                    }
                    results.push({
                        id: item.id,
                        name: item.name,
                        price: parseFloat(price.toFixed(2)),
                        category: cat.name
                    });
                }
            });
        });
        return results;
    }
    getMenuItem(id) {
        if (!this.menuData)
            return null;
        for (const cat of this.menuData.categories) {
            const item = cat.items.find((i) => i.id === id);
            if (item) {
                // Determine base price for response
                let basePrice = item.price || 0;
                if (!basePrice && item.modifierGroups) {
                    const sizeGroup = item.modifierGroups.find((g) => g.id === 'size' || g.name.toLowerCase().includes('size'));
                    if (sizeGroup && sizeGroup.options?.[0]) {
                        basePrice = sizeGroup.options[0].priceDelta || 0;
                    }
                }
                // Return structured data for Vapi
                return {
                    id: item.id,
                    name: item.name,
                    basePrice: parseFloat(basePrice.toFixed(2)),
                    modifierGroups: item.modifierGroups || [],
                    tags: item.tags || [],
                    category: cat.name
                };
            }
        }
        return null;
    }
    validateQuote(input) {
        const { items } = input;
        const errors = [];
        let subtotal = 0;
        const validatedItems = items.map((inputItem) => {
            const menuItem = this.getMenuItem(inputItem.itemId);
            if (!menuItem) {
                errors.push(`Item not found: ${inputItem.itemId}`);
                return null;
            }
            let itemPrice = menuItem.basePrice || 0;
            const tags = menuItem.tags || [];
            const itemName = menuItem.name.toLowerCase();
            const itemId = menuItem.id.toLowerCase();
            // Robust tag inference
            const isDinner = tags.includes('dinner') || itemName.includes('dinner');
            const isFish = itemName.includes('fish') || itemName.includes('snapper');
            const isWings = itemId.includes('wings') || itemName.includes('wings');
            const isAckee = itemId.includes('ackee') || itemName.includes('ackee');
            const isOxtail = itemId.includes('oxtail') || itemName.includes('oxtail');
            // Requirement: Dinner defaults
            if (isDinner) {
                if (!inputItem.modifiers?.rice_choice)
                    errors.push(`${menuItem.name} requires rice_choice`);
                if (!inputItem.modifiers?.cabbage)
                    errors.push(`${menuItem.name} requires cabbage`);
                if (!inputItem.modifiers?.spice_level)
                    errors.push(`${menuItem.name} requires spice_level`);
            }
            // Requirement: Fish dinners
            if (isFish && isDinner) {
                if (!inputItem.modifiers?.fish_style)
                    errors.push(`${menuItem.name} requires fish_style (Escovitch/Brown Stewed)`);
            }
            // Requirement: Wings
            if (isWings) {
                if (!inputItem.modifiers?.wings_size)
                    errors.push(`${menuItem.name} requires wings_size`);
                if (!inputItem.modifiers?.wings_sauce)
                    errors.push(`${menuItem.name} requires wings_sauce`);
            }
            // Requirement: Ackee
            if (isAckee) {
                if (!inputItem.modifiers?.callaloo_add)
                    errors.push(`${menuItem.name} requires callaloo add decision`);
            }
            // Calculate price from modifiers
            if (menuItem.modifierGroups) {
                menuItem.modifierGroups.forEach((group) => {
                    const selectedOptionId = inputItem.modifiers?.[group.id];
                    const option = group.options.find((o) => o.id === selectedOptionId);
                    if (option) {
                        itemPrice += (option.priceDelta || 0);
                    }
                });
            }
            // Requirement: Oxtail gravy on side
            if (isOxtail && inputItem.modifiers?.gravy_on_side === 'yes') {
                itemPrice += 0.50;
            }
            // Requirement: Ackee callaloo add
            if (isAckee && inputItem.modifiers?.callaloo_add === 'yes') {
                itemPrice += 3.00;
            }
            subtotal += itemPrice * (inputItem.qty || 1);
            return { ...inputItem, price: itemPrice };
        });
        const tax = subtotal * 0.06625; // Using tax rate from JSON
        const total = subtotal + tax;
        return {
            valid: errors.length === 0,
            subtotal: parseFloat(subtotal.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            fees: 0,
            total: parseFloat(total.toFixed(2)),
            errors,
            items: validatedItems.filter(Boolean)
        };
    }
    async createOrder(input) {
        const quote = this.validateQuote(input);
        if (!quote.valid)
            return { success: false, errors: quote.errors };
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const orderId = (0, uuid_1.v4)();
        const restaurantId = process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';
        await db.run(`
      INSERT INTO orders (
        id, restaurant_id, status, customer_name, customer_phone, last_initial,
        order_type, pickup_time, subtotal, tax, fees, total, total_amount,
        source, call_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
            orderId, restaurantId, 'pending', input.customer?.name, input.customer?.phone, input.customer?.lastInitial,
            input.orderType, input.pickupTime, quote.subtotal, quote.tax, quote.fees, quote.total, quote.total,
            input.source || 'vapi', input.callId
        ]);
        for (const item of quote.items) {
            const menuItem = this.getMenuItem(item.itemId);
            await db.run(`
        INSERT INTO order_items (
          id, order_id, item_id, item_name_snapshot, qty, unit_price_snapshot, modifiers_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
                (0, uuid_1.v4)(), orderId, item.itemId, menuItem?.name, item.qty, item.price, JSON.stringify(item.modifiers || {})
            ]);
        }
        await bus_1.eventBus.emit('order.created_vapi', {
            restaurantId,
            type: 'order.created_vapi',
            actor: { actorType: 'system' },
            payload: {
                orderId,
                customerName: input.customer?.name,
                totalAmount: quote.total,
                channel: 'vapi'
            },
            occurredAt: new Date().toISOString()
        });
        return {
            orderId,
            status: 'pending',
            total: quote.total
        };
    }
    async acceptOrder(orderId, prepTimeMinutes, userId) {
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order)
            throw new Error('Order not found');
        if (order.status !== 'pending')
            throw new Error('Order is not pending');
        const acceptedAt = new Date().toISOString();
        await db.run(`
      UPDATE orders SET
        status = 'accepted',
        prep_time_minutes = ?,
        accepted_at = ?,
        accepted_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [prepTimeMinutes, acceptedAt, userId, orderId]);
        // SMS notification
        if (order.customer_phone) {
            await SmsService_1.SmsService.getInstance().sendSms(order.customer_phone, `Your order is confirmed. Ready in about ${prepTimeMinutes} minutes...`);
        }
        await db.run(`
      INSERT INTO order_events (id, order_id, event, meta_json, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [(0, uuid_1.v4)(), orderId, 'accepted', JSON.stringify({ prepTimeMinutes, acceptedAt, userId })]);
        return { success: true, smsSent: true };
    }
    async logCall(input) {
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const id = (0, uuid_1.v4)();
        await db.run(`
      INSERT INTO call_logs (id, call_id, from_phone, transcript, summary_json, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id, input.callId, input.fromPhone, input.transcript, JSON.stringify(input.summary || {})]);
        return { success: true };
    }
}
exports.VoiceOrderingService = VoiceOrderingService;
//# sourceMappingURL=VoiceOrderingService.js.map