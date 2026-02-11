import React from 'react';
import { Flame } from 'lucide-react';
import type { MenuItem } from './types';

interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
  itemsByCategory: Record<string, MenuItem[]>;
}

export function CategorySidebar({ categories, selectedCategory, onCategorySelect, itemsByCategory }: CategorySidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0 sticky top-40 h-fit">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
          <h3 className="text-white font-bold text-sm uppercase tracking-wide">Categories</h3>
        </div>
        <nav className="max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <ul className="p-2 space-y-1">
            <li>
              <button
                onClick={() => onCategorySelect('all')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  !selectedCategory || selectedCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                All Items
              </button>
            </li>
            {categories.map((cat) => {
              const catLower = cat.toLowerCase();
              const isPopular = catLower.includes('popular') || catLower.includes('hot') || catLower.includes('best');
              const categoryItems = itemsByCategory[cat] || [];

              return (
                <li key={cat}>
                  <button
                    onClick={() => onCategorySelect(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isPopular && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                      <span className="truncate">{cat}</span>
                    </span>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                      selectedCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {categoryItems.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
