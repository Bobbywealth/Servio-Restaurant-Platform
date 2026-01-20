"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventTenantAccess = exports.requirePlatformAdmin = void 0;
/**
 * Middleware to ensure only platform-admin users can access admin endpoints
 */
const requirePlatformAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'You must be logged in to access admin endpoints'
        });
    }
    if (req.user.role !== 'platform-admin') {
        return res.status(403).json({
            error: 'Platform admin access required',
            message: 'This endpoint requires platform administrator privileges',
            userRole: req.user.role
        });
    }
    next();
};
exports.requirePlatformAdmin = requirePlatformAdmin;
/**
 * Middleware to prevent access to tenant-specific endpoints for platform admins
 */
const preventTenantAccess = (req, res, next) => {
    if (req.user && req.user.role === 'platform-admin') {
        return res.status(403).json({
            error: 'Platform admin cannot access tenant endpoints',
            message: 'Use admin-specific endpoints instead'
        });
    }
    next();
};
exports.preventTenantAccess = preventTenantAccess;
//# sourceMappingURL=adminAuth.js.map