#!/usr/bin/env node

import { DatabaseService } from '../services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  tags?: string[];
  modifierGroups?: string[];
}

interface ModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

async function setupSasheysKitchen() {
  console.log('🏪 Setting up Sashey\'s Kitchen Jamaican Restaurant...');
  
  await DatabaseService.initialize();
  const dbService = DatabaseService.getInstance();
  const db = dbService.getDatabase();
  
  const restaurantId = 'sasheys-kitchen-union';
  
  // 1. Create/Update Sashey's Kitchen restaurant
  console.log('📍 Creating restaurant record...');
  
  const restaurantData = {
    id: restaurantId,
    name: 'Sasheys Kitchen',
    slug: 'sasheys-kitchen',
    address: '1400 Burnet Avenue, Union, NJ',
    phone: '(908) 686-8178',
    email: 'sasheysk@gmail.com',
    settings: JSON.stringify({
      currency: 'USD',
      timezone: 'America/New_York',
      taxRate: 0.06625, // NJ sales tax rate
      orderTypes: ['dine-in', 'pickup', 'delivery'],
      deliveryPlatforms: ['DoorDash', 'Uber Eats', 'Grub Hub'],
      paymentProcessor: 'clover',
      website: 'www.sasheyskitchen.com'
    }),
    operating_hours: JSON.stringify({
      tue: ['10:00', '20:30'], // Tuesday 10am-8:30pm
      wed: ['10:00', '20:30'], // Wednesday 10am-8:30pm  
      thu: ['10:00', '20:30'], // Thursday 10am-8:30pm
      fri: ['10:00', '20:30'], // Friday 10am-8:30pm
      sat: ['10:00', '20:30']  // Saturday 10am-8:30pm
      // Sunday and Monday closed
    }),
    timezone: 'America/New_York',
    closed_message: 'We\'re currently closed. Open Tuesday-Saturday 10am-8:30pm!',
    is_active: true
  };

  // Insert or update restaurant
  const existingRestaurant = await db.get('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
  
  if (existingRestaurant) {
    await db.run(`
      UPDATE restaurants SET
        name = ?, slug = ?, address = ?, phone = ?, email = ?,
        settings = ?, operating_hours = ?, timezone = ?, 
        closed_message = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      restaurantData.name, restaurantData.slug, restaurantData.address,
      restaurantData.phone, restaurantData.email, restaurantData.settings,
      restaurantData.operating_hours, restaurantData.timezone,
      restaurantData.closed_message, restaurantData.is_active, restaurantId
    ]);
    console.log('🔄 Updated existing Sashey\'s Kitchen restaurant');
  } else {
    await db.run(`
      INSERT INTO restaurants (
        id, name, slug, address, phone, email, settings, 
        operating_hours, timezone, closed_message, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      restaurantData.id, restaurantData.name, restaurantData.slug,
      restaurantData.address, restaurantData.phone, restaurantData.email,
      restaurantData.settings, restaurantData.operating_hours,
      restaurantData.timezone, restaurantData.closed_message, restaurantData.is_active
    ]);
    console.log('✅ Created new Sashey\'s Kitchen restaurant');
  }

  // 2. Create Owner Account
  console.log('👤 Setting up owner account...');
  const ownerPassword = 'sashey123'; // Change this to a secure password
  const passwordHash = await bcrypt.hash(ownerPassword, 10);
  
  const ownerId = 'sasheys-owner';
  const existingOwner = await db.get('SELECT id FROM users WHERE id = ? OR email = ?', [ownerId, 'sasheysk@gmail.com']);
  
  if (existingOwner) {
    await db.run(`
      UPDATE users SET
        name = ?, email = ?, password_hash = ?, role = ?, 
        permissions = ?, restaurant_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR email = ?
    `, [
      'Sashey (Owner)', 'sasheysk@gmail.com', passwordHash, 'owner',
      JSON.stringify(['*']), restaurantId, true, ownerId, 'sasheysk@gmail.com'
    ]);
    console.log('🔄 Updated owner account');
  } else {
    await db.run(`
      INSERT INTO users (
        id, restaurant_id, name, email, password_hash, role, permissions, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ownerId, restaurantId, 'Sashey (Owner)', 'sasheysk@gmail.com',
      passwordHash, 'owner', JSON.stringify(['*']), true
    ]);
    console.log('✅ Created owner account');
  }

  // 3. Load and import menu data
  console.log('📄 Loading menu data...');
  const menuFilePath = path.join(__dirname, '../../data/menu/sasheys_menu_vapi.json');
  
  if (fs.existsSync(menuFilePath)) {
    const menuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));
    
    // Import categories
    console.log('📂 Creating menu categories...');
    const categories = menuData.categories || [];
    const categoryMap: { [key: string]: string } = {};
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const categoryId = uuidv4();
      
      const existingCategory = await db.get(
        'SELECT id FROM menu_categories WHERE name = ? AND restaurant_id = ?',
        [category.name, restaurantId]
      );
      
      if (!existingCategory) {
        await db.run(`
          INSERT INTO menu_categories (
            id, restaurant_id, name, description, sort_order, is_active
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [categoryId, restaurantId, category.name, category.description || '', i, true]);
        
        categoryMap[category.id] = categoryId;
        console.log(`✅ Created category: ${category.name}`);
      } else {
        categoryMap[category.id] = existingCategory.id;
        console.log(`🔄 Using existing category: ${category.name}`);
      }
    }
    
    // Import menu items
    console.log('🍽️ Creating menu items...');
    const items = menuData.items || [];
    let itemCount = 0;
    
    for (const item of items) {
      const itemId = uuidv4();
      const categoryId = categoryMap[item.categoryId];
      
      if (!categoryId) {
        console.log(`⚠️  Skipping item ${item.name} - category not found`);
        continue;
      }
      
      const existingItem = await db.get(
        'SELECT id FROM menu_items WHERE name = ? AND restaurant_id = ?',
        [item.name, restaurantId]
      );
      
      if (!existingItem) {
        await db.run(`
          INSERT INTO menu_items (
            id, restaurant_id, category_id, name, description, price,
            tags, is_available, images, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          itemId, restaurantId, categoryId, item.name,
          item.description || '', item.price || 0,
          JSON.stringify(item.tags || []), true,
          JSON.stringify(item.images || []), itemCount
        ]);
        
        itemCount++;
        console.log(`✅ Created menu item: ${item.name} - $${item.price}`);
      } else {
        console.log(`🔄 Menu item already exists: ${item.name}`);
      }
    }
    
    console.log(`📊 Menu import complete: ${itemCount} items processed`);
  } else {
    console.log('⚠️  Menu file not found, using basic setup');
  }

  // Summary
  const userCount = await db.get('SELECT COUNT(*) as count FROM users WHERE restaurant_id = ?', [restaurantId]);
  const menuItemCount = await db.get('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
  const categoryCount = await db.get('SELECT COUNT(*) as count FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);

  console.log('\n🎉 Sashey\'s Kitchen Setup Complete!');
  console.log('📊 Summary:');
  console.log(`  • Restaurant: ${restaurantData.name}`);
  console.log(`  • Address: ${restaurantData.address}`);
  console.log(`  • Phone: ${restaurantData.phone}`);
  console.log(`  • Email: ${restaurantData.email}`);
  console.log(`  • Users: ${userCount.count}`);
  console.log(`  • Menu Categories: ${categoryCount.count}`);
  console.log(`  • Menu Items: ${menuItemCount.count}`);
  console.log('\n🔑 Owner Login:');
  console.log(`  • Email: sasheysk@gmail.com`);
  console.log(`  • Password: ${ownerPassword}`);
  console.log('\n⏰ Operating Hours: Tuesday-Saturday 10am-8:30pm');
  console.log('🚚 Order Types: Dine-in, Pickup, Delivery (DoorDash, Uber Eats, Grub Hub)');
}

// Run the setup
if (require.main === module) {
  setupSasheysKitchen()
    .then(() => {
      console.log('\n✅ Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { setupSasheysKitchen };