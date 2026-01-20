"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeNotifications = initializeNotifications;
const bus_1 = require("../events/bus");
const DatabaseService_1 = require("../services/DatabaseService");
const NotificationDispatcher_1 = require("./NotificationDispatcher");
const NotificationService_1 = require("./NotificationService");
const NotificationStore_1 = require("./NotificationStore");
let initialized = false;
function initializeNotifications(io) {
    if (initialized)
        return;
    const store = new NotificationStore_1.NotificationStore(DatabaseService_1.DatabaseService.getInstance().getDatabase());
    const dispatcher = new NotificationDispatcher_1.NotificationDispatcher(io);
    const service = new NotificationService_1.NotificationService(bus_1.eventBus, store, dispatcher);
    service.register();
    initialized = true;
}
//# sourceMappingURL=initNotifications.js.map