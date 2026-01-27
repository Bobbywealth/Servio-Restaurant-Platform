#!/usr/bin/env ts-node

/**
 * Sync Sashey's Menu from JSON to Database
 * 
 * This script reads the updated menu JSON and syncs it to the database.
 * It handles:
 * - Creating/updating categories
 * - Creating items with size variations for multi-priced items
 * - Proper ID generation for consistency
 */

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/services/DatabaseService';
import { logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const MENU_JSON_PATH = path.join(__dirname, '../data/menu/sasheys_menu_updated.json');

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  tags?: string[];
}

interface Category {
  name: string;
  items: MenuItem[];
  isHidden?: boolean;
}

interface MenuData {
  store: {
    id: string;
    name: string;
    currency: string;
  };
  categories: Category[];
}

// Helper to generate slug-safe IDs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper to get size name from tags
function getSizeName(tags: string[] = []): string | null {
  const sizeMapping: Record<string, string> = {
    'small': 'Small',
    'medium': 'Medium',
    'large': 'Large',
    'xlarge': 'Extra Large',
    'xxlarge': '2XL',
    'one-size': 'Regular',
    '6pcs': '6 Piece',
    '10pcs': '10 Piece',
    '15pcs': '15 Piece',
    'half-tray': 'Half Tray',
    'full-tray': 'Full Tray',
    '4oz': '4oz',
    '26oz': '26oz'
  };
  
  for (const tag of tags) {
    if (sizeMapping[tag]) {
      return sizeMapping[tag];
    }
  }
  return null;
}

