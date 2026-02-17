'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  is_available?: boolean;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

interface GlobalMenuManagerProps {
  onClose?: () => void;
}

export function GlobalMenuManager({ onClose }: GlobalMenuManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastPushId, setLastPushId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/global-menu');
      setCategories(response.data.categories || []);
      const restaurantRows = response.data.restaurants || [];
      setRestaurants(restaurantRows);
      setSelectedRestaurants(new Set(restaurantRows.map((r: Restaurant) => r.id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  const itemCount = useMemo(() => categories.reduce((acc, c) => acc + c.items.length, 0), [categories]);

  const toggleRestaurant = (id: string) => {
    const next = new Set(selectedRestaurants);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRestaurants(next);
  };

  const pushMenu = async () => {
    if (selectedRestaurants.size === 0) return;
    setSyncing(true);
    try {
      const response = await api.post('/api/admin/global-menu/push', {
        restaurant_ids: Array.from(selectedRestaurants)
      });
      setLastPushId(response.data.push_id || null);
    } finally {
      setSyncing(false);
    }
  };

  const rollbackMenu = async () => {
    if (!lastPushId) return;
    setSyncing(true);
    try {
      await api.post('/api/admin/global-menu/rollback', {
        push_id: lastPushId,
        restaurant_ids: Array.from(selectedRestaurants)
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Global Menu Manager</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Push menu changes to multiple restaurants and rollback if needed.</p>
        </div>
        {onClose && <button onClick={onClose} className="btn-secondary">Close</button>}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 text-gray-500 flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading menu...</div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 mb-2">Template Menu</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{categories.length} categories • {itemCount} items</p>
            <div className="mt-4 space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="rounded border border-gray-100 dark:border-gray-700 p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.items.length} items</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Target Restaurants</h3>
            <div className="space-y-2 mb-4">
              {restaurants.map((restaurant) => (
                <label key={restaurant.id} className="flex items-center justify-between rounded border border-gray-100 dark:border-gray-700 p-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{restaurant.name}</p>
                    <p className="text-xs text-gray-500">{restaurant.slug}</p>
                  </div>
                  <input type="checkbox" checked={selectedRestaurants.has(restaurant.id)} onChange={() => toggleRestaurant(restaurant.id)} />
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button className="btn-primary flex items-center gap-2" onClick={pushMenu} disabled={syncing || selectedRestaurants.size === 0}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Push Menu
              </button>
              <button className="btn-secondary" disabled={!lastPushId || syncing} onClick={rollbackMenu}>Rollback Last Push</button>
            </div>
            {lastPushId && <p className="mt-3 text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />Last push ID: {lastPushId}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default GlobalMenuManager;
