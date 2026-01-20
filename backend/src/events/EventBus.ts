export type EventHandler<TEvent = any> = (event: TEvent) => Promise<void> | void;

export class EventBus {
  private handlers: Record<string, EventHandler[]> = {};

  on(eventType: string, handler: EventHandler) {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(handler);
  }

  async emit(eventType: string, event: any) {
    const handlers = this.handlers[eventType] || [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

export const eventBus = new EventBus();
