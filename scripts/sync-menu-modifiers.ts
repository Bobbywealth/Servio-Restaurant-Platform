#!/usr/bin/env ts-node

/**
 * Sync menu modifier groups/options from JSON into the database.
 *
 * Reads sasheys_menu_vapi.json and upserts modifier groups/options,
 * then attaches them to the corresponding menu items.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../src/utils/logger';

const MENU_JSON_PATH = path.join(__dirname, '../data/menu/sasheys_menu_vapi.json');

interface ModifierOption {
  id: string;
  name: string;
  priceDelta?: number;
  isSoldOut?: boolean;
  isPreselected?: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number | null;
  options?: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  modifierGroups?: ModifierGroup[];
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  store: {
    id: string;
    name: string;
  };
  categories: Category[];
}

function inferSelectionType(group: ModifierGroup): 'single' | 'multiple' {
  const max = group.maxSelect ?? null;
  if (max !== null && max > 1) return 'multiple';
  if ((group.minSelect ?? 0) > 1) return 'multiple';
  return 'single';
}

async function upsertModifierGroup(db: any, restaurantId: string, group: ModifierGroup, displayOrder: number) {
  const existing =
    await db.get(
      `SELECT id FROM modifier_groups WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
      [group.id, restaurantId]
    ) ||
    await db.get(
      `SELECT id FROM modifier_groups WHERE restaurant_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`,
      [restaurantId, group.name]
    );
  const selectionType = inferSelectionType(group);
  const minSelections = group.minSelect ?? 0;
  const maxSelections = group.maxSelect ?? null;
  const isRequired = group.required ? 1 : 0;

  if (existing) {
    await db.run(
      `UPDATE modifier_groups
       SET name = ?, selection_type = ?, min_selections = ?, max_selections = ?, is_required = ?,
           display_order = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND restaurant_id = ?`,
      [
        group.name,
        selectionType,
        minSelections,
        maxSelections,
        isRequired,
        displayOrder,
        existing.id,
        restaurantId
      ]
    );
  }

  const resolvedId = existing?.id ?? group.id;
  if (!existing) {
    await db.run(
      `INSERT INTO modifier_groups (
        id, restaurant_id, name, selection_type, min_selections, max_selections, is_required,
        display_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        resolvedId,
        restaurantId,
        group.name,
        selectionType,
        minSelections,
        maxSelections,
        isRequired,
        displayOrder
      ]
    );
  }

  return resolvedId;
}

async function upsertModifierOption(
  db: any,
  restaurantId: string,
  groupId: string,
  option: ModifierOption,
  displayOrder: number
) {
  const existingById = await db.get(
    `SELECT id, group_id FROM modifier_options WHERE id = ? AND deleted_at IS NULL`,
    [option.id]
  );
  const existingByName = await db.get(
    `SELECT id FROM modifier_options WHERE group_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`,
    [groupId, option.name]
  );
  const existing =
    (existingById && existingById.group_id === groupId ? existingById : null) || existingByName;

  const priceDelta = option.priceDelta ?? 0;
  const isSoldOut = option.isSoldOut ? 1 : 0;
  const isPreselected = option.isPreselected ? 1 : 0;

  if (existing) {
    await db.run(
      `UPDATE modifier_options
       SET name = ?, price_delta = ?, is_sold_out = ?, is_preselected = ?,
           display_order = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND group_id = ?`,
      [
        option.name,
        priceDelta,
        isSoldOut,
        isPreselected,
        displayOrder,
        existing.id,
        groupId
      ]
    );
  }

  if (!existing) {
    const resolvedOptionId = existingById ? uuidv4() : option.id;
    await db.run(
      `INSERT INTO modifier_options (
        id, group_id, restaurant_id, name, price_delta, is_sold_out, is_preselected,
        display_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        resolvedOptionId,
        groupId,
        restaurantId,
        option.name,
        priceDelta,
        isSoldOut,
        isPreselected,
        displayOrder
      ]
    );
  }
}

async function attachGroupToItem(db: any, itemId: string, groupId: string, displayOrder: number) {
  const existing = await db.get(
    `SELECT id FROM item_modifier_groups WHERE item_id = ? AND group_id = ? AND deleted_at IS NULL`,
    [itemId, groupId]
  );
  if (existing) {
    await db.run(
      `UPDATE item_modifier_groups
       SET display_order = ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ? AND group_id = ?`,
      [displayOrder, itemId, groupId]
    );
    return;
  }
  await db.run(
    `INSERT INTO item_modifier_groups (
      id, item_id, group_id, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [uuidv4(), itemId, groupId, displayOrder]
  );
}

async function syncModifiers() {
  console.log('🔧 Syncing menu modifiers into the database...\n');

  if (!fs.existsSync(MENU_JSON_PATH)) {
    throw new Error(`Menu JSON file not found at: ${MENU_JSON_PATH}`);
  }

  const rawData = fs.readFileSync(MENU_JSON_PATH, 'utf8');
  const menuData: MenuData = JSON.parse(rawData);

  await DatabaseService.initialize();
  const db = DatabaseService.getInstance().getDatabase();

  const restaurantId = menuData.store.id;
  const restaurant = await db.get('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
  if (!restaurant) {
    throw new Error(`Restaurant ${restaurantId} not found. Run import-menu-from-json first.`);
  }

  let groupCount = 0;
  let optionCount = 0;
  let attachmentCount = 0;

  for (const category of menuData.categories) {
    const categoryRow = await db.get(
      'SELECT id FROM menu_categories WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)',
      [restaurantId, category.name]
    );
    const categoryId = categoryRow?.id ?? null;

    for (const item of category.items) {
      if (!item.modifierGroups || item.modifierGroups.length === 0) {
        continue;
      }

      let itemRow = await db.get(
        'SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?',
        [item.id, restaurantId]
      );
      if (!itemRow && categoryId) {
        itemRow = await db.get(
          'SELECT id FROM menu_items WHERE restaurant_id = ? AND category_id = ? AND LOWER(name) = LOWER(?)',
          [restaurantId, categoryId, item.name]
        );
      }
      if (!itemRow) {
        logger.warn(`Menu item not found in DB, skipping modifiers: ${item.name} (${item.id})`);
        continue;
      }

      for (const [groupIndex, group] of item.modifierGroups.entries()) {
        const groupId = await upsertModifierGroup(db, restaurantId, group, groupIndex);
        groupCount += 1;

        const options = group.options || [];
        for (const [optionIndex, option] of options.entries()) {
          await upsertModifierOption(db, restaurantId, groupId, option, optionIndex);
          optionCount += 1;
        }

        await attachGroupToItem(db, itemRow.id, groupId, groupIndex);
        attachmentCount += 1;
      }
    }
  }

  console.log('✅ Modifier sync complete!');
  console.log(`   Groups processed: ${groupCount}`);
  console.log(`   Options processed: ${optionCount}`);
  console.log(`   Item-group attachments: ${attachmentCount}`);
}

if (require.main === module) {
  syncModifiers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Modifier sync failed:', error);
      process.exit(1);
    });
}

export { syncModifiers };
