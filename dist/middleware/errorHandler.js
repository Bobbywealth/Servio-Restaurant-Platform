"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.ForbiddenError = exports.BadRequestError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = void 0;
const logger_1 = require("../utils/logger");
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
        this.isOperational = true;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.isOperational = true;
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.statusCode = 401;
        this.isOperational = true;
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class BadRequestError extends Error {
    constructor(message = 'Bad Request') {
        super(message);
        this.statusCode = 400;
        this.isOperational = true;
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.statusCode = 403;
        this.isOperational = true;
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
const errorHandler = (error, req, res, _next) => {
    // Default error values
    let statusCode = error.statusCode || 500;
    let message = error.message || 'Internal Server Error';
    let isOperational = error.isOperational || false;
    // Log error details
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        statusCode,
        isOperational,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        query: req.query,
        params: req.params
    };
    if (statusCode >= 500) {
        logger_1.logger.error('Server Error:', errorInfo);
    }
    else {
        logger_1.logger.warn('Client Error:', errorInfo);
    }
    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = error.message;
    }
    else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    }
    else if (error.name === 'JsonWebTokenError' || (error.message && error.message.includes('secret or public key must be provided'))) {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    else if (error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('duplicate key'))) {
        statusCode = 400;
        message = 'Database constraint violation';
    }
    // Prepare error response
    const errorResponse = {
        success: false,
        error: {
            message,
            type: error.name,
            statusCode
        }
    };
    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = error.stack;
        errorResponse.error.details = errorInfo;
    }
    // Add request ID if available
    if (req.headers['x-request-id']) {
        errorResponse.requestId = req.headers['x-request-id'];
    }
    // Ensure JSON response
    res.setHeader('Content-Type', 'application/json');
    return res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
// Async error wrapper
const asyncHandler = (fn) => (req, res, _next) => {
    Promise.resolve(fn(req, res, _next)).catch(_next);
};
exports.asyncHandler = asyncHandler;
// 404 handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map