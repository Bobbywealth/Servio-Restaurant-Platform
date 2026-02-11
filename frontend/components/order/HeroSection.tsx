import React from 'react';
import { motion } from 'framer-motion';
import { resolveMediaUrl } from '../../lib/utils';
import type { RestaurantInfo } from './types';

interface HeroSectionProps {
  restaurant: RestaurantInfo;
}

export function HeroSection({ restaurant }: HeroSectionProps) {
  return (
    <div className="relative h-44 sm:h-56 md:h-72 overflow-hidden">
      {restaurant.cover_image_url ? (
        <img
          src={resolveMediaUrl(restaurant.cover_image_url)}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 safe-area-inset-left safe-area-inset-right">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3 sm:gap-5">
            {restaurant.logo_url && (
              <motion.div
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-2xl p-1.5 sm:p-2 shadow-2xl shrink-0"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <img src={resolveMediaUrl(restaurant.logo_url)} alt="Logo" className="w-full h-full object-contain rounded-xl" />
              </motion.div>
            )}
            <motion.div
              className="mb-1 min-w-0 flex-1"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight truncate">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-white/70 text-xs sm:text-sm md:text-base mt-1 line-clamp-2">{restaurant.description}</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
