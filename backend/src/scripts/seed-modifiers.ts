#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

async function seedModifiers() {
  console.log('🌱 Seeding modifiers and add-ons for testing...');
  
  // Initialize database connection
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  // Get the demo restaurant ID - try multiple possible slugs
  let restaurant = await db.get('SELECT id FROM restaurants WHERE slug = ? LIMIT 1', ['demo-restaurant-1']);
  if (!restaurant) {
    restaurant = await db.get('SELECT id FROM restaurants WHERE slug = ? LIMIT 1', ['demo-restaurant']);
  }
  if (!restaurant) {
    restaurant = await db.get('SELECT id FROM restaurants WHERE name LIKE ? LIMIT 1', ['%Demo%']);
  }
  if (!restaurant) {
    console.error('❌ Demo restaurant not found. Please create a restaurant first.');
    return;
  }
  
  const restaurantId = restaurant.id;
  
  // Define modifier groups with their options
  const modifierGroups = [
    {
      name: 'Spice Level',
      description: 'Choose your heat level',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 1,
      options: [
        { name: 'Mild', description: 'Easy on the spice', priceModifier: 0 },
        { name: 'Medium', description: 'Traditional Jamaican heat', priceModifier: 0 },
        { name: 'Hot', description: 'Extra spicy', priceModifier: 0 },
        { name: 'Fire', description: 'For the brave only!', priceModifier: 0.50 }
      ]
    },
    {
      name: 'Protein Choice',
      description: 'Select your protein',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 2,
      options: [
        { name: 'Jerk Chicken', description: '', priceModifier: 0 },
        { name: 'Curry Chicken', description: '', priceModifier: 0 },
        { name: 'Brown Stew Chicken', description: '', priceModifier: 0 },
        { name: 'Curry Goat', description: '', priceModifier: 2.00 },
        { name: 'Jerk Pork', description: '', priceModifier: 1.00 },
        { name: 'Oxtail', description: '', priceModifier: 4.00 }
      ]
    },
    {
      name: 'Side Selections',
      description: 'Choose 2 sides',
      minSelections: 2,
      maxSelections: 2,
      isRequired: true,
      sortOrder: 3,
      options: [
        { name: 'Rice and Peas', description: '', priceModifier: 0 },
        { name: 'White Rice', description: '', priceModifier: 0 },
        { name: 'Fried Plantains', description: '', priceModifier: 0 },
        { name: 'Steamed Vegetables', description: '', priceModifier: 0 },
        { name: 'Cabbage', description: '', priceModifier: 0 },
        { name: 'Mac and Cheese', description: '', priceModifier: 1.00 },
        { name: 'Callaloo', description: '', priceModifier: 1.00 }
      ]
    },
    {
      name: 'Extra Protein',
      description: 'Add more meat to your dish',
      minSelections: 0,
      maxSelections: 3,
      isRequired: false,
      sortOrder: 4,
      options: [
        { name: 'Extra Chicken', description: '4oz portion', priceModifier: 5.00 },
        { name: 'Extra Goat', description: '4oz portion', priceModifier: 6.00 },
        { name: 'Extra Pork', description: '4oz portion', priceModifier: 5.50 },
        { name: 'Extra Oxtail', description: '2 pieces', priceModifier: 8.00 }
      ]
    },
    {
      name: 'Extra Sides',
      description: 'Add additional sides',
      minSelections: 0,
      maxSelections: 5,
      isRequired: false,
      sortOrder: 5,
      options: [
        { name: 'Extra Rice and Peas', description: 'Side portion', priceModifier: 3.00 },
        { name: 'Extra Plantains', description: 'Side portion', priceModifier: 3.00 },
        { name: 'Extra Vegetables', description: 'Side portion', priceModifier: 3.00 },
        { name: 'Festival', description: '2 pieces', priceModifier: 2.50 },
        { name: 'Fried Dumplings', description: '2 pieces', priceModifier: 3.00 },
        { name: 'Extra Cabbage', description: 'Side portion', priceModifier: 3.00 }
      ]
    },
    {
      name: 'Sauce Options',
      description: 'Choose your sauce',
      minSelections: 0,
      maxSelections: 3,
      isRequired: false,
      sortOrder: 6,
      options: [
        { name: 'Jerk Sauce', description: 'Spicy jerk marinade', priceModifier: 0.50 },
        { name: 'Scotch Bonnet Sauce', description: 'Extra hot pepper sauce', priceModifier: 0.50 },
        { name: 'Curry Sauce', description: 'Creamy curry sauce', priceModifier: 0.75 },
        { name: 'Brown Gravy', description: 'Rich savory gravy', priceModifier: 0.75 },
        { name: 'Garlic Butter', description: 'Herb garlic butter', priceModifier: 0.50 }
      ]
    },
    {
      name: 'Drink Size',
      description: 'Select your drink size',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 7,
      options: [
        { name: 'Small (12oz)', description: '', priceModifier: 0 },
        { name: 'Medium (16oz)', description: '', priceModifier: 1.00 },
        { name: 'Large (24oz)', description: '', priceModifier: 2.00 }
      ]
    },
    {
      name: 'Add Ice',
      description: 'Ice preference',
      minSelections: 1,
      maxSelections: 1,
      isRequired: false,
      sortOrder: 8,
      options: [
        { name: 'No Ice', description: '', priceModifier: 0 },
        { name: 'Light Ice', description: '', priceModifier: 0 },
        { name: 'Regular Ice', description: '', priceModifier: 0 },
        { name: 'Extra Ice', description: '', priceModifier: 0 }
      ]
    },
    {
      name: 'Special Instructions',
      description: 'Customize your order',
      minSelections: 0,
      maxSelections: 5,
      isRequired: false,
      sortOrder: 9,
      options: [
        { name: 'No Onions', description: '', priceModifier: 0 },
        { name: 'No Peppers', description: '', priceModifier: 0 },
        { name: 'No Garlic', description: '', priceModifier: 0 },
        { name: 'Extra Vegetables', description: '', priceModifier: 1.00 },
        { name: 'Well Done', description: '', priceModifier: 0 },
        { name: 'Light Seasoning', description: '', priceModifier: 0 }
      ]
    },
    {
      name: 'Toppings',
      description: 'Add toppings to your dessert',
      minSelections: 0,
      maxSelections: 3,
      isRequired: false,
      sortOrder: 10,
      options: [
        { name: 'Whipped Cream', description: '', priceModifier: 0.75 },
        { name: 'Ice Cream Scoop', description: 'Vanilla', priceModifier: 2.00 },
        { name: 'Chocolate Drizzle', description: '', priceModifier: 0.50 },
        { name: 'Caramel Sauce', description: '', priceModifier: 0.50 },
        { name: 'Fresh Fruit', description: '', priceModifier: 1.50 }
      ]
    },
    {
      name: 'Combo Upgrade',
      description: 'Make it a combo',
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      sortOrder: 11,
      options: [
        { name: 'Add Drink', description: 'Any soft drink', priceModifier: 2.00 },
        { name: 'Add Side & Drink', description: 'Side and drink', priceModifier: 4.50 },
        { name: 'Add Dessert & Drink', description: 'Dessert and drink', priceModifier: 6.00 }
      ]
    }
  ];
  
  // Create modifier groups and their options
  const groupMap: { [key: string]: string } = {};
  let groupsCreated = 0;
  let groupsUpdated = 0;
  let optionsCreated = 0;
  
  for (const group of modifierGroups) {
    try {
      // Check if modifier group already exists
      let existingGroup = await db.get(
        'SELECT id FROM modifier_groups WHERE name = ? AND restaurant_id = ?',
        [group.name, restaurantId]
      );
      
      let groupId: string;
      
      if (existingGroup) {
        groupId = existingGroup.id;
        // Update existing group
        await db.run(`
          UPDATE modifier_groups 
          SET description = ?, min_selection = ?, max_selection = ?, 
              is_required = ?, sort_order = ?, is_active = TRUE,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          group.description,
          group.minSelections,
          group.maxSelections,
          group.isRequired ? 1 : 0,
          group.sortOrder,
          groupId
        ]);
        groupsUpdated++;
        console.log(`🔄 Updated modifier group: ${group.name}`);
      } else {
        // Create new group
        groupId = uuidv4();
        await db.run(`
          INSERT INTO modifier_groups (
            id, restaurant_id, name, description, min_selection, max_selection,
            is_required, sort_order, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
        `, [
          groupId,
          restaurantId,
          group.name,
          group.description,
          group.minSelections,
          group.maxSelections,
          group.isRequired ? 1 : 0,
          group.sortOrder
        ]);
        groupsCreated++;
        console.log(`✅ Created modifier group: ${group.name}`);
      }
      
      groupMap[group.name] = groupId;
      
      // Delete existing options for this group (we'll recreate them)
      await db.run('DELETE FROM modifier_options WHERE modifier_group_id = ?', [groupId]);
      
      // Create options for this group
      for (let i = 0; i < group.options.length; i++) {
        const option = group.options[i];
        const optionId = uuidv4();
        
        await db.run(`
          INSERT INTO modifier_options (
            id, modifier_group_id, name, description, price_modifier,
            sort_order, is_available
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)
        `, [
          optionId,
          groupId,
          option.name,
          option.description || null,
          option.priceModifier,
          i
        ]);
        optionsCreated++;
      }
      
      console.log(`  → Added ${group.options.length} options`);
      
    } catch (err) {
      console.error(`❌ Failed to create/update modifier group ${group.name}:`, err);
    }
  }
  
  console.log('\n📊 Modifier Groups Summary:');
  console.log(`  • Created: ${groupsCreated} groups`);
  console.log(`  • Updated: ${groupsUpdated} groups`);
  console.log(`  • Total options created: ${optionsCreated}`);
  
  // Now assign modifiers to menu items
  console.log('\n🔗 Linking modifiers to menu items...');
  
  // Get all menu items by category
  const entrees = await db.all(
    `SELECT mi.id, mi.name 
     FROM menu_items mi 
     JOIN menu_categories mc ON mi.category_id = mc.id 
     WHERE mc.name = 'Entrees' AND mi.restaurant_id = ?`,
    [restaurantId]
  );
  
  const beverages = await db.all(
    `SELECT mi.id, mi.name 
     FROM menu_items mi 
     JOIN menu_categories mc ON mi.category_id = mc.id 
     WHERE mc.name = 'Beverages' AND mi.restaurant_id = ?`,
    [restaurantId]
  );
  
  const desserts = await db.all(
    `SELECT mi.id, mi.name 
     FROM menu_items mi 
     JOIN menu_categories mc ON mi.category_id = mc.id 
     WHERE mc.name = 'Desserts' AND mi.restaurant_id = ?`,
    [restaurantId]
  );
  
  const appetizers = await db.all(
    `SELECT mi.id, mi.name 
     FROM menu_items mi 
     JOIN menu_categories mc ON mi.category_id = mc.id 
     WHERE mc.name = 'Appetizers' AND mi.restaurant_id = ?`,
    [restaurantId]
  );
  
  const voiceSpecials = await db.all(
    `SELECT mi.id, mi.name 
     FROM menu_items mi 
     JOIN menu_categories mc ON mi.category_id = mc.id 
     WHERE mc.name = 'Voice Specials' AND mi.restaurant_id = ?`,
    [restaurantId]
  );
  
  // Link modifiers to entrees
  for (const entree of entrees) {
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [entree.id]);
    
    const modifiersToAdd = [
      groupMap['Spice Level'],
      groupMap['Extra Protein'],
      groupMap['Extra Sides'],
      groupMap['Sauce Options'],
      groupMap['Special Instructions'],
      groupMap['Combo Upgrade']
    ];
    
    for (let i = 0; i < modifiersToAdd.length; i++) {
      if (modifiersToAdd[i]) {
        await db.run(`
          INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), entree.id, modifiersToAdd[i], i]);
      }
    }
    console.log(`  ✓ Linked modifiers to: ${entree.name}`);
  }
  
  // Link modifiers to beverages
  for (const beverage of beverages) {
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [beverage.id]);
    
    // Only fresh juices get size options, not canned drinks
    if (!beverage.name.includes('Champagne') && !beverage.name.includes('Ting')) {
      const modifiersToAdd = [
        groupMap['Drink Size'],
        groupMap['Add Ice']
      ];
      
      for (let i = 0; i < modifiersToAdd.length; i++) {
        if (modifiersToAdd[i]) {
          await db.run(`
            INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), beverage.id, modifiersToAdd[i], i]);
        }
      }
      console.log(`  ✓ Linked modifiers to: ${beverage.name}`);
    }
  }
  
  // Link modifiers to desserts
  for (const dessert of desserts) {
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [dessert.id]);
    
    const modifiersToAdd = [
      groupMap['Toppings']
    ];
    
    for (let i = 0; i < modifiersToAdd.length; i++) {
      if (modifiersToAdd[i]) {
        await db.run(`
          INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), dessert.id, modifiersToAdd[i], i]);
      }
    }
    console.log(`  ✓ Linked modifiers to: ${dessert.name}`);
  }
  
  // Link modifiers to appetizers
  for (const appetizer of appetizers) {
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [appetizer.id]);
    
    // Only add spice level for spicy appetizers
    if (appetizer.name.includes('Jerk') || appetizer.name.includes('Patty')) {
      const modifiersToAdd = [
        groupMap['Spice Level'],
        groupMap['Sauce Options']
      ];
      
      for (let i = 0; i < modifiersToAdd.length; i++) {
        if (modifiersToAdd[i]) {
          await db.run(`
            INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), appetizer.id, modifiersToAdd[i], i]);
        }
      }
      console.log(`  ✓ Linked modifiers to: ${appetizer.name}`);
    }
  }
  
  // Link modifiers to voice specials (combo items)
  for (const special of voiceSpecials) {
    await db.run('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?', [special.id]);
    
    // Lunch Special gets protein choice
    if (special.name.includes('Lunch Special')) {
      const modifiersToAdd = [
        groupMap['Protein Choice'],
        groupMap['Side Selections'],
        groupMap['Spice Level'],
        groupMap['Sauce Options'],
        groupMap['Special Instructions']
      ];
      
      for (let i = 0; i < modifiersToAdd.length; i++) {
        if (modifiersToAdd[i]) {
          await db.run(`
            INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), special.id, modifiersToAdd[i], i]);
        }
      }
    } else {
      // Other specials get standard modifiers
      const modifiersToAdd = [
        groupMap['Spice Level'],
        groupMap['Extra Protein'],
        groupMap['Extra Sides'],
        groupMap['Sauce Options'],
        groupMap['Special Instructions']
      ];
      
      for (let i = 0; i < modifiersToAdd.length; i++) {
        if (modifiersToAdd[i]) {
          await db.run(`
            INSERT INTO menu_item_modifiers (id, menu_item_id, modifier_group_id, sort_order)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), special.id, modifiersToAdd[i], i]);
        }
      }
    }
    console.log(`  ✓ Linked modifiers to: ${special.name}`);
  }
  
  // Final summary
  const totalModifierLinks = await db.get(
    'SELECT COUNT(*) as count FROM menu_item_modifiers'
  );
  
  console.log('\n🎉 Modifier Linking Complete:');
  console.log(`  • Total modifier-item links: ${totalModifierLinks.count}`);
  console.log('\n💡 Modifier Groups Available:');
  for (const groupName of Object.keys(groupMap)) {
    const optionCount = await db.get(
      'SELECT COUNT(*) as count FROM modifier_options WHERE modifier_group_id = ?',
      [groupMap[groupName]]
    );
    console.log(`  • ${groupName}: ${optionCount.count} options`);
  }
}

// Run the script
if (require.main === module) {
  seedModifiers()
    .then(() => {
      console.log('\n✅ Modifier seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Modifier seeding failed:', error);
      process.exit(1);
    });
}

export { seedModifiers };
