#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

async function seedMenuItems() {
  console.log('🌱 Seeding menu items for testing...');
  
  // Initialize database connection
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  // Get the demo restaurant ID
  const restaurant = await db.get('SELECT id FROM restaurants WHERE slug = "demo-restaurant" LIMIT 1');
  if (!restaurant) {
    console.error('❌ Demo restaurant not found. Please create a restaurant first.');
    return;
  }
  
  const restaurantId = restaurant.id;
  
  // Define categories with sort order
  const categories = [
    { name: 'Appetizers', description: 'Start your meal right', sortOrder: 1 },
    { name: 'Entrees', description: 'Main dishes', sortOrder: 2 },
    { name: 'Sides', description: 'Perfect accompaniments', sortOrder: 3 },
    { name: 'Desserts', description: 'Sweet endings', sortOrder: 4 },
    { name: 'Beverages', description: 'Refreshing drinks', sortOrder: 5 },
    { name: 'Voice Specials', description: 'Featured items', sortOrder: 6 }
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
      price: 4.99,
      cost: 1.50,
      category: 'Appetizers',
      preparationTime: 5,
      allergens: ['gluten', 'soy']
    },
    {
      name: 'Festival',
      description: 'Sweet fried dumplings, crispy outside and soft inside',
      price: 3.99,
      cost: 0.80,
      category: 'Appetizers',
      preparationTime: 8,
      allergens: ['gluten']
    },
    {
      name: 'Ackee Fritters',
      description: 'Golden fried fritters made with Jamaicas national fruit',
      price: 6.99,
      cost: 2.00,
      category: 'Appetizers',
      preparationTime: 10,
      allergens: ['gluten', 'eggs']
    },
    {
      name: 'Saltfish Fritters',
      description: 'Crispy codfish fritters with peppers and onions',
      price: 7.99,
      cost: 2.50,
      category: 'Appetizers',
      preparationTime: 10,
      allergens: ['gluten', 'fish', 'eggs']
    },
    {
      name: 'Jerk Chicken Wings',
      description: '6 pieces of spicy jerk-marinated chicken wings',
      price: 9.99,
      cost: 3.50,
      category: 'Appetizers',
      preparationTime: 15,
      allergens: ['soy']
    },
    {
      name: 'Plantain Chips',
      description: 'Crispy fried green plantain chips with jerk mayo',
      price: 5.99,
      cost: 1.20,
      category: 'Appetizers',
      preparationTime: 5,
      allergens: []
    },
    
    // Entrees
    {
      name: 'Curry Goat',
      description: 'Tender goat meat slow-cooked in aromatic curry spices',
      price: 18.99,
      cost: 7.00,
      category: 'Entrees',
      preparationTime: 25,
      allergens: ['dairy']
    },
    {
      name: 'Jerk Chicken',
      description: 'Grilled chicken marinated in authentic jerk spices',
      price: 16.99,
      cost: 5.50,
      category: 'Entrees',
      preparationTime: 20,
      allergens: ['soy']
    },
    {
      name: 'Brown Stew Chicken',
      description: 'Chicken braised in rich brown gravy with vegetables',
      price: 15.99,
      cost: 5.00,
      category: 'Entrees',
      preparationTime: 20,
      allergens: ['soy']
    },
    {
      name: 'Oxtail',
      description: 'Fall-off-the-bone oxtail in savory gravy with butter beans',
      price: 22.99,
      cost: 9.00,
      category: 'Entrees',
      preparationTime: 30,
      allergens: ['soy']
    },
    {
      name: 'Curry Chicken',
      description: 'Chicken pieces simmered in flavorful curry sauce',
      price: 15.99,
      cost: 5.00,
      category: 'Entrees',
      preparationTime: 20,
      allergens: ['dairy']
    },
    {
      name: 'Escovitch Fish',
      description: 'Fried whole snapper topped with pickled vegetables',
      price: 19.99,
      cost: 8.00,
      category: 'Entrees',
      preparationTime: 25,
      allergens: ['fish']
    },
    {
      name: 'Ackee and Saltfish',
      description: 'Jamaicas national dish - ackee cooked with salted cod',
      price: 17.99,
      cost: 6.50,
      category: 'Entrees',
      preparationTime: 15,
      allergens: ['fish']
    },
    {
      name: 'Stew Peas',
      description: 'Red kidney beans cooked with pig tail and dumplings',
      price: 16.99,
      cost: 5.50,
      category: 'Entrees',
      preparationTime: 25,
      allergens: ['gluten', 'pork']
    },
    {
      name: 'Jerk Pork',
      description: 'Tender pork shoulder marinated in jerk spices and grilled',
      price: 17.99,
      cost: 6.00,
      category: 'Entrees',
      preparationTime: 20,
      allergens: ['pork', 'soy']
    },
    {
      name: 'Pepper Steak',
      description: 'Strips of beef sautéed with bell peppers in brown sauce',
      price: 19.99,
      cost: 8.00,
      category: 'Entrees',
      preparationTime: 18,
      allergens: ['soy']
    },
    
    // Sides
    {
      name: 'Rice and Peas',
      description: 'Coconut rice cooked with kidney beans and thyme',
      price: 4.99,
      cost: 1.00,
      category: 'Sides',
      preparationTime: 5,
      allergens: []
    },
    {
      name: 'White Rice',
      description: 'Steamed jasmine rice',
      price: 3.99,
      cost: 0.60,
      category: 'Sides',
      preparationTime: 5,
      allergens: []
    },
    {
      name: 'Fried Plantains',
      description: 'Sweet caramelized ripe plantains',
      price: 4.99,
      cost: 1.20,
      category: 'Sides',
      preparationTime: 8,
      allergens: []
    },
    {
      name: 'Steamed Vegetables',
      description: 'Seasonal vegetables lightly steamed',
      price: 4.99,
      cost: 1.50,
      category: 'Sides',
      preparationTime: 10,
      allergens: []
    },
    {
      name: 'Mac and Cheese',
      description: 'Creamy baked macaroni and cheese',
      price: 5.99,
      cost: 1.80,
      category: 'Sides',
      preparationTime: 5,
      allergens: ['gluten', 'dairy']
    },
    {
      name: 'Cabbage',
      description: 'Sautéed cabbage with carrots and peppers',
      price: 4.99,
      cost: 1.00,
      category: 'Sides',
      preparationTime: 8,
      allergens: []
    },
    {
      name: 'Callaloo',
      description: 'Jamaican greens sautéed with onions and tomatoes',
      price: 5.99,
      cost: 1.50,
      category: 'Sides',
      preparationTime: 10,
      allergens: []
    },
    {
      name: 'Boiled Dumplings',
      description: 'Traditional Jamaican flour dumplings',
      price: 3.99,
      cost: 0.80,
      category: 'Sides',
      preparationTime: 12,
      allergens: ['gluten']
    },
    {
      name: 'Fried Dumplings',
      description: 'Golden fried flour dumplings',
      price: 4.99,
      cost: 1.00,
      category: 'Sides',
      preparationTime: 10,
      allergens: ['gluten']
    },
    {
      name: 'Coleslaw',
      description: 'Creamy cabbage and carrot salad',
      price: 3.99,
      cost: 1.00,
      category: 'Sides',
      preparationTime: 5,
      allergens: ['eggs', 'dairy']
    },
    
    // Desserts
    {
      name: 'Rum Cake',
      description: 'Moist butter cake soaked in rum syrup',
      price: 6.99,
      cost: 2.00,
      category: 'Desserts',
      preparationTime: 5,
      allergens: ['gluten', 'eggs', 'dairy', 'alcohol']
    },
    {
      name: 'Sweet Potato Pudding',
      description: 'Traditional Caribbean dessert with coconut and spices',
      price: 5.99,
      cost: 1.50,
      category: 'Desserts',
      preparationTime: 5,
      allergens: ['dairy']
    },
    {
      name: 'Grater Cake',
      description: 'Sweet coconut candy in pink and white',
      price: 4.99,
      cost: 1.20,
      category: 'Desserts',
      preparationTime: 2,
      allergens: []
    },
    {
      name: 'Banana Fritters',
      description: 'Sweet fried banana dough dusted with cinnamon sugar',
      price: 5.99,
      cost: 1.50,
      category: 'Desserts',
      preparationTime: 8,
      allergens: ['gluten']
    },
    {
      name: 'Coconut Drops',
      description: 'Chewy ginger-spiced coconut candies',
      price: 4.99,
      cost: 1.00,
      category: 'Desserts',
      preparationTime: 2,
      allergens: []
    },
    
    // Beverages
    {
      name: 'Sorrel Drink',
      description: 'Hibiscus tea with ginger and spices (16oz)',
      price: 4.99,
      cost: 1.00,
      category: 'Beverages',
      preparationTime: 3,
      allergens: []
    },
    {
      name: 'Ginger Beer',
      description: 'Spicy homemade ginger beer (16oz)',
      price: 4.99,
      cost: 1.00,
      category: 'Beverages',
      preparationTime: 3,
      allergens: []
    },
    {
      name: 'Carrot Juice',
      description: 'Fresh carrot juice with nutmeg and vanilla (16oz)',
      price: 5.99,
      cost: 1.50,
      category: 'Beverages',
      preparationTime: 5,
      allergens: ['dairy']
    },
    {
      name: 'Pineapple Ginger Juice',
      description: 'Fresh pineapple and ginger blend (16oz)',
      price: 5.99,
      cost: 1.50,
      category: 'Beverages',
      preparationTime: 5,
      allergens: []
    },
    {
      name: 'Fruit Punch',
      description: 'Tropical fruit blend with a hint of rum (16oz)',
      price: 5.99,
      cost: 1.50,
      category: 'Beverages',
      preparationTime: 3,
      allergens: ['alcohol']
    },
    {
      name: 'Jamaican Cola Champagne',
      description: 'Sweet vanilla-flavored soda (12oz can)',
      price: 2.99,
      cost: 0.80,
      category: 'Beverages',
      preparationTime: 1,
      allergens: []
    },
    {
      name: 'Ting Grapefruit Soda',
      description: 'Refreshing grapefruit soda (12oz can)',
      price: 2.99,
      cost: 0.80,
      category: 'Beverages',
      preparationTime: 1,
      allergens: []
    },
    
    // Voice Specials
    {
      name: 'Baby Special Plate',
      description: 'Jerk chicken, curry goat, rice & peas, plantains, and cabbage',
      price: 19.50,
      cost: 7.50,
      category: 'Voice Specials',
      preparationTime: 25,
      allergens: ['soy', 'dairy']
    },
    {
      name: 'Family Feast',
      description: 'Serves 4: Jerk chicken, oxtail, rice & peas, plantains, cabbage, and festival',
      price: 69.99,
      cost: 28.00,
      category: 'Voice Specials',
      preparationTime: 30,
      allergens: ['gluten', 'soy', 'dairy']
    },
    {
      name: 'Lunch Special',
      description: 'Choice of protein with 2 sides and a drink',
      price: 14.99,
      cost: 5.50,
      category: 'Voice Specials',
      preparationTime: 20,
      allergens: ['soy']
    },
    {
      name: 'Seafood Combo',
      description: 'Escovitch fish and saltfish fritters with rice & peas',
      price: 24.99,
      cost: 10.00,
      category: 'Voice Specials',
      preparationTime: 25,
      allergens: ['fish', 'gluten', 'eggs']
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
          SET description = ?, price = ?, cost = ?, category_id = ?,
              preparation_time = ?, allergens = ?, is_available = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          item.description,
          item.price,
          item.cost,
          categoryId,
          item.preparationTime,
          JSON.stringify(item.allergens),
          existingItem.id
        ]);
        updatedCount++;
        console.log(`🔄 Updated: ${item.name}`);
      } else {
        // Insert new item
        const itemId = uuidv4();
        await db.run(`
          INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, price, cost,
            preparation_time, allergens, is_available, images, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, '[]', 0)
        `, [
          itemId,
          restaurantId,
          categoryId,
          item.name,
          item.description,
          item.price,
          item.cost,
          item.preparationTime,
          JSON.stringify(item.allergens)
        ]);
        createdCount++;
        console.log(`✅ Created: ${item.name} - $${item.price}`);
      }
    } catch (err) {
      console.error(`❌ Failed to create/update item ${item.name}:`, err);
    }
  }
  
  // Summary
  const totalItems = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  
  console.log('\n📊 Summary:');
  console.log(`  • Created: ${createdCount} items`);
  console.log(`  • Updated: ${updatedCount} items`);
  console.log(`  • Total menu items: ${totalItems.count}`);
  
  // Show category breakdown
  console.log('\n📋 Menu by Category:');
  for (const catName of Object.keys(categoryMap)) {
    const count = await db.get(
      'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
      [categoryMap[catName]]
    );
    console.log(`  • ${catName}: ${count.count} items`);
  }
}

// Run the script
if (require.main === module) {
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
