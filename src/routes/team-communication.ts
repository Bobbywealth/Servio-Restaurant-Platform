import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain'
]);

const CHANNEL_NAME_MAX_LENGTH = 80;
const CHANNEL_DESCRIPTION_MAX_LENGTH = 300;
const MESSAGE_MAX_LENGTH = 4000;
const ATTACHMENTS_MAX_COUNT = 5;
const ATTACHMENT_NAME_MAX_LENGTH = 200;
const ATTACHMENT_URL_MAX_LENGTH = 2048;
const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MESSAGE_PAGE_SIZE = 50;

type TeamAttachment = {
  name?: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
};

const success = (res: Response, data: unknown, status = 200) => {
  return res.status(status).json({ success: true, data, error: null });
};

const failure = (res: Response, status: number, message: string) => {
  return res.status(status).json({ success: false, data: null, error: { message } });
};

const isManagerOrAbove = (role?: string) => {
  return ['manager', 'owner', 'admin', 'platform-admin'].includes((role || '').toLowerCase());
};

const parseAttachments = (value: unknown): TeamAttachment[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as TeamAttachment[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const validateAttachments = (attachments: unknown): { ok: true; value: TeamAttachment[] } | { ok: false; message: string } => {
  if (attachments === undefined || attachments === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(attachments)) {
    return { ok: false, message: 'attachments must be an array' };
  }

  if (attachments.length > ATTACHMENTS_MAX_COUNT) {
    return { ok: false, message: `A maximum of ${ATTACHMENTS_MAX_COUNT} attachments is allowed` };
  }

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') {
      return { ok: false, message: 'Each attachment must be an object' };
    }

    const candidate = attachment as TeamAttachment;

    if (!candidate.url || typeof candidate.url !== 'string' || candidate.url.length > ATTACHMENT_URL_MAX_LENGTH) {
      return { ok: false, message: 'Each attachment must include a valid url' };
    }

    if (!candidate.mimeType || typeof candidate.mimeType !== 'string' || !ALLOWED_ATTACHMENT_MIME_TYPES.has(candidate.mimeType)) {
      return { ok: false, message: 'Attachment MIME type is not allowed' };
    }

    if (candidate.name && (typeof candidate.name !== 'string' || candidate.name.length > ATTACHMENT_NAME_MAX_LENGTH)) {
      return { ok: false, message: 'Attachment name is invalid' };
    }

    if (candidate.sizeBytes !== undefined) {
      if (typeof candidate.sizeBytes !== 'number' || candidate.sizeBytes < 0 || candidate.sizeBytes > ATTACHMENT_MAX_SIZE_BYTES) {
        return { ok: false, message: 'Attachment size is invalid' };
      }
    }
  }

  return { ok: true, value: attachments as TeamAttachment[] };
};

const getMembership = async (restaurantId: string, channelId: string, userId: string) => {
  const db = DatabaseService.getInstance().getDatabase();
  return db.get(
    `SELECT m.channel_id, m.user_id, c.name
     FROM team_channel_members m
     JOIN team_channels c ON c.id = m.channel_id
     WHERE m.restaurant_id = ?
       AND m.channel_id = ?
       AND m.user_id = ?
       AND c.is_archived = FALSE`,
    [restaurantId, channelId, userId]
  );
};

const ensureChannelMember = async (req: Request, res: Response, channelId: string) => {
  const user = req.user;
  if (!user?.id || !user.restaurantId) {
    failure(res, 401, 'Not authenticated');
    return null;
  }

  const membership = await getMembership(user.restaurantId, channelId, user.id);
  if (!membership) {
    failure(res, 403, 'You are not a member of this channel');
    return null;
  }

  return membership;
};

/**
 * GET /api/team/channels
 */
