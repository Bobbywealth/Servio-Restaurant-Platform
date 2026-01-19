"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueAccessToken = issueAccessToken;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const DatabaseService_1 = require("../services/DatabaseService");
const errorHandler_1 = require("./errorHandler");
const JWT_SECRET = process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me';
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 60 * 15); // 15m default
function parsePermissions(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value.map(String);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '*')
            return ['*'];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed))
                return parsed.map(String);
        }
        catch {
            // ignore
        }
    }
    return [];
}
function issueAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}
async function requireAuth(req, _res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            throw new errorHandler_1.UnauthorizedError('Missing Authorization header');
        }
        const token = header.slice('Bearer '.length).trim();
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const userId = decoded?.sub;
        if (!userId)
            throw new errorHandler_1.UnauthorizedError('Invalid token payload');
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const userRow = await db.get('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
        if (!userRow)
            throw new errorHandler_1.UnauthorizedError('User not found or inactive');
        const user = {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email ?? null,
            role: userRow.role,
            permissions: parsePermissions(userRow.permissions)
        };
        req.user = user;
        return next();
    }
    catch (err) {
        return next(err);
    }
}
function requirePermission(permission) {
    return (req, _res, next) => {
        const user = req.user;
        if (!user)
            return next(new errorHandler_1.UnauthorizedError());
        if (user.permissions.includes('*') || user.permissions.includes(permission))
            return next();
        return next(new errorHandler_1.ForbiddenError(`Missing permission: ${permission}`));
    };
}
//# sourceMappingURL=auth.js.map