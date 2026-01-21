import { DatabaseService } from './DatabaseService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SmsService } from './SmsService';

import { eventBus } from '../events/bus';
import { logger } from '../utils/logger';

// Try multiple paths for different environments
const MENU_DATA_PATHS = [
  path.join(process.cwd(), 'backend/data/menu/sasheys_menu_vapi.json'), // Local dev
  path.join(process.cwd(), 'data/menu/sasheys_menu_vapi.json'),          // Production (Render)
  path.join(__dirname, '../data/menu/sasheys_menu_vapi.json'),           // Compiled dist
  path.join(__dirname, '../../data/menu/sasheys_menu_vapi.json')         // Alt path
];

function findMenuDataPath(): string | null {
  for (const p of MENU_DATA_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

const MENU_DATA_PATH = findMenuDataPath();

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
      if (MENU_DATA_PATH && fs.existsSync(MENU_DATA_PATH)) {
        logger.info(`Loading menu from: ${MENU_DATA_PATH}`);
        const raw = fs.readFileSync(MENU_DATA_PATH, 'utf8');
        this.menuData = JSON.parse(raw);
        logger.info(`Menu loaded successfully with ${this.menuData?.categories?.length || 0} categories`);
      } else {
        logger.warn(`Menu data file not found. Tried paths:`, MENU_DATA_PATHS);
        logger.warn('Vapi voice ordering will not work without menu data!');
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

  /**
   * Search menu - now uses LIVE database with real-time availability
   */
  public async searchMenu(query: string, restaurantId: string) {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      // If no query or very short query, return top available items
      if (!query || query.trim().length < 2) {
        logger.info('Empty/short search query, returning top available items', { restaurant_id: restaurantId });
        const topItems = await db.all(`
          SELECT 
            mi.id,
            mi.name,
            mi.description,
            mi.price,
            mc.name as category,
            mi.is_available
          FROM menu_items mi
          LEFT JOIN menu_categories mc ON mi.category_id = mc.id
          WHERE mi.restaurant_id = ?
            AND mi.is_available = TRUE
          ORDER BY mi.sort_order ASC, mi.name ASC
          LIMIT 10
        `, [restaurantId]);
        
        return topItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          description: item.description || '',
          category: item.category || 'Other'
        }));
      }
      
      // Use fuzzy matching for better results
      const q = `%${query.toLowerCase().trim()}%`;
      
      // Query live menu from database - ONLY available items with relevance ranking
      const items = await db.all(`
        SELECT 
          mi.id,
          mi.name,
          mi.description,
          mi.price,
          mc.name as category,
          mi.is_available
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.restaurant_id = ?
          AND mi.is_available = TRUE
          AND (
            LOWER(mi.name) LIKE ?
            OR LOWER(mi.description) LIKE ?
            OR LOWER(mc.name) LIKE ?
          )
        ORDER BY 
          CASE 
            WHEN LOWER(mi.name) = LOWER(?) THEN 1
            WHEN LOWER(mi.name) LIKE ? THEN 2
            ELSE 3
          END,
          mi.name ASC
        LIMIT 20
      `, [restaurantId, q, q, q, query.toLowerCase(), `${query.toLowerCase()}%`]);

      logger.info(`searchMenu: found ${items.length} items`, { 
        query, 
        restaurant_id: restaurantId,
        items_found: items.length 
      });

      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price),
        description: item.description || '',
        category: item.category || 'Other'
      }));
    } catch (error) {
      logger.error('‼️ DATABASE ERROR - Falling back to static JSON menu', { 
        error: error instanceof Error ? error.message : String(error),
        restaurant_id: restaurantId 
      });
      // Fallback to static menu if database fails
      return this.searchMenuFallback(query);
    }
  }

  /**
   * Get specific menu item - now from LIVE database
   */
  public async getMenuItem(id: string, restaurantId: string) {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      const item = await db.get(`
        SELECT 
          mi.id,
          mi.name,
          mi.description,
          mi.price,
          mc.name as category,
          mi.is_available
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = ? AND mi.restaurant_id = ?
      `, [id, restaurantId]);

      if (!item) {
        logger.warn(`Menu item not found in database: ${id}`);
        return this.getMenuItemFallback(id);
      }

      // Check if item is available
      if (!item.is_available) {
        logger.warn(`Menu item is 86'd (unavailable): ${item.name}`);
        return null; // Don't offer unavailable items
      }

      // Load modifiers from database
      const modifierGroups = await this.loadModifiersForItem(id, restaurantId);

      return {
        id: item.id,
        name: item.name,
        basePrice: parseFloat(item.price),
        description: item.description || '',
        category: item.category || 'Other',
        modifierGroups, // Now populated from DB
        tags: []
      };
    } catch (error) {
      logger.error('‼️ DATABASE ERROR - Falling back to static JSON for getMenuItem', { 
        error: error instanceof Error ? error.message : String(error),
        item_id: id,
        restaurant_id: restaurantId 
      });
      return this.getMenuItemFallback(id);
    }
  }

  /**
   * Load modifiers for a menu item from database
   */
  private async loadModifiersForItem(itemId: string, restaurantId: string): Promise<any[]> {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      // Get modifier groups for this menu item
      const groups = await db.all(`
        SELECT 
          mg.id,
          mg.name,
          mg.min_selection,
          mg.max_selection,
          mg.is_required
        FROM modifier_groups mg
        INNER JOIN menu_item_modifiers mim ON mim.modifier_group_id = mg.id
        WHERE mim.menu_item_id = ?
          AND mg.restaurant_id = ?
          AND mg.is_active = TRUE
        ORDER BY mg.sort_order ASC, mg.name ASC
      `, [itemId, restaurantId]);
      
      // Load options for each group
      const modifierGroups = await Promise.all(groups.map(async (group: any) => {
        const options = await db.all(`
          SELECT 
            id,
            name,
            price_modifier as priceDelta,
            is_available
          FROM modifier_options
          WHERE modifier_group_id = ?
            AND is_available = TRUE
          ORDER BY sort_order ASC, name ASC
        `, [group.id]);
        
        return {
          id: group.id,
          name: group.name,
          minSelection: group.min_selection,
          maxSelection: group.max_selection,
          isRequired: group.is_required,
          options: options.map((opt: any) => ({
            id: opt.id,
            name: opt.name,
            priceDelta: parseFloat(opt.priceDelta || 0)
          }))
        };
      }));
      
      return modifierGroups;
    } catch (error) {
      logger.error('Failed to load modifiers for item', { item_id: itemId, error });
      return []; // Return empty array on error, don't break order flow
    }
  }

  /**
   * Fallback to static JSON menu if database fails
   */
  private searchMenuFallback(query: string) {
    if (!this.menuData) return [];
    const results: any[] = [];
    const q = query.toLowerCase();

    this.menuData.categories.forEach((cat: any) => {
      cat.items.forEach((item: any) => {
        if (item.name.toLowerCase().includes(q)) {
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

  /**
   * Fallback to get item from static JSON
   */
  private getMenuItemFallback(id: string) {
    if (!this.menuData) return null;
    for (const cat of this.menuData.categories) {
      const item = cat.items.find((i: any) => i.id === id);
      if (item) {
        let basePrice = item.price || 0;
        if (!basePrice && item.modifierGroups) {
          const sizeGroup = item.modifierGroups.find((g: any) => g.id === 'size' || g.name.toLowerCase().includes('size'));
          if (sizeGroup && sizeGroup.options?.[0]) {
            basePrice = sizeGroup.options[0].priceDelta || 0;
          }
        }

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

  public async validateQuote(input: any, restaurantId: string) {
    const { items } = input;
    const errors: string[] = [];
    let subtotal = 0;

    const validatedItems = await Promise.all(items.map(async (inputItem: any) => {
      const menuItem = await this.getMenuItem(inputItem.itemId, restaurantId);
      if (!menuItem) {
        errors.push(`Item not found: ${inputItem.itemId}`);
        return null;
      }

      const qty = Number(inputItem.qty ?? 1);
      const rawModifiers = (inputItem.modifiers && typeof inputItem.modifiers === 'object') ? inputItem.modifiers : {};

      // Build normalized modifier selections keyed by modifier_group_id.
      // We accept any of:
      // - modifiers[group.id] = optionId | optionName | [..]
      // - modifiers[group.name] = ...
      // - modifiers[slugified(group.name)] = ...
      const normalizedModifiers: Record<string, any> = {};

      function slugify(value: string): string {
        return String(value || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      function toArray(value: any): any[] {
        if (value == null) return [];
        return Array.isArray(value) ? value : [value];
      }

      function pickSelectionForGroup(group: any): any[] {
        const candidates = [
          rawModifiers?.[group.id],
          rawModifiers?.[group.name],
          rawModifiers?.[slugify(group.name)]
        ];
        for (const c of candidates) {
          const arr = toArray(c).filter((v) => v != null && String(v).trim().length > 0);
          if (arr.length > 0) return arr;
        }
        return [];
      }

      let itemPrice = Number(menuItem.basePrice ?? 0);
      const groups = Array.isArray(menuItem.modifierGroups) ? menuItem.modifierGroups : [];

      for (const group of groups) {
        const selections = pickSelectionForGroup(group);
        const minSel = Number(group.minSelection ?? 0);
        const maxSel = Number(group.maxSelection ?? 1);
        const isRequired = Boolean(group.isRequired) || minSel > 0;

        if (isRequired && selections.length < Math.max(1, minSel)) {
          errors.push(`${menuItem.name} requires ${group.name}`);
          continue;
        }

        if (selections.length > maxSel) {
          errors.push(`${menuItem.name}: too many selections for ${group.name} (max ${maxSel})`);
          continue;
        }

        // Resolve selections to actual options.
        const resolvedOptionIds: string[] = [];
        for (const sel of selections) {
          const selStr = String(sel).trim();
          if (!selStr) continue;
          const byId = group.options?.find((o: any) => String(o.id) === selStr);
          const byName = group.options?.find((o: any) => String(o.name).toLowerCase() === selStr.toLowerCase());
          const opt = byId || byName;
          if (!opt) {
            errors.push(`${menuItem.name}: invalid selection "${selStr}" for ${group.name}`);
            continue;
          }
          resolvedOptionIds.push(String(opt.id));
          itemPrice += Number(opt.priceDelta ?? 0);
        }

        if (resolvedOptionIds.length > 0) {
          normalizedModifiers[group.id] = maxSel > 1 ? resolvedOptionIds : resolvedOptionIds[0];
        }
      }

      subtotal += itemPrice * (Number.isFinite(qty) ? qty : 1);
      return { ...inputItem, qty, modifiers: normalizedModifiers, price: itemPrice };
    }));

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

  public async createOrder(input: any, restaurantId: string) {
    // Validate restaurantId is provided
    if (!restaurantId) {
      logger.error('❌ createOrder called without restaurantId');
      return { 
        success: false, 
        errors: ['Unable to identify restaurant location. Please hold for assistance.'] 
      };
    }

    const quote = await this.validateQuote(input, restaurantId);
    if (!quote.valid) return { success: false, errors: quote.errors };

    const db = DatabaseService.getInstance().getDatabase();
    const orderId = uuidv4();
    
    logger.info('Creating order', { restaurant_id: restaurantId, order_id: orderId });

    // Orders require channel + total_amount (base schema). Voice-ordering columns exist via migration 011.
    await db.run(
      `
        INSERT INTO orders (
          id, restaurant_id, channel, status, total_amount, payment_status,
          customer_name, customer_phone, last_initial,
          order_type, pickup_time, subtotal, tax, fees, total,
          source, call_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        orderId,
        restaurantId,
        'vapi',
        'received',
        quote.total,
        'unpaid',
        input.customer?.name ?? null,
        input.customer?.phone ?? null,
        input.customer?.lastInitial ?? null,
        input.orderType ?? null,
        input.pickupTime ?? null,
        quote.subtotal,
        quote.tax,
        quote.fees,
        quote.total,
        input.source || 'vapi',
        input.callId ?? null
      ]
    );

    for (const item of (quote.items as any[])) {
      const menuItem = await this.getMenuItem(item.itemId, restaurantId);
      // order_items base schema requires: name, quantity, unit_price.
      // voice-ordering migration adds: item_id, item_name_snapshot, qty, unit_price_snapshot, modifiers_json.
      await db.run(
        `
          INSERT INTO order_items (
            id, order_id, menu_item_id, name, quantity, unit_price, notes,
            item_id, item_name_snapshot, qty, unit_price_snapshot, modifiers_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          uuidv4(),
          orderId,
          item.itemId ?? null,
          String(menuItem?.name ?? 'Item'),
          Number(item.qty ?? item.quantity ?? 1),
          Number(item.price ?? 0),
          item.notes ?? null,
          item.itemId ?? null,
          String(menuItem?.name ?? 'Item'),
          Number(item.qty ?? item.quantity ?? 1),
          Number(item.price ?? 0),
          JSON.stringify(item.modifiers || {})
        ]
      );
    }

    await eventBus.emit('order.created_vapi', {
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
      status: 'received',
      total: quote.total
    };
  }

  public async acceptOrder(orderId: string, prepTimeMinutes: number, userId: string) {
    const db = DatabaseService.getInstance().getDatabase();
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending') throw new Error('Order is not pending');

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
      await SmsService.getInstance().sendSms(
        order.customer_phone,
        `Your order is confirmed. Ready in about ${prepTimeMinutes} minutes...`
      );
    }

    await db.run(`
      INSERT INTO order_events (id, order_id, event, meta_json, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), orderId, 'accepted', JSON.stringify({ prepTimeMinutes, acceptedAt, userId })]);

    return { success: true, smsSent: true };
  }

  public async logCall(input: any) {
    const db = DatabaseService.getInstance().getDatabase();
    const id = uuidv4();
    await db.run(`
      INSERT INTO call_logs (id, call_id, from_phone, transcript, summary_json, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id, input.callId, input.fromPhone, input.transcript, JSON.stringify(input.summary || {})]);
    return { success: true };
  }
}