router.get('/channels', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const db = DatabaseService.getInstance().getDatabase();
  const channels = await db.all(
    `SELECT c.id, c.name, c.description, c.created_by, c.created_at, c.updated_at,
            m.joined_at,
            (SELECT COUNT(*) FROM team_channel_members cm WHERE cm.channel_id = c.id) as member_count,
            (SELECT COUNT(*)
             FROM team_messages tm
             WHERE tm.channel_id = c.id
               AND tm.created_at > COALESCE(m.last_read_at, '1970-01-01'::timestamptz)) as unread_count,
            (SELECT tm2.created_at
             FROM team_messages tm2
             WHERE tm2.channel_id = c.id
             ORDER BY tm2.created_at DESC
             LIMIT 1) as last_message_at
     FROM team_channels c
     JOIN team_channel_members m ON m.channel_id = c.id AND m.user_id = ?
     WHERE c.restaurant_id = ?
       AND c.is_archived = FALSE
     ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
    [user.id, user.restaurantId]
  );

  return success(res, { channels });
}));

/**
 * POST /api/team/channels
 */
router.post('/channels', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const { name, description, memberIds } = req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > CHANNEL_NAME_MAX_LENGTH) {
    return failure(res, 400, `name must be between 2 and ${CHANNEL_NAME_MAX_LENGTH} characters`);
  }

  if (description !== undefined && (typeof description !== 'string' || description.length > CHANNEL_DESCRIPTION_MAX_LENGTH)) {
    return failure(res, 400, `description must be ${CHANNEL_DESCRIPTION_MAX_LENGTH} characters or less`);
  }

  if (memberIds !== undefined && !Array.isArray(memberIds)) {
    return failure(res, 400, 'memberIds must be an array of user IDs');
  }

  const db = DatabaseService.getInstance().getDatabase();
  const requestedMemberIds = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))
    : [];
  const uniqueMemberIds = Array.from(new Set([...requestedMemberIds, user.id]));

  if (uniqueMemberIds.length > 100) {
    return failure(res, 400, 'A channel can include a maximum of 100 members');
  }

  const placeholders = uniqueMemberIds.map(() => '?').join(',');
  const existingMembers = uniqueMemberIds.length > 0
    ? await db.all<{ id: string }>(
      `SELECT id FROM users WHERE restaurant_id = ? AND id IN (${placeholders})`,
      [user.restaurantId, ...uniqueMemberIds]
    )
    : [];

  if (existingMembers.length !== uniqueMemberIds.length) {
    return failure(res, 400, 'One or more members were not found in this restaurant');
  }

  const channelId = uuidv4();
  await db.run(
    `INSERT INTO team_channels (id, restaurant_id, name, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [channelId, user.restaurantId, name.trim(), description?.trim() || null, user.id]
  );

  for (const memberId of uniqueMemberIds) {
    await db.run(
      `INSERT INTO team_channel_members (channel_id, user_id, restaurant_id, joined_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, memberId, user.restaurantId]
    );
  }

  const channel = await db.get(
    `SELECT id, restaurant_id, name, description, created_by, created_at, updated_at
     FROM team_channels
     WHERE id = ?`,
    [channelId]
  );

  return success(res, { channel }, 201);
}));

/**
 * POST /api/team/channels/:id/members
 */
router.post('/channels/:id/members', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const channelId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  if (!isManagerOrAbove(user.role)) {
    return failure(res, 403, 'Manager access required');
  }

  const membership = await ensureChannelMember(req, res, channelId);
  if (!membership) return;

  const { memberIds } = req.body || {};
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return failure(res, 400, 'memberIds array is required');
  }

  const uniqueMemberIds = Array.from(new Set(memberIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  if (uniqueMemberIds.length === 0) {
    return failure(res, 400, 'memberIds array is required');
  }

  const db = DatabaseService.getInstance().getDatabase();
  const placeholders = uniqueMemberIds.map(() => '?').join(',');
  const members = await db.all<{ id: string }>(
    `SELECT id FROM users WHERE restaurant_id = ? AND id IN (${placeholders})`,
    [user.restaurantId, ...uniqueMemberIds]
  );

  if (members.length !== uniqueMemberIds.length) {
    return failure(res, 400, 'One or more members were not found in this restaurant');
  }

  for (const memberId of uniqueMemberIds) {
    await db.run(
      `INSERT INTO team_channel_members (channel_id, user_id, restaurant_id, joined_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, memberId, user.restaurantId]
    );
  }

  return success(res, { channelId, addedMemberIds: uniqueMemberIds });
}));

