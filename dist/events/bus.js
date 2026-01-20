"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
class EventBus {
    constructor() {
        this.handlers = {};
    }
    on(eventType, handler) {
        if (!this.handlers[eventType]) {
            this.handlers[eventType] = [];
        }
        this.handlers[eventType].push(handler);
    }
    async emit(eventType, event) {
        const handlers = this.handlers[eventType] || [];
        for (const handler of handlers) {
            await handler(event);
        }
    }
}
exports.EventBus = EventBus;
exports.eventBus = new EventBus();
//# sourceMappingURL=bus.js.map