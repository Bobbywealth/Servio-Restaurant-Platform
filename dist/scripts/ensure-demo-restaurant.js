#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDemoRestaurant = ensureDemoRestaurant;
const DatabaseService_1 = require("../services/DatabaseService");
async function ensureDemoRestaurant() {
    console.log('🏢 Ensuring demo restaurant exists...');
    try {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Refusing to create demo restaurant in production');
        }
        // Initialize database connection
        await DatabaseService_1.DatabaseService.initialize();
        const dbService = DatabaseService_1.DatabaseService.getInstance();
        const db = dbService.getDatabase();
        const restaurantId = 'demo-restaurant-1';
        // Check if restaurant exists
        const existingRestaurant = await db.get('SELECT id FROM restaurants WHERE id = ?', [restaurantId]);
        if (existingRestaurant) {
            console.log('✅ Demo restaurant already exists');
            return;
        }
        // Create demo restaurant with all required fields
        await db.run(`INSERT INTO restaurants (
        id, name, slug, description, cuisine_type, price_range,
        settings, operating_hours, timezone, closed_message,
        is_active, online_ordering_enabled, pickup_enabled, delivery_enabled,
        delivery_radius, delivery_fee, minimum_order, social_links
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            restaurantId,
            "Sashey's Kitchen", // Using the name from the screenshot
            'sashey-kitchen',
            'Authentic Caribbean cuisine with fresh ingredients and bold flavors',
            'Caribbean',
            '$$',
            JSON.stringify({
                currency: 'USD',
                tax_rate: 0.08,
                service_fee: 0.03
            }),
            JSON.stringify({
                monday: ['09:00', '21:00'],
                tuesday: ['09:00', '21:00'],
                wednesday: ['09:00', '21:00'],
                thursday: ['09:00', '21:00'],
                friday: ['09:00', '22:00'],
                saturday: ['09:00', '22:00'],
                sunday: ['10:00', '20:00']
            }),
            'America/New_York',
            'We\'re temporarily closed right now. Please check back soon!',
            1, // is_active
            1, // online_ordering_enabled
            1, // pickup_enabled
            1, // delivery_enabled
            5, // delivery_radius (5 miles)
            2.99, // delivery_fee
            15.00, // minimum_order
            JSON.stringify({
                website: '',
                facebook: '',
                instagram: '',
                twitter: ''
            })
        ]);
        console.log('✅ Created demo restaurant: Sashey\'s Kitchen');
        // Verify it was created
        const newRestaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
        console.log('📋 Restaurant details:', {
            id: newRestaurant.id,
            name: newRestaurant.name,
            slug: newRestaurant.slug,
            is_active: newRestaurant.is_active
        });
    }
    catch (error) {
        console.error('❌ Error ensuring demo restaurant:', error);
        throw error;
    }
}
// Run the script
if (require.main === module) {
    ensureDemoRestaurant()
        .then(() => {
        console.log('\n✅ Demo restaurant setup completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Demo restaurant setup failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=ensure-demo-restaurant.js.map