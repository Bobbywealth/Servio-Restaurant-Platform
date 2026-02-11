import React from 'react';
import { motion } from 'framer-motion';
import { Flame, ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { resolveMediaUrl } from '../../lib/utils';
import type { MenuItem } from './types';

interface MenuGridProps {
  visibleCategories: string[];
  allCategories: string[];
  itemsByCategory: Record<string, MenuItem[]>;
  collapsedCategories: Set<string>;
  showAllCategories: boolean;
  visibleCategoryCount: number;
  filteredItemCount: number;
  onToggleCategory: (cat: string) => void;
  onOpenItem: (item: MenuItem) => void;
  onShowMore: () => void;
  onShowAll: () => void;
  onShowLess: () => void;
  onClearFilters: () => void;
}

export function MenuGrid({
  visibleCategories,
  allCategories,
  itemsByCategory,
  collapsedCategories,
  showAllCategories,
  visibleCategoryCount,
  filteredItemCount,
  onToggleCategory,
  onOpenItem,
  onShowMore,
  onShowAll,
  onShowLess,
  onClearFilters,
}: MenuGridProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="space-y-8">
        {visibleCategories.map((cat, catIndex) => {
          const categoryItems = itemsByCategory[cat] || [];
          const isCollapsed = collapsedCategories.has(cat);
          const catLower = cat.toLowerCase();
          const isPopular = catLower.includes('popular') || catLower.includes('hot') || catLower.includes('best');
          const categoryId = `category-${cat.replace(/\s+/g, '-').toLowerCase()}`;

          if (categoryItems.length === 0) return null;

          return (
            <motion.div
              key={cat}
              id={categoryId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIndex * 0.05 }}
            >
              <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-white to-slate-50 rounded-2xl px-4 py-3 -mt-2 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  {isPopular && (
                    <span className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold rounded-full shadow-sm">
                      <Flame className="w-3 h-3" />
                      HOT
                    </span>
                  )}
                  <h2 className={`font-bold text-slate-900 ${isPopular ? 'text-xl' : 'text-lg'}`}>
                    {cat}
                  </h2>
                  <span className="text-sm text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                    {categoryItems.length}
                  </span>
                </div>
                <button
                  onClick={() => onToggleCategory(cat)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95"
                  aria-label={isCollapsed ? `Expand ${cat}` : `Collapse ${cat}`}
                >
                  {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>
              </div>

              {isCollapsed ? (
                <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
                  <p className="font-medium">{categoryItems.length} items in {cat}</p>
                  <button
                    onClick={() => onToggleCategory(cat)}
                    className="text-blue-600 font-semibold mt-1 hover:underline"
                  >
                    Tap to expand
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {categoryItems.map((item, itemIndex) => (
                    <motion.div
                      key={item.id}
                      className="group bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (catIndex * 0.05) + (itemIndex * 0.03) }}
                      onClick={() => onOpenItem(item)}
                    >
                      <div className="flex items-start gap-3">
                        {item.image && (
                          <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            <img
                              src={resolveMediaUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {item.name}
                          </h3>
                          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                            {item.description || 'Delicious item'}
                          </p>
                          <div className="flex items-center justify-between mt-1.5 sm:mt-2">
                            <p className="font-black text-base sm:text-lg text-slate-900">
                              {item.sizes && item.sizes.length > 0 ? (
                                <>From ${item.fromPrice?.toFixed(2) || item.price.toFixed(2)}</>
                              ) : (
                                <>${item.price.toFixed(2)}</>
                              )}
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}
                              className="shrink-0 p-2 sm:p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                              aria-label={`Add ${item.name} to cart`}
                            >
                              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}

        {!showAllCategories && allCategories.length > 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
            <button
              onClick={onShowMore}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-bold text-base shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 min-h-[52px]"
            >
              Show More Categories ({allCategories.length - visibleCategoryCount} remaining)
            </button>
            <div className="mt-3">
              <button
                onClick={onShowAll}
                className="text-blue-600 font-semibold hover:text-blue-700 text-sm underline"
              >
                Show all {allCategories.length} categories
              </button>
            </div>
          </motion.div>
        )}

        {showAllCategories && allCategories.length > 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
            <button
              onClick={onShowLess}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all min-h-[44px]"
            >
              Show Less Categories
            </button>
          </motion.div>
        )}
      </div>

      {filteredItemCount === 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No items found</h3>
          <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
          <button
            onClick={onClearFilters}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
