import { AssistantService } from './AssistantService';
import { DatabaseService } from './DatabaseService';

const mockLogAudit = jest.fn().mockResolvedValue(undefined);
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: { create: jest.fn() },
      speech: { create: jest.fn() }
    },
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

jest.mock('./MiniMaxService', () => ({
  MiniMaxService: jest.fn().mockImplementation(() => ({
    isConfigured: jest.fn().mockReturnValue(false),
    textToSpeech: jest.fn()
  }))
}));

jest.mock('./VoiceConversationService', () => ({
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


jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

jest.mock('./DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        get: mockDbGet,
        all: mockDbAll,
        run: jest.fn()
      })),
      logAudit: mockLogAudit
    }))
  }
}));

describe('AssistantService executeTool get_menu_categories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns categories with success status and uses expected SQL parameter ordering', async () => {
    mockDbGet.mockResolvedValue({ restaurant_id: 'restaurant-1' });
    mockDbAll.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Entrees',
        description: 'Main dishes',
        sort_order: 1,
        item_count: 3,
        unavailable_count: 1
      }
    ]);

    const service = new AssistantService();

    const action = await (service as any).executeTool(
      {
        type: 'function',
        id: 'tool-1',
        function: {
          name: 'get_menu_categories',
          arguments: JSON.stringify({ includeUnavailable: true })
        }
      },
      'user-1'
    );

    expect(action.status).toBe('success');
    expect(action.type).toBe('get_menu_categories');
    expect(action.details.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cat-1',
          name: 'Entrees',
          item_count: 3
        })
      ])
    );

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('AND (is_available = 1 OR ?)) as item_count'),
      [1, 'restaurant-1']
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      'restaurant-1',
      'user-1',
      'get_menu_categories',
      'menu_category',
      'multiple',
      { count: 1 }
    );

    expect(DatabaseService.getInstance).toHaveBeenCalled();
  });
});
