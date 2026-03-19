import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { api } from '../../lib/api';
import { Search, ChevronDown, ChevronUp, CheckCircle, XCircle, Edit3 } from 'lucide-react';

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
  image?: string | null;
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

type FilterType = 'all' | 'available' | 'unavailable';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const [isClient, setIsClient] = useState(false);

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
          image: item.image || null,
          is_available: item.is_available !== undefined ? Boolean(item.is_available) : true
        }));

        map.set(group.category_id, {
          ...existing,
          items: [...existing.items, ...items]
        });
      });

      const ordered = Array.from(map.values()).sort((a, b) => {
        // Put "Entrees" first, then sort alphabetically
        if (a.name.toLowerCase() === 'entrees') return -1;
        if (b.name.toLowerCase() === 'entrees') return 1;
        return a.name.localeCompare(b.name);
      });
      setCategories(ordered);
      // Start with all categories collapsed by default
      setExpandedCategories(new Set());
    } catch (err: any) {
      setError(err?.message || 'Failed to load menu items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Filter categories and items based on search and filter
  const filteredCategories = useMemo(() => {
    return categories.map(category => {
      let filteredItems = category.items;
      
      // Apply availability filter
      if (filter === 'available') {
        filteredItems = filteredItems.filter(item => item.is_available);
      } else if (filter === 'unavailable') {
        filteredItems = filteredItems.filter(item => !item.is_available);
      }
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
        );
      }
      
      return { ...category, items: filteredItems };
    }).filter(category => category.items.length > 0);
  }, [categories, filter, searchQuery]);

  const totalItems = useMemo(() => categories.reduce((sum, category) => sum + category.items.length, 0), [categories]);
  const availableItems = useMemo(
    () => categories.reduce((sum, category) => sum + category.items.filter((item) => item.is_available).length, 0),
    [categories]
  );
  const unavailableItems = totalItems - availableItems;

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

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedCategories(new Set(categories.map(c => c.id)));
  const collapseAll = () => setExpandedCategories(new Set());

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Menu • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
      </Head>
      <div className="no-print flex min-h-screen flex-col md:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-5 sm:px-6 md:px-6 lg:px-8">
          <div className="max-w-5xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold">Menu Management</h1>
                <p className="text-[var(--tablet-muted)] mt-2">
                  Toggle item availability for the live menu.
                </p>
              </div>
              <button
                onClick={loadMenu}
                className="rounded-xl bg-[var(--tablet-accent)] px-5 py-3 text-sm font-semibold text-[var(--tablet-accent-contrast)] hover:opacity-90 touch-manipulation min-h-[48px]"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Stats Cards */}
            <div className="mt-5 bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/60 px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--tablet-muted)]">Total</div>
                  <div className="mt-1 text-2xl font-bold text-[var(--tablet-text)]">{totalItems}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-400">Available</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">{availableItems}</div>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-rose-400">Unavailable</div>
                  <div className="mt-1 text-2xl font-bold text-rose-400">{unavailableItems}</div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {/* Search and Filter Bar */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--tablet-muted)]" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)] text-[var(--tablet-text)] placeholder:text-[var(--tablet-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] min-h-[48px]"
                  />
                </div>
                
                {/* Filter Tabs */}
                <div className="flex rounded-xl border border-[var(--tablet-border)] overflow-hidden">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-3 text-sm font-medium touch-manipulation min-h-[48px] min-w-[80px] ${
                      filter === 'all' 
                        ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]' 
                        : 'bg-[var(--tablet-bg)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface)]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('available')}
                    className={`px-4 py-3 text-sm font-medium touch-manipulation min-h-[48px] min-w-[80px] border-l border-[var(--tablet-border)] ${
                      filter === 'available' 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-[var(--tablet-bg)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface)]'
                    }`}
                  >
                    Available
                  </button>
                  <button
                    onClick={() => setFilter('unavailable')}
                    className={`px-4 py-3 text-sm font-medium touch-manipulation min-h-[48px] min-w-[80px] border-l border-[var(--tablet-border)] ${
                      filter === 'unavailable' 
                        ? 'bg-rose-500 text-white' 
                        : 'bg-[var(--tablet-bg)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface)]'
                    }`}
                  >
                    Unavailable
                  </button>
                </div>
              </div>

              {/* Expand/Collapse All */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-sm text-[var(--tablet-accent)] hover:underline touch-manipulation"
                >
                  Expand All
                </button>
                <span className="text-[var(--tablet-muted)]">|</span>
                <button
                  onClick={collapseAll}
                  className="text-sm text-[var(--tablet-accent)] hover:underline touch-manipulation"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Categories - Dashboard-style list */}
            <div className="mt-4 space-y-4">
              {loading && categories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--tablet-border)] p-8 text-center text-[var(--tablet-muted)]">
                  Loading menu items…
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--tablet-border)] p-8 text-center text-[var(--tablet-muted)]">
                  {searchQuery || filter !== 'all' 
                    ? 'No items match your search/filter.' 
                    : 'No menu categories found.'}
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const isExpanded = expandedCategories.has(category.id);
                  const availableCount = category.items.filter(i => i.is_available).length;
                  
                  return (
                    <div 
                      key={category.id} 
                      className="rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] overflow-hidden"
                    >
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--tablet-bg)]/50 hover:bg-[var(--tablet-bg)] touch-manipulation"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            availableCount === category.items.length 
                              ? 'bg-emerald-400' 
                              : availableCount > 0 
                                ? 'bg-yellow-400' 
                                : 'bg-rose-400'
                          }`} />
                          <div className="text-left">
                            <h2 className="text-base font-semibold">{category.name}</h2>
                            <p className="text-sm text-[var(--tablet-muted)]">
                              {availableCount}/{category.items.length} available
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[var(--tablet-muted)]">{category.items.length} items</span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-[var(--tablet-muted)]" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-[var(--tablet-muted)]" />
                          )}
                        </div>
                      </button>

                      {/* Items Table Header */}
                      {isExpanded && (
                        <div className="hidden md:grid md:grid-cols-[80px_minmax(200px,1fr)_120px_140px] px-4 py-2 border-b border-[var(--tablet-border)] text-xs font-semibold text-[var(--tablet-muted)] uppercase tracking-wide bg-[var(--tablet-bg)]">
                          <div className="w-10"></div>
                          <div>Name</div>
                          <div className="text-center">Price</div>
                          <div className="text-center">Status</div>
                        </div>
                      )}

                      {/* Items List - Grid Layout */}
                      {isExpanded && (
                        <div className="divide-y divide-[var(--tablet-border)]">
                          {category.items.map((item) => (
                            <div 
                              key={item.id} 
                              className="grid grid-cols-[auto_1fr] md:grid-cols-[80px_minmax(200px,1fr)_120px_140px] items-center gap-x-3 gap-y-2 px-4 py-2.5 hover:bg-[var(--tablet-bg)]/30 transition-colors"
                            >
                              {/* Thumbnail - column 1 */}
                              <div className="w-10 h-10 rounded-lg bg-[var(--tablet-bg)] overflow-hidden flex-shrink-0 border border-[var(--tablet-border)]">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-sm font-medium text-[var(--tablet-muted)]">
                                      {item.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Item Name + Description - column 2 */}
                              <div className="min-w-0">
                                <span className="font-medium text-sm text-[var(--tablet-text)] block">
                                  {item.name}
                                </span>
                                {item.description && (
                                  <p className="text-xs text-[var(--tablet-muted)] line-clamp-2 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Price - column 3 (desktop only) */}
                              <div className="hidden md:block text-center">
                                <span className="text-sm font-semibold text-[var(--tablet-text)]">
                                  {formatMoney(item.price)}
                                </span>
                              </div>

                              {/* Status - column 4 (desktop only) */}
                              <div className="hidden md:flex justify-center">
                                <button
                                  onClick={() => toggleAvailability(item)}
                                  disabled={pendingItemId === item.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors touch-manipulation ${
                                    item.is_available
                                      ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                                      : 'border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                                  }`}
                                >
                                  {item.is_available ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                                  )}
                                  {item.is_available ? 'Available' : 'Unavailable'}
                                </button>
                              </div>

                              {/* Mobile layout: Price and Status inline */}
                              <div className="md:hidden col-span-2 flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[var(--tablet-text)]">
                                  {formatMoney(item.price)}
                                </span>
                                <button
                                  onClick={() => toggleAvailability(item)}
                                  disabled={pendingItemId === item.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors touch-manipulation ${
                                    item.is_available
                                      ? 'border-emerald-500/40 text-emerald-300'
                                      : 'border-rose-500/40 text-rose-300'
                                  }`}
                                >
                                  {item.is_available ? (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
