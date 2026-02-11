import React from 'react';
import { Search, X, Flame, Leaf, DollarSign, Filter } from 'lucide-react';
import type { MenuItem } from './types';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onToggleFilter: (filter: string) => void;
  onClearFilters: () => void;
  isFilterMenuOpen: boolean;
  onToggleFilterMenu: () => void;
  filteredItemCount: number;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  isFilterMenuOpen,
  onToggleFilterMenu,
  filteredItemCount,
}: SearchFilterBarProps) {
  return (
    <div className="sticky top-[52px] sm:top-[60px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-2 sm:py-3 safe-area-inset-left safe-area-inset-right">
        {/* Search Input */}
        <div className="relative mb-2 sm:mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-10 py-3 bg-slate-100 border-2 border-transparent focus:border-blue-500 rounded-xl focus:outline-none text-base transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="text-sm text-slate-500">
            {filteredItemCount} results found
          </div>
        )}

        {/* Filter Row */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => onToggleFilter('popular')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilters.includes('popular')
                ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            Popular
          </button>

          <button
            onClick={() => onToggleFilter('vegetarian')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilters.includes('vegetarian')
                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }`}
          >
            <Leaf className="w-4 h-4" />
            Vegetarian
          </button>

          <button
            onClick={() => onToggleFilter('under10')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilters.includes('under10')
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Under $10
          </button>

          <button
            onClick={onToggleFilterMenu}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              isFilterMenuOpen
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            More
          </button>

          {(searchQuery || activeFilters.length > 0) && (
            <button
              onClick={onClearFilters}
              className="ml-auto text-sm text-slate-500 hover:text-slate-700 font-medium whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
