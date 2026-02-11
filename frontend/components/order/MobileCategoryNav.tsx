import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, CheckCircle2, Check, Flame, Tag } from 'lucide-react';
import type { MenuItem } from './types';

interface MobileCategoryNavProps {
  categories: string[];
  selectedCategory: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onCategorySelect: (cat: string) => void;
  itemsByCategory: Record<string, MenuItem[]>;
}

export function MobileCategoryNav({
  categories,
  selectedCategory,
  isOpen,
  onToggle,
  onCategorySelect,
  itemsByCategory,
}: MobileCategoryNavProps) {
  return (
    <div className="sticky top-[104px] sm:top-[120px] z-10 lg:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-2 sm:py-3 safe-area-inset-left safe-area-inset-right">
        <div className="relative">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-left focus:outline-none focus:border-blue-500 active:border-blue-600 transition-all"
          >
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {selectedCategory && selectedCategory !== 'all' ? selectedCategory : 'All Categories'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {categories.length} categories available
                </div>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 z-50"
              >
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[70vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-bold text-slate-900">Select a Category</div>
                  </div>

                  <button
                    onClick={() => { onCategorySelect('all'); onToggle(); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-900">All Items</div>
                        <div className="text-xs text-slate-500 mt-0.5">View all categories</div>
                      </div>
                    </div>
                    {(!selectedCategory || selectedCategory === 'all') && (
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </button>

                  {categories.map(cat => {
                    const catLower = cat.toLowerCase();
                    const isPopular = catLower.includes('popular') || catLower.includes('hot') || catLower.includes('best');
                    const categoryItems = itemsByCategory[cat] || [];

                    return (
                      <button
                        key={cat}
                        onClick={() => { onCategorySelect(cat); onToggle(); }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {isPopular ? (
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                              <Flame className="w-4 h-4 text-orange-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Tag className="w-4 h-4 text-slate-600" />
                            </div>
                          )}
                          <div className="text-left min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{cat}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>
                        {selectedCategory === cat && (
                          <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onToggle}
                className="fixed inset-0 bg-black/50 z-40"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
