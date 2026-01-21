import { ServiceContainer } from '../container/ServiceContainer';
import type { DbClient } from '../services/DatabaseService';
import { createMockDb } from './mocks/mockDb';
import { createMockEventBus } from './mocks/mockEventBus';
import { createMockDatabaseService } from './mocks/mockDatabaseService';
import { OrderRepository } from '../repositories/OrderRepository';
import { OrderService } from '../services/OrderService';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { InventoryService } from '../services/InventoryService';
import { CacheService } from '../services/CacheService';

export class ServiceTestContainer extends ServiceContainer {
  static create(options: { db?: DbClient } = {}): ServiceTestContainer {
    const c = new ServiceTestContainer();
    c.setupTestServices(options);
    return c;
  }

  setupTestServices(options: { db?: DbClient } = {}): void {
    const db = options.db ?? createMockDb();
    const bus = createMockEventBus();
    const databaseService = createMockDatabaseService(db);
    const cacheService = new CacheService();

    // core
    this.registerValue('db', db);
    this.registerValue('eventBus', bus);
    this.registerValue('databaseService', databaseService);
    this.registerValue('cacheService', cacheService);

    // repos
    this.register('orderRepository', (resolvedDb) => new OrderRepository(resolvedDb), { dependencies: ['db'] });
    this.register('inventoryRepository', (resolvedDb) => new InventoryRepository(resolvedDb), { dependencies: ['db'] });

    // services
    this.register(
      'orderService',
      (orderRepository, resolvedBus, resolvedDatabaseService, resolvedCacheService) =>
        // databaseService here is a mock with the same surface area OrderService needs
        new OrderService(orderRepository, resolvedBus, resolvedDatabaseService as any, resolvedCacheService as any),
      { dependencies: ['orderRepository', 'eventBus', 'databaseService', 'cacheService'] }
    );
    this.register(
      'inventoryService',
      (inventoryRepository, resolvedBus, resolvedDatabaseService, resolvedCacheService) =>
        new InventoryService(inventoryRepository, resolvedBus, resolvedDatabaseService as any, resolvedCacheService as any),
      { dependencies: ['inventoryRepository', 'eventBus', 'databaseService', 'cacheService'] }
    );
  }

  reset(options: { db?: DbClient } = {}): void {
    this.clear();
    this.setupTestServices(options);
  }
}

