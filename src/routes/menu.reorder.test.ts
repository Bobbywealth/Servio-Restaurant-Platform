import express from 'express';
import { DatabaseService } from '../services/DatabaseService';

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn()
  }
}));


jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-test')
}));

jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined)
  };
  return jest.fn(() => chain);
});

type CategoryRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_hidden: boolean;
};

type ItemRow = {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  sort_order: number;
  is_available: boolean;
};

const mockedGetInstance = DatabaseService.getInstance as jest.Mock;

const requestJson = async (app: express.Express, path: string, method = 'GET', body?: unknown) => {
  const server = app.listen(0);
  const { port } = server.address() as any;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-1', restaurantId: 'rest-1' };
    next();
  });
  const menuRouter = require('./menu').default;
  app.use('/api/menu', menuRouter);
  return app;
};

describe('menu reorder routes', () => {
  let categories: CategoryRow[];
  let items: ItemRow[];

  beforeEach(() => {
    jest.clearAllMocks();

    categories = [
      { id: 'cat-1', restaurant_id: 'rest-1', name: 'Appetizers', description: null, sort_order: 0, is_active: true, is_hidden: false },
      { id: 'cat-2', restaurant_id: 'rest-1', name: 'Entrees', description: null, sort_order: 1, is_active: true, is_hidden: false },
      { id: 'cat-3', restaurant_id: 'rest-1', name: 'Desserts', description: null, sort_order: 2, is_active: true, is_hidden: false }
    ];

    items = [
      { id: 'item-1', restaurant_id: 'rest-1', category_id: 'cat-1', name: 'Bruschetta', sort_order: 0, is_available: true },
      { id: 'item-2', restaurant_id: 'rest-1', category_id: 'cat-1', name: 'Calamari', sort_order: 1, is_available: true },
      { id: 'item-3', restaurant_id: 'rest-1', category_id: 'cat-1', name: 'Wings', sort_order: 2, is_available: true }
    ];

    const db = {
      all: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM menu_categories mc')) {
          return [...categories]
            .filter((c) => c.restaurant_id === params[0])
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
            .map((c) => {
              const categoryItems = items.filter((item) => item.category_id === c.id);
              return {
                id: c.id,
                name: c.name,
                description: c.description,
                is_hidden: c.is_hidden,
                sort_order: c.sort_order,
                is_active: c.is_active,
                total_items: categoryItems.length,
                available_items: categoryItems.filter((i) => i.is_available).length,
                unavailable_items: categoryItems.filter((i) => !i.is_available).length
              };
            });
        }

        if (sql.includes('SELECT id FROM menu_categories WHERE id IN')) {
          const restaurantId = params[params.length - 1];
          const ids = params.slice(0, -1);
          return categories
            .filter((c) => c.restaurant_id === restaurantId && ids.includes(c.id))
            .map((c) => ({ id: c.id }));
        }

        if (sql.includes('FROM menu_categories') && sql.includes('ORDER BY sort_order ASC, name ASC')) {
          const restaurantId = params[0];
          return categories
            .filter((c) => c.restaurant_id === restaurantId)
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
            .map((c) => ({ id: c.id }));
        }

        if (sql.includes('SELECT id FROM menu_items WHERE id IN')) {
          const restaurantId = params[params.length - 2];
          const categoryId = params[params.length - 1];
          const ids = params.slice(0, -2);
          return items
            .filter((item) => item.restaurant_id === restaurantId && item.category_id === categoryId && ids.includes(item.id))
            .map((item) => ({ id: item.id }));
        }

        if (sql.includes('FROM menu_items') && sql.includes('ORDER BY sort_order ASC, name ASC')) {
          const [restaurantId, categoryId] = params;
          return items
            .filter((item) => item.restaurant_id === restaurantId && item.category_id === categoryId)
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
            .map((item) => ({ id: item.id }));
        }

        return [];
      }),
      get: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?')) {
          const [categoryId, restaurantId] = params;
          const category = categories.find((c) => c.id === categoryId && c.restaurant_id === restaurantId);
          return category ? { id: category.id } : undefined;
        }
        return undefined;
      }),
      run: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
          return { changes: 0 };
        }

        if (sql.includes('UPDATE menu_categories')) {
          const [sortOrder, categoryId, restaurantId] = params;
          const category = categories.find((c) => c.id === categoryId && c.restaurant_id === restaurantId);
          if (!category) return { changes: 0 };
          category.sort_order = Number(sortOrder);
          return { changes: 1 };
        }

        if (sql.includes('UPDATE menu_items')) {
          const [sortOrder, itemId, restaurantId, categoryId] = params;
          const item = items.find((i) => i.id === itemId && i.restaurant_id === restaurantId && i.category_id === categoryId);
          if (!item) return { changes: 0 };
          item.sort_order = Number(sortOrder);
          return { changes: 1 };
        }

        return { changes: 0 };
      })
    };

    mockedGetInstance.mockReturnValue({
      getDatabase: () => db,
      logAudit: jest.fn().mockResolvedValue(undefined)
    });
  });

  it('persists category reorder and returns same order on roundtrip', async () => {
    const app = buildApp();

    const reorder = await requestJson(app, '/api/menu/categories/reorder', 'PUT', {
      categoryIds: ['cat-3', 'cat-1', 'cat-2']
    });
    expect(reorder.status).toBe(200);
    expect(reorder.data.success).toBe(true);

    const roundtrip = await requestJson(app, '/api/menu/categories', 'GET');
    expect(roundtrip.status).toBe(200);
    expect(roundtrip.data.data.map((row: any) => row.id)).toEqual(['cat-3', 'cat-1', 'cat-2']);
  });

  it('persists item reorder and keeps resulting order in storage', async () => {
    const app = buildApp();

    const reorder = await requestJson(app, '/api/menu/categories/cat-1/items/reorder', 'PUT', {
      itemIds: ['item-3', 'item-1', 'item-2']
    });

    expect(reorder.status).toBe(200);
    expect(reorder.data.success).toBe(true);

    const orderedIds = items
      .filter((item) => item.category_id === 'cat-1')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.id);
    expect(orderedIds).toEqual(['item-3', 'item-1', 'item-2']);
  });

  it('handles partial invalid IDs by reordering valid IDs and appending missing existing IDs', async () => {
    const app = buildApp();

    const categoryReorder = await requestJson(app, '/api/menu/categories/reorder', 'PUT', {
      categoryIds: ['cat-2', 'cat-does-not-exist']
    });

    expect(categoryReorder.status).toBe(200);
    const categoriesRoundtrip = await requestJson(app, '/api/menu/categories', 'GET');
    expect(categoriesRoundtrip.data.data.map((row: any) => row.id)).toEqual(['cat-2', 'cat-1', 'cat-3']);

    const itemReorder = await requestJson(app, '/api/menu/categories/cat-1/items/reorder', 'PUT', {
      itemIds: ['item-2', 'item-does-not-exist']
    });

    expect(itemReorder.status).toBe(200);
    expect(itemReorder.data.invalidItemIds).toEqual(['item-does-not-exist']);

    const orderedIds = items
      .filter((item) => item.category_id === 'cat-1')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.id);
    expect(orderedIds).toEqual(['item-2', 'item-1', 'item-3']);
  });
});
