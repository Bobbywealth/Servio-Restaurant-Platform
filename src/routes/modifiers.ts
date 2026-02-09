import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, UnauthorizedError } from '../middleware/errorHandler';

const router = Router();

const asString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function ensureRestaurantAccess(req: Request, restaurantId: string) {
  if (!req.user?.restaurantId || req.user.restaurantId !== restaurantId) {
    throw new UnauthorizedError('Restaurant access denied');
  }
}

// ---------------------------------------------------------------------------
// Modifier Groups CRUD
// ---------------------------------------------------------------------------

router.post('/restaurants/:restaurantId/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = asString(req.params.restaurantId);
  if (!restaurantId) return res.status(400).json({ success: false, error: { message: 'restaurantId is required' } });
  ensureRestaurantAccess(req, restaurantId);

  const {
    name,
    description = null,
    selectionType = 'single',
    minSelections = 0,
    maxSelections = null,
    isRequired = false,
    displayOrder = 0,
    isActive = true,
    options = [],
  } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Modifier group name is required' } });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const groupId = uuidv4();

  await db.run(`
    INSERT INTO modifier_groups (
      id, restaurant_id, name, description, selection_type, min_selections, max_selections,
      is_required, display_order, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    groupId,
    restaurantId,
    name.trim(),
    description,
    selectionType,
    Number(minSelections ?? 0),
    maxSelections !== null && maxSelections !== undefined ? Number(maxSelections) : null,
    Boolean(isRequired),
    Number(displayOrder ?? 0),
    Boolean(isActive)
  ]);

  const createdOptions = [];
  for (const opt of options as any[]) {
    if (!opt?.name) continue;
    const optionId = uuidv4();
    await db.run(`
      INSERT INTO modifier_options (
        id, restaurant_id, group_id, name, price_delta, is_active, display_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      optionId,
      restaurantId,
      groupId,
      String(opt.name).trim(),
      Number(opt.priceDelta ?? 0),
      opt.isActive === false ? 0 : 1,
      Number(opt.displayOrder ?? 0),
    ]);
    createdOptions.push({
      id: optionId,
      name: String(opt.name).trim(),
      priceDelta: Number(opt.priceDelta ?? 0),
      isActive: opt.isActive !== false,
      displayOrder: Number(opt.displayOrder ?? 0),
    });
  }

  res.status(201).json({
    success: true,
    data: {
      group: {
        id: groupId,
        restaurantId,
        name: name.trim(),
        description,
        selectionType,
        minSelections: Number(minSelections ?? 0),
        maxSelections: maxSelections !== null && maxSelections !== undefined ? Number(maxSelections) : null,
        isRequired: Boolean(isRequired),
        displayOrder: Number(displayOrder ?? 0),
        isActive: Boolean(isActive),
      },
      options: createdOptions,
    }
  });
}));

router.get('/restaurants/:restaurantId/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = asString(req.params.restaurantId);
  if (!restaurantId) return res.status(400).json({ success: false, error: { message: 'restaurantId is required' } });
  ensureRestaurantAccess(req, restaurantId);

  const includeOptions = String(req.query.includeOptions || '').toLowerCase() === 'true' || req.query.includeOptions === '1';
  const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true' || req.query.activeOnly === '1';

  const db = DatabaseService.getInstance().getDatabase();
  const groups = await db.all(`
    SELECT *
    FROM modifier_groups
    WHERE restaurant_id = ?
      AND deleted_at IS NULL
      ${activeOnly ? 'AND is_active = TRUE' : ''}
    ORDER BY display_order ASC, name ASC
  `, [restaurantId]);

  let optionsByGroup: Record<string, any[]> = {};
  if (includeOptions && groups.length) {
    const groupIds = groups.map((g: any) => g.id);
    const placeholders = groupIds.map(() => '?').join(',');
    const opts = await db.all(`
      SELECT *
      FROM modifier_options
      WHERE group_id IN (${placeholders})
        AND deleted_at IS NULL
        ${activeOnly ? 'AND is_active = TRUE' : ''}
      ORDER BY display_order ASC, name ASC
    `, groupIds);

    optionsByGroup = opts.reduce((acc: Record<string, any[]>, opt: any) => {
      if (!acc[opt.group_id]) acc[opt.group_id] = [];
      acc[opt.group_id].push(opt);
      return acc;
    }, {});
  }

  const enriched = groups.map((g: any) => ({
    ...g,
    options: includeOptions ? (optionsByGroup[g.id] || []) : undefined,
  }));

  res.json({ success: true, data: enriched });
}));

