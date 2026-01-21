import type { DbClient } from '../services/DatabaseService';
import type {
  IInventoryRepository,
  InventoryCategoryCount,
  InventoryItemRow,
  InventorySearchParams
} from './interfaces/IInventoryRepository';

function asNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number(value ?? 0);
}

export class InventoryRepository implements IInventoryRepository {
  constructor(private db: DbClient) {}

  async search(restaurantId: string, params: InventorySearchParams): Promise<InventoryItemRow[]> {
    const conditions: string[] = ['restaurant_id = ?'];
    const sqlParams: any[] = [restaurantId];

    if (params.q) {
      conditions.push('(name LIKE ? OR sku LIKE ?)');
      sqlParams.push(`%${params.q}%`, `%${params.q}%`);
    }

    if (params.category) {
      conditions.push('category = ?');
      sqlParams.push(params.category);
    }

    if (params.lowStock) {
      conditions.push('on_hand_qty <= low_stock_threshold');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const rows = await this.db.all<any>(`SELECT * FROM inventory_items ${whereClause} ORDER BY name`, sqlParams);
    return rows.map((r: any) => ({
      ...r,
      on_hand_qty: asNumber(r.on_hand_qty),
      low_stock_threshold: asNumber(r.low_stock_threshold)
    }));
  }

  async findById(restaurantId: string, itemId: string): Promise<InventoryItemRow | null> {
    const row = await this.db.get<any>('SELECT * FROM inventory_items WHERE id = ? AND restaurant_id = ?', [
      itemId,
      restaurantId
    ]);
    if (!row) return null;
    return {
      ...row,
      on_hand_qty: asNumber(row.on_hand_qty),
      low_stock_threshold: asNumber(row.low_stock_threshold)
    };
  }

  async findByNameLike(restaurantId: string, name: string): Promise<InventoryItemRow | null> {
    const row = await this.db.get<any>('SELECT * FROM inventory_items WHERE name LIKE ? AND restaurant_id = ?', [
      `%${name}%`,
      restaurantId
    ]);
    if (!row) return null;
    return {
      ...row,
      on_hand_qty: asNumber(row.on_hand_qty),
      low_stock_threshold: asNumber(row.low_stock_threshold)
    };
  }

  async updateOnHandQty(itemId: string, newQuantity: number): Promise<void> {
    await this.db.run('UPDATE inventory_items SET on_hand_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      newQuantity,
      itemId
    ]);
  }

  async listLowStock(restaurantId: string): Promise<any[]> {
    return await this.db.all<any>(
      `
        SELECT *,
               CASE
                 WHEN on_hand_qty = 0 THEN 'out_of_stock'
                 WHEN on_hand_qty <= low_stock_threshold THEN 'low_stock'
                 ELSE 'normal'
               END as stock_status
        FROM inventory_items
        WHERE restaurant_id = ? AND on_hand_qty <= low_stock_threshold
        ORDER BY on_hand_qty ASC
      `,
      [restaurantId]
    );
  }

  async listCategories(restaurantId: string): Promise<InventoryCategoryCount[]> {
    const rows = await this.db.all<any>(
      `
        SELECT category, COUNT(*) as item_count
        FROM inventory_items
        WHERE restaurant_id = ?
        GROUP BY category
        ORDER BY category
      `,
      [restaurantId]
    );
    return rows.map((r: any) => ({ category: r.category ?? null, item_count: asNumber(r.item_count) }));
  }
}

