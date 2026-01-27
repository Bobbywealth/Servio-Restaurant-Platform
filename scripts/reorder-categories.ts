#!/usr/bin/env ts-node

/**
 * Reorder Sashey's Menu Categories
 * 
 * Arranges categories in a logical order for a Jamaican restaurant menu:
 * 1. Breakfast - Start with breakfast items
 * 2. Daily Special - Limited time offers
 * 3. Entrees - Main dishes
 * 4. Roti - Breads
 * 5. Wings - Popular appetizers
 * 6. Patties - Savory pastries
 * 7. Sides - Accompaniments
 * 8. Soups - Starters
 * 9. Salads - Fresh options
 * 10. Desserts - Sweets
 * 11. Juices and Sodas - Beverages
 * 12. Bread and Buns - Baked goods
 * 13. Snacks - Light bites
 * 14. Catering - Party trays
 */

import dotenv from 'dotenv';
dotenv.config();

import { DatabaseService } from '../src/services/DatabaseService';

const RESTAURANT_ID = 'sasheys-kitchen-union';

// Logical category order for a Jamaican restaurant
// Flow: Breakfast -> Starters -> Mains -> Sides -> Desserts -> Drinks -> Baked goods -> Snacks -> Catering
const CATEGORY_ORDER = [
  'Breakfast',           // Start with breakfast
  'Soups',               // Starters
  'Salads',              // Light options
  'Wings',               // Popular appetizer
  'Patties',             // Savory pastries
  'Entrees',             // Main dishes
  'Roti',                // Breads with meals
  'Sides',               // Accompaniments
  'Catering',            // Party trays (separate section)
  'Desserts',            // Sweets
  'Juices and Sodas',    // Beverages
  'Bread and Buns',      // Baked goods
  'Snacks',              // Light bites
  'Daily Special',       // Limited time offers at the end
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
