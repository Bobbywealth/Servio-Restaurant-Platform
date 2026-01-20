import type { Server as IOServer } from 'socket.io';
import { eventBus } from '../events/eventBus';
import { DatabaseService } from '../services/DatabaseService';
import { NotificationDispatcher } from './NotificationDispatcher';
import { NotificationService } from './NotificationService';
import { NotificationStore } from './NotificationStore';

let initialized = false;

export function initializeNotifications(io: IOServer) {
  if (initialized) return;
  const store = new NotificationStore(DatabaseService.getInstance().getDatabase());
  const dispatcher = new NotificationDispatcher(io);
  const service = new NotificationService(eventBus, store, dispatcher);
  service.register();
  initialized = true;
}
