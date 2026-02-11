import React from 'react';
import { Clock, MapPin, Phone } from 'lucide-react';
import type { RestaurantInfo } from './types';

interface InfoBarProps {
  restaurant: RestaurantInfo;
}

export function InfoBar({ restaurant }: InfoBarProps) {
  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/50 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-2.5 sm:py-3 safe-area-inset-left safe-area-inset-right">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-6 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 20-30 min
          </span>
          {restaurant.address?.city && (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" /> {restaurant.address.city}, {restaurant.address.state}
            </span>
          )}
          {restaurant.phone && (
            <span className="hidden xs:inline-flex items-center gap-1 sm:gap-1.5 text-slate-600">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" /> {restaurant.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
