import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

// Kitchen Assistant event types
export interface KitchenTimerEvent {
  sessionId: number;
  recipeId: number;
  recipeName: string;
  stepNumber: number;
  remainingSeconds: number;
  status: 'running' | 'halfway' | 'completed' | 'paused';
}

export interface KitchenSessionEvent {
  sessionId: number;
  recipeId: number;
  recipeName: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed';
}

export class SocketService {
  private static io: SocketIOServer | null = null;

  // Kitchen Assistant room management
  public static joinKitchenRoom(companyId: number, socketId: string) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.sockets.sockets.get(socketId)?.join(room);
    logger.info(`[socket] Socket ${socketId} joined kitchen room ${room}`);
  }

  public static leaveKitchenRoom(companyId: number, socketId: string) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.sockets.sockets.get(socketId)?.leave(room);
    logger.info(`[socket] Socket ${socketId} left kitchen room ${room}`);
  }

  // Kitchen timer events
  public static emitTimerUpdate(companyId: number, event: KitchenTimerEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:timer-update', event);
    logger.info(`[socket] Timer update emitted to ${room}: ${event.status}`);
  }

  public static emitTimerHalfway(companyId: number, event: KitchenTimerEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:timer-halfway', event);
    logger.info(`[socket] Timer halfway alert to ${room}`);
  }

  public static emitTimerComplete(companyId: number, event: KitchenTimerEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:timer-complete', event);
    logger.info(`[socket] Timer complete to ${room}`);
  }

  // Kitchen session events
  public static emitSessionStart(companyId: number, event: KitchenSessionEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:session-start', event);
  }

  public static emitSessionUpdate(companyId: number, event: KitchenSessionEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:session-update', event);
  }

  public static emitSessionComplete(companyId: number, event: KitchenSessionEvent) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:session-complete', event);
  }

  // Voice command events
  public static emitVoiceCommand(companyId: number, data: { 
    sessionId?: number; 
    command: string; 
    response: string 
  }) {
    const room = `kitchen:${companyId}`;
    SocketService.getIO()?.to(room).emit('kitchen:voice-command', data);
  }

  public static setIO(io: SocketIOServer) {
    SocketService.io = io;
  }

  public static getIO(): SocketIOServer | null {
    if (!SocketService.io) {
      logger.warn('[socket] io instance not initialized');
    }
    return SocketService.io;
  }
}
