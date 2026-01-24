import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

export class SocketService {
  private static io: SocketIOServer | null = null;

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
