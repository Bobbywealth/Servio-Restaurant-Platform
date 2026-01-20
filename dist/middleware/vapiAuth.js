"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVapiAuth = void 0;
const errorHandler_1 = require("./errorHandler");
/**
 * Simple middleware to protect Vapi endpoints using a shared Bearer token.
 * Vapi sends: Authorization: Bearer <VAPI_API_KEY>
 */
const requireVapiAuth = (req, res, next) => {
    const vapiKey = process.env.VAPI_API_KEY;
    if (!vapiKey) {
        // If no key is configured, allow for now but log warning
        console.warn('VAPI_API_KEY not configured in environment variables');
        return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new errorHandler_1.UnauthorizedError('Missing or invalid Authorization header');
    }
    const token = authHeader.split(' ')[1];
    if (token !== vapiKey) {
        throw new errorHandler_1.UnauthorizedError('Invalid Vapi API Key');
    }
    next();
};
exports.requireVapiAuth = requireVapiAuth;
//# sourceMappingURL=vapiAuth.js.map