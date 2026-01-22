import { DatabaseService } from './DatabaseService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SmsService } from './SmsService';

import { eventBus } from '../events/bus';
import { logger } from '../utils/logger';

// Menu data path - corrected for production (no 'backend/' prefix)
const MENU_DATA_PATH = path.join(process.cwd(), 'data/menu/sasheys_menu_vapi.json');

export class VoiceOrderingService {
  private static instance: VoiceOrderingService;
  private menuData: any = null;

  private constructor() {
    this.loadMenuData();
  }

  public static getInstance(): VoiceOrderingService {
    if (!VoiceOrderingService.instance) {
      VoiceOrderingService.instance = new VoiceOrderingService();
    }
    return VoiceOrderingService.instance;
  }

  private loadMenuData() {
    try {
      if (fs.existsSync(MENU_DATA_PATH)) {
        const raw = fs.readFileSync(MENU_DATA_PATH, 'utf8');
        this.menuData = JSON.parse(raw);
      }
    } catch (error) {
      logger.error('Failed to load menu data:', error);
    }
  }

  public getStoreStatus() {
    if (!this.menuData) return null;
    return {
      status: "open", // Simplified for now, could be dynamic
      closedMessage: "We’re temporarily closed right now...",
      hours: { 
        "tue": ["09:00","21:00"], 
        "wed": ["09:00","21:00"], 
        "thu": ["09:00","21:00"], 
        "fri": ["09:00","21:00"], 
        "sat": ["09:00","21:00"] 
      },
      timezone: "America/New_York"
    };
  }

  public getFullMenu() {
    return this.menuData;
  }

  public searchMenu(query: string) {
    if (!this.menuData) return [];
    const results: any[] = [];
    const q = query.toLowerCase();

    this.menuData.categories.forEach((cat: any) => {
      cat.items.forEach((item: any) => {
        if (item.name.toLowerCase().includes(q)) {
          // Determine base price
          let price = item.price || 0;
          if (!price && item.modifierGroups) {
            const sizeGroup = item.modifierGroups.find((g: any) => g.id === 'size' || g.name.toLowerCase().includes('size'));
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

  public getMenuItem(id: string) {
    if (!this.menuData) return null;
    for (const cat of this.menuData.categories) {
      const item = cat.items.find((i: any) => i.id === id);
      if (item) {
        // Determine base price for response
        let basePrice = item.price || 0;
        if (!basePrice && item.modifierGroups) {
          const sizeGroup = item.modifierGroups.find((g: any) => g.id === 'size' || g.name.toLowerCase().includes('size'));
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

  public validateQuote(input: any) {
    const { items } = input;
    const errors: string[] = [];
    let subtotal = 0;

    const validatedItems = items.map((inputItem: any) => {
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
        if (!inputItem.modifiers?.rice_choice) errors.push(`${menuItem.name} requires rice_choice`);
        if (!inputItem.modifiers?.cabbage) errors.push(`${menuItem.name} requires cabbage`);
        if (!inputItem.modifiers?.spice_level) errors.push(`${menuItem.name} requires spice_level`);
      }

      // Requirement: Fish dinners
      if (isFish && isDinner) {
        if (!inputItem.modifiers?.fish_style) errors.push(`${menuItem.name} requires fish_style (Escovitch/Brown Stewed)`);
      }

      // Requirement: Wings
      if (isWings) {
        if (!inputItem.modifiers?.wings_size) errors.push(`${menuItem.name} requires wings_size`);
        if (!inputItem.modifiers?.wings_sauce) errors.push(`${menuItem.name} requires wings_sauce`);
      }

      // Requirement: Ackee
      if (isAckee) {
        if (!inputItem.modifiers?.callaloo_add) errors.push(`${menuItem.name} requires callaloo add decision`);
      }

      // Calculate price from modifiers
      if (menuItem.modifierGroups) {
        menuItem.modifierGroups.forEach((group: any) => {
          const selectedOptionId = inputItem.modifiers?.[group.id];
          const option = group.options.find((o: any) => o.id === selectedOptionId);
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

  public async createOrder(input: any) {
    const normalizedItems = Array.isArray(input?.items)
      ? input.items.map((item: any) => ({
          itemId: item?.itemId || item?.id,
          qty: item?.qty ?? item?.quantity,
          modifiers: item?.modifiers || {}
        }))
      : [];
    const normalizedCustomer = input?.customer || {
      name: input?.customerName,
      phone: input?.customerPhone,
      email: input?.customerEmail,
      lastInitial: input?.customerLastInitial
    };

    if (!normalizedItems || normalizedItems.length === 0) {
      logger.warn('createOrder missing items', { callId: input?.callId });
      return { success: false, errors: ['Missing items'] };
    }
    if (!normalizedCustomer?.name || !normalizedCustomer?.phone) {
      logger.warn('createOrder missing customer details', {
        callId: input?.callId,
        hasName: Boolean(normalizedCustomer?.name),
        hasPhone: Boolean(normalizedCustomer?.phone)
      });
      return { success: false, errors: ['Missing customer name or phone'] };
    }
    if (!input?.totals) {
      logger.warn('createOrder missing totals payload', { callId: input?.callId });
      return { success: false, errors: ['Missing totals'] };
    }

    const quote = this.validateQuote({ ...input, items: normalizedItems });
    if (!quote.valid) return { success: false, errors: quote.errors };

    const db = DatabaseService.getInstance().getDatabase();
    const orderId = uuidv4();
    const restaurantId = process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';
    const lastInitial =
      normalizedCustomer?.lastInitial ||
      String(normalizedCustomer?.name || '')
        .trim()
        .split(/\s+/)
        .pop()
        ?.charAt(0)
        ?.toUpperCase();

    const providedTotals = input?.totals;
    const totalDelta = Math.abs(Number(providedTotals.total) - Number(quote.total));
    if (totalDelta > 0.05) {
      logger.warn('createOrder totals mismatch', {
        callId: input?.callId,
        orderId,
        provided: providedTotals,
        computed: { subtotal: quote.subtotal, tax: quote.tax, fees: quote.fees, total: quote.total }
      });
    }

    const orderItems = (quote.items as any[]).map((item: any) => {
      const menuItem = this.getMenuItem(item.itemId);
      return {
        item_id: item.itemId,
        name: menuItem?.name || item.itemId,
        quantity: item.qty || 1,
        unit_price: item.price,
        price: item.price,
        modifiers: item.modifiers || {}
      };
    });

    await db.run(`
      INSERT INTO orders (
        id, restaurant_id, status, customer_name, customer_phone, last_initial,
        order_type, pickup_time, items, subtotal, tax, fees, total, total_amount,
        source, call_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      orderId, restaurantId, 'received', normalizedCustomer?.name, normalizedCustomer?.phone, lastInitial,
      input.orderType, input.pickupTime, JSON.stringify(orderItems), quote.subtotal, quote.tax, quote.fees, quote.total, quote.total,
      input.source || 'vapi', input.callId
    ]);

    for (const item of (quote.items as any[])) {
      const menuItem = this.getMenuItem(item.itemId);
      await db.run(`
        INSERT INTO order_items (
          id, order_id, item_id, item_name_snapshot, qty, unit_price_snapshot, modifiers_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        uuidv4(), orderId, item.itemId, menuItem?.name, item.qty, item.price, JSON.stringify(item.modifiers || {})
      ]);
    }

    logger.info('createOrder success', {
      orderId,
      restaurantId,
      callId: input?.callId,
      total: quote.total,
      status: 'received'
    });

    try {
      await eventBus.emit('order.created_vapi', {
        restaurantId,
        type: 'order.created_vapi',
        actor: { actorType: 'system' },
        payload: {
          orderId,
          customerName: normalizedCustomer?.name,
          customerPhone: normalizedCustomer?.phone,
          customerEmail: normalizedCustomer?.email,
          totalAmount: quote.total,
          channel: 'vapi',
          status: 'received'
        },
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      logger.warn('createOrder event emit failed', {
        orderId,
        callId: input?.callId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return {
      orderId,
      status: 'received',
      total: quote.total
    };
  }

  public async acceptOrder(orderId: string, prepTimeMinutes: number, userId: string) {
    const db = DatabaseService.getInstance().getDatabase();
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

    if (!order) throw new Error('Order not found');
    if (!['pending', 'received'].includes(order.status)) throw new Error('Order is not pending');

    const acceptedAt = new Date().toISOString();
    await db.run(`
      UPDATE orders SET
        status = 'preparing',
        prep_time_minutes = ?,
        accepted_at = ?,
        accepted_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [prepTimeMinutes, acceptedAt, userId, orderId]);

    // SMS notification
    if (order.customer_phone) {
      await SmsService.getInstance().sendSms(
        order.customer_phone,
        `Your order is confirmed. Ready in about ${prepTimeMinutes} minutes...`
      );
    }

    await db.run(`
      INSERT INTO order_events (id, order_id, event, meta_json, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), orderId, 'preparing', JSON.stringify({ prepTimeMinutes, acceptedAt, userId })]);

    return { success: true, smsSent: true };
  }

  public async logCall(input: any) {
    const db = DatabaseService.getInstance().getDatabase();
    const callId = input?.callId;
    const id = callId || uuidv4();
    const summaryJson = input?.summary ? JSON.stringify(input.summary) : '{}';

    // Use an UPSERT so we can safely log transcript updates + end-of-call summaries.
    await db.run(
      `
        INSERT INTO call_logs (id, call_id, from_phone, transcript, summary_json, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          from_phone = COALESCE(excluded.from_phone, call_logs.from_phone),
          transcript = COALESCE(excluded.transcript, call_logs.transcript),
          summary_json = CASE
            WHEN excluded.summary_json IS NOT NULL AND excluded.summary_json != '{}' THEN excluded.summary_json
            ELSE call_logs.summary_json
          END
      `,
      [id, callId, input?.fromPhone, input?.transcript, summaryJson]
    );

    return { success: true };
  }
}