/**
 * GET /api/team/channels/:id/messages?cursor=...
 */
router.get('/channels/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const channelId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const membership = await ensureChannelMember(req, res, channelId);
  if (!membership) return;

  const db = DatabaseService.getInstance().getDatabase();
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
  const cursorRow = cursor
    ? await db.get<{ created_at: string }>(
      `SELECT created_at FROM team_messages
       WHERE id = ? AND channel_id = ? AND restaurant_id = ?`,
      [cursor, channelId, user.restaurantId]
    )
    : null;

  const rows = await db.all(
    `SELECT tm.id, tm.channel_id, tm.user_id, u.name as user_name, tm.content, tm.attachments,
            tm.created_at, tm.updated_at, tm.edited_at
     FROM team_messages tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.restaurant_id = ?
       AND tm.channel_id = ?
       ${cursorRow ? 'AND tm.created_at < ?' : ''}
     ORDER BY tm.created_at DESC
     LIMIT ?`,
    cursorRow
      ? [user.restaurantId, channelId, cursorRow.created_at, MESSAGE_PAGE_SIZE]
      : [user.restaurantId, channelId, MESSAGE_PAGE_SIZE]
  );

  const messages = rows.map((row: any) => ({
    ...row,
    attachments: parseAttachments(row.attachments)
  }));

  const nextCursor = messages.length === MESSAGE_PAGE_SIZE ? messages[messages.length - 1].id : null;
  return success(res, { messages, nextCursor });
}));

/**
 * POST /api/team/channels/:id/messages
 */
router.post('/channels/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const channelId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const membership = await ensureChannelMember(req, res, channelId);
  if (!membership) return;

  const { content, attachments } = req.body || {};
  const attachmentValidation = validateAttachments(attachments);
  if (!attachmentValidation.ok) {
    return failure(res, 400, attachmentValidation.message);
  }

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!normalizedContent && attachmentValidation.value.length === 0) {
    return failure(res, 400, 'Message content or attachments are required');
  }

  if (normalizedContent.length > MESSAGE_MAX_LENGTH) {
    return failure(res, 400, `Message content must be ${MESSAGE_MAX_LENGTH} characters or less`);
  }

  const db = DatabaseService.getInstance().getDatabase();
  const messageId = uuidv4();

  await db.run(
    `INSERT INTO team_messages (id, channel_id, restaurant_id, user_id, content, attachments)
     VALUES (?, ?, ?, ?, ?, ?::jsonb)`,
    [messageId, channelId, user.restaurantId, user.id, normalizedContent || null, JSON.stringify(attachmentValidation.value)]
  );

  const message = await db.get(
    `SELECT tm.id, tm.channel_id, tm.user_id, u.name as user_name, tm.content, tm.attachments,
            tm.created_at, tm.updated_at, tm.edited_at
     FROM team_messages tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.id = ?`,
    [messageId]
  );

  return success(res, {
    message: {
      ...message,
      attachments: parseAttachments((message as any)?.attachments)
    }
  }, 201);
}));

/**
 * PATCH /api/team/messages/:id
 */
