import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const parseMetadata = (value: any) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
};

const getUnreadCount = async (restaurantId: string, role: string, userId: string) => {
  const db = DatabaseService.getInstance().getDatabase();
  const result = await db.get(
    `
    SELECT COUNT(DISTINCT n.id) as c
    FROM notifications n
    JOIN notification_recipients nr ON nr.notification_id = n.id
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.restaurant_id = ?
      AND (
        nr.recipient_type = 'restaurant'
        OR (nr.recipient_type = 'role' AND nr.recipient_role = ?)
        OR (nr.recipient_type = 'user' AND nr.recipient_user_id = ?)
      )
      AND r.read_at IS NULL
    `,
    [userId, restaurantId, role, userId]
  );
  return Number(result?.c ?? 0);
};

/**
 * GET /api/notifications?limit=50
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const restaurantId = user.restaurantId;
  const userId = user.id;
  const role = user.role;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const db = DatabaseService.getInstance().getDatabase();
  const rows = await db.all(
    `
    SELECT DISTINCT n.*, r.read_at as read_at,
      CASE WHEN r.read_at IS NULL THEN 0 ELSE 1 END as is_read
    FROM notifications n
    JOIN notification_recipients nr ON nr.notification_id = n.id
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.restaurant_id = ?
      AND (
        nr.recipient_type = 'restaurant'
        OR (nr.recipient_type = 'role' AND nr.recipient_role = ?)
        OR (nr.recipient_type = 'user' AND nr.recipient_user_id = ?)
      )
    ORDER BY n.created_at DESC
    LIMIT ?
    `,
    [userId, restaurantId, role, userId, limit]
  );

  const unreadCount = await getUnreadCount(restaurantId, role, userId);

  const items = rows.map((row: any) => ({
    ...row,
    metadata: parseMetadata(row.metadata),
    is_read: Boolean(row.is_read),
    read_at: row.read_at || null
  }));

  res.json({ success: true, data: { unreadCount, items } });
}));

/**
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const userId = user.id;
  const role = user.role;
  const restaurantId = user.restaurantId;
  const id = req.params.id;

  const db = DatabaseService.getInstance().getDatabase();
  await db.run(
    `INSERT INTO notification_reads (notification_id, user_id, read_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = excluded.read_at`,
    [id, userId]
  );

  const unreadCount = await getUnreadCount(restaurantId, role, userId);
  const io = req.app.get('socketio');
  if (io) {
    io.to(`user-${userId}`).emit('notifications.unread_count.updated', { unreadCount });
  }

  res.json({ success: true, data: { ok: true, unreadCount } });
}));

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const restaurantId = user.restaurantId;
  const userId = user.id;
  const role = user.role;

  const db = DatabaseService.getInstance().getDatabase();
  await db.run(
    `
    INSERT INTO notification_reads (notification_id, user_id, read_at)
    SELECT DISTINCT n.id, ?, CURRENT_TIMESTAMP
    FROM notifications n
    JOIN notification_recipients nr ON nr.notification_id = n.id
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
    WHERE n.restaurant_id = ?
      AND (
        nr.recipient_type = 'restaurant'
        OR (nr.recipient_type = 'role' AND nr.recipient_role = ?)
        OR (nr.recipient_type = 'user' AND nr.recipient_user_id = ?)
      )
      AND r.read_at IS NULL
    ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = excluded.read_at
    `,
    [userId, userId, restaurantId, role, userId]
  );

  const unreadCount = await getUnreadCount(restaurantId, role, userId);
  const io = req.app.get('socketio');
  if (io) {
    io.to(`user-${userId}`).emit('notifications.unread_count.updated', { unreadCount });
  }

  res.json({ success: true, data: { ok: true, unreadCount } });
}));

export default router;
