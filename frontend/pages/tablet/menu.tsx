import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { api } from '../../lib/api';

type MenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  is_available?: boolean | null;
};

type MenuCategoryGroup = {
  id: string;
  name: string;
  description?: string | null;
  items: MenuItem[];
};

type CategoriesResponse = {
  success: boolean;
  data?: MenuCategory[];
};

type ItemsResponse = {
  success: boolean;
  data?: { categories?: Array<{ category_id: string; category_name?: string; items?: MenuItem[] }> };
};

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function TabletMenuPage() {
  const [categories, setCategories] = useState<MenuCategoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [categoriesRes, itemsRes] = await Promise.all([
        api.get<CategoriesResponse>('/api/menu/categories/all'),
        api.get<ItemsResponse>('/api/menu/items/full')
      ]);

      const categoryRows = categoriesRes.data?.data || [];
      const itemGroups = itemsRes.data?.data?.categories || [];

      const map = new Map<string, MenuCategoryGroup>();
      categoryRows.forEach((category) => {
        map.set(category.id, {
          id: category.id,
          name: category.name,
          description: category.description,
          items: []
        });
      });

      itemGroups.forEach((group) => {
        const existing = map.get(group.category_id) || {
          id: group.category_id,
          name: group.category_name || 'Uncategorized',
          description: null,
          items: []
        };

        const items = (group.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: typeof item.price === 'number' ? item.price : Number(item.price || 0),
          is_available: item.is_available !== undefined ? Boolean(item.is_available) : true
        }));

        map.set(group.category_id, {
          ...existing,
          items: [...existing.items, ...items]
        });
      });

      const ordered = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setCategories(ordered);
    } catch (err: any) {
      setError(err?.message || 'Failed to load menu items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const totalItems = useMemo(() => categories.reduce((sum, category) => sum + category.items.length, 0), [categories]);

  const toggleAvailability = async (item: MenuItem) => {
    const nextAvailable = !item.is_available;
    setPendingItemId(item.id);
    try {
      if (nextAvailable) {
        await api.post('/api/menu/items/set-available', { itemId: item.id });
      } else {
        await api.post('/api/menu/items/set-unavailable', { itemId: item.id });
      }
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          items: category.items.map((menuItem) =>
            menuItem.id === item.id ? { ...menuItem, is_available: nextAvailable } : menuItem
          )
        }))
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update item availability.');
    } finally {
      setPendingItemId(null);
    }
  };

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Menu • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Menu Management</h1>
                <p className="text-[var(--tablet-muted)] mt-2">
                  Review items and toggle availability for the live menu.
                </p>
              </div>
              <button
                onClick={loadMenu}
                className="rounded-xl bg-[var(--tablet-accent)] px-4 py-2 text-sm font-semibold text-[var(--tablet-accent-contrast)] hover:opacity-90"
                disabled={loading}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="mt-6 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--tablet-muted)]">
                <span>{categories.length} categories</span>
                <span>{totalItems} items</span>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {loading && categories.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--tablet-border)] p-6 text-center text-sm text-[var(--tablet-muted)]">
                  Loading menu items…
                </div>
              ) : categories.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--tablet-border)] p-6 text-center text-sm text-[var(--tablet-muted)]">
                  No menu categories found.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-base font-semibold">{category.name}</h2>
                          {category.description && (
                            <p className="text-xs text-[var(--tablet-muted)]">{category.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-[var(--tablet-muted)]">{category.items.length} items</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {category.items.length === 0 ? (
                          <div className="text-xs text-[var(--tablet-muted)]">No items in this category.</div>
                        ) : (
                          category.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <div className="text-sm font-semibold">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-[var(--tablet-muted)]">{item.description}</div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-[var(--tablet-bg)] px-3 py-1 text-[var(--tablet-text)]">
                                  {formatMoney(item.price)}
                                </span>
                                <button
                                  onClick={() => toggleAvailability(item)}
                                  disabled={pendingItemId === item.id}
                                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                                    item.is_available
                                      ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                                  }`}
                                >
                                  {pendingItemId === item.id
                                    ? 'Updating…'
                                    : item.is_available
                                      ? 'Available'
                                      : 'Unavailable'}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
