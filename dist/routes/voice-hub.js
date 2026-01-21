"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DatabaseService_1 = require("../services/DatabaseService");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
function getDateFilter(dateRange) {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let startDate;
    switch (dateRange) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            break;
        case 'yesterday': {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
            endDate.setTime(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
            break;
        }
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
        case 'all':
        default:
            startDate = new Date(2020, 0, 1);
            break;
    }
    return { startDate, endDate };
}
function normalizePhone(input) {
    if (!input)
        return '';
    return String(input).replace(/\D/g, '');
}
const router = (0, express_1.Router)();
// All voice hub endpoints require an authenticated dashboard user
router.use(auth_1.requireAuth);
/**
 * Incoming calls (from call_logs) matched to orders.
 *
 * Matching priority:
 * 1) `orders.call_id === call_logs.call_id`
 * 2) normalized phone match within a time window around the call
 */
router.get('/incoming-calls', async (req, res) => {
    try {
        const { dateRange = 'today', search = '', matchedOnly = 'true', page = '1', limit = '50' } = req.query;
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) {
            return res.status(400).json({ success: false, error: 'Restaurant ID required' });
        }
        const db = DatabaseService_1.DatabaseService.getInstance().getDatabase();
        const { startDate, endDate } = getDateFilter(dateRange);
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        const where = [];
        const params = [];
        if (dateRange !== 'all') {
            where.push('cl.created_at >= ? AND cl.created_at <= ?');
            params.push(startDate.toISOString(), endDate.toISOString());
        }
        if (search) {
            where.push('(cl.from_phone LIKE ? OR cl.call_id LIKE ? OR cl.transcript LIKE ?)');
            const p = `%${search}%`;
            params.push(p, p, p);
        }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        // Pull call logs for the date range, and join any *potential* matching orders for this restaurant.
        // We intentionally allow multiple matches here and pick the best match in JS.
        const rows = await db.all(`
        SELECT
          cl.id as call_log_id,
          cl.call_id as call_id,
          cl.from_phone as from_phone,
          cl.transcript as transcript,
          cl.summary_json as summary_json,
          cl.created_at as call_created_at,

          o.id as order_id,
          o.status as order_status,
          o.total as order_total,
          o.total_amount as order_total_amount,
          o.customer_name as customer_name,
          o.customer_phone as customer_phone,
          o.call_id as order_call_id,
          o.created_at as order_created_at
        FROM call_logs cl
        LEFT JOIN orders o
          ON o.restaurant_id = ?
          AND (
            (o.call_id IS NOT NULL AND o.call_id = cl.call_id)
            OR (o.customer_phone IS NOT NULL AND o.customer_phone = cl.from_phone)
          )
          AND o.created_at >= datetime(cl.created_at, '-15 minutes')
          AND o.created_at <= datetime(cl.created_at, '+6 hours')
        ${whereClause}
        ORDER BY cl.created_at DESC
        LIMIT ? OFFSET ?
      `, [restaurantId, ...params, limitNum, offset]);
        // Group by call_id (or call_log_id fallback) and pick the best matching order.
        const grouped = new Map();
        for (const r of rows) {
            const key = r.call_id || r.call_log_id;
            const arr = grouped.get(key) || [];
            arr.push(r);
            grouped.set(key, arr);
        }
        const results = Array.from(grouped.values()).map((candidates) => {
            // Base info from first row
            const base = candidates[0];
            const callPhone = normalizePhone(base.from_phone);
            // Find best order match
            let best = null;
            for (const c of candidates) {
                if (!c.order_id)
                    continue;
                const isCallIdMatch = c.order_call_id && base.call_id && c.order_call_id === base.call_id;
                const isPhoneMatch = normalizePhone(c.customer_phone) && callPhone && normalizePhone(c.customer_phone) === callPhone;
                const score = (isCallIdMatch ? 100 : 0) + (isPhoneMatch ? 10 : 0);
                if (!best || score > best._score)
                    best = { ...c, _score: score };
            }
            const matchedOrder = best?.order_id
                ? {
                    id: best.order_id,
                    status: best.order_status,
                    total: best.order_total ?? best.order_total_amount,
                    customerName: best.customer_name,
                    customerPhone: best.customer_phone,
                    createdAt: best.order_created_at,
                    matchType: best.order_call_id && base.call_id && best.order_call_id === base.call_id ? 'call_id' : 'phone'
                }
                : null;
            return {
                callId: base.call_id,
                fromPhone: base.from_phone,
                createdAt: base.call_created_at,
                transcript: base.transcript,
                summary: (() => {
                    try {
                        return base.summary_json ? JSON.parse(base.summary_json) : {};
                    }
                    catch {
                        return {};
                    }
                })(),
                matchedOrder
            };
        });
        const onlyMatched = String(matchedOnly).toLowerCase() !== 'false';
        const filtered = onlyMatched ? results.filter((r) => r.matchedOrder) : results;
        res.json({ success: true, data: filtered });
    }
    catch (error) {
        logger_1.logger.error('Error fetching incoming call logs:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch incoming call logs' });
    }
});
exports.default = router;
//# sourceMappingURL=voice-hub.js.map