/**
 * Script to delete test restaurants from the database
 * Run with: npx ts-node scripts/delete-test-restaurants.ts
 * 
 * This script deletes all restaurants with test/demo slugs or names
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://bobbyc@localhost:5432/servio';

const TEST_SLUGS = [
  'test-restaurant',
  'test-restaurant-demo',
  'test-restaurant-1772089794',
  'test-restaurant-1772089793',
  'dhdjdh',
  'sashyes-kitchen',
  'test2',
  'test',
  'e2etest',
  'demo-restaurant',
  'servio-platform-admin'
];

async function deleteTestRestaurants() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('Connected to database');
    
    // Find test restaurants
    const testPattern = TEST_SLUGS.map(s => `'${s}'`).join(', ');
    const findResult = await pool.query(`
      SELECT id, name, slug 
      FROM restaurants 
      WHERE slug IN (${testPattern})
         OR name ILIKE '%test%'
         OR slug ILIKE '%test%'
    `);
    
    console.log(`Found ${findResult.rows.length} test restaurants:`);
    findResult.rows.forEach(r => console.log(`  - ${r.name} (${r.slug}) [${r.id}]`));
    
    if (findResult.rows.length === 0) {
      console.log('No test restaurants found.');
      return;
    }
    
    const restaurantIds = findResult.rows.map(r => `'${r.id}'`).join(', ');
    
    // Delete in correct order to handle foreign keys
    console.log('\nDeleting related data...');
    
    await pool.query(`DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE restaurant_id IN (${restaurantIds}))`);
    console.log('  - auth_sessions');
    
    await pool.query(`DELETE FROM users WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - users');
    
    await pool.query(`DELETE FROM orders WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - orders');
    
    await pool.query(`DELETE FROM menu_categories WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - menu_categories');
    
    await pool.query(`DELETE FROM menu_items WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - menu_items');
    
    await pool.query(`DELETE FROM inventory_items WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - inventory_items');
    
    await pool.query(`DELETE FROM inventory_transactions WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - inventory_transactions');
    
    await pool.query(`DELETE FROM time_entries WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - time_entries');
    
    await pool.query(`DELETE FROM audit_logs WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - audit_logs');
    
    await pool.query(`DELETE FROM api_keys WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - api_keys');
    
    await pool.query(`DELETE FROM conversations WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - conversations');
    
    await pool.query(`DELETE FROM demo_bookings WHERE restaurant_id IN (${restaurantIds})`);
    console.log('  - demo_bookings');
    
    // Finally delete the restaurants
    await pool.query(`DELETE FROM restaurants WHERE id IN (${restaurantIds})`);
    console.log('  - restaurants');
    
    console.log('\n✅ All test restaurants deleted!');
    
    // Verify
    const remaining = await pool.query('SELECT COUNT(*) as count FROM restaurants');
    console.log(`Remaining restaurants: ${remaining.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

deleteTestRestaurants();
