#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

type ModifierOptionSeed = {
  name: string;
  priceModifier: number;
  isAvailable?: boolean;
};

type ModifierGroupSeed = {
  name: string;
  description: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOptionSeed[];
};

type MenuItemRow = {
  id: string;
  name: string;
};

const RESTAURANT_SLUGS = ['demo-restaurant-1', 'demo-restaurant'];

const modifierGroups: ModifierGroupSeed[] = [
  {
    name: 'Size',
    description: 'Select portion size',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 1,
    options: [
      { name: 'Small', priceModifier: 0 },
      { name: 'Medium', priceModifier: 0 },
      { name: 'Large', priceModifier: 5.0 },
      { name: 'Extra Large', priceModifier: 14.49 }
    ]
  },
  {
    name: 'Gravy Amount',
    description: 'How much gravy would you like',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 2,
    options: [
      { name: 'No gravy', priceModifier: 0 },
      { name: 'Moderate gravy', priceModifier: 0 },
      { name: 'A lot of gravy', priceModifier: 0 }
    ]
  },
  {
    name: 'Gravy Style',
    description: 'How would you like your gravy',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 3,
    options: [
      { name: 'On the food', priceModifier: 0 },
      { name: 'On the side', priceModifier: 1.0 }
    ]
  },
  {
    name: 'Side Choice',
    description: 'What else would you like with your food',
    minSelections: 1,
    maxSelections: 3,
    isRequired: true,
    sortOrder: 4,
    options: [
      { name: 'Rice & Peas', priceModifier: 0 },
      { name: 'Yellow rice', priceModifier: 0, isAvailable: false },
      { name: 'White Rice ( contains Coconut oil )', priceModifier: 0 },
      { name: 'Boiled Food', priceModifier: 0 },
      { name: 'Steamed Cabbage', priceModifier: 0 },
      { name: 'Fresh Salad', priceModifier: 0, isAvailable: false },
      { name: 'Cold Cabbbage ( Pack with Entrée )', priceModifier: 0, isAvailable: false },
      { name: 'Fried Dumplings', priceModifier: 0 },
      { name: 'Reggae Pasta in Plate', priceModifier: 3.0 },
      { name: 'Macaroni Salad in Plate', priceModifier: 0, isAvailable: false },
      { name: 'Mac & Cheese in Plate', priceModifier: 6.0 },
      { name: 'Festival', priceModifier: 0, isAvailable: false },
      { name: 'Fries', priceModifier: 0, isAvailable: false },
      { name: 'Macaroni Salad Only', priceModifier: 0, isAvailable: false }
    ]
  },
  {
    name: 'Gravy Type',
    description: 'What kind of gravy would you like',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 5,
    options: [
      { name: 'Same as Meat', priceModifier: 0 },
      { name: 'No Gravy', priceModifier: 0 },
      { name: 'Natural Vegan Gravy', priceModifier: 0 },
      { name: 'Oxtail Gravy', priceModifier: 0 },
      { name: 'Jerk Sauce Gravy', priceModifier: 0 },
      { name: 'Curry Chicken Gravy', priceModifier: 0 },
      { name: 'Curry Goat Gravy', priceModifier: 0 },
      { name: 'Stew Beef Gravy', priceModifier: 0 },
      { name: 'Stew Chicken Gravy', priceModifier: 0 },
      { name: 'Jerk BBQ Sauce', priceModifier: 0, isAvailable: false },
      { name: 'Honey Jerk Sauce', priceModifier: 0 }
    ]
  },
  {
    name: 'Premium Sides',
    description: 'Premium sides',
    minSelections: 0,
    maxSelections: 2,
    isRequired: false,
    sortOrder: 6,
    options: [
      { name: 'Plantain', priceModifier: 0, isAvailable: false },
      { name: 'Mac and Cheese', priceModifier: 6.0 },
      { name: 'Reggae Rasta Pasta', priceModifier: 5.0 },
      { name: 'Fries', priceModifier: 0, isAvailable: false }
    ]
  },
  {
    name: 'Fish Style',
    description: 'How do you like your fish',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 7,
    options: [
      { name: 'Brown stew', priceModifier: 0 },
      { name: 'Fried', priceModifier: 0 },
      { name: 'Steamed', priceModifier: 0 }
    ]
  },
  {
    name: 'Salmon Style',
    description: 'How would you like your Salmon done',
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 8,
    options: [
      { name: 'Salmon Garlic Butter', priceModifier: 0 },
      { name: 'Fried Salmon', priceModifier: 0 },
      { name: 'Sweet Chili Salmon', priceModifier: 0 },
      { name: 'Honey Jerk Salmon', priceModifier: 0 },
      { name: 'Baked Salmon', priceModifier: 0 }
    ]
  }
];

