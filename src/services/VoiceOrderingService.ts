import { DatabaseService } from './DatabaseService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SmsService } from './SmsService';
import { SocketService } from './SocketService';

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

  private async getModifierGroupsForItem(itemId: string, restaurantId: string) {
    const db = DatabaseService.getInstance().getDatabase();
    const rows = await db.all(
      `
      SELECT
        img.group_id,
        img.override_min,
        img.override_max,
        img.override_required,
        img.display_order as assignment_display_order,
        mg.name as group_name,
        mg.selection_type,
        mg.min_selections,
        mg.max_selections,
        mg.is_required,
        mg.display_order as group_display_order,
        mo.id as option_id,
        mo.name as option_name,
        mo.price_delta,
        mo.is_sold_out,
        mo.is_preselected,
        mo.display_order as option_display_order
      FROM item_modifier_groups img
      INNER JOIN modifier_groups mg ON mg.id = img.group_id
      INNER JOIN modifier_options mo ON mo.group_id = mg.id
      WHERE img.item_id = ?
        AND mg.restaurant_id = ?
        AND mg.is_active = TRUE
        AND mg.deleted_at IS NULL
        AND mo.is_active = TRUE
        AND mo.deleted_at IS NULL
        AND img.deleted_at IS NULL
      ORDER BY img.display_order ASC, mg.display_order ASC, mo.display_order ASC
      `,
      [itemId, restaurantId]
    );

    if (!rows || rows.length === 0) return [];

    const groups: Record<string, any> = {};
    rows.forEach((row: any) => {
      if (!groups[row.group_id]) {
        const effectiveMin = row.override_min ?? row.min_selections ?? 0;
        const effectiveMax = row.override_max ?? row.max_selections ?? null;
        const effectiveRequired = row.override_required ?? row.is_required ?? false;
        groups[row.group_id] = {
          id: row.group_id,
          name: row.group_name,
          required: Boolean(effectiveRequired),
          minSelect: Number(effectiveMin ?? 0),
          maxSelect: effectiveMax === null ? null : Number(effectiveMax),
          selectionType: row.selection_type,
          options: []
        };
      }
      groups[row.group_id].options.push({
        id: row.option_id,
        name: row.option_name,
        priceDelta: Number(row.price_delta || 0),
        isSoldOut: Boolean(row.is_sold_out),
        isPreselected: Boolean(row.is_preselected)
      });
    });

    return Object.values(groups);
  }

  /**
   * Validate that all required modifiers have been provided for an item.
   * Returns { valid: true, priceDelta: number } if valid, or { valid: false, missingModifiers: [...] } if invalid.
   */
  public async validateItemModifiers(
    itemId: string,
    restaurantId: string,
    providedModifiers: Record<string, any> | null | undefined
  ): Promise<{ valid: boolean; priceDelta: number; missingModifiers: Array<{ groupId: string; groupName: string; required: boolean }> }> {
    // #region agent log - hypothesis A, B
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:113',
        message: 'validateItemModifiers ENTRY',
        data: { itemId, restaurantId, providedModifiers },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'A'
      })
    }).catch(() => {});
    // #endregion

    const groups = await this.getModifierGroupsForItem(itemId, restaurantId);

    // #region agent log - hypothesis A, C
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:119',
        message: 'modifierGroups fetched for item',
        data: {
          itemId,
          groupCount: groups?.length,
          groups: groups?.map((g: any) => ({
            id: g.id,
            name: g.name,
            required: g.required,
            minSelect: g.minSelect,
            optionsCount: g.options?.length
          }))
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'A'
      })
    }).catch(() => {});
    // #endregion

    if (!groups || groups.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:122',
          message: 'no modifier groups - returning valid',
          data: { itemId },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'A'
        })
      }).catch(() => {});
      // #endregion
      return { valid: true, priceDelta: 0, missingModifiers: [] };
    }

    const modifiers = providedModifiers || {};
    const missingModifiers: Array<{ groupId: string; groupName: string; required: boolean }> = [];
    let priceDelta = 0;

    // #region agent log - hypothesis B
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:127',
        message: 'checking each modifier group',
        data: {
          itemId,
          totalGroups: groups.length,
          modifiersIsArray: Array.isArray(modifiers),
          modifiersRaw: modifiers,
          groupNames: groups.map((g: any) => g.name),
          groupIds: groups.map((g: any) => g.id)
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'B'
      })
    }).catch(() => {});
    // #endregion

    for (const group of groups) {
      let selection: any;

      // Handle both array format (from Vapi AI) and object format
      if (Array.isArray(modifiers)) {
        // Vapi format: [{id: "...", optionIds: ["..."]}, ...]
        // OR legacy: [{group_id: "...", option_id: "..."}, ...]
        const found = modifiers.find((m: any) => m.id === group.id || m.group_id === group.id);
        // Support both single option_id and array of optionIds
        const optionId = found?.option_id ?? found?.optionIds?.[0];
        selection = optionId;
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'VoiceOrderingService.ts:207',
            message: 'array modifier lookup',
            data: {
              groupName: group.name,
              groupId: group.id,
              modifierCount: modifiers.length,
              modifierSample: modifiers.slice(0, 3),
              foundSelection: selection
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: 'C'
          })
        }).catch(() => {});
        // #endregion
      } else {
        // Object format: {"<group-id>": "<option-id>"}
        selection = modifiers[group.id];
      }

      const hasSelection = selection !== undefined && selection !== null && selection !== '' &&
        !(Array.isArray(selection) && selection.length === 0);

      // #region agent log - hypothesis A, B
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:131',
          message: 'modifier group evaluation',
          data: {
            groupName: group.name,
            groupRequired: group.required,
            selectionValue: selection,
            hasSelection,
            willAddToMissing: group.required && !hasSelection
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'A'
        })
      }).catch(() => {});
    // #endregion

      if (group.required && !hasSelection) {
        missingModifiers.push({
          groupId: group.id,
          groupName: group.name,
          required: true
        });
      }

      // Calculate price delta from selected options
      if (hasSelection) {
        const selectedIds = Array.isArray(selection) ? selection : [selection];
        for (const selectedId of selectedIds) {
          const option = group.options.find((opt: any) => opt.id === selectedId || opt.name.toLowerCase() === String(selectedId).toLowerCase());
          if (option && option.priceDelta) {
            priceDelta += option.priceDelta;
          }
        }
      }
    }

    // #region agent log - hypothesis A, B
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:154',
        message: 'validateItemModifiers EXIT',
        data: {
          itemId,
          valid: missingModifiers.length === 0,
          missingModifierCount: missingModifiers.length,
          missingModifiers,
          priceDelta
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'A'
      })
    }).catch(() => {});
    // #endregion

    return {
      valid: missingModifiers.length === 0,
      priceDelta,
      missingModifiers
    };
  }

  /**
   * Get modifier groups for an item formatted for Vapi AI to ask questions.
   * Returns modifiers in exact display_order with question prompts.
   *
   * Smart defaults: Modifier groups that have a preselected default AND are not required
   * will be auto-applied silently (not asked). This is useful for gravy type where
   * "same as meat" is the default and we only ask if customer wants something different.
   */
  public async getItemModifiersForVapi(itemId: string, restaurantId: string): Promise<any[]> {
    const groups = await this.getModifierGroupsForItem(itemId, restaurantId);

    if (!groups || groups.length === 0) {
      return [];
    }

    const questionsToAsk: any[] = [];
    const autoAppliedDefaults: any[] = [];

    // Process each modifier group
    groups.forEach((group: any, index: number) => {
      const groupNameLower = group.name.toLowerCase();

      // Check if this group has a preselected default option
      const defaultOption = group.options.find((opt: any) => opt.isPreselected && !opt.isSoldOut);

      // Determine if this modifier should be asked or auto-applied
      // Auto-apply (don't ask) if:
      // 1. It's NOT required AND
      // 2. It HAS a default option AND
      // 3. It's a "gravy type" modifier (customers usually want same gravy as their meat)
      const isGravyType = groupNameLower.includes('gravy') &&
                          (groupNameLower.includes('type') || groupNameLower.includes('style') || groupNameLower.includes('kind'));

      const shouldAutoApply = !group.required && defaultOption && isGravyType;

      if (shouldAutoApply) {
        // Don't ask - auto-apply the default
        autoAppliedDefaults.push({
          groupId: group.id,
          groupName: group.name,
          defaultOptionId: defaultOption.id,
          defaultOptionName: defaultOption.name,
          priceDelta: defaultOption.priceDelta || 0
        });
        return; // Skip adding to questions
      }

      // This modifier needs to be asked
      const availableOptions = group.options.filter((opt: any) => !opt.isSoldOut);
      const optionNames = availableOptions.map((opt: any) => {
        if (opt.priceDelta > 0) {
          return `${opt.name} (+$${opt.priceDelta.toFixed(2)})`;
        }
        return opt.name;
      });

      // Generate a natural question based on the group name
      let question = '';

      if (groupNameLower.includes('size')) {
        question = `What size would you like? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('side') || groupNameLower.includes('choice')) {
        question = `What would you like for your ${group.name.toLowerCase()}? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('spice') || groupNameLower.includes('heat')) {
        question = `What spice level would you like? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('sauce')) {
        question = `What sauce would you like? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('add-on') || groupNameLower.includes('extra') || groupNameLower.includes('topping')) {
        question = `Would you like any ${group.name.toLowerCase()}? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('preparation') || groupNameLower.includes('style') || groupNameLower.includes('cooking')) {
        question = `How would you like it prepared? Options are: ${optionNames.join(', ')}.`;
      } else if (groupNameLower.includes('gravy')) {
        question = `For gravy, would you like: ${optionNames.join(', ')}?`;
      } else {
        question = `For ${group.name}, please choose from: ${optionNames.join(', ')}.`;
      }

      questionsToAsk.push({
        groupId: group.id,
        groupName: group.name,
        question,
        required: group.required,
        selectionType: group.selectionType,
        minSelections: group.minSelect,
        maxSelections: group.maxSelect,
        displayOrder: index + 1,
        options: availableOptions.map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          priceDelta: opt.priceDelta,
          isSoldOut: opt.isSoldOut,
          isDefault: opt.isPreselected
        }))
      });
    });

    // Return questions to ask, plus info about auto-applied defaults
    // The AI should include autoAppliedDefaults in the order without asking
    return questionsToAsk.map((q, idx) => ({ ...q, displayOrder: idx + 1 }));
  }

  /**
   * Get auto-applied default modifiers for an item (modifiers that don't need to be asked).
   * These should be included in the order automatically.
   */
  public async getAutoAppliedModifiers(itemId: string, restaurantId: string): Promise<any[]> {
    const groups = await this.getModifierGroupsForItem(itemId, restaurantId);

    if (!groups || groups.length === 0) {
      return [];
    }

    const autoApplied: any[] = [];

    groups.forEach((group: any) => {
      const groupNameLower = group.name.toLowerCase();
      const defaultOption = group.options.find((opt: any) => opt.isPreselected && !opt.isSoldOut);

      // Auto-apply gravy type modifiers that have a default
      const isGravyType = groupNameLower.includes('gravy') &&
                          (groupNameLower.includes('type') || groupNameLower.includes('style') || groupNameLower.includes('kind'));

      if (!group.required && defaultOption && isGravyType) {
        autoApplied.push({
          groupId: group.id,
          groupName: group.name,
          optionId: defaultOption.id,
          optionName: defaultOption.name,
          priceDelta: defaultOption.priceDelta || 0
        });
      }
    });

    return autoApplied;
  }

  private resolveRestaurantId(input?: string | null) {
    // Try: input → env var. Avoid hardcoded fallbacks to prevent wrong-restaurant lookups.
    const resolved = input || process.env.VAPI_RESTAURANT_ID || null;
    return this.normalizeRestaurantId(resolved);
  }

  private normalizeRestaurantId(input?: string | null): string | null {
    if (!input) {
      return null;
    }

    const mapping: Record<string, string> = {
      unions: 'sasheys-kitchen-union',
      union: 'sasheys-kitchen-union',
      sasheys: 'sasheys-kitchen-union',
      sashey: 'sasheys-kitchen-union'
    };

    const trimmed = input.trim();
    const normalized = trimmed.toLowerCase();
    return mapping[normalized] || trimmed;
  }

  public async resolveRestaurantIdFromSlug(slug?: string | null) {
    const trimmed = this.normalizeRestaurantId(slug);
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
        modifierGroups: await this.getModifierGroupsForItem(row.id, resolvedRestaurantId),
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

  private getMenuItemPrice(item: any) {
    let price = item.price || 0;
    if (!price && item.modifierGroups) {
      const sizeGroup = item.modifierGroups.find((g: any) => g.id === 'size' || g.name.toLowerCase().includes('size'));
      if (sizeGroup && sizeGroup.options?.[0]) {
        price = sizeGroup.options[0].priceDelta || 0;
      }
    }
    return price;
  }

  private getMenuItemsFromData(predicate?: (item: any, category: any) => boolean) {
    if (!this.menuData) return [];
    const results: any[] = [];

    this.menuData.categories.forEach((cat: any) => {
      cat.items.forEach((item: any) => {
        if (!predicate || predicate(item, cat)) {
          const price = this.getMenuItemPrice(item);
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

  private getPopularMenuItems() {
    const popularTags = new Set([
      'popular',
      'recommended',
      'featured',
      'best-seller',
      'bestseller',
      'signature'
    ]);
    return this.getMenuItemsFromData((item) => {
      const tags = (item.tags || []).map((tag: string) => tag.toLowerCase());
      return tags.some((tag: string) => popularTags.has(tag));
    });
  }

  private isGeneralMenuQuery(query: string) {
    const normalized = String(query || '').toLowerCase().trim();
    if (!normalized) return true;
    const cleaned = normalized.replace(/[^a-z0-9\s]/g, '').trim();
    if (!cleaned) return true;

    const exactMatches = new Set([
      'menu',
      'full menu',
      'full',
      'all',
      'all items',
      'everything',
      'popular',
      'popular items',
      'recommendations',
      'recommendation',
      'specials',
      'special'
    ]);
    if (exactMatches.has(cleaned)) return true;

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length <= 4 && tokens.includes('menu')) return true;
    if (tokens.some((token) => ['popular', 'recommend', 'recommendations', 'specials', 'special'].includes(token))) return true;

    return false;
  }

  public searchMenu(query: string) {
    if (!this.menuData) return [];
    let items: any[] = [];
    if (this.isGeneralMenuQuery(query)) {
      const popular = this.getPopularMenuItems();
      items = popular.length > 0 ? popular : this.getMenuItemsFromData();
      console.log('🔍 [searchMenu] Returning items:', JSON.stringify(items, null, 2));
      return items;
    }
    const q = query.toLowerCase();
    items = this.getMenuItemsFromData((item) => item.name.toLowerCase().includes(q));
    console.log('🔍 [searchMenu] Returning items:', JSON.stringify(items, null, 2));
    return items;
  }

  public getMenuItem(id: string) {
    if (!this.menuData) return null;
    for (const cat of this.menuData.categories) {
      const item = cat.items.find((i: any) => i.id === id);
      if (item) {
        // Determine base price for response
        let basePrice = this.getMenuItemPrice(item);

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

  public async validateQuote(input: any) {
    // #region agent log - all hypotheses
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:683',
        message: 'validateQuote ENTRY - full input',
        data: {
          orderType: input?.orderType,
          restaurantId: input?.restaurantId,
          restaurantSlug: input?.restaurantSlug,
          itemCount: input?.items?.length,
          items: input?.items?.map((item: any) => ({
            itemId: item.itemId,
            id: item.id,
            name: item.name,
            itemName: item.itemName,
            qty: item.qty,
            quantity: item.quantity,
            modifiers: item.modifiers
          }))
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'ALL'
      })
    }).catch(() => {});
    // #endregion

    // ADD COMPREHENSIVE LOGGING FIRST
    console.log('🛒 [validateQuote] RAW input received:', JSON.stringify(input, null, 2));

    const orderType = String(input?.orderType || 'pickup').toLowerCase();
    if (!VoiceOrderingService.ALLOWED_ORDER_TYPES.has(orderType)) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:688',
          message: 'invalid orderType',
          data: { orderType },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'D'
        })
      }).catch(() => {});
      // #endregion
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

    // Log each item being processed
    if (items) {
      items.forEach((item: any, index: number) => {
        console.log(`🛒 [validateQuote] Item ${index}:`, {
          hasItemId: !!(item.itemId || item.id),
          hasName: !!(item.name || item.itemName),
          itemId: item.itemId || item.id,
          name: item.name || item.itemName,
          qty: item.qty || item.quantity,
          modifiers: item.modifiers
        });
        // #region agent log - hypothesis E
        fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'VoiceOrderingService.ts:704',
            message: 'item being processed',
            data: {
              index,
              itemId: item.itemId || item.id,
              name: item.name || item.itemName,
              qty: item.qty || item.quantity,
              modifiers: item.modifiers
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: 'E'
          })
        }).catch(() => {});
        // #endregion
      });
    }

    const restaurantId = this.resolveRestaurantId(
      input.restaurantId || input.restaurantSlug || process.env.VAPI_RESTAURANT_ID
    );

    // #region agent log - hypothesis D
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:715',
        message: 'restaurantId resolution',
        data: {
          inputRestaurantId: input.restaurantId,
          inputRestaurantSlug: input.restaurantSlug,
          envVapiRestaurantId: process.env.VAPI_RESTAURANT_ID,
          resolvedRestaurantId: restaurantId
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'D'
      })
    }).catch(() => {});
    // #endregion

    if (!restaurantId) {
      console.error('❌ [validateQuote] Restaurant ID is required');
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:720',
          message: 'restaurantId is required but missing',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'D'
        })
      }).catch(() => {});
      // #endregion
      return {
        valid: false,
        subtotal: 0,
        tax: 0,
        fees: 0,
        total: 0,
        errors: ['Restaurant ID is required'],
        items: []
      };
    }

    const errors: string[] = [];
    let subtotal = 0;

    const validatedItems = await Promise.all(items.map(async (inputItem: any) => {
      let menuItem = null;

      // Try to get by itemId first (prefer database-backed menu)
      // Accept both "itemId" (from frontend) and "id" (from Vapi)
      const itemId = inputItem.itemId || inputItem.id;
      if (itemId) {
        menuItem = await this.getMenuItemLive(itemId, restaurantId);
        if (!menuItem) {
          console.log(`⚠️ [validateQuote] Failed to get item by ID ${itemId}, trying local menu data...`);
          menuItem = this.getMenuItem(itemId);
        }
      }

      // Fallback: search by name if no ID or ID lookup failed
      if (!menuItem && (inputItem.name || inputItem.itemName)) {
        const searchName = inputItem.name || inputItem.itemName;
        console.log(`🔍 [validateQuote] Falling back to name search for: "${searchName}"`);

        try {
          const searchResults = await this.searchMenuLive(searchName, restaurantId);

          if (searchResults && searchResults.length > 0) {
            // Take first exact or closest match
            const firstResult = searchResults[0];
            console.log(`✅ [validateQuote] Found item by name: "${firstResult.name}" (ID: ${firstResult.id})`);

            // Convert search result to menu item format
            menuItem = await this.getMenuItemLive(firstResult.id, restaurantId);
            if (!menuItem) {
              menuItem = {
                id: firstResult.id,
                name: firstResult.name,
                basePrice: Number(firstResult.price || 0),
                modifierGroups: [],
                tags: [],
                category: firstResult.category || 'Menu'
              };
            }
          }
        } catch (err) {
          console.log(`⚠️ [validateQuote] Failed to search by name "${searchName}":`, err instanceof Error ? err.message : String(err));
        }
      }

      if (!menuItem) {
        const itemDesc = inputItem.itemId || inputItem.id || inputItem.name || inputItem.itemName || 'unknown';
        errors.push(`Item not found: ${itemDesc}`);
        console.error('❌ [validateQuote] Could not resolve item:', inputItem);
        return null;
      }

      let itemPrice = menuItem.basePrice || 0;
      const itemName = menuItem.name.toLowerCase();
      const itemIdLower = menuItem.id.toLowerCase();

      // #region agent log - hypothesis A, B, C
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:1006',
          message: 'calling validateItemModifiers',
          data: {
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            restaurantId,
            passedModifiers: inputItem.modifiers
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'A'
        })
      }).catch(() => {});
      // #endregion

      // DATABASE-DRIVEN MODIFIER VALIDATION
      // Validate required modifiers from Menu Management configuration
      const modifierValidation = await this.validateItemModifiers(
        menuItem.id,
        restaurantId,
        inputItem.modifiers
      );

      // #region agent log - hypothesis A, B, C, E
      fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'VoiceOrderingService.ts:1100',
          message: 'modifierValidation result',
          data: {
            menuItemName: menuItem.name,
            menuItemId: menuItem.id,
            isValid: modifierValidation.valid,
            missingModifiers: modifierValidation.missingModifiers,
            priceDelta: modifierValidation.priceDelta,
            inputModifiers: inputItem.modifiers
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'A'
        })
      }).catch(() => {});
      // #endregion

      // Add modifier price delta to item price
      itemPrice += modifierValidation.priceDelta;

      // Log and track missing required modifiers
      if (!modifierValidation.valid && modifierValidation.missingModifiers.length > 0) {
        const missingNames = modifierValidation.missingModifiers.map(m => m.groupName).join(', ');
        console.log(`⚠️ [validateQuote] ${menuItem.name} missing required modifiers: ${missingNames}`);

        // #region agent log - hypothesis A
        fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'VoiceOrderingService.ts:1020',
            message: 'adding errors for missing modifiers',
            data: {
              menuItemName: menuItem.name,
              missingModifiers: modifierValidation.missingModifiers,
              errorsToAdd: modifierValidation.missingModifiers.map((m: any) =>
                `${menuItem.name}: Missing required modifier "${m.groupName}". Please ask customer for their ${m.groupName.toLowerCase()} choice.`
              )
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: 'A'
          })
        }).catch(() => {});
        // #endregion

        // Add errors for missing required modifiers (blocking)
        for (const missing of modifierValidation.missingModifiers) {
          errors.push(`${menuItem.name}: Missing required modifier "${missing.groupName}". Please ask customer for their ${missing.groupName.toLowerCase()} choice.`);
        }
      }

      // Legacy price adjustments for special cases not yet in modifier groups
      // (Oxtail gravy on side, Ackee callaloo add)
      const isOxtail = itemIdLower.includes('oxtail') || itemName.includes('oxtail');
      const isAckee = itemIdLower.includes('ackee') || itemName.includes('ackee');

      if (isOxtail && inputItem.modifiers?.gravy_on_side === 'yes') {
        itemPrice += 0.50;
      }
      if (isAckee && inputItem.modifiers?.callaloo_add === 'yes') {
        itemPrice += 3.00;
      }

      // Get quantity from either qty or quantity field
      const quantity = inputItem.qty || inputItem.quantity || 1;

      subtotal += itemPrice * quantity;

      // Return with the correct itemId and any missing modifier info
      return {
        ...inputItem,
        itemId: menuItem.id,
        itemName: menuItem.name,
        price: itemPrice,
        qty: quantity,
        missingModifiers: modifierValidation.missingModifiers
      };
    }));

    const tax = subtotal * 0.06625; // Using tax rate from JSON
    const total = subtotal + tax;

    // Collect all missing modifiers across items
    const validItems = validatedItems.filter(Boolean);
    const allMissingModifiers = validItems
      .filter((item: any) => item.missingModifiers && item.missingModifiers.length > 0)
      .map((item: any) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        missingModifiers: item.missingModifiers
      }));

    console.log('🛒 [validateQuote] Result:', {
      valid: errors.length === 0,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      errorCount: errors.length,
      errors,
      missingModifiersCount: allMissingModifiers.length
    });

    // #region agent log - all hypotheses
    fetch('http://127.0.0.1:7245/ingest/736b35ed-f7bd-4b4f-b5c9-370964b02fb5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'VoiceOrderingService.ts:1067',
        message: 'validateQuote EXIT - final result',
        data: {
          isValid: errors.length === 0,
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          errorCount: errors.length,
          errors,
          missingModifiersCount: allMissingModifiers.length,
          missingModifiers: allMissingModifiers,
          validatedItemCount: validItems.length
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'ALL'
      })
    }).catch(() => {});
    // #endregion

    return {
      valid: errors.length === 0,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      fees: 0,
      total: parseFloat(total.toFixed(2)),
      errors,
      items: validItems,
      // Include missing modifiers info so AI knows what to ask
      ...(allMissingModifiers.length > 0 ? {
        missingModifiers: allMissingModifiers,
        message: 'Some items are missing required modifiers. Please collect the following before placing the order.'
      } : {})
    };
  }

  /**
   * Look up a customer by phone number for caller recognition
   */
  public async lookupCustomerByPhone(phone: string, restaurantId: string): Promise<{
    found: boolean;
    customer?: { id: string; name: string; email: string; phone: string };
  }> {
    const db = DatabaseService.getInstance().getDatabase();
    // Normalize phone number (strip non-digits)
    const normalizedPhone = String(phone || '').replace(/\D/g, '');

    if (!normalizedPhone) {
      return { found: false };
    }

    try {
      const customer = await db.get(
        `SELECT id, name, email, phone FROM customers WHERE phone = ? AND restaurant_id = ?`,
        [normalizedPhone, restaurantId]
      );

      if (customer) {
        return {
          found: true,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          }
        };
      }
    } catch (error) {
      logger.error('lookupCustomerByPhone error:', { phone: normalizedPhone, restaurantId, error });
    }

    return { found: false };
  }

  /**
   * Upsert a customer from voice order (create if new, update if exists)
   * Returns the customer ID
   */
  public async upsertCustomerFromVoiceOrder(customer: {
    name: string;
    phone: string;
    email?: string;
  }, restaurantId: string): Promise<string> {
    const db = DatabaseService.getInstance().getDatabase();
    const normalizedPhone = String(customer.phone || '').replace(/\D/g, '');

    if (!normalizedPhone) {
      throw new Error('Phone number is required for customer upsert');
    }

    // Check if customer already exists
    const existing = await db.get(
      `SELECT id, name, email FROM customers WHERE phone = ? AND restaurant_id = ?`,
      [normalizedPhone, restaurantId]
    );

    if (existing) {
      // Update if name or email changed
      const nameChanged = existing.name !== customer.name;
      const emailChanged = existing.email !== customer.email;

      if (nameChanged || emailChanged) {
        await db.run(
          `UPDATE customers SET name = ?, email = ? WHERE id = ?`,
          [customer.name, customer.email || null, existing.id]
        );
        logger.info('Customer updated via voice order', { customerId: existing.id, nameChanged, emailChanged });
      }

      return existing.id;
    }

    // Create new customer
    const customerId = uuidv4();
    await db.run(
      `INSERT INTO customers (id, restaurant_id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [customerId, restaurantId, customer.name, customer.email || null, normalizedPhone]
    );

    logger.info('Customer created via voice order', { customerId, phone: normalizedPhone });
    return customerId;
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

    // Customer info is optional if customerId is provided (recognized customer)
    const hasCustomerId = input?.customerId || input?.customer?.customerId;
    const hasCustomerInfo = input?.customer?.name && input?.customer?.phone;

    if (!hasCustomerId && !hasCustomerInfo) {
      logger.warn('createOrder missing customer details', {
        callId: input?.callId,
        hasCustomerId: Boolean(hasCustomerId),
        hasCustomerInfo: Boolean(hasCustomerInfo)
      });
      return { success: false, errors: ['Missing customer information'] };
    }

    const quote = await this.validateQuote(input);
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

    // Handle customer lookup/upsert for recognized customers
    let customerId = input?.customerId || input?.customer?.customerId;
    let customerName = input?.customer?.name;
    let customerPhone = input?.customer?.phone;

    if (!customerId && customerPhone) {
      // Try to look up existing customer by phone
      const lookupResult = await this.lookupCustomerByPhone(customerPhone, restaurantId);
      if (lookupResult.found) {
        customerId = lookupResult.customer!.id;
        // Use the name from our records if customer provided a different one
        if (!customerName) {
          customerName = lookupResult.customer!.name;
        }
      } else {
        // Create new customer from voice order
        customerId = await this.upsertCustomerFromVoiceOrder({
          name: customerName || 'Unknown',
          phone: customerPhone,
          email: input?.customer?.email
        }, restaurantId);
      }
    } else if (customerId && !customerName) {
      // Get customer info from database for recognized customer
      await this.lookupCustomerByPhone('', restaurantId);
      // customerName will be filled from input or remains undefined
    }

    // Optional totals validation - if provided, compare to calculated quote
    const providedTotals = input?.totals;
    if (providedTotals) {
      const totalDelta = Math.abs(Number(providedTotals.total) - Number(quote.total));
      if (totalDelta > 0.05) {
        logger.warn('createOrder totals mismatch', {
          callId: input?.callId,
          orderId,
          provided: providedTotals,
          computed: { subtotal: quote.subtotal, tax: quote.tax, fees: quote.fees, total: quote.total }
        });
      }
    } else {
      logger.info('createOrder using calculated totals', {
        callId: input?.callId,
        orderId,
        totals: { subtotal: quote.subtotal, tax: quote.tax, fees: quote.fees, total: quote.total }
      });
    }

    const menuItemCache = new Map<string, any>();
    const resolveMenuItem = async (itemId: string) => {
      if (menuItemCache.has(itemId)) return menuItemCache.get(itemId);
      const liveItem = await this.getMenuItemLive(itemId, restaurantId);
      const item = liveItem || this.getMenuItem(itemId);
      menuItemCache.set(itemId, item);
      return item;
    };

    const orderItems: any[] = [];
    for (const item of (quote.items as any[])) {
      const menuItem = await resolveMenuItem(item.itemId);
      orderItems.push({
        item_id: item.itemId,
        name: menuItem?.name || item.itemId,
        quantity: item.qty || 1,
        unit_price: item.price,
        price: item.price,
        modifiers: item.modifiers || {}
      });
    }

    await db.run(`
      INSERT INTO orders (
        id, restaurant_id, customer_id, channel, status, customer_name, customer_phone, last_initial,
        order_type, pickup_time, items, subtotal, tax, fees, total, total_amount,
        source, call_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      orderId, restaurantId, customerId, input.source || 'vapi', 'received', customerName, customerPhone, lastInitial,
      input.orderType, input.pickupTime, JSON.stringify(orderItems), quote.subtotal, quote.tax, quote.fees, quote.total, quote.total,
      input.source || 'vapi', input.callId
    ]);

    for (const item of (quote.items as any[])) {
      const menuItem = await resolveMenuItem(item.itemId);
      await db.run(`
        INSERT INTO order_items (
          id, order_id, menu_item_id, item_id, name, item_name_snapshot,
          quantity, qty, unit_price, unit_price_snapshot, modifiers_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        uuidv4(),
        orderId,
        item.itemId,
        item.itemId,
        menuItem?.name || item.itemId,
        menuItem?.name,
        item.qty,
        item.qty,
        item.price,
        item.price,
        JSON.stringify(item.modifiers || {})
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
      const io = SocketService.getIO();
      if (io) {
        io.to(`restaurant-${restaurantId}`).emit('new-order', {
          orderId,
          totalAmount: quote.total
        });
      }

      await eventBus.emit('order.created_vapi', {
        restaurantId,
        type: 'order.created_vapi',
        actor: { actorType: 'system' },
        payload: {
          orderId,
          customerId,
          customerName,
          customerPhone,
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
