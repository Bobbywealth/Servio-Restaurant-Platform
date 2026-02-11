import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

interface StickyNavProps {
  categories: string[];
  showAllCategories: boolean;
  onCategorySelect: (cat: string) => void;
  onToggleShowAll: () => void;
}

export function StickyNav({ categories, showAllCategories, onCategorySelect, onToggleShowAll }: StickyNavProps) {
  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-[68px] z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm"
    >
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          <button
            onClick={() => { onCategorySelect('all'); onToggleShowAll(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all bg-blue-600 text-white flex-shrink-0"
          >
            All
          </button>

          {(showAllCategories ? categories : categories.slice(0, 2)).map(cat => {
            const catLower = cat.toLowerCase();
            const isPopular = catLower.includes('popular') || catLower.includes('hot') || catLower.includes('best');
            return (
              <button
                key={cat}
                onClick={() => onCategorySelect(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 max-w-[100px] truncate ${
                  isPopular
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={cat}
              >
                <span className="truncate">{cat}</span>
              </button>
            );
          })}

          {categories.length > 2 && (
            <button
              onClick={onToggleShowAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                showAllCategories
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {showAllCategories ? 'Less' : `+${categories.length - 2}`}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
