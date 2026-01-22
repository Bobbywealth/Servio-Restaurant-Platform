#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeDemoData = purgeDemoData;
const DatabaseService_1 = require("../services/DatabaseService");
const logger_1 = require("../utils/logger");
function envBool(name, defaultValue = false) {
    const raw = process.env[name];
    if (!raw)
        return defaultValue;
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(raw).toLowerCase());
}
async function purgeDemoData() {
    const confirmed = envBool('CONFIRM_PURGE_DEMO_DATA', false);
    if (!confirmed) {
        throw new Error('Refusing to purge demo data. Set CONFIRM_PURGE_DEMO_DATA=true to proceed.');
    }
    logger_1.logger.warn('Purging demo data (DESTRUCTIVE).');
    await DatabaseService_1.DatabaseService.initialize();
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const demoRestaurantIds = ['demo-restaurant-1'];
    const demoSlugs = ['demo-restaurant'];
    const demoEmails = [
        'admin@servio.com',
        'owner@demo.servio',
        'manager@demo.servio',
        'staff@demo.servio'
    ];
    // Delete in child->parent order. Best-effort: ignore missing tables/columns.
    for (const rid of demoRestaurantIds) {
        const statements = [
            `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)`,
            `DELETE FROM orders WHERE restaurant_id = ?`,
            `DELETE FROM receipts WHERE restaurant_id = ?`,
            `DELETE FROM receipt_line_items WHERE receipt_id IN (SELECT id FROM receipts WHERE restaurant_id = ?)`,
            `DELETE FROM inventory_transactions WHERE restaurant_id = ?`,
            `DELETE FROM inventory_items WHERE restaurant_id = ?`,
            `DELETE FROM tasks WHERE restaurant_id = ?`,
            `DELETE FROM time_entries WHERE restaurant_id = ?`,
            `DELETE FROM marketing_sends WHERE campaign_id IN (SELECT id FROM marketing_campaigns WHERE restaurant_id = ?)`,
            `DELETE FROM marketing_campaigns WHERE restaurant_id = ?`,
            `DELETE FROM customers WHERE restaurant_id = ?`,
            `DELETE FROM menu_items WHERE restaurant_id = ?`,
            `DELETE FROM menu_categories WHERE restaurant_id = ?`,
            `DELETE FROM users WHERE restaurant_id = ?`,
            `DELETE FROM audit_logs WHERE restaurant_id = ?`,
            `DELETE FROM restaurants WHERE id = ?`
        ];
        for (const sql of statements) {
            try {
                await db.run(sql, [rid]);
            }
            catch (e) {
                logger_1.logger.warn(`Skip purge statement (may be missing table/columns): ${sql} :: ${e?.message || e}`);
            }
        }
    }
    for (const slug of demoSlugs) {
        try {
            await db.run('DELETE FROM restaurants WHERE slug = ?', [slug]);
        }
        catch (e) {
            logger_1.logger.warn(`Skip slug purge: ${e?.message || e}`);
        }
    }
    for (const email of demoEmails) {
        try {
            await db.run('DELETE FROM users WHERE LOWER(email) = ?', [email.toLowerCase()]);
        }
        catch (e) {
            logger_1.logger.warn(`Skip email purge: ${e?.message || e}`);
        }
    }
    logger_1.logger.info('Demo purge complete.');
}
if (require.main === module) {
    purgeDemoData()
        .then(() => process.exit(0))
        .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=purge-demo-data.js.map