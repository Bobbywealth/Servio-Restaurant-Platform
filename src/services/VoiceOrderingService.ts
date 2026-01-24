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

  private static readonly ALLOWED_ORDER_TYPES = new Set(['pickup', 'delivery', 'dine-in']);

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

  private resolveRestaurantId(input?: string | null) {
    // Try: input → env var. Avoid hardcoded fallbacks to prevent wrong-restaurant lookups.
    return input || process.env.VAPI_RESTAURANT_ID || null;
  }

  public async resolveRestaurantIdFromSlug(slug?: string | null) {
    const trimmed = String(slug || '').trim();
    if (!trimmed) return null;
    try {
      const db = DatabaseService.getInstance().getDatabase();
      const row = await db.get(
        'SELECT id FROM restaurants WHERE slug = ? AND is_active = TRUE',
        [trimmed]
      );
      return row?.id || null;
    } catch (err) {
      logger.error('[vapi] resolveRestaurantIdFromSlug failed', {
        slug: trimmed,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }

  // Live DB: get open/closed info; for now always "open" if DB reachable
  public async getStoreStatus(restaurantId?: string | null) {
    const resolvedRestaurantId = this.resolveRestaurantId(restaurantId);
    if (!resolvedRestaurantId) {
      return {
        status: 'open',
        closedMessage: 'Restaurant ID missing; assuming open',
        timezone: 'America/New_York'
      };
    }

    try {
      const db = DatabaseService.getInstance().getDatabase();
      const row = await db.get(
        'SELECT settings FROM restaurants WHERE id = ?',
        [resolvedRestaurantId]
      );
      const settings = row?.settings ? JSON.parse(row.settings) : {};
      return {
        status: 'open',
        closedMessage: 'We’re temporarily closed right now...',
        hours: settings.operating_hours || {},
        timezone: settings.timezone || 'America/New_York'
      };
    } catch (err) {
      logger.warn('[vapi] getStoreStatus fallback to open', { error: err instanceof Error ? err.message : String(err) });
      return {
        status: 'open',
        closedMessage: 'We’re temporarily closed right now...',
        timezone: 'America/New_York'
      };
    }
  }

  /**
   * Live DB search (restaurant-scoped).
   *
   * Requirements:
   * - restaurantId must be provided (no JWT context for Vapi)
   * - do NOT exclude items due to is_available/is_active/scheduling during debugging
   * - fuzzy match against:
   *   - item.name
   *   - item.description
   *   - category + item combined
   */
  public async searchMenuLiveWithDebug(query: string, restaurantId?: string | null): Promise<{
    items: Array<{ id: string; name: string; price: number; category: string; is_available?: boolean }>;
    debug: {
      restaurantId: string | null;
      query: string;
      rowsBeforeFiltering: number;
      rowsAfterFiltering: number;
      wouldFilterUnavailable: number;
    };
  }> {
    const resolvedRestaurantId = this.resolveRestaurantId(restaurantId);
    const trimmedQuery = String(query || '').trim();

    const debugBase = {
      restaurantId: resolvedRestaurantId,
      query: trimmedQuery,
      rowsBeforeFiltering: 0,
      rowsAfterFiltering: 0,
      wouldFilterUnavailable: 0
    };

    if (!resolvedRestaurantId) {
      logger.error('[menu.search] missing restaurantId', { query: trimmedQuery });
      return { items: [], debug: debugBase };
    }

    if (!trimmedQuery) {
      logger.warn('[menu.search] empty query', { restaurantId: resolvedRestaurantId });
      return { items: [], debug: debugBase };
    }

    // Fuzzy token matching: "curry chicken" -> match rows containing both tokens.
    const tokens = trimmedQuery
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    const combinedExpr = `LOWER(COALESCE(mc.name, '') || ' ' || mi.name || ' ' || COALESCE(mi.description, ''))`;
    const tokenClauses = tokens.map(() => `${combinedExpr} LIKE ?`).join(' AND ');

    const fullLike = `%${trimmedQuery.toLowerCase()}%`;
    const tokenLikes = tokens.map((t) => `%${t}%`);

    try {
      const db = DatabaseService.getInstance().getDatabase();
      const rows = await db.all(
        `
        SELECT
          mi.id,
          mi.name,
          mi.description,
          mi.price,
          mi.is_available,
          mc.name as category
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mc.id = mi.category_id
        WHERE mi.restaurant_id = ?
          AND (
            LOWER(mi.name) LIKE ?
            OR LOWER(COALESCE(mi.description, '')) LIKE ?
            OR ${combinedExpr} LIKE ?
            OR (${tokenClauses})
          )
        ORDER BY mi.name ASC
        LIMIT 50
        `,
        [resolvedRestaurantId, fullLike, fullLike, fullLike, ...tokenLikes]
      );

      const rowsBefore = Array.isArray(rows) ? rows.length : 0;
      const wouldFilterUnavailable = (rows || []).filter((r: any) => r && r.is_available === 0).length;

      // TEMP: disable over-filtering. We keep everything, but log what WOULD have been excluded.
      const kept = rows || [];

      logger.info('[menu.search] db_rows', {
        restaurantId: resolvedRestaurantId,
        query: trimmedQuery,
        rowsBeforeFiltering: rowsBefore,
        rowsAfterFiltering: kept.length,
        wouldFilterUnavailable
      });

      // Also use console.log to avoid Render truncation
      console.log(`[MENU_SEARCH_RESULT] restaurantId=${resolvedRestaurantId} query="${trimmedQuery}" before=${rowsBefore} after=${kept.length} unavailable=${wouldFilterUnavailable}`);

      const items = kept.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: Number(r.price || 0),
        category: r.category || 'Menu',
        is_available: r.is_available
      }));

      return {
        items,
        debug: {
          restaurantId: resolvedRestaurantId,
          query: trimmedQuery,
          rowsBeforeFiltering: rowsBefore,
          rowsAfterFiltering: items.length,
          wouldFilterUnavailable
        }
      };
    } catch (err) {
      logger.error('[menu.search] failed', {
        restaurantId: resolvedRestaurantId,
        query: trimmedQuery,
        error: err instanceof Error ? err.message : String(err)
      });
      return { items: [], debug: debugBase };
    }
  }

  public async searchMenuLive(query: string, restaurantId?: string | null) {
    const { items } = await this.searchMenuLiveWithDebug(query, restaurantId);
    return items;
  }

  // Live DB get item by id or name (restaurant-scoped; do not filter by is_available during debugging)
  public async getMenuItemLive(idOrName: string, restaurantId?: string | null) {
    const resolvedRestaurantId = this.resolveRestaurantId(restaurantId);
    const trimmed = String(idOrName || '').trim();
    const fallbackItem = () => {
      const byId = this.getMenuItem(trimmed);
      if (byId) return byId;
      const bySearch = this.searchMenu(trimmed)[0];
      if (!bySearch) return null;
      return {
        id: bySearch.id,
        name: bySearch.name,
        basePrice: Number(bySearch.price || 0),
        modifierGroups: [],
        tags: [],
        category: bySearch.category || 'Menu'
      };
    };
    if (!trimmed) return null;
    if (!resolvedRestaurantId) return null;

    try {
      const db = DatabaseService.getInstance().getDatabase();
      const row = await db.get(
        `
        SELECT mi.*, mc.name as category
        FROM menu_items mi
        LEFT JOIN menu_categories mc ON mc.id = mi.category_id
        WHERE mi.restaurant_id = ?
          AND (
            mi.id = ?
            OR LOWER(mi.name) LIKE ?
            OR LOWER(COALESCE(mi.description, '')) LIKE ?
            OR LOWER(COALESCE(mc.name, '') || ' ' || mi.name) LIKE ?
          )
        LIMIT 1
        `,
        [
          resolvedRestaurantId,
          trimmed,
          `%${trimmed.toLowerCase()}%`,
          `%${trimmed.toLowerCase()}%`,
          `%${trimmed.toLowerCase()}%`
        ]
      );
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        basePrice: Number(row.price || 0),
        modifierGroups: [], // could be populated later if needed
        tags: [],
        category: row.category || 'Menu'
      };
    } catch (err) {
      logger.error('[vapi] getMenuItemLive failed', { error: err instanceof Error ? err.message : String(err) });
      return fallbackItem();
    }
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
    const orderType = String(input?.orderType || 'pickup').toLowerCase();
    if (!VoiceOrderingService.ALLOWED_ORDER_TYPES.has(orderType)) {
      return {
        valid: false,
        subtotal: 0,
        tax: 0,
        fees: 0,
        total: 0,
        errors: [`Invalid orderType: ${orderType}`],
        items: []
      };
    }

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
    const orderType = String(input?.orderType || 'pickup').toLowerCase();
    if (!VoiceOrderingService.ALLOWED_ORDER_TYPES.has(orderType)) {
      logger.warn('createOrder invalid orderType', { callId: input?.callId, orderType });
      return { success: false, errors: [`Invalid orderType: ${orderType}`] };
    }
    input.orderType = orderType;
    if (orderType === 'dine-in') {
      // No pickup time required/used for dine-in.
      input.pickupTime = null;
    }

    if (!input?.items || !Array.isArray(input.items) || input.items.length === 0) {
      logger.warn('createOrder missing items', { callId: input?.callId });
      return { success: false, errors: ['Missing items'] };
    }
    if (!input?.customer?.name || !input?.customer?.phone) {
      logger.warn('createOrder missing customer details', {
        callId: input?.callId,
        hasName: Boolean(input?.customer?.name),
        hasPhone: Boolean(input?.customer?.phone)
      });
      return { success: false, errors: ['Missing customer name or phone'] };
    }
    if (!input?.totals) {
      logger.warn('createOrder missing totals payload', { callId: input?.callId });
      return { success: false, errors: ['Missing totals'] };
    }

    const quote = this.validateQuote(input);
    if (!quote.valid) return { success: false, errors: quote.errors };

    const db = DatabaseService.getInstance().getDatabase();
    const orderId = uuidv4();
    const restaurantId = this.resolveRestaurantId(input?.restaurantId);
    if (!restaurantId) {
      logger.error('createOrder missing restaurantId', { callId: input?.callId });
      return { success: false, errors: ['Missing restaurantId'] };
    }
    const lastInitial =
      input.customer?.lastInitial ||
      String(input.customer?.name || '')
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
      orderId, restaurantId, 'received', input.customer?.name, input.customer?.phone, lastInitial,
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
          customerName: input.customer?.name,
          customerPhone: input.customer?.phone,
          customerEmail: input.customer?.email,
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
