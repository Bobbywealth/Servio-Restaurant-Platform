"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const VoiceOrderingService_1 = require("../services/VoiceOrderingService");
const auth_1 = require("../middleware/auth");
const vapiAuth_1 = require("../middleware/vapiAuth");
const router = (0, express_1.Router)();
const service = VoiceOrderingService_1.VoiceOrderingService.getInstance();
// 1) Store Status
router.get('/store/status', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const status = service.getStoreStatus();
    res.json(status);
}));
// 2) Menu APIs
router.get('/menu', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json(service.getFullMenu());
}));
router.get('/menu/search', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q } = req.query;
    res.json(service.searchMenu(String(q || '')));
}));
router.get('/menu/items/:id', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = service.getMenuItem(id);
    if (!item)
        return res.status(404).json({ error: 'Item not found' });
    res.json(item);
}));
// 3) Quote
router.post('/order/quote', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json(service.validateQuote(req.body));
}));
// 4) Create Order (PENDING Only)
router.post('/orders', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await service.createOrder(req.body);
    if (result.orderId) {
        res.status(201).json(result);
    }
    else {
        res.status(400).json(result);
    }
}));
// 5) Accept Order
router.post('/orders/:id/accept', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { prepTimeMinutes } = req.body;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await service.acceptOrder(id, prepTimeMinutes, req.user.id);
    res.json(result);
}));
// 6) Cancel / Complete
router.post('/orders/:id/cancel', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Implementation for internal workflow
    res.json({ success: true, status: 'cancelled' });
}));
router.post('/orders/:id/complete', auth_1.requireAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // Implementation for internal workflow
    res.json({ success: true, status: 'completed' });
}));
// 7) Call Logs
router.post('/calls/log', vapiAuth_1.requireVapiAuth, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json(await service.logCall(req.body));
}));
exports.default = router;
//# sourceMappingURL=voice.js.map