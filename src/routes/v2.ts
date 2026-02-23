import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { getFilterParams, buildWhereClause, buildOrderByClause } from '../utils/filter';
import { DatabaseService } from '../services/DatabaseService';

/**
 * Versioned API Routes (v2)
 * 
 * This module provides v2 versions of common endpoints with:
 * - Consistent pagination
 * - Advanced filtering
 * - Better error responses
 * - Cursor-based pagination option
 */

const router = Router();

/**
 * Generic list endpoint with full filtering support
 * GET /api/v2/:resource
 */
router.get('/:resource', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource } = req.params;
    const pagination = getPaginationParams(req.query as any, { defaultLimit: 20, maxLimit: 100 });
    const filters = getFilterParams(req.query as any);
    
    const db = DatabaseService.getInstance().getDatabase();
    
    // Build query
    const { where, params } = buildWhereClause(filters.filters);
    const orderBy = buildOrderByClause(pagination.sortBy, pagination.sortOrder);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${resource} ${where}`;
    const countResult = await db.all<{ total: string }>(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0');
    
    // Get paginated data
    const dataQuery = `SELECT * FROM ${resource} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, pagination.limit, pagination.offset];
    const dataResult = await db.all(dataQuery, dataParams);
    
    const response = createPaginatedResponse(dataResult, total, pagination);
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Generic get by ID endpoint
 * GET /api/v2/:resource/:id
 */
router.get('/:resource/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource, id } = req.params;
    
    const db = DatabaseService.getInstance().getDatabase();
    const query = `SELECT * FROM ${resource} WHERE id = $1`;
    const result = await db.all(query, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `${resource} with id ${id} not found`,
        requestId: req.id
      });
    }
    
    res.json(result[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * Generic create endpoint
 * POST /api/v2/:resource
 */
router.post('/:resource', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource } = req.params;
    const data = req.body;
    
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request body is required',
        requestId: req.id
      });
    }
    
    const db = DatabaseService.getInstance().getDatabase();
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${resource} (${columns.join(', ')}, created_at, updated_at)
      VALUES (${placeholders}, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await db.all(query, values);
    
    res.status(201).json(result[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * Generic update endpoint
 * PUT /api/v2/:resource/:id
 */
router.put('/:resource/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource, id } = req.params;
    const data = req.body;
    
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request body is required',
        requestId: req.id
      });
    }
    
    const db = DatabaseService.getInstance().getDatabase();
    const updates = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
    
    const query = `
      UPDATE ${resource}
      SET ${updates}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.all(query, [id, ...Object.values(data)]);
    
    if (result.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `${resource} with id ${id} not found`,
        requestId: req.id
      });
    }
    
    res.json(result[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * Generic delete endpoint
 * DELETE /api/v2/:resource/:id
 */
router.delete('/:resource/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource, id } = req.params;
    
    const db = DatabaseService.getInstance().getDatabase();
    const query = `DELETE FROM ${resource} WHERE id = $1 RETURNING id`;
    const result = await db.all(query, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `${resource} with id ${id} not found`,
        requestId: req.id
      });
    }
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Cursor-based pagination for large datasets
 * GET /api/v2/:resource/cursor
 */
router.get('/:resource/cursor', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resource } = req.params;
    const cursor = req.query.cursor as string;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = req.query.sortBy as string || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    const db = DatabaseService.getInstance().getDatabase();
    
    let whereClause = '';
    let params: any[] = [limit + 1]; // Fetch one extra to determine if there's more
    
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      const operator = sortOrder === 'ASC' ? '>' : '<';
      whereClause = `WHERE ${sortBy} ${operator} $${params.length + 1}`;
      params.push(decoded[sortBy]);
    }
    
    const query = `
      SELECT * FROM ${resource} ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $1
    `;
    
    const result = await db.all(query, params);
    
    const hasMore = result.length > limit;
    if (hasMore) {
      result.pop(); // Remove the extra item
    }
    
    const nextCursor = hasMore ? Buffer.from(JSON.stringify(result[result.length - 1])).toString('base64') : null;
    const prevCursor = cursor; // Can be used to go backwards
    
    res.json({
      data: result,
      pagination: {
        nextCursor,
        previousCursor: prevCursor,
        hasMore,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
