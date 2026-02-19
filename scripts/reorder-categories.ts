#!/usr/bin/env ts-node

/**
 * Reorder Sashey's Menu Categories
 * 
 * Arranges categories in daypart progression from light/early to heavy/later:
 * 1. Breakfast - Start-of-day menu
 * 2. Brunch - Mid-morning transition (if available)
 * 3. Lunch - Midday meals
 * 4. Snacks - Light bites
 * 5. Dinner / Entrees - Main evening dishes
 * 6. Family Meals / Catering - Large-format meals
 * 7. Sides - Accompaniments
 * 8. Desserts - Sweets
 * 9. Beverages - Drinks
 * 10. Kids Menu - Family-focused section
 */

import dotenv from 'dotenv';
dotenv.config();

import { DatabaseService } from '../src/services/DatabaseService';

const RESTAURANT_ID = 'sasheys-kitchen-union';

// Requested category progression:
// Breakfast -> Brunch -> Lunch -> Snacks -> Dinner/Entrees -> Family Meals/Catering -> Sides -> Desserts -> Beverages -> Kids Menu
const CATEGORY_ORDER = [
  'Breakfast',
  'Brunch',
  'Lunch',
  'Snacks',
  'Dinner',
  'Entrees',
  'Main Courses',
  'Family Meals',
  'Catering',
  'Sides',
  'Desserts',
  'Beverages',
  'Juices and Sodas',
  'Kids Menu',
];

async function reorderCategories() {
  console.log('🔄 Reordering Sashey\'s menu categories...\n');

  try {
    await DatabaseService.initialize();
    const db = DatabaseService.getInstance().getDatabase();

    let updated = 0;
    let notFound = 0;

    for (let i = 0; i < CATEGORY_ORDER.length; i++) {
      const categoryName = CATEGORY_ORDER[i];
      
      const result = await db.run(
        `UPDATE menu_categories 
         SET sort_order = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE restaurant_id = ? AND name = ?`,
        [i, RESTAURANT_ID, categoryName]
      );

      if (result.changes && result.changes > 0) {
        console.log(`✅ ${i + 1}. ${categoryName}`);
        updated++;
      } else {
        console.log(`⚠️  ${i + 1}. ${categoryName} (not found)`);
        notFound++;
      }
    }

    console.log('\n✅ Category reordering completed!');
    console.log(`   Categories reordered: ${updated}`);
    console.log(`   Categories not found: ${notFound}`);

    // Display the new order
    console.log('\n📋 New Category Order:');
    console.log('='.repeat(40));
    
    const categories = await db.all(
      `SELECT name, sort_order, COALESCE(is_hidden, FALSE) as is_hidden 
       FROM menu_categories 
       WHERE restaurant_id = ? 
       ORDER BY sort_order ASC`,
      [RESTAURANT_ID]
    );

    for (const cat of categories) {
      const hidden = cat.is_hidden ? ' [HIDDEN]' : '';
      console.log(`  ${cat.sort_order + 1}. ${cat.name}${hidden}`);
    }

  } catch (error) {
    console.error('❌ Category reordering failed:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  reorderCategories()
    .then(() => {
      console.log('\n🎉 Categories reordered successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}

export { reorderCategories };