router.patch('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const messageId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const db = DatabaseService.getInstance().getDatabase();
  const message = await db.get<{ id: string; channel_id: string; user_id: string }>(
    `SELECT id, channel_id, user_id
     FROM team_messages
     WHERE id = ? AND restaurant_id = ?`,
    [messageId, user.restaurantId]
  );

  if (!message) {
    return failure(res, 404, 'Message not found');
  }

  const membership = await ensureChannelMember(req, res, message.channel_id);
  if (!membership) return;

  if (message.user_id !== user.id && !isManagerOrAbove(user.role)) {
    return failure(res, 403, 'You can only edit your own messages');
  }

  const { content, attachments } = req.body || {};
  const attachmentValidation = validateAttachments(attachments);
  if (!attachmentValidation.ok) {
    return failure(res, 400, attachmentValidation.message);
  }

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!normalizedContent && attachmentValidation.value.length === 0) {
    return failure(res, 400, 'Message content or attachments are required');
  }

  if (normalizedContent.length > MESSAGE_MAX_LENGTH) {
    return failure(res, 400, `Message content must be ${MESSAGE_MAX_LENGTH} characters or less`);
  }

  await db.run(
    `UPDATE team_messages
     SET content = ?, attachments = ?::jsonb, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND restaurant_id = ?`,
    [normalizedContent || null, JSON.stringify(attachmentValidation.value), messageId, user.restaurantId]
  );

  const updated = await db.get(
    `SELECT tm.id, tm.channel_id, tm.user_id, u.name as user_name, tm.content, tm.attachments,
            tm.created_at, tm.updated_at, tm.edited_at
     FROM team_messages tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.id = ?`,
    [messageId]
  );

  return success(res, {
    message: {
      ...updated,
      attachments: parseAttachments((updated as any)?.attachments)
    }
  });
}));

/**
 * DELETE /api/team/messages/:id
 */
router.delete('/messages/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const messageId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const db = DatabaseService.getInstance().getDatabase();
  const message = await db.get<{ id: string; channel_id: string; user_id: string }>(
    `SELECT id, channel_id, user_id
     FROM team_messages
     WHERE id = ? AND restaurant_id = ?`,
    [messageId, user.restaurantId]
  );

  if (!message) {
    return failure(res, 404, 'Message not found');
  }

  const membership = await ensureChannelMember(req, res, message.channel_id);
  if (!membership) return;

  if (message.user_id !== user.id && !isManagerOrAbove(user.role)) {
    return failure(res, 403, 'You can only delete your own messages');
  }

  await db.run(
    'DELETE FROM team_messages WHERE id = ? AND restaurant_id = ?',
    [messageId, user.restaurantId]
  );

  return success(res, { deletedMessageId: messageId });
}));

/**
 * POST /api/team/channels/:id/read
 */
router.post('/channels/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const channelId = req.params.id;

  if (!user?.id || !user.restaurantId) {
    return failure(res, 401, 'Not authenticated');
  }

  const membership = await ensureChannelMember(req, res, channelId);
  if (!membership) return;

  const db = DatabaseService.getInstance().getDatabase();
  const requestedMessageId = typeof req.body?.messageId === 'string' ? req.body.messageId : null;

  const latestMessage = requestedMessageId
    ? await db.get<{ id: string; created_at: string }>(
      `SELECT id, created_at
       FROM team_messages
       WHERE id = ? AND channel_id = ? AND restaurant_id = ?`,
      [requestedMessageId, channelId, user.restaurantId]
    )
    : await db.get<{ id: string; created_at: string }>(
      `SELECT id, created_at
       FROM team_messages
       WHERE channel_id = ? AND restaurant_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [channelId, user.restaurantId]
    );

  await db.run(
    `UPDATE team_channel_members
     SET last_read_message_id = ?,
         last_read_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE channel_id = ? AND user_id = ? AND restaurant_id = ?`,
    [latestMessage?.id || null, latestMessage?.created_at || new Date().toISOString(), channelId, user.id, user.restaurantId]
  );

  return success(res, {
    channelId,
    lastReadMessageId: latestMessage?.id || null,
    readAt: latestMessage?.created_at || new Date().toISOString()
  });
}));

export default router;
