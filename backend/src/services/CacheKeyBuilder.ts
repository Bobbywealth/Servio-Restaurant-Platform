import crypto from 'crypto';

export class CacheKeyBuilder {
  static order(orderId: string) {
    return `order:${orderId}`;
  }

  static ordersByRestaurant(restaurantId: string, filters?: any) {
    const filterKey = filters ? `:${this.hashFilters(filters)}` : '';
    return `orders:restaurant:${restaurantId}${filterKey}`;
  }

  static ordersByRestaurantPaged(restaurantId: string, filters: any, limit: number, offset: number) {
    return `${this.ordersByRestaurant(restaurantId, filters)}:limit:${limit}:offset:${offset}`;
  }

  static orderStatsSummary(restaurantId: string) {
    return `orders:restaurant:${restaurantId}:stats:summary`;
  }

  static orderWaitingTimes(restaurantId: string) {
    return `orders:restaurant:${restaurantId}:waiting-times`;
  }

  static inventorySearch(restaurantId: string, params: any) {
    return `inventory:restaurant:${restaurantId}:search:${this.hashFilters(params || {})}`;
  }

  static inventoryLowStock(restaurantId: string) {
    return `inventory:restaurant:${restaurantId}:low-stock`;
  }

  static inventoryCategories(restaurantId: string) {
    return `inventory:restaurant:${restaurantId}:categories`;
  }

  static orderPatterns(restaurantId: string) {
    return [`order:*`, `orders:restaurant:${restaurantId}:*`];
  }

  static inventoryPatterns(restaurantId: string) {
    return [`inventory:restaurant:${restaurantId}:*`, `inventory:item:*`];
  }

  private static hashFilters(filters: any): string {
    const sorted = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as any);

    return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').substring(0, 8);
  }
}

