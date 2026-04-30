import { realtimeService } from '../../services/RealtimeService';
import { buildRestaurantRoom } from '../../constants/realtimeRooms';

class FakeSocket {
  id: string;
  data: Record<string, any> = {};
  joinedRooms = new Set<string>();
  receivedEvents: Array<{ event: string; payload: any }> = [];
  private serverHandlers = new Map<string, (payload?: any) => void>();

  constructor(private io: FakeIO, id: string) {
    this.id = id;
  }

  on(event: string, handler: (payload?: any) => void): this {
    this.serverHandlers.set(event, handler);
    return this;
  }

  emit(event: string, payload?: any): boolean {
    this.receivedEvents.push({ event, payload });
    return true;
  }

  join(room: string): void {
    this.joinedRooms.add(room);
    this.io.addToRoom(room, this);
  }

  leave(room: string): void {
    this.joinedRooms.delete(room);
    this.io.removeFromRoom(room, this);
  }

  clientEmit(event: string, payload?: any): void {
    this.serverHandlers.get(event)?.(payload);
  }

  receiveRoomEvent(event: string, payload: any): void {
    this.receivedEvents.push({ event, payload });
  }
}

class FakeIO {
  private connectionHandler: ((socket: FakeSocket) => void) | null = null;
  private readonly rooms = new Map<string, Set<FakeSocket>>();
  public readonly sockets = { sockets: new Map<string, FakeSocket>() };

  on(event: string, handler: (socket: FakeSocket) => void): this {
    if (event === 'connection') {
      this.connectionHandler = handler;
    }
    return this;
  }

  connect(socket: FakeSocket): void {
    this.sockets.sockets.set(socket.id, socket);
    this.connectionHandler?.(socket);
  }

  to(room: string): { emit: (event: string, payload: any) => void } {
    return {
      emit: (event: string, payload: any) => {
        for (const socket of this.rooms.get(room) || []) {
          socket.receiveRoomEvent(event, payload);
        }
      }
    };
  }

  addToRoom(room: string, socket: FakeSocket): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set<FakeSocket>());
    }
    this.rooms.get(room)?.add(socket);
  }

  removeFromRoom(room: string, socket: FakeSocket): void {
    this.rooms.get(room)?.delete(socket);
  }
}

describe('RealtimeService room authorization and isolation', () => {
  let io: FakeIO;

  beforeEach(() => {
    io = new FakeIO();
    realtimeService.resetForTests();
    realtimeService.initialize(io as any);
  });

  it('allows authorized users to join only permitted rooms', () => {
    const socket = new FakeSocket(io, 'socket-1');
    io.connect(socket);

    socket.clientEmit('authenticate', { userId: 'u1', restaurantId: 'rest-1' });
    socket.clientEmit('join:restaurant', { restaurantId: 'rest-1' });
    socket.clientEmit('join:restaurant', { restaurantId: 'rest-2' });

    expect(socket.joinedRooms.has(buildRestaurantRoom('rest-1'))).toBe(true);
    expect(socket.joinedRooms.has(buildRestaurantRoom('rest-2'))).toBe(false);
    expect(socket.receivedEvents.some((entry) => entry.event === 'room:join_denied')).toBe(true);
  });

  it('delivers message events only to sockets in the target channel', () => {
    const restaurantMemberA = new FakeSocket(io, 'socket-a');
    const restaurantMemberB = new FakeSocket(io, 'socket-b');
    const outsider = new FakeSocket(io, 'socket-c');
    io.connect(restaurantMemberA);
    io.connect(restaurantMemberB);
    io.connect(outsider);

    restaurantMemberA.clientEmit('authenticate', { userId: 'u1', restaurantId: 'rest-1' });
    restaurantMemberB.clientEmit('authenticate', { userId: 'u2', restaurantId: 'rest-1' });
    outsider.clientEmit('authenticate', { userId: 'u3', restaurantId: 'rest-2' });

    realtimeService.emitToRestaurant('rest-1', 'order:updated', { orderId: 'order-1' });

    expect(restaurantMemberA.receivedEvents.some((e) => e.event === 'order:updated')).toBe(true);
    expect(restaurantMemberB.receivedEvents.some((e) => e.event === 'order:updated')).toBe(true);
    expect(outsider.receivedEvents.some((e) => e.event === 'order:updated')).toBe(false);
  });

  it('enforces cross-restaurant socket isolation for emitted realtime events', () => {
    const restOneSocket = new FakeSocket(io, 'socket-r1');
    const restTwoSocket = new FakeSocket(io, 'socket-r2');
    io.connect(restOneSocket);
    io.connect(restTwoSocket);

    restOneSocket.clientEmit('authenticate', { userId: 'u1', restaurantId: 'rest-1' });
    restTwoSocket.clientEmit('authenticate', { userId: 'u2', restaurantId: 'rest-2' });

    realtimeService.emit({
      type: 'order:status_changed',
      payload: { orderId: 'order-123', status: 'preparing' },
      restaurantId: 'rest-1',
      timestamp: new Date().toISOString()
    });

    expect(restOneSocket.receivedEvents.some((e) => e.event === 'order:status_changed')).toBe(true);
    expect(restTwoSocket.receivedEvents.some((e) => e.event === 'order:status_changed')).toBe(false);
  });
});