router.put('/modifier-groups/:groupId', asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const existing = await db.get(`SELECT * FROM modifier_groups WHERE id = ? AND deleted_at IS NULL`, [groupId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Modifier group not found' } });
  }
  ensureRestaurantAccess(req, existing.restaurant_id);

  const allowedFields = ['name', 'description', 'selectionType', 'minSelections', 'maxSelections', 'isRequired', 'displayOrder', 'isActive'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const field of allowedFields) {
    const value = (req.body || {})[field];
    if (value === undefined) continue;
    switch (field) {
      case 'selectionType':
        updates.push('selection_type = ?');
        params.push(value);
        break;
      case 'minSelections':
        updates.push('min_selections = ?');
        params.push(Number(value));
        break;
      case 'maxSelections':
        updates.push('max_selections = ?');
        params.push(value === null || value === undefined ? null : Number(value));
        break;
      case 'isRequired':
        updates.push('is_required = ?');
        params.push(Boolean(value));
        break;
      case 'displayOrder':
        updates.push('display_order = ?');
        params.push(Number(value));
        break;
      case 'isActive':
        updates.push('is_active = ?');
        params.push(Boolean(value));
        break;
      default:
        updates.push(`${field.toLowerCase()} = ?`);
        params.push(value);
    }
  }

  if (!updates.length) {
    return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(groupId);

  await db.run(`UPDATE modifier_groups SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = await db.get(`SELECT * FROM modifier_groups WHERE id = ?`, [groupId]);
  res.json({ success: true, data: updated });
}));

router.delete('/modifier-groups/:groupId', asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const db = DatabaseService.getInstance().getDatabase();
  const existing = await db.get(`SELECT * FROM modifier_groups WHERE id = ? AND deleted_at IS NULL`, [groupId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Modifier group not found' } });
  }
  ensureRestaurantAccess(req, existing.restaurant_id);

  await db.run(`
    UPDATE modifier_groups
    SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [groupId]);

  res.json({ success: true, data: { id: groupId } });
}));

// ---------------------------------------------------------------------------
// Modifier Options CRUD (within group)
// ---------------------------------------------------------------------------

router.post('/modifier-groups/:groupId/options', asyncHandler(async (req: Request, res: Response) => {
  const groupId = asString(req.params.groupId);
  if (!groupId) return res.status(400).json({ success: false, error: { message: 'groupId is required' } });
  const db = DatabaseService.getInstance().getDatabase();
  const group = await db.get(`SELECT * FROM modifier_groups WHERE id = ? AND deleted_at IS NULL`, [groupId]);
  if (!group) {
    return res.status(404).json({ success: false, error: { message: 'Modifier group not found' } });
  }
  ensureRestaurantAccess(req, group.restaurant_id);

  const { name, priceDelta = 0, displayOrder = 0, isActive = true } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Option name is required' } });
  }

  const optionId = uuidv4();
  await db.run(`
    INSERT INTO modifier_options (
      id, restaurant_id, group_id, name, price_delta, is_active, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    optionId,
    group.restaurant_id,
    groupId,
    name.trim(),
    Number(priceDelta ?? 0),
    Boolean(isActive),
    Number(displayOrder ?? 0),
  ]);

  res.status(201).json({
    success: true,
    data: {
      option: {
        id: optionId,
        groupId,
        name: name.trim(),
        priceDelta: Number(priceDelta ?? 0),
        isActive: Boolean(isActive),
        displayOrder: Number(displayOrder ?? 0),
      }
    }
  });
}));

router.put('/modifier-options/:optionId', asyncHandler(async (req: Request, res: Response) => {
  const optionId = asString(req.params.optionId);
  if (!optionId) return res.status(400).json({ success: false, error: { message: 'optionId is required' } });
  const db = DatabaseService.getInstance().getDatabase();
  const existing = await db.get(`SELECT * FROM modifier_options WHERE id = ? AND deleted_at IS NULL`, [optionId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Modifier option not found' } });
  }
  ensureRestaurantAccess(req, existing.restaurant_id);

  const allowed = ['name', 'priceDelta', 'isActive', 'displayOrder'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const field of allowed) {
    const value = (req.body || {})[field];
    if (value === undefined) continue;
    switch (field) {
      case 'priceDelta':
        updates.push('price_delta = ?');
        params.push(Number(value));
        break;
      case 'isActive':
        updates.push('is_active = ?');
        params.push(Boolean(value));
        break;
      case 'displayOrder':
        updates.push('display_order = ?');
        params.push(Number(value));
        break;
      case 'name':
        updates.push('name = ?');
        params.push(String(value).trim());
        break;
    }
  }
  if (!updates.length) {
    return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(optionId);

  await db.run(`UPDATE modifier_options SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await db.get(`SELECT * FROM modifier_options WHERE id = ?`, [optionId]);
  res.json({ success: true, data: updated });
}));

