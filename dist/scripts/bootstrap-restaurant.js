#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapRestaurant = bootstrapRestaurant;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const DatabaseService_1 = require("../services/DatabaseService");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
function env(name) {
    const v = process.env[name];
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}
function envBool(name, defaultValue = false) {
    const raw = env(name);
    if (!raw)
        return defaultValue;
    return ['1', 'true', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}
async function bootstrapRestaurant() {
    const restaurantId = env('BOOTSTRAP_RESTAURANT_ID') || env('DEFAULT_RESTAURANT_ID');
    const restaurantSlug = env('BOOTSTRAP_RESTAURANT_SLUG') || restaurantId;
    const restaurantName = env('BOOTSTRAP_RESTAURANT_NAME') || 'Sasheys Kitchen';
    const userEmail = env('BOOTSTRAP_USER_EMAIL');
    const userPassword = env('BOOTSTRAP_USER_PASSWORD');
    const userName = env('BOOTSTRAP_USER_NAME') || 'Kitchen';
    const userRole = env('BOOTSTRAP_USER_ROLE') || 'manager';
    const forcePassword = envBool('BOOTSTRAP_FORCE_PASSWORD', false);
    const enableMenuImport = envBool('BOOTSTRAP_IMPORT_MENU', false);
    const menuJsonPath = env('BOOTSTRAP_MENU_JSON_PATH') ||
        path_1.default.join(process.cwd(), 'data', 'menu', 'sasheys_menu_vapi.json');
    if (!restaurantId) {
        throw new Error('Missing BOOTSTRAP_RESTAURANT_ID (or DEFAULT_RESTAURANT_ID)');
    }
    if (!restaurantSlug) {
        throw new Error('Missing BOOTSTRAP_RESTAURANT_SLUG (or DEFAULT_RESTAURANT_ID)');
    }
    if (!userEmail || !userPassword) {
        throw new Error('Missing BOOTSTRAP_USER_EMAIL or BOOTSTRAP_USER_PASSWORD');
    }
    logger_1.logger.info('Bootstrapping restaurant + kitchen user...');
    logger_1.logger.info(`Restaurant: id=${restaurantId} slug=${restaurantSlug} name=${restaurantName}`);
    logger_1.logger.info(`User: email=${userEmail} role=${userRole}`);
    await DatabaseService_1.DatabaseService.initialize();
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    // Restaurant upsert
    await db.run(`INSERT INTO restaurants (
      id, name, slug, settings, operating_hours, timezone, closed_message,
      is_active, online_ordering_enabled, pickup_enabled, delivery_enabled, social_links, website
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      settings = excluded.settings,
      operating_hours = excluded.operating_hours,
      timezone = excluded.timezone,
      closed_message = excluded.closed_message,
      is_active = excluded.is_active,
      online_ordering_enabled = excluded.online_ordering_enabled,
      pickup_enabled = excluded.pickup_enabled,
      delivery_enabled = excluded.delivery_enabled,
      social_links = excluded.social_links,
      website = excluded.website`, [
        restaurantId,
        restaurantName,
        restaurantSlug,
        JSON.stringify({ currency: 'USD', tax_rate: 0.0 }),
        JSON.stringify({}),
        env('BOOTSTRAP_TIMEZONE') || 'America/New_York',
        env('BOOTSTRAP_CLOSED_MESSAGE') || 'We’re temporarily closed right now...',
        1,
        1,
        1,
        0,
        JSON.stringify({}),
        env('BOOTSTRAP_WEBSITE') || null
    ]);
    // User upsert by email
    const existing = await db.get('SELECT id, email, password_hash FROM users WHERE LOWER(email) = ?', [
        userEmail.toLowerCase()
    ]);
    const passwordHash = bcryptjs_1.default.hashSync(userPassword, 10);
    if (existing?.id) {
        if (forcePassword || !existing.password_hash) {
            await db.run(`UPDATE users
         SET name = ?, role = ?, restaurant_id = ?, permissions = ?, password_hash = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [userName, userRole, restaurantId, JSON.stringify(['*']), passwordHash, existing.id]);
        }
        else {
            await db.run(`UPDATE users
         SET name = ?, role = ?, restaurant_id = ?, permissions = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [userName, userRole, restaurantId, JSON.stringify(['*']), existing.id]);
        }
        logger_1.logger.info(`Updated existing user ${userEmail}`);
    }
    else {
        const userId = env('BOOTSTRAP_USER_ID') || (0, uuid_1.v4)();
        await db.run(`INSERT INTO users (id, restaurant_id, name, email, password_hash, pin, role, permissions, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`, [
            userId,
            restaurantId,
            userName,
            userEmail.toLowerCase(),
            passwordHash,
            env('BOOTSTRAP_USER_PIN') || null,
            userRole,
            JSON.stringify(['*'])
        ]);
        logger_1.logger.info(`Created new user ${userEmail}`);
    }
    // Optional: import menu JSON (best-effort)
    if (enableMenuImport) {
        if (!fs_1.default.existsSync(menuJsonPath)) {
            throw new Error(`Menu JSON file not found at ${menuJsonPath}`);
        }
        const raw = fs_1.default.readFileSync(menuJsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
        logger_1.logger.info(`Importing menu items: ${items.length} from ${menuJsonPath}`);
        // Ensure a default category
        const categoryId = 'bootstrap-cat-1';
        await db.run(`INSERT INTO menu_categories (id, restaurant_id, name)
       VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, restaurant_id = excluded.restaurant_id`, [categoryId, restaurantId, env('BOOTSTRAP_MENU_CATEGORY') || 'Menu']);
        for (const item of items) {
            const name = String(item?.name || item?.title || '').trim();
            if (!name)
                continue;
            const price = Number(item?.price ?? item?.amount ?? 0);
            const description = typeof item?.description === 'string' ? item.description : null;
            const menuItemId = String(item?.id || (0, uuid_1.v4)());
            try {
                await db.run(`INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, is_available)
           VALUES (?, ?, ?, ?, ?, ?, TRUE)
           ON CONFLICT (id) DO UPDATE SET
             restaurant_id = excluded.restaurant_id,
             category_id = excluded.category_id,
             name = excluded.name,
             description = excluded.description,
             price = excluded.price`, [menuItemId, restaurantId, categoryId, name, description, Number.isFinite(price) ? price : 0]);
            }
            catch (e) {
                logger_1.logger.warn(`Menu import failed for item "${name}": ${String(e?.message || e)}`);
            }
        }
    }
    logger_1.logger.info('Bootstrap complete.');
}
if (require.main === module) {
    bootstrapRestaurant()
        .then(() => process.exit(0))
        .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=bootstrap-restaurant.js.map