async function syncMenu() {
  console.log('🔄 Starting menu sync...\n');

  try {
    // Load JSON data
    if (!fs.existsSync(MENU_JSON_PATH)) {
      throw new Error(`Menu JSON file not found at: ${MENU_JSON_PATH}`);
    }

    const rawData = fs.readFileSync(MENU_JSON_PATH, 'utf8');
    const menuData: MenuData = JSON.parse(rawData);

    console.log(`🏪 Restaurant: ${menuData.store.name}`);
    console.log(`🆔 Restaurant ID: ${menuData.store.id}`);
    console.log(`📂 Categories: ${menuData.categories.length}`);
    console.log('');

    // Initialize database
    await DatabaseService.initialize();
    const db = DatabaseService.getInstance().getDatabase();

    const restaurantId = menuData.store.id;

    // Ensure restaurant exists
    console.log('🔍 Checking if restaurant exists...');
    const existingRestaurant = await db.get(
      'SELECT id, name FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    if (!existingRestaurant) {
      console.log('📝 Creating restaurant record...');
      await db.run(
        `INSERT INTO restaurants (
          id, name, slug, address, settings, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          restaurantId,
          menuData.store.name,
          'sasheyskitchen',
          '123 Main St, Union, NJ',
          JSON.stringify({
            currency: menuData.store.currency,
            tax_rate: 0.06625
          }),
          1
        ]
      );
      console.log('✅ Restaurant created\n');
    } else {
      console.log(`✅ Restaurant exists: ${existingRestaurant.name}\n`);
    }

    // Get existing categories
    const existingCategories = await db.all(
      'SELECT id, name FROM menu_categories WHERE restaurant_id = ?',
      [restaurantId]
    );
    const categoryIdMap: Record<string, string> = {};
    for (const cat of existingCategories) {
      categoryIdMap[slugify(cat.name)] = cat.id;
    }

    // Process categories
    let totalItems = 0;
    let updatedItems = 0;
    let skippedItems = 0;
    let createdCategories = 0;
    let updatedCategories = 0;

    for (const category of menuData.categories) {
      console.log(`📁 Processing category: ${category.name}`);

      const categoryKey = slugify(category.name);
      let categoryId = categoryIdMap[categoryKey];

      // Get current sort order if category exists
      const existingCat = await db.get(
        'SELECT id, sort_order FROM menu_categories WHERE id = ?',
        [categoryId]
      );

      if (!existingCat) {
        // Create new category
        categoryId = uuidv4();
        const sortOrder = Object.keys(categoryIdMap).length;
        await db.run(
          `INSERT INTO menu_categories (
            id, restaurant_id, name, is_hidden, is_active, sort_order,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [categoryId, restaurantId, category.name, category.isHidden ? 1 : 0, 1, sortOrder]
        );
        console.log(`  ✅ Created category: ${category.name}`);
        createdCategories++;
      } else {
        // Update existing category
        await db.run(
          `UPDATE menu_categories SET name = ?, is_hidden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [category.name, category.isHidden ? 1 : 0, categoryId]
        );
        console.log(`  🔄 Updated category: ${category.name}`);
        updatedCategories++;
      }

      // Group items by base name to identify size variations
      const itemsByName: Record<string, MenuItem[]> = {};
      for (const item of category.items) {
        // Remove size tags from the base name for grouping
        const baseName = item.name.replace(/\s+\((Small|Medium|Large|One Size|Extra Large|2XL|6 Piece|10 Piece|15 Piece|Half Tray|Full Tray|4oz|26oz)\)$/i, '').trim();
        if (!itemsByName[baseName]) {
          itemsByName[baseName] = [];
        }
        itemsByName[baseName].push(item);
      }

      // Process each unique item (grouped by name with sizes)
      for (const [baseName, items] of Object.entries(itemsByName)) {
        // Get the primary price (smallest or first)
        const primaryItem = items.find(i => i.price !== null) || items[0];
        
        if (primaryItem.price === null) {
          console.log(`  ⚠️ Skipping item with no price: ${baseName}`);
          continue;
        }

        // Check if item already exists in this category
        const existingItemInCategory = await db.get(
          'SELECT id FROM menu_items WHERE restaurant_id = ? AND category_id = ? AND name = ?',
          [restaurantId, categoryId, baseName]
        );

        let itemId: string;
        let displayName = baseName;

        if (existingItemInCategory) {
          // Update existing item in this category
          itemId = existingItemInCategory.id;
          await db.run(
            `UPDATE menu_items SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [primaryItem.price, itemId]
          );
          console.log(`  🔄 Updated item: ${baseName}`);
          updatedItems++;
        } else {
          // Check if item exists in ANY category (constraint violation possible)
          const existingItemAnyCategory = await db.get(
            'SELECT id, category_id FROM menu_items WHERE restaurant_id = ? AND name = ?',
            [restaurantId, baseName]
          );

          if (existingItemAnyCategory) {
            // Item exists in a different category - append category name to make unique
            displayName = `${baseName} (${category.name})`;
            // Check again with the new name
            const existingWithNewName = await db.get(
              'SELECT id FROM menu_items WHERE restaurant_id = ? AND category_id = ? AND name = ?',
              [restaurantId, categoryId, displayName]
            );
            
            if (existingWithNewName) {
              itemId = existingWithNewName.id;
              await db.run(
                `UPDATE menu_items SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [primaryItem.price, itemId]
              );
              console.log(`  🔄 Updated item: ${displayName}`);
              updatedItems++;
            } else {
              // Create new item with modified name
              itemId = `${restaurantId}-item-${slugify(displayName)}-${Date.now()}`;
              await db.run(
                `INSERT INTO menu_items (
                  id, restaurant_id, category_id, name, description, price,
                  is_available, tags, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                  itemId,
                  restaurantId,
                  categoryId,
                  displayName,
                  primaryItem.description || '',
                  primaryItem.price,
                  1,
                  JSON.stringify(primaryItem.tags || [])
                ]
              );
              console.log(`  ➕ Created item: ${displayName} (from ${category.name})`);
              totalItems++;
            }
          } else {
            // No conflict - create new item
            itemId = items[0].id || `${restaurantId}-item-${slugify(baseName)}-${Date.now()}`;
            await db.run(
              `INSERT INTO menu_items (
                id, restaurant_id, category_id, name, description, price,
                is_available, tags, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                itemId,
                restaurantId,
                categoryId,
                baseName,
                primaryItem.description || '',
                primaryItem.price,
                1,
                JSON.stringify(primaryItem.tags || [])
              ]
            );
            console.log(`  ➕ Created item: ${baseName}`);
            totalItems++;
          }
        }

        // Create size variations for items with multiple prices
        const sizeVariations = items.filter(i => i.price !== null && i.tags && i.tags.length > 0);
        if (sizeVariations.length > 1) {
          // Delete existing sizes for this item
          await db.run('DELETE FROM item_sizes WHERE item_id = ?', [itemId]);

          // Create new size entries
          for (const item of sizeVariations) {
            const sizeName = getSizeName(item.tags);
            if (sizeName) {
              const existingSize = await db.get(
                'SELECT id FROM item_sizes WHERE item_id = ? AND size_name = ?',
                [itemId, sizeName]
              );
              
              if (!existingSize) {
                await db.run(
                  `INSERT INTO item_sizes (id, item_id, size_name, price, display_order, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                  [uuidv4(), itemId, sizeName, item.price, sizeVariations.indexOf(item)]
                );
                console.log(`    📏 Added size: ${sizeName} - $${item.price}`);
              }
            }
          }
        }
      }
    }

    console.log('');
    console.log('✅ Menu sync completed!');
    console.log(`   Categories created: ${createdCategories}`);
    console.log(`   Categories updated: ${updatedCategories}`);
    console.log(`   Items created: ${totalItems}`);
    console.log(`   Items updated: ${updatedItems}`);
    console.log('');

    // Verify the sync
    const itemCount = await db.get(
      'SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?',
      [restaurantId]
    );
    const categoryCount = await db.get(
      'SELECT COUNT(*) as count FROM menu_categories WHERE restaurant_id = ?',
      [restaurantId]
    );
    console.log(`📊 Total items in database: ${itemCount.count}`);
    console.log(`📊 Total categories in database: ${categoryCount.count}`);

  } catch (error) {
    console.error('❌ Menu sync failed:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  syncMenu()
    .then(() => {
      console.log('\n🎉 Menu sync successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Menu sync failed:', error);
      process.exit(1);
    });
}

export { syncMenu };
