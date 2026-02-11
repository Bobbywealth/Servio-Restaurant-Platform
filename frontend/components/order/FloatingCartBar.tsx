import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

interface FloatingCartBarProps {
  itemCount: number;
  total: number;
  onViewCart: () => void;
}

export function FloatingCartBar({ itemCount, total, onViewCart }: FloatingCartBarProps) {
  if (itemCount === 0) return null;

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/50 shadow-2xl shadow-slate-900/10 z-50 gpu-accelerated will-change-transform"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", bounce: 0.3 }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 pt-3 safe-area-inset-left safe-area-inset-right">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Your Order</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">${total.toFixed(2)}</p>
          </div>
        </div>
        <button
          onClick={onViewCart}
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-8 py-3 rounded-xl font-bold text-base sm:text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95"
        >
          View Cart
        </button>
      </div>
    </motion.div>
  );
}
