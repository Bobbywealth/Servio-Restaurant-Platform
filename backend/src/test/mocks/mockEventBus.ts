import type { EventBus } from '../../events/bus';

export function createMockEventBus(): Pick<EventBus, 'on' | 'emit'> & {
  events: Array<{ type: string; payload: any }>;
} {
  const events: Array<{ type: string; payload: any }> = [];
  const handlers: Record<string, Array<(event: any) => any>> = {};

  return {
    events,
    on: (eventType: string, handler: (event: any) => any) => {
      if (!handlers[eventType]) handlers[eventType] = [];
      handlers[eventType].push(handler);
    },
    emit: async (eventType: string, payload: any) => {
      events.push({ type: eventType, payload });
      const hs = handlers[eventType] || [];
      for (const h of hs) {
        await h(payload);
      }
    }
  };
}