router.delete('/modifier-options/:optionId', asyncHandler(async (req: Request, res: Response) => {
  const optionId = asString(req.params.optionId);
  if (!optionId) return res.status(400).json({ success: false, error: { message: 'optionId is required' } });
  const db = DatabaseService.getInstance().getDatabase();
  const existing = await db.get(`SELECT * FROM modifier_options WHERE id = ? AND deleted_at IS NULL`, [optionId]);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Modifier option not found' } });
  }
  ensureRestaurantAccess(req, existing.restaurant_id);

  await db.run(`
    UPDATE modifier_options
    SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [optionId]);

  res.json({ success: true, data: { id: optionId } });
}));

// ---------------------------------------------------------------------------
// Attach/detach groups to items
// ---------------------------------------------------------------------------

async function assertItemRestaurant(db: any, itemId: string, restaurantId: string) {
  const item = await db.get(`SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?`, [itemId, restaurantId]);
  if (!item) {
    throw new UnauthorizedError('Item does not belong to this restaurant');
  }
}

router.post('/menu-items/:itemId/modifier-groups', asyncHandler(async (req: Request, res: Response) => {
  const itemId = asString(req.params.itemId);
  if (!itemId) return res.status(400).json({ success: false, error: { message: 'itemId is required' } });
  const { groupId, overrideMin = null, overrideMax = null, overrideRequired = null, displayOrder = 0 } = req.body || {};
  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'groupId is required' } });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const group = await db.get(`SELECT * FROM modifier_groups WHERE id = ? AND deleted_at IS NULL`, [groupId]);
  if (!group) {
    return res.status(404).json({ success: false, error: { message: 'Modifier group not found' } });
  }
  ensureRestaurantAccess(req, group.restaurant_id);
  await assertItemRestaurant(db, itemId, group.restaurant_id);

  const normalizedOverrides = {
    overrideMin: overrideMin === null || overrideMin === undefined ? null : Number(overrideMin),
    overrideMax: overrideMax === null || overrideMax === undefined ? null : Number(overrideMax),
    overrideRequired: overrideRequired === null || overrideRequired === undefined ? null : Boolean(overrideRequired),
    displayOrder: Number(displayOrder ?? 0),
  };

  const existing = await db.get(
    `
      SELECT id
      FROM item_modifier_groups
      WHERE item_id = ? AND group_id = ? AND deleted_at IS NULL
    `,
    [itemId, groupId]
  );
  if (existing) {
    await db.run(
      `
        UPDATE item_modifier_groups
        SET override_min = ?, override_max = ?, override_required = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        normalizedOverrides.overrideMin,
        normalizedOverrides.overrideMax,
        normalizedOverrides.overrideRequired,
        normalizedOverrides.displayOrder,
        existing.id,
      ]
    );
    return res.status(200).json({
      success: true,
      data: {
        id: existing.id,
        itemId,
        groupId,
        overrideMin: normalizedOverrides.overrideMin,
        overrideMax: normalizedOverrides.overrideMax,
        overrideRequired: normalizedOverrides.overrideRequired,
        displayOrder: normalizedOverrides.displayOrder,
      }
    });
  }

  const softDeleted = await db.get(
    `
      SELECT id
      FROM item_modifier_groups
      WHERE item_id = ? AND group_id = ? AND deleted_at IS NOT NULL
    `,
    [itemId, groupId]
  );
  if (softDeleted) {
    await db.run(
      `
        UPDATE item_modifier_groups
        SET deleted_at = NULL,
            override_min = ?,
            override_max = ?,
            override_required = ?,
            display_order = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        normalizedOverrides.overrideMin,
        normalizedOverrides.overrideMax,
        normalizedOverrides.overrideRequired,
        normalizedOverrides.displayOrder,
        softDeleted.id,
      ]
    );
    return res.status(200).json({
      success: true,
      data: {
        id: softDeleted.id,
        itemId,
        groupId,
        overrideMin: normalizedOverrides.overrideMin,
        overrideMax: normalizedOverrides.overrideMax,
        overrideRequired: normalizedOverrides.overrideRequired,
        displayOrder: normalizedOverrides.displayOrder,
      }
    });
  }

  const joinId = uuidv4();
  await db.run(`
    INSERT INTO item_modifier_groups (
      id, item_id, group_id, override_min, override_max, override_required, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    joinId,
    itemId,
    groupId,
    normalizedOverrides.overrideMin,
    normalizedOverrides.overrideMax,
    normalizedOverrides.overrideRequired,
    normalizedOverrides.displayOrder,
  ]);

  res.status(201).json({
    success: true,
    data: {
      id: joinId,
      itemId,
      groupId,
      overrideMin: normalizedOverrides.overrideMin,
      overrideMax: normalizedOverrides.overrideMax,
      overrideRequired: normalizedOverrides.overrideRequired,
      displayOrder: normalizedOverrides.displayOrder,
    }
  });
}));

router.delete('/menu-items/:itemId/modifier-groups/:groupId', asyncHandler(async (req: Request, res: Response) => {
  const itemId = asString(req.params.itemId);
  const groupId = asString(req.params.groupId);
  if (!itemId || !groupId) return res.status(400).json({ success: false, error: { message: 'itemId and groupId are required' } });
  const db = DatabaseService.getInstance().getDatabase();
  const group = await db.get(`SELECT * FROM modifier_groups WHERE id = ? AND deleted_at IS NULL`, [groupId]);
  if (!group) {
    return res.status(404).json({ success: false, error: { message: 'Modifier group not found' } });
  }
  ensureRestaurantAccess(req, group.restaurant_id);
  await assertItemRestaurant(db, itemId, group.restaurant_id);

  await db.run(`
    UPDATE item_modifier_groups
    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE item_id = ? AND group_id = ? AND deleted_at IS NULL
  `, [itemId, groupId]);

  res.json({ success: true, data: { itemId, groupId } });
}));

export default router;
