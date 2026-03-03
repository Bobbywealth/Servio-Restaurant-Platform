import { logger } from './logger';

type CacheInvalidator = (matcher: (url: string) => boolean) => number;

let cacheInvalidator: CacheInvalidator | null = null;

const extractUrlFromCacheKey = (cacheKey: string): string => {
  const separatorIndex = cacheKey.indexOf(':');
  if (separatorIndex === -1) return cacheKey;
  return cacheKey.slice(separatorIndex + 1);
};

export const registerCacheInvalidator = (invalidator: CacheInvalidator) => {
  cacheInvalidator = invalidator;
};

export const invalidateCacheByUrlFragment = (urlFragment: string): number => {
  if (!cacheInvalidator) {
    logger.warn('[cache] invalidateCacheByUrlFragment called before cache invalidator registration', {
      urlFragment
    });
    return 0;
  }

  const deletedCount = cacheInvalidator((url) => url.includes(urlFragment));
  logger.info('[cache] cache invalidated by URL fragment', { urlFragment, deletedCount });
  return deletedCount;
};

export const invalidateRestaurantOrderCache = (restaurantId?: string | null, orderId?: string | null): number => {
  if (!cacheInvalidator) {
    logger.warn('[cache] invalidateRestaurantOrderCache called before cache invalidator registration', {
      restaurantId,
      orderId
    });
    return 0;
  }

  const safeRestaurantId = restaurantId ? String(restaurantId) : null;
  const safeOrderId = orderId ? String(orderId) : null;

  const deletedCount = cacheInvalidator((url) => {
    if (!url.startsWith('/api/orders')) return false;

    if (safeOrderId && (
      url.includes(`/api/orders/${safeOrderId}`) ||
      url.includes(`/api/orders/public/order/${safeOrderId}`) ||
      url.includes(`orderId=${encodeURIComponent(safeOrderId)}`)
    )) {
      return true;
    }

    if (safeRestaurantId && (
      url.includes(`restaurantId=${encodeURIComponent(safeRestaurantId)}`) ||
      url.includes(`/api/orders/public/${encodeURIComponent(safeRestaurantId)}`)
    )) {
      return true;
    }

    // Most dashboard order routes are restaurant-scoped without explicit query params.
    return true;
  });

  logger.info('[cache] order cache invalidated', {
    restaurantId: safeRestaurantId,
    orderId: safeOrderId,
    deletedCount
  });
  return deletedCount;
};

export const getCacheUrl = (cacheKey: string): string => extractUrlFromCacheKey(cacheKey);
