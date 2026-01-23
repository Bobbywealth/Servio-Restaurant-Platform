#!/usr/bin/env ts-node

/**
 * Import Menu from JSON to Database
 * 
 * Reads the Sashey's Kitchen menu from sasheys_menu_vapi.json
 * and imports it into the PostgreSQL database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/services/DatabaseService';
import { logger } from '../src/utils/logger';

const MENU_JSON_PATH = path.join(__dirname, '../data/menu/sasheys_menu_vapi.json');

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  tags?: string[];
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  store: {
    id: string;
    name: string;
    currency: string;
  };
  categories: Category[];
}

async function importMenu() {
  console.log('📋 Starting menu import from JSON...\n');

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
          '123 Main St, Union, NJ', // Default address
          JSON.stringify({
            currency: menuData.store.currency,
            tax_rate: 0.06625
          }),
          1 // is_active
        ]
      );
      console.log('✅ Restaurant created\n');
    } else {
      console.log(`✅ Restaurant exists: ${existingRestaurant.name}\n`);
    }

    // Import categories and items
    let totalItems = 0;
    let skippedItems = 0;

    for (const category of menuData.categories) {
      console.log(`📁 Processing category: ${category.name}`);

      // Create or get category
      const categoryId = `${restaurantId}-cat-${category.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      const existingCategory = await db.get(
        'SELECT id FROM menu_categories WHERE id = ?',
        [categoryId]
      );

      if (!existingCategory) {
        await db.run(
          `INSERT INTO menu_categories (
            id, restaurant_id, name, is_active, 
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [categoryId, restaurantId, category.name, 1]
        );
        console.log(`  ✅ Created category: ${category.name}`);
      }

      // Import items
      for (const item of category.items) {
        const itemId = item.id || `${categoryId}-${item.name.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Check if item already exists
        const existingItem = await db.get(
          'SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?',
          [itemId, restaurantId]
        );

        if (existingItem) {
          skippedItems++;
          continue;
        }

        // Determine price
        let price = item.price || 0;
        
        // Some items might have price in modifiers
        if (!price && (item as any).modifierGroups) {
          const modGroups = (item as any).modifierGroups;
          const sizeGroup = modGroups.find((g: any) => 
            g.id === 'size' || g.name?.toLowerCase().includes('size')
          );
          if (sizeGroup?.options?.[0]?.priceDelta) {
            price = sizeGroup.options[0].priceDelta;
          }
        }

        await db.run(
          `INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, 
            price, is_available, tags,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            itemId,
            restaurantId,
            categoryId,
            item.name,
            item.description || '',
            price,
            1, // is_available
            JSON.stringify(item.tags || [])
          ]
        );

        totalItems++;
      }

      console.log(`  ➕ Added ${category.items.length - skippedItems} items`);
    }

    console.log('');
    console.log('✅ Import completed!');
    console.log(`   Total items imported: ${totalItems}`);
    console.log(`   Items skipped (already exist): ${skippedItems}`);
    console.log('');

    // Verify the import
    const itemCount = await db.get(
      'SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?',
      [restaurantId]
    );
    console.log(`📊 Total items in database for ${menuData.store.name}: ${itemCount.count}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  importMenu()
    .then(() => {
      console.log('\n🎉 Menu import successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Menu import failed:', error);
      process.exit(1);
    });
}

export { importMenu };
