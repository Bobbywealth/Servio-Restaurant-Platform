#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import xlsx from 'xlsx';
import { DatabaseService } from '../services/DatabaseService';

type SizeColumn = {
  label: string;
  colIndex: number;
};

type MenuItem = {
  name: string;
  category: string;
  sizes: { label: string; price: number }[];
};

const SIZE_LABELS = new Set([
  'ONE SIZE',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'EXTRA LARGE',
  'HALF',
  'FULL'
]);

function normalizeLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSizeColumns(row: unknown[]): SizeColumn[] {
  const columns: SizeColumn[] = [];
  row.forEach((cell, idx) => {
    const label = normalizeLabel(cell);
    if (SIZE_LABELS.has(label)) {
      columns.push({ label, colIndex: idx });
    }
  });
  return columns;
}

async function importSasheysMenuFromXlsx() {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
  const restaurantId = process.env.DEFAULT_RESTAURANT_ID || DatabaseService.DEFAULT_RESTAURANT_ID;
  const menuPath =
    process.argv[2] ||
    process.env.SASHEYS_MENU_XLSX ||
    path.join(__dirname, "../../Sashey's Menu Prices .xlsx");

  if (!fs.existsSync(menuPath)) {
    console.error('❌ Menu XLSX file not found:', menuPath);
    process.exit(1);
  }

  console.log('📄 Reading menu XLSX:', menuPath);
  const workbook = xlsx.readFile(menuPath);
  const sheet = workbook.Sheets['Sheet1'];

  if (!sheet) {
    console.error('❌ Sheet1 not found in XLSX.');
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];

  const items: MenuItem[] = [];
  const categoryOrder: string[] = [];
  let currentCategory = '';
  let sizeColumns: SizeColumn[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const nameCell = row[1];
    const normalizedName = normalizeLabel(nameCell);
    const isCategoryRow =
      !row[0] && !!normalizedName && row.some((cell) => SIZE_LABELS.has(normalizeLabel(cell)));

    if (isCategoryRow) {
      currentCategory = String(nameCell).trim();
      sizeColumns = buildSizeColumns(row);
      if (!categoryOrder.includes(currentCategory)) {
        categoryOrder.push(currentCategory);
      }
      continue;
    }

    const idCell = row[0];
    if (!currentCategory || !idCell || !nameCell) {
      continue;
    }

    const sizes = sizeColumns
      .map(({ label, colIndex }) => ({
        label,
        price: parsePrice(row[colIndex])
      }))
      .filter((size) => size.price !== null) as { label: string; price: number }[];

    if (sizes.length === 0) {
      continue;
    }

    items.push({
      name: String(nameCell).trim(),
      category: currentCategory,
      sizes
    });
  }

  if (items.length === 0) {
    console.error('❌ No menu items parsed from XLSX.');
    process.exit(1);
  }

  console.log(`📦 Parsed ${items.length} items across ${categoryOrder.length} categories.`);

  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();

  const existingRestaurant = await db.get('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
  if (!existingRestaurant) {
    console.log('🏪 Creating restaurant record...');
    await db.run(
      `
        INSERT INTO restaurants (
          id, name, slug, settings, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        restaurantId,
        DatabaseService.DEFAULT_RESTAURANT_NAME,
        DatabaseService.DEFAULT_RESTAURANT_SLUG,
        JSON.stringify({}),
        true
      ]
    );
  }

  console.log('🧹 Clearing existing menu data...');
  await db.run(
    'DELETE FROM menu_item_modifiers WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ?)',
    [restaurantId]
  );
  await db.run(
    'DELETE FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE restaurant_id = ?)',
    [restaurantId]
  );
  await db.run('DELETE FROM modifier_groups WHERE restaurant_id = ?', [restaurantId]);
  await db.run('DELETE FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  await db.run('DELETE FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);

  console.log('📂 Creating menu categories...');
  const categoryIdMap = new Map<string, string>();
  for (let i = 0; i < categoryOrder.length; i += 1) {
    const categoryId = uuidv4();
    const categoryName = categoryOrder[i];
    await db.run(
      `
        INSERT INTO menu_categories (
          id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [categoryId, restaurantId, categoryName, '', i, true]
    );
    categoryIdMap.set(categoryName, categoryId);
  }

  console.log('🍽️ Creating menu items...');
  const nameCounts = new Map<string, number>();
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const categoryId = categoryIdMap.get(item.category);
    if (!categoryId) continue;

    const baseName = item.name;
    const nextCount = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, nextCount);
    const uniqueName =
      nextCount === 1 ? baseName : `${baseName} (${item.category}${nextCount > 2 ? ` ${nextCount}` : ''})`;

    const basePrice = Math.min(...item.sizes.map((size) => size.price));
    const itemId = uuidv4();

    await db.run(
      `
        INSERT INTO menu_items (
          id, restaurant_id, category_id, name, description, price,
          tags, is_available, images, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        itemId,
        restaurantId,
        categoryId,
        uniqueName,
        '',
        basePrice,
        JSON.stringify([]),
        true,
        JSON.stringify([]),
        itemIndex
      ]
    );

    if (item.sizes.length > 1) {
      const modGroupId = uuidv4();
      await db.run(
        `
          INSERT INTO modifier_groups (
            id, restaurant_id, name, is_required, min_selection, max_selection,
            sort_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [modGroupId, restaurantId, 'Size', true, 1, 1, 0, true]
      );

      for (let optIndex = 0; optIndex < item.sizes.length; optIndex += 1) {
        const size = item.sizes[optIndex];
        const optionId = uuidv4();
        const priceDelta = Number((size.price - basePrice).toFixed(2));

        await db.run(
          `
            INSERT INTO modifier_options (
              id, modifier_group_id, name, price_modifier, sort_order, is_available,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [optionId, modGroupId, size.label, priceDelta, optIndex, true]
        );
      }

      await db.run(
        `
          INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
          VALUES (?, ?, ?, ?)
        `,
        [uuidv4(), itemId, modGroupId, 0]
      );
    }
  }

  const categoryCount = await db.get('SELECT COUNT(*) as count FROM menu_categories WHERE restaurant_id = ?', [
    restaurantId
  ]);
  const itemCount = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?', [
    restaurantId
  ]);
  const modGroupCount = await db.get('SELECT COUNT(*) as count FROM modifier_groups WHERE restaurant_id = ?', [
    restaurantId
  ]);
  const modOptionCount = await db.get(
    'SELECT COUNT(*) as count FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE restaurant_id = ?)',
    [restaurantId]
  );

  console.log('\n🎉 Menu Import Complete!');
  console.log('📊 Final Summary:');
  console.log(`  • Categories: ${categoryCount?.count ?? 0}`);
  console.log(`  • Menu Items: ${itemCount?.count ?? 0}`);
  console.log(`  • Modifier Groups: ${modGroupCount?.count ?? 0}`);
  console.log(`  • Modifier Options: ${modOptionCount?.count ?? 0}`);
}

if (require.main === module) {
  importSasheysMenuFromXlsx()
    .then(() => {
      console.log('✅ Done.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}
