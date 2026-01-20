"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const templates_1 = require("./templates");
const handledEvents = [
    'staff.clock_in',
    'staff.clock_out',
    'staff.break_start',
    'staff.break_end',
    'staff.open_shift_detected',
    'order.created_web',
    'order.created_vapi',
    'order.status_changed',
    'receipt.uploaded',
    'receipt.applied',
    'inventory.low_stock',
    'task.created',
    'task.completed',
    'system.error',
    'system.warning'
];
class NotificationService {
    constructor(bus, store, dispatcher) {
        this.bus = bus;
        this.store = store;
        this.dispatcher = dispatcher;
    }
    register() {
        for (const type of handledEvents) {
            this.bus.on(type, async (event) => {
                const drafts = (0, templates_1.buildNotificationDraft)(event);
                for (const draft of drafts) {
                    const { notificationId, createdAt } = await this.store.createNotification(event.restaurantId, event.type, draft);
                    this.dispatcher.emitToRestaurant(event.restaurantId, {
                        restaurantId: event.restaurantId,
                        notification: {
                            id: notificationId,
                            type: event.type,
                            severity: draft.severity,
                            title: draft.title,
                            message: draft.message,
                            metadata: draft.metadata ?? {},
                            createdAt,
                            isRead: false
                        }
                    });
                }
            });
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map