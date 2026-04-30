import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';
import { DatabaseService } from '../services/DatabaseService';

const router = Router();

const isSupportUser = (role?: string) => role === 'platform-admin' || role === 'admin';

const normalizeMessage = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

router.get('/threads', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const db = DatabaseService.getInstance().getDatabase();
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);

  const where: string[] = [];
  const params: any[] = [];

  if (status === 'open' || status === 'closed') {
    where.push('t.status = ?');
    params.push(status);
  }

  if (!isSupportUser(user.role)) {
    where.push('t.restaurant_id = ?');
    params.push(user.restaurantId);
  } else if (typeof req.query.restaurantId === 'string' && req.query.restaurantId.trim()) {
    where.push('t.restaurant_id = ?');
    params.push(req.query.restaurantId.trim());
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await db.all<any>(
    `SELECT t.*, r.name as restaurant_name,
            (
              SELECT m.message
              FROM support_chat_messages m
              WHERE m.thread_id = t.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) as last_message
       FROM support_chat_threads t
       JOIN restaurants r ON r.id = t.restaurant_id
       ${whereClause}
       ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
       LIMIT ?`,
    [...params, limit]
  );

  res.json({ success: true, data: { threads: rows } });
}));

router.post('/threads', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const db = DatabaseService.getInstance().getDatabase();

  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const requestedRestaurantId = typeof req.body?.restaurantId === 'string' ? req.body.restaurantId.trim() : '';
  const restaurantId = isSupportUser(user.role) && requestedRestaurantId ? requestedRestaurantId : user.restaurantId;
  const senderType = isSupportUser(user.role) ? 'support' : 'restaurant';

  const threadId = uuidv4();
  const messageId = uuidv4();

  await db.exec('BEGIN');
  try {
    await db.run(
      `INSERT INTO support_chat_threads (id, restaurant_id, status, created_by_user_id, last_message_at)
       VALUES (?, ?, 'open', ?, NOW())`,
      [threadId, restaurantId, user.id]
    );

    await db.run(
      `INSERT INTO support_chat_messages (id, thread_id, sender_type, sender_user_id, message)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, threadId, senderType, user.id, message]
    );

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  const io = req.app.get('socketio');
  if (io) io.emit('support-chat:updated', { threadId, restaurantId });

  res.status(201).json({ success: true, data: { threadId } });
}));

router.get('/threads/:threadId/messages', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const db = DatabaseService.getInstance().getDatabase();
  const { threadId } = req.params;

  const thread = await db.get<any>('SELECT * FROM support_chat_threads WHERE id = ?', [threadId]);
  if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

  if (!isSupportUser(user.role) && thread.restaurant_id !== user.restaurantId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const messages = await db.all<any>(
    `SELECT m.*, u.name as sender_name
       FROM support_chat_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
      WHERE m.thread_id = ?
      ORDER BY m.created_at ASC`,
    [threadId]
  );

  res.json({ success: true, data: { thread, messages } });
}));

router.post('/threads/:threadId/messages', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const db = DatabaseService.getInstance().getDatabase();
  const { threadId } = req.params;

  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const thread = await db.get<any>('SELECT * FROM support_chat_threads WHERE id = ?', [threadId]);
  if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

  if (!isSupportUser(user.role) && thread.restaurant_id !== user.restaurantId) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const senderType = isSupportUser(user.role) ? 'support' : 'restaurant';
  const messageId = uuidv4();

  await db.run(
    `INSERT INTO support_chat_messages (id, thread_id, sender_type, sender_user_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [messageId, threadId, senderType, user.id, message]
  );

  const io = req.app.get('socketio');
  if (io) io.emit('support-chat:updated', { threadId, restaurantId: thread.restaurant_id });

  res.status(201).json({ success: true, data: { id: messageId } });
}));

export default router;
