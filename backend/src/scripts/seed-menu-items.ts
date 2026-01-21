#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

async function seedMenuItems() {
  console.log('🌱 Seeding menu items for testing...');
  
  // Initialize database connection
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  // Prefer configured/default restaurant slug; fall back to first restaurant.
  const preferredSlug = process.env.DEFAULT_RESTAURANT_SLUG || DatabaseService.DEFAULT_RESTAURANT_SLUG;
  let restaurant = await db.get('SELECT id FROM restaurants WHERE slug = ? LIMIT 1', [preferredSlug]);
  if (!restaurant) {
    restaurant = await db.get('SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1');
  }
  if (!restaurant) {
    console.error('❌ No restaurant found. Please create a restaurant first.');
    return;
  }
  
  const restaurantId = restaurant.id;
  
  // Define categories with sort order
  const categories = [
    { name: 'Appetizers', description: 'Small bites to start', sortOrder: 1 },
    { name: 'Dinners', description: 'Large plates served with rice, cabbage, and plantains', sortOrder: 2 },
    { name: 'Lunch Specials', description: 'Available 11am-3pm daily', sortOrder: 3 },
    { name: 'Sides', description: 'Add-ons and extras', sortOrder: 4 },
    { name: 'Beverages', description: 'Jamaican sodas and juices', sortOrder: 5 }
  ];
  
  // Create or update categories
  const categoryMap: { [key: string]: string } = {};
  
  for (const cat of categories) {
    let category = await db.get(
      'SELECT id FROM menu_categories WHERE name = ? AND restaurant_id = ?',
      [cat.name, restaurantId]
    );
    
    if (!category) {
      const categoryId = uuidv4();
      await db.run(`
        INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
      `, [categoryId, restaurantId, cat.name, cat.description, cat.sortOrder]);
      categoryMap[cat.name] = categoryId;
      console.log(`✅ Created category: ${cat.name}`);
    } else {
      await db.run(`
        UPDATE menu_categories 
        SET description = ?, sort_order = ? 
        WHERE id = ?
      `, [cat.description, cat.sortOrder, category.id]);
      categoryMap[cat.name] = category.id;
      console.log(`🔄 Updated category: ${cat.name}`);
    }
  }
  
  // Define menu items
  const menuItems = [
    // Appetizers
    {
      name: 'Jamaican Beef Patty',
      description: 'Flaky pastry filled with spiced ground beef',
      price: 4.50,
      category: 'Appetizers',
      tags: ['snack', 'patty']
    },
    {
      name: 'Jerk Chicken Wings',
      description: '6 spicy wings marinated in our house jerk blend',
      price: 9.99,
      category: 'Appetizers',
      tags: ['spicy', 'wings']
    },
    {
      name: 'Festival',
      description: '3 sweet fried dumplings',
      price: 3.50,
      category: 'Appetizers',
      tags: ['side', 'sweet']
    },
    
    // Dinners
    {
      name: 'Oxtail Dinner',
      description: 'Large portion of fall-off-the-bone oxtail in rich gravy. Includes rice & peas or white rice, and cabbage.',
      price: 24.99,
      category: 'Dinners',
      tags: ['dinner', 'popular', 'oxtail']
    },
    {
      name: 'Curry Goat Dinner',
      description: 'Tender goat meat in authentic Jamaican curry. Includes rice & peas or white rice, and cabbage.',
      price: 19.99,
      category: 'Dinners',
      tags: ['dinner', 'spicy', 'goat']
    },
    {
      name: 'Jerk Chicken Dinner',
      description: 'Our signature spicy jerk chicken. Includes rice & peas or white rice, and cabbage.',
      price: 16.99,
      category: 'Dinners',
      tags: ['dinner', 'jerk', 'chicken']
    },
    {
      name: 'Curry Chicken Dinner',
      description: 'Chicken pieces simmered in savory curry gravy. Includes rice & peas or white rice, and cabbage.',
      price: 15.99,
      category: 'Dinners',
      tags: ['dinner', 'curry']
    },
    {
      name: 'Brown Stew Chicken Dinner',
      description: 'Caramelized chicken braised with carrots and peppers. Includes rice & peas or white rice, and cabbage.',
      price: 15.99,
      category: 'Dinners',
      tags: ['dinner', 'stew']
    },
    {
      name: 'Ackee & Saltfish Dinner',
      description: 'Jamaicas national dish. Sautéed with onions and peppers. Includes rice & peas or white rice, and cabbage.',
      price: 18.99,
      category: 'Dinners',
      tags: ['dinner', 'seafood', 'ackee']
    },
    
    // Sides
    {
      name: 'Fried Plantains',
      description: 'Sweet, ripe fried plantains (5 pieces)',
      price: 4.50,
      category: 'Sides',
      tags: ['side', 'sweet']
    },
    {
      name: 'Rice & Peas',
      description: 'Traditional kidney beans and coconut milk rice',
      price: 5.99,
      category: 'Sides',
      tags: ['side']
    },
    {
      name: 'Mac and Cheese',
      description: 'Baked cheesy macaroni',
      price: 6.50,
      category: 'Sides',
      tags: ['side', 'cheese']
    },
    
    // Beverages
    {
      name: 'D&G Kola Champagne',
      description: 'Jamaican Kola Champagne soda',
      price: 2.75,
      category: 'Beverages',
      tags: ['drink', 'soda']
    },
    {
      name: 'Ting',
      description: 'Grapefruit sparkling soda',
      price: 2.75,
      category: 'Beverages',
      tags: ['drink', 'soda']
    },
    {
      name: 'Homemade Ginger Beer',
      description: 'Spicy and refreshing homemade ginger beer',
      price: 4.99,
      category: 'Beverages',
      tags: ['drink', 'homemade']
    },
    {
      name: 'Homemade Sorrel',
      description: 'Sweet hibiscus and ginger drink',
      price: 4.99,
      category: 'Beverages',
      tags: ['drink', 'homemade']
    }
  ];
  
  // Insert menu items
  let createdCount = 0;
  let updatedCount = 0;
  
  for (const item of menuItems) {
    try {
      // Check if item already exists
      const existingItem = await db.get(
        'SELECT id FROM menu_items WHERE name = ? AND restaurant_id = ?',
        [item.name, restaurantId]
      );
      
      const categoryId = categoryMap[item.category];
      
      if (existingItem) {
        // Update existing item
        await db.run(`
          UPDATE menu_items 
          SET description = ?, price = ?, category_id = ?,
              tags = ?, is_available = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          item.description,
          item.price,
          categoryId,
          JSON.stringify(item.tags || []),
          existingItem.id
        ]);
        updatedCount++;
        console.log(`🔄 Updated: ${item.name}`);
      } else {
        // Insert new item
        const itemId = uuidv4();
        await db.run(`
          INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, price,
            tags, is_available, images, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, '[]', 0)
        `, [
          itemId,
          restaurantId,
          categoryId,
          item.name,
          item.description,
          item.price,
          JSON.stringify(item.tags || [])
        ]);
        createdCount++;
        console.log(`✅ Created: ${item.name} - $${item.price}`);
      }
    } catch (err) {
      console.error(`❌ Failed to create/update item ${item.name}:`, err);
    }
  }
  
  // Summary
  const totalItemsCount = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  
  console.log('\n📊 Summary:');
  console.log(`  • Created: ${createdCount} items`);
  console.log(`  • Updated: ${updatedCount} items`);
  console.log(`  • Total menu items: ${totalItemsCount.count}`);
  
  // Show category breakdown
  console.log('\n📋 Menu by Category:');
  for (const catName of Object.keys(categoryMap)) {
    const countData = await db.get(
      'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
      [categoryMap[catName]]
    );
    console.log(`  • ${catName}: ${countData.count} items`);
  }
}

// Run the script
if (require.main === module || process.env.RUN_SEED === 'true') {
  seedMenuItems()
    .then(() => {
      console.log('\n✅ Menu seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Menu seeding failed:', error);
      process.exit(1);
    });
}

export { seedMenuItems };
