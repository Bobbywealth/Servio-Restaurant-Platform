import { container } from '../container/ServiceContainer';
import { DatabaseService } from '../services/DatabaseService';
import { eventBus } from '../events/bus';
import { OrderRepository } from '../repositories/OrderRepository';
import { OrderService } from '../services/OrderService';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { InventoryService } from '../services/InventoryService';
import { getCacheService } from '../services/CacheService';
import { HttpClientService } from '../services/HttpClientService';

let registered = false;

export function registerServices(): void {
  if (registered) return;

  // Shared singletons (match existing behavior across the codebase)
  container.registerValue('eventBus', eventBus);

  // Infrastructure
  container.register('db', () => DatabaseService.getInstance().getDatabase());
  container.registerValue('databaseService', DatabaseService.getInstance());
  container.registerValue('cacheService', getCacheService());
  container.register('httpClientService', () => new HttpClientService(), { lifetime: 'singleton' });

  // Repositories
  container.register('orderRepository', (db) => new OrderRepository(db), { dependencies: ['db'] });
  container.register('inventoryRepository', (db) => new InventoryRepository(db), { dependencies: ['db'] });

  // Domain services
  container.register(
    'orderService',
    (orderRepository, bus, databaseService, cacheService) =>
      new OrderService(orderRepository, bus, databaseService, cacheService),
    { dependencies: ['orderRepository', 'eventBus', 'databaseService', 'cacheService'] }
  );
  container.register(
    'inventoryService',
    (inventoryRepository, bus, databaseService, cacheService) =>
      new InventoryService(inventoryRepository, bus, databaseService, cacheService),
    { dependencies: ['inventoryRepository', 'eventBus', 'databaseService', 'cacheService'] }
  );

  registered = true;
}

export function getService<T>(name: string): T {
  return container.get<T>(name);
}

