import type { EventBus } from '../events/bus';
import type { DatabaseService } from './DatabaseService';
import { InventoryItemNotFoundError, InventoryValidationError } from '../errors/ServiceErrors';
import { logger } from '../utils/logger';
import type { IInventoryRepository } from '../repositories/interfaces/IInventoryRepository';
import type { CacheService } from './CacheService';
import { CacheKeyBuilder } from './CacheKeyBuilder';

export class InventoryService {
  constructor(
    private inventoryRepository: IInventoryRepository,
    private bus: EventBus,
    private databaseService: DatabaseService,
    private cache: CacheService
  ) {}

  async searchInventory(restaurantId: string, params: { q?: string; category?: string; lowStock?: string }): Promise<any[]> {
    const key = CacheKeyBuilder.inventorySearch(restaurantId, params);
    return this.cache.getOrSet(key, 30, () =>
      this.inventoryRepository.search(restaurantId, {
        q: params.q,
        category: params.category,
        lowStock: params.lowStock === 'true'
      })
    );
  }

  async receiveInventory(params: {
    restaurantId: string;
    userId: string;
    items: Array<{ name: string; quantity: number }>;
  }): Promise<{ results: Array<{ item: string; received: number; newTotal: number; unit: string | null }> }> {
    if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
      throw new InventoryValidationError('Items array is required');
    }

    const results: Array<{ item: string; received: number; newTotal: number; unit: string | null }> = [];

    for (const item of params.items) {
      const name = item?.name;
      const quantity = item?.quantity;
      if (!name || !quantity) continue;

      const inventoryItem = await this.inventoryRepository.findByNameLike(params.restaurantId, name);
      if (!inventoryItem) continue;

      const newQuantity = Number(inventoryItem.on_hand_qty) + Number(quantity);
      await this.inventoryRepository.updateOnHandQty(inventoryItem.id, newQuantity);

      await this.databaseService.logAudit(
        params.restaurantId,
        params.userId || 'system',
        'receive_inventory',
        'inventory',
        inventoryItem.id,
        { name, previousQuantity: inventoryItem.on_hand_qty, received: quantity, newQuantity }
      );

      await this.bus.emit('inventory.updated', {
        restaurantId: params.restaurantId,
        type: 'inventory.updated',
        actor: { actorType: 'user', actorId: params.userId },
        payload: { itemId: inventoryItem.id, previousQuantity: inventoryItem.on_hand_qty, newQuantity },
        occurredAt: new Date().toISOString()
      });

      if (newQuantity <= Number(inventoryItem.low_stock_threshold)) {
        await this.bus.emit('inventory.low_stock', {
          restaurantId: params.restaurantId,
          type: 'inventory.low_stock',
          actor: { actorType: 'system' },
          payload: {
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            currentQuantity: newQuantity,
            threshold: inventoryItem.low_stock_threshold
          },
          occurredAt: new Date().toISOString()
        });
      }

      results.push({ item: name, received: quantity, newTotal: newQuantity, unit: inventoryItem.unit ?? null });
    }

    logger.info(`Inventory received: ${results.length} items updated`);
    await this.cache.invalidate(CacheKeyBuilder.inventoryPatterns(params.restaurantId).join('|'));
    return { results };
  }

  async adjustInventory(params: {
    restaurantId: string;
    userId: string;
    itemId: string;
    quantity: number;
    reason: string;
  }): Promise<{
    itemId: string;
    itemName: string;
    previousQuantity: number;
    adjustment: number;
    newQuantity: number;
    reason: string;
    unit: string | null;
  }> {
    if (!params.itemId || params.quantity === undefined || !params.reason) {
      throw new InventoryValidationError('itemId, quantity, and reason are required');
    }

    const item = await this.inventoryRepository.findById(params.restaurantId, params.itemId);
    if (!item) throw new InventoryItemNotFoundError();

    const newQuantity = Number(item.on_hand_qty) + Number(params.quantity);
    if (newQuantity < 0) {
      throw new InventoryValidationError(
        `Cannot reduce ${item.name} below 0. Current: ${item.on_hand_qty}, Requested: ${params.quantity}`
      );
    }

    await this.inventoryRepository.updateOnHandQty(params.itemId, newQuantity);

    await this.databaseService.logAudit(
      params.restaurantId,
      params.userId || 'system',
      'adjust_inventory',
      'inventory',
      params.itemId,
      { itemName: item.name, previousQuantity: item.on_hand_qty, adjustment: params.quantity, newQuantity, reason: params.reason }
    );

    await this.bus.emit('inventory.updated', {
      restaurantId: params.restaurantId,
      type: 'inventory.updated',
      actor: { actorType: 'user', actorId: params.userId },
      payload: { itemId: params.itemId, previousQuantity: item.on_hand_qty, newQuantity, reason: params.reason },
      occurredAt: new Date().toISOString()
    });

    if (newQuantity <= Number(item.low_stock_threshold)) {
      await this.bus.emit('inventory.low_stock', {
        restaurantId: params.restaurantId,
        type: 'inventory.low_stock',
        actor: { actorType: 'system' },
        payload: {
          itemId: item.id,
          itemName: item.name,
          currentQuantity: newQuantity,
          threshold: item.low_stock_threshold
        },
        occurredAt: new Date().toISOString()
      });
    }

    logger.info(`Inventory adjusted: ${item.name} ${params.quantity > 0 ? '+' : ''}${params.quantity} (reason: ${params.reason})`);

    await this.cache.invalidate(CacheKeyBuilder.inventoryPatterns(params.restaurantId).join('|'));

    return {
      itemId: params.itemId,
      itemName: item.name,
      previousQuantity: item.on_hand_qty,
      adjustment: params.quantity,
      newQuantity,
      reason: params.reason,
      unit: item.unit ?? null
    };
  }

  async listLowStock(restaurantId: string): Promise<any[]> {
    const key = CacheKeyBuilder.inventoryLowStock(restaurantId);
    return this.cache.getOrSet(key, 30, () => this.inventoryRepository.listLowStock(restaurantId));
  }

  async listCategories(restaurantId: string): Promise<any[]> {
    const key = CacheKeyBuilder.inventoryCategories(restaurantId);
    return this.cache.getOrSet(key, 300, () => this.inventoryRepository.listCategories(restaurantId));
  }
}