async function upsertGroup(db: any, restaurantId: string, group: ModifierGroupSeed) {
  const existing = await db.get(
    'SELECT id FROM modifier_groups WHERE name = ? AND restaurant_id = ?',
    [group.name, restaurantId]
  );

  const groupId = existing?.id ?? uuidv4();
  if (existing?.id) {
    await db.run(
      `UPDATE modifier_groups
       SET description = ?, min_selection = ?, max_selection = ?,
           is_required = ?, sort_order = ?, is_active = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        group.description,
        group.minSelections,
        group.maxSelections,
        group.isRequired ? 1 : 0,
        group.sortOrder,
        groupId
      ]
    );
  } else {
    await db.run(
      `INSERT INTO modifier_groups
       (id, restaurant_id, name, description, min_selection, max_selection,
        is_required, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        groupId,
        restaurantId,
        group.name,
        group.description,
        group.minSelections,
        group.maxSelections,
        group.isRequired ? 1 : 0,
        group.sortOrder
      ]
    );
  }

  await db.run('DELETE FROM modifier_options WHERE modifier_group_id = ?', [groupId]);
  for (let i = 0; i < group.options.length; i += 1) {
    const option = group.options[i];
    await db.run(
      `INSERT INTO modifier_options
       (id, modifier_group_id, name, description, price_modifier, sort_order, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        groupId,
        option.name,
        null,
        option.priceModifier,
        i,
        option.isAvailable === false ? 0 : 1
      ]
    );
  }

  return groupId;
}

function isDinnerItem(name: string) {
  return name.toLowerCase().includes('dinner');
}

function isFishDinner(name: string) {
  const lower = name.toLowerCase();
  return lower.includes('fish dinner') || lower.includes('snapper');
}

function isSalmonDinner(name: string) {
  return name.toLowerCase().includes('salmon dinner');
}

async function seedFoodbookingModifiers() {
  await DatabaseService.initialize();
  const db = DatabaseService.getInstance().getDatabase();

  const restaurant = await db.get(
    'SELECT id FROM restaurants WHERE slug IN (?, ?) LIMIT 1',
    RESTAURANT_SLUGS
  );
  if (!restaurant) {
    throw new Error('Demo restaurant not found for modifier seeding.');
  }
  const restaurantId = restaurant.id;

  const groupIds: Record<string, string> = {};
  for (const group of modifierGroups) {
    groupIds[group.name] = await upsertGroup(db, restaurantId, group);
  }

  const menuItems = await db.all(
    'SELECT id, name FROM menu_items WHERE restaurant_id = ? AND is_available = TRUE',
    [restaurantId]
  ) as MenuItemRow[];

  const attachGroup = async (itemId: string, groupName: string, sortOrder: number) => {
    const groupId = groupIds[groupName];
    if (!groupId) return;
    await db.run(
      `INSERT OR IGNORE INTO menu_item_modifiers
       (id, menu_item_id, modifier_group_id, sort_order)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), itemId, groupId, sortOrder]
    );
  };

  for (const item of menuItems) {
    if (!isDinnerItem(item.name)) continue;

    await attachGroup(item.id, 'Size', 1);
    await attachGroup(item.id, 'Gravy Amount', 2);
    await attachGroup(item.id, 'Gravy Style', 3);
    await attachGroup(item.id, 'Side Choice', 4);
    await attachGroup(item.id, 'Gravy Type', 5);
    await attachGroup(item.id, 'Premium Sides', 6);

    if (isFishDinner(item.name)) {
      await attachGroup(item.id, 'Fish Style', 7);
    }
    if (isSalmonDinner(item.name)) {
      await attachGroup(item.id, 'Salmon Style', 8);
    }
  }
}

if (require.main === module || process.env.RUN_SEED === 'true') {
  seedFoodbookingModifiers()
    .then(() => {
      console.log('✅ Foodbooking modifiers seeded successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Foodbooking modifier seeding failed:', error);
      process.exit(1);
    });
}

export { seedFoodbookingModifiers };
