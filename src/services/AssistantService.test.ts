jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

jest.mock('../services/MiniMaxService', () => ({
  MiniMaxService: jest.fn().mockImplementation(() => ({
    isConfigured: jest.fn(() => false)
  }))
}));

jest.mock('../services/VoiceConversationService', () => ({
  VoiceConversationService: {
    getInstance: jest.fn(() => ({
      updateConversationStatus: jest.fn(),
      getConversationBySessionId: jest.fn(),
      getLastMessages: jest.fn(),
      createConversation: jest.fn(),
      addMessage: jest.fn()
    }))
  }
}));

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => mockDb),
      logAudit: jest.fn()
    }))
  }
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { AssistantService } from './AssistantService';

describe('AssistantService restaurant context resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws RESTAURANT_CONTEXT_MISSING when user record is missing', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const service = new AssistantService();

    await expect((service as any).resolveRestaurantId('missing-user')).rejects.toMatchObject({
      code: 'RESTAURANT_CONTEXT_MISSING',
      name: 'RestaurantContextMissingError'
    });
  });

  it('throws RESTAURANT_CONTEXT_MISSING when user has no restaurant_id', async () => {
    mockDb.get.mockResolvedValue({ restaurant_id: null });
    const service = new AssistantService();

    await expect((service as any).resolveRestaurantId('no-restaurant')).rejects.toMatchObject({
      code: 'RESTAURANT_CONTEXT_MISSING',
      name: 'RestaurantContextMissingError'
    });
  });

  it('returns context repair guidance from tool execution boundary when context is missing', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const service = new AssistantService();

    const action = await (service as any).executeTool({
      id: 'tool-1',
      type: 'function',
      function: {
        name: 'get_store_status',
        arguments: '{}'
      }
    }, 'missing-user');

    expect(action).toMatchObject({
      type: 'get_store_status',
      status: 'error',
      description: expect.stringContaining('re-authenticate/select restaurant'),
      error: expect.stringContaining('Please re-authenticate or select a restaurant')
    });
  });
});
