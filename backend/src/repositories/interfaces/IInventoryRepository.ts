export interface InventoryItemRow {
  id: string;
  restaurant_id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  on_hand_qty: number;
  low_stock_threshold: number;
  category?: string | null;
  updated_at?: string | null;
}

export interface InventorySearchParams {
  q?: string;
  category?: string;
  lowStock?: boolean;
}

export interface InventoryCategoryCount {
  category: string | null;
  item_count: number;
}

export interface IInventoryRepository {
  search(restaurantId: string, params: InventorySearchParams): Promise<InventoryItemRow[]>;
  findById(restaurantId: string, itemId: string): Promise<InventoryItemRow | null>;
  findByNameLike(restaurantId: string, name: string): Promise<InventoryItemRow | null>;
  updateOnHandQty(itemId: string, newQuantity: number): Promise<void>;
  listLowStock(restaurantId: string): Promise<any[]>;
  listCategories(restaurantId: string): Promise<InventoryCategoryCount[]>;
}

