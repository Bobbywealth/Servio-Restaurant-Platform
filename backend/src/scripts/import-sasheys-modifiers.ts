#!/usr/bin/env node

import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
import csvParser from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';

type ModifierRow = {
  groupName: string;
  optionName: string;
  extraPrice: number;
  required: boolean;
  appliesTo: string;
};

type MenuItem = {
  id: string;
  name: string;
  categoryName: string;
};

type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
};

const DEFAULT_MODIFIERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1CtEFumHvmDdZJCWf_rCvxJWShHFKs97MtsUByLfuw7k/gviz/tq?tqx=out:csv&gid=889134832';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function stripParens(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function parsePrice(value: string): number {
  const cleaned = value.replace(/[+$,]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPriceLike(value: string): boolean {
  return /^\+\$?\d/.test(value.trim());
}

function fetchCsvRows(url: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to fetch CSV: ${res.statusCode}`));
          return;
        }
        res
          .pipe(csvParser())
          .on('data', (data) => rows.push(data))
          .on('end', () => resolve(rows))
          .on('error', reject);
      })
      .on('error', reject);
  });
}

function parseModifierRows(rawRows: Record<string, string>[]): ModifierRow[] {
  const rows: ModifierRow[] = [];
  let lastGroupName = '';

  for (const row of rawRows) {
    const groupCell = row['Modifier Group Name SIZE OPTIONS']?.trim() ?? '';
    const optionCell = row['Modifier Option ']?.trim() ?? '';
    const extraPriceCell = row['Extra Price ']?.trim() ?? '';
    const requiredCell = row['Required/Optional ']?.trim() ?? '';
    const appliesToCell = row['Applies To ']?.trim() ?? '';

    if (!optionCell) {
      continue;
    }

    let groupName = groupCell;
    let extraPrice = extraPriceCell ? parsePrice(extraPriceCell) : 0;

    if (isPriceLike(groupCell)) {
      extraPrice = extraPriceCell ? extraPrice : parsePrice(groupCell);
      groupName = lastGroupName;
    }

    if (!groupName || normalize(groupName) === 'size') {
      continue;
    }

    if (!isPriceLike(groupCell)) {
      lastGroupName = groupName;
    }

    rows.push({
      groupName,
      optionName: optionCell,
      extraPrice,
      required: normalize(requiredCell) === 'required',
      appliesTo: appliesToCell
    });
  }

  return rows;
}

async function importSasheysModifiers() {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
  const restaurantId = process.env.DEFAULT_RESTAURANT_ID || DatabaseService.DEFAULT_RESTAURANT_ID;
  const modifiersUrl = process.argv[2] || process.env.SASHEYS_MODIFIERS_CSV || DEFAULT_MODIFIERS_CSV_URL;

  console.log('📄 Loading modifiers from:', modifiersUrl);
  const rawRows = await fetchCsvRows(modifiersUrl);
  const modifierRows = parseModifierRows(rawRows);

  if (modifierRows.length === 0) {
    console.error('❌ No modifier rows parsed from sheet.');
    process.exit(1);
  }

  await DatabaseService.initialize();
  const db = DatabaseService.getInstance().getDatabase();

  const items = await db.all<MenuItem>(
    `
      SELECT mi.id, mi.name, COALESCE(mc.name, '') as "categoryName"
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.restaurant_id = ?
    `,
    [restaurantId]
  );

  const itemByName = new Map<string, MenuItem[]>();
  for (const item of items) {
    const baseName = normalize(stripParens(item.name));
    const existing = itemByName.get(baseName) ?? [];
    existing.push(item);
    itemByName.set(baseName, existing);
  }

  const groupMap = new Map<string, ModifierGroup>();
  const existingGroups = await db.all<{ id: string; name: string; is_required: boolean }>(
    'SELECT id, name, is_required FROM modifier_groups WHERE restaurant_id = ?',
    [restaurantId]
  );
  for (const group of existingGroups) {
    groupMap.set(normalize(group.name), {
      id: group.id,
      name: group.name,
      required: !!group.is_required
    });
  }

  const optionMap = new Map<string, Set<string>>();
  const itemGroupLinks = new Set<string>();

  function resolveTargets(appliesTo: string): MenuItem[] {
    const normalized = normalize(appliesTo);
    if (!normalized) return [];

    if (normalized === 'most entrees') {
      return items.filter((item) => normalize(item.categoryName) === 'entrees');
    }
    if (normalized === 'all wing dinners') {
      return items.filter(
        (item) => normalize(item.name).includes('wing') && normalize(item.name).includes('dinner')
      );
    }

    const targets = appliesTo.split(',').map((entry) => entry.trim()).filter(Boolean);
    const resolved: MenuItem[] = [];
    for (const target of targets) {
      const key = normalize(target);
      const matches = itemByName.get(key) ?? [];
      if (matches.length > 0) {
        resolved.push(...matches);
        continue;
      }
      const fallback = items.filter((item) => normalize(stripParens(item.name)).startsWith(key));
      resolved.push(...fallback);
    }

    return resolved;
  }

  for (const row of modifierRows) {
    const groupKey = normalize(row.groupName);
    let group = groupMap.get(groupKey);
    if (!group) {
      const groupId = uuidv4();
      await db.run(
        `
          INSERT INTO modifier_groups (
            id, restaurant_id, name, is_required, min_selection, max_selection,
            sort_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [groupId, restaurantId, row.groupName, row.required, row.required ? 1 : 0, 1, 0, true]
      );
      group = { id: groupId, name: row.groupName, required: row.required };
      groupMap.set(groupKey, group);
    }

    const optionsKey = group.id;
    if (!optionMap.has(optionsKey)) {
      optionMap.set(optionsKey, new Set());
    }
    const optionSet = optionMap.get(optionsKey)!;

    if (!optionSet.has(row.optionName)) {
      const optionId = uuidv4();
      await db.run(
        `
          INSERT INTO modifier_options (
            id, modifier_group_id, name, price_modifier, sort_order, is_available,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [optionId, group.id, row.optionName, row.extraPrice, optionSet.size, true]
      );
      optionSet.add(row.optionName);
    }

    const targetItems = resolveTargets(row.appliesTo);
    for (const item of targetItems) {
      const linkKey = `${item.id}:${group.id}`;
      if (itemGroupLinks.has(linkKey)) continue;
      await db.run(
        `
          INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
          VALUES (?, ?, ?, ?)
        `,
        [uuidv4(), item.id, group.id, 0]
      );
      itemGroupLinks.add(linkKey);
    }
  }

  const groupCount = await db.get('SELECT COUNT(*) as count FROM modifier_groups WHERE restaurant_id = ?', [
    restaurantId
  ]);
  const optionCount = await db.get(
    'SELECT COUNT(*) as count FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE restaurant_id = ?)',
    [restaurantId]
  );
  console.log('✅ Modifier import complete.');
  console.log(`  • Modifier Groups: ${groupCount?.count ?? 0}`);
  console.log(`  • Modifier Options: ${optionCount?.count ?? 0}`);
}

if (require.main === module) {
  importSasheysModifiers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Modifier import failed:', error);
      process.exit(1);
    });
}
