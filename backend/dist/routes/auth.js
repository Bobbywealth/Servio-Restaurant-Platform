"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
function safeUser(row) {
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        email: row.email ?? null,
        role: row.role,
        permissions: (() => {
            try {
                return typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
            }
            catch {
                return row.permissions === '*' ? ['*'] : [];
            }
        })()
    };
}
router.post('/signup', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, restaurantName } = req.body ?? {};
    if (!name || !email || !password || !restaurantName) {
        throw new Error('All fields are required');
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    // 1. Create Restaurant
    const restaurantId = (0, uuid_1.v4)();
    const slug = restaurantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.run('INSERT INTO restaurants (id, name, slug) VALUES (?, ?, ?)', [restaurantId, restaurantName, slug]);
    // 2. Create Owner User
    const userId = (0, uuid_1.v4)();
    const passwordHash = await bcryptjs_1.default.hash(String(password), 10);
    await db.run('INSERT INTO users (id, restaurant_id, name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, restaurantId, name, email, passwordHash, 'owner', JSON.stringify(['*'])]);
    res.status(201).json({
        success: true,
        data: {
            restaurant: { id: restaurantId, name: restaurantName, slug },
            user: { id: userId, name, email, role: 'owner' }
        }
    });
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        throw new errorHandler_1.UnauthorizedError('Email and password are required');
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    if (!user || !user.password_hash) {
        throw new errorHandler_1.UnauthorizedError('Invalid email or password');
    }
    const ok = await bcryptjs_1.default.compare(String(password), String(user.password_hash));
    if (!ok)
        throw new errorHandler_1.UnauthorizedError('Invalid email or password');
    const sessionId = (0, uuid_1.v4)();
    const refreshToken = (0, uuid_1.v4)();
    const refreshTokenHash = await bcryptjs_1.default.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.run('INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)', [sessionId, user.id, refreshTokenHash, expiresAt]);
    const accessToken = (0, auth_1.issueAccessToken)({
        sub: user.id,
        restaurantId: user.restaurant_id,
        sid: sessionId
    });
    res.json({
        success: true,
        data: {
            user: safeUser(user),
            accessToken,
            refreshToken
        }
    });
}));
router.post('/refresh', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken)
        throw new errorHandler_1.UnauthorizedError('refreshToken is required');
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const sessions = await db.all('SELECT * FROM auth_sessions');
    const now = Date.now();
    for (const s of sessions) {
        const expired = new Date(s.expires_at).getTime() <= now;
        if (expired)
            continue;
        const match = await bcryptjs_1.default.compare(String(refreshToken), String(s.refresh_token_hash));
        if (!match)
            continue;
        const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [s.user_id]);
        if (!user)
            throw new errorHandler_1.UnauthorizedError('User not found or inactive');
        const accessToken = (0, auth_1.issueAccessToken)({
            sub: user.id,
            restaurantId: user.restaurant_id,
            sid: s.id
        });
        return res.json({
            success: true,
            data: {
                user: safeUser(user),
                accessToken
            }
        });
    }
    throw new errorHandler_1.UnauthorizedError('Invalid refresh token');
}));
router.post('/logout', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
        return res.json({ success: true, data: { loggedOut: true } });
    }
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const sessions = await db.all('SELECT * FROM auth_sessions');
    for (const s of sessions) {
        const match = await bcryptjs_1.default.compare(String(refreshToken), String(s.refresh_token_hash));
        if (match) {
            await db.run('DELETE FROM auth_sessions WHERE id = ?', [s.id]);
            break;
        }
    }
    res.json({ success: true, data: { loggedOut: true } });
}));
router.get('/me', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({ success: true, data: { user: req.user } });
}));
// Account switching endpoint for testing
router.post('/switch-account', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { targetEmail } = req.body ?? {};
    if (!targetEmail) {
        throw new errorHandler_1.UnauthorizedError('Target email is required');
    }
    // In production, you'd want to add proper authorization checks here
    // For testing purposes, we'll allow switching to any active account
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const targetUser = await db.get('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [targetEmail]);
    if (!targetUser) {
        throw new errorHandler_1.UnauthorizedError('Target user not found or inactive');
    }
    // Create new session for the target user
    const sessionId = (0, uuid_1.v4)();
    const refreshToken = (0, uuid_1.v4)();
    const refreshTokenHash = await bcryptjs_1.default.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.run('INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, ?)', [sessionId, targetUser.id, refreshTokenHash, expiresAt]);
    const accessToken = (0, auth_1.issueAccessToken)({
        sub: targetUser.id,
        restaurantId: targetUser.restaurant_id,
        sid: sessionId
    });
    res.json({
        success: true,
        data: {
            user: safeUser(targetUser),
            accessToken,
            refreshToken,
            message: `Switched to ${targetUser.name} (${targetUser.role})`
        }
    });
}));
// Get all available accounts for switching (testing only)
router.get('/available-accounts', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
    const users = await db.all('SELECT id, email, name, role FROM users WHERE is_active = TRUE ORDER BY role DESC, name ASC');
    const accountsByRole = users.reduce((acc, user) => {
        if (!acc[user.role])
            acc[user.role] = [];
        acc[user.role].push({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });
        return acc;
    }, {});
    res.json({
        success: true,
        data: {
            accounts: accountsByRole,
            totalCount: users.length
        }
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map