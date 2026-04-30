import { DatabaseService } from './DatabaseService';
import { EmailService } from './EmailService';
import { PushService } from './PushService';
import { logger } from '../utils/logger';

export class InventoryLowStockNotifierService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private lastNotifiedAt = new Map<string, number>();

  constructor(intervalMs = 15 * 60 * 1000) {
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.timer) return;
    this.run().catch((error) => logger.error('[low-stock-notifier] Initial run failed:', error));
    this.timer = setInterval(() => this.run().catch((error) => logger.error('[low-stock-notifier] Scheduled run failed:', error)), this.intervalMs);
    logger.info(`[low-stock-notifier] Started (every ${Math.round(this.intervalMs / 60000)} minutes)`);
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  async run(): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();
    const rows = await db.all<any>(`SELECT id, restaurant_id, name, unit, on_hand_qty, low_stock_threshold FROM inventory_items WHERE is_active = TRUE AND deleted_at IS NULL AND on_hand_qty <= low_stock_threshold`);
    if (!rows.length) return;

    const grouped = new Map<string, any[]>();
    rows.forEach((row) => grouped.set(row.restaurant_id, [...(grouped.get(row.restaurant_id) || []), row]));

    for (const [restaurantId, items] of grouped.entries()) {
      const key = `${restaurantId}:${new Date().toISOString().slice(0, 10)}`;
      if (this.lastNotifiedAt.has(key)) continue;

      const body = items.slice(0, 5).map((item) => `${item.name} (${item.on_hand_qty}/${item.low_stock_threshold} ${item.unit})`).join(', ');

      const pushService = new PushService(db);
      await pushService.sendToRestaurant(restaurantId, { title: `Low stock alert (${items.length})`, body, tag: 'inventory-low-stock' });

      const users = await db.all<{ email: string }>('SELECT email FROM users WHERE restaurant_id = ? AND is_active = TRUE AND email IS NOT NULL', [restaurantId]);
      for (const user of users) {
        try {
          await EmailService.getInstance().sendMail({ to: user.email, subject: `Low stock alert (${items.length})`, text: `The following items are low on stock: ${body}` });
        } catch (error) {
          logger.warn('[low-stock-notifier] Email send failed', { restaurantId, email: user.email, error: error instanceof Error ? error.message : String(error) });
        }
      }

      this.lastNotifiedAt.set(key, Date.now());
    }
  }
}
