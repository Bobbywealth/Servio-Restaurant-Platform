#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

interface VapiMenuData {
  store: {
    id: string;
    name: string;
    currency: string;
    taxRate: number;
  };
  categories: VapiCategory[];
  defaults?: {
    dinnerModifierGroups?: VapiModifierGroup[];
  };
}

interface VapiCategory {
  id: string;
  name: string;
  items: VapiMenuItem[];
}

interface VapiMenuItem {
  id: string;
  name: string;
  description?: string;
  available: boolean;
  tags?: string[];
  price?: number | null;
  modifierGroups?: VapiModifierGroup[];
}

interface VapiModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: VapiModifierOption[];
}

interface VapiModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

async function importSasheysMenu() {
  console.log('🍽️ Importing complete Sashey\'s Kitchen menu...');
  
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  const restaurantId = 'sasheys-kitchen-union';
  
  // Load menu data
  const menuFilePath = path.join(__dirname, '../../data/menu/sasheys_menu_vapi.json');
  
  if (!fs.existsSync(menuFilePath)) {
    console.error('❌ Menu file not found:', menuFilePath);
    return;
  }
  
  console.log('📄 Reading menu data...');
  const menuData: VapiMenuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));
  
  // Clear existing menu items and categories for clean import
  console.log('🧹 Cleaning existing menu data...');
  await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ?)', [restaurantId]);
  await db.run('DELETE FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE restaurant_id = ?)', [restaurantId]);
  await db.run('DELETE FROM modifier_groups WHERE restaurant_id = ?', [restaurantId]);
  await db.run('DELETE FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  await db.run('DELETE FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);
  
  // Import categories and items
  console.log('📂 Importing categories and menu items...');
  
  for (let catIndex = 0; catIndex < menuData.categories.length; catIndex++) {
    const category = menuData.categories[catIndex];
    const categoryId = uuidv4();
    
    // Create category
    await db.run(`
      INSERT INTO menu_categories (
        id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [categoryId, restaurantId, category.name, '', catIndex, true]);
    
    console.log(`✅ Created category: ${category.name} (${category.items.length} items)`);
    
    // Import items for this category
    for (let itemIndex = 0; itemIndex < category.items.length; itemIndex++) {
      const item = category.items[itemIndex];
      const itemId = uuidv4();
      
      // Determine base price - use the lowest price from size modifiers if price is null
      let basePrice = item.price || 0;
      if (!item.price && item.modifierGroups) {
        const sizeGroup = item.modifierGroups.find(g => g.id === 'size');
        if (sizeGroup && sizeGroup.options.length > 0) {
          basePrice = Math.min(...sizeGroup.options.map(opt => opt.priceDelta));
        }
      }
      
      // Create menu item
      await db.run(`
        INSERT INTO menu_items (
          id, restaurant_id, category_id, name, description, price,
          tags, is_available, images, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        itemId, restaurantId, categoryId, item.name,
        item.description || '', basePrice,
        JSON.stringify(item.tags || []), item.available,
        JSON.stringify([]), itemIndex
      ]);
      
      console.log(`  ✅ ${item.name} - $${basePrice.toFixed(2)}`);
      
      // Import modifier groups for this item
      if (item.modifierGroups) {
        for (const modGroup of item.modifierGroups) {
          const modGroupId = uuidv4();
          
          // Create modifier group
          await db.run(`
            INSERT INTO modifier_groups (
              id, restaurant_id, name, is_required, min_selection, max_selection, 
              sort_order, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            modGroupId, restaurantId, modGroup.name,
            modGroup.required || false,
            modGroup.minSelect || 0,
            modGroup.maxSelect || 1,
            0, true
          ]);
          
          // Create modifier options
          for (let optIndex = 0; optIndex < modGroup.options.length; optIndex++) {
            const option = modGroup.options[optIndex];
            const optionId = uuidv4();
            
            await db.run(`
              INSERT INTO modifier_options (
                id, modifier_group_id, name, price_modifier, sort_order, is_available,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              optionId, modGroupId, option.name, option.priceDelta,
              optIndex, true
            ]);
          }
          
          // Link modifier group to menu item
          await db.run(`
            INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), itemId, modGroupId, 0]);
        }
      }
    }
  }
  
  // Add some default modifier groups from the JSON (if they exist)
  if (menuData.defaults?.dinnerModifierGroups) {
    console.log('🔧 Adding default modifier groups...');
    
    for (const defaultGroup of menuData.defaults.dinnerModifierGroups) {
      const modGroupId = uuidv4();
      
      await db.run(`
        INSERT INTO modifier_groups (
          id, restaurant_id, name, is_required, min_selection, max_selection,
          sort_order, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        modGroupId, restaurantId, `Default: ${defaultGroup.name}`,
        defaultGroup.required || false,
        defaultGroup.minSelect || 0,
        defaultGroup.maxSelect || 1,
        0, true
      ]);
      
      for (let optIndex = 0; optIndex < defaultGroup.options.length; optIndex++) {
        const option = defaultGroup.options[optIndex];
        const optionId = uuidv4();
        
        await db.run(`
          INSERT INTO modifier_options (
            id, modifier_group_id, name, price_modifier, sort_order, is_available,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          optionId, modGroupId, option.name, option.priceDelta,
          optIndex, true
        ]);
      }
      
      console.log(`✅ Created default modifier: ${defaultGroup.name}`);
    }
  }
  
  // Final summary
  const categoryCount = await db.get('SELECT COUNT(*) as count FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);
  const itemCount = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  const modGroupCount = await db.get('SELECT COUNT(*) as count FROM modifier_groups WHERE restaurant_id = ?', [restaurantId]);
  const modOptionCount = await db.get('SELECT COUNT(*) as count FROM modifier_options WHERE modifier_group_id IN (SELECT id FROM modifier_groups WHERE restaurant_id = ?)', [restaurantId]);
  
  console.log('\n🎉 Menu Import Complete!');
  console.log('📊 Final Summary:');
  console.log(`  • Categories: ${categoryCount.count}`);
  console.log(`  • Menu Items: ${itemCount.count}`);
  console.log(`  • Modifier Groups: ${modGroupCount.count}`);
  console.log(`  • Modifier Options: ${modOptionCount.count}`);
  
  // Show sample items per category
  console.log('\n📋 Menu Preview:');
  const categories = await db.all(`
    SELECT c.name, COUNT(mi.id) as item_count 
    FROM menu_categories c 
    LEFT JOIN menu_items mi ON c.id = mi.category_id 
    WHERE c.restaurant_id = ? 
    GROUP BY c.id, c.name 
    ORDER BY c.sort_order
  `, [restaurantId]);
  
  categories.forEach((cat: any) => {
    console.log(`  • ${cat.name}: ${cat.item_count} items`);
  });
}

// Run the import
if (require.main === module) {
  importSasheysMenu()
    .then(() => {
      console.log('\n✅ Menu import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Menu import failed:', error);
      process.exit(1);
    });
}

export { importSasheysMenu };