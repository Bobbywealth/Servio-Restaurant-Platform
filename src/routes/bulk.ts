import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Bulk Operations API
 * 
 * Allows batch operations on multiple resources:
 * - POST /api/bulk - Create multiple resources
 * - PUT /api/bulk - Update multiple resources
 * - DELETE /api/bulk - Delete multiple resources
 * - PATCH /api/bulk - Patch multiple resources
 * 
 * Supports validation, partial success, and detailed reporting
 */

interface BulkOperationRequest {
  operations: BulkOperation[];
  continueOnError?: boolean;
}

interface BulkOperation {
  id?: string;
  method: 'CREATE' | 'UPDATE' | 'DELETE' | 'PATCH';
  resource: string;
  data?: Record<string, any>;
  filter?: Record<string, any>;
}

interface BulkOperationResult {
  success: boolean;
  operation: BulkOperation;
  result?: any;
  error?: string;
}

/**
 * Execute bulk operations
 * POST /api/bulk
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { operations, continueOnError = false }: BulkOperationRequest = req.body;
    const requestId = req.id;
    
    // Validate request
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Operations array is required and must not be empty',
        requestId
      });
    }
    
    // Limit operations to prevent abuse
    if (operations.length > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 100 operations allowed per request',
        requestId
      });
    }
    
    logger.info(`[BULK] Starting bulk operation with ${operations.length} operations`, {
      requestId,
      userId: (req as any).user?.id
    });
    
    const results: BulkOperationResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each operation
    for (const operation of operations) {
      try {
        const result = await executeOperation(operation, req, res);
        results.push({
          success: true,
          operation,
          result
        });
        successCount++;
      } catch (error: any) {
        errorCount++;
        const errorMessage = error.message || 'Unknown error';
        
        logger.error(`[BULK] Operation failed`, {
          requestId,
          operation,
          error: errorMessage
        });
        
        results.push({
          success: false,
          operation,
          error: errorMessage
        });
        
        // If not continuing on error, stop processing
        if (!continueOnError) {
          break;
        }
      }
    }
    
    // Return results
    const response = {
      summary: {
        total: operations.length,
        success: successCount,
        failed: errorCount,
        duration: Date.now() - (req.startTime || Date.now())
      },
      results,
      requestId
    };
    
    // Set appropriate status code
    const statusCode = errorCount === 0 ? 200 : (successCount === 0 ? 400 : 207);
    res.status(statusCode).json(response);
    
  } catch (error: any) {
    logger.error('[BULK] Bulk operation failed', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      requestId: req.id
    });
  }
});

/**
 * Bulk delete - more efficient for delete operations
 * DELETE /api/bulk
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { resource, ids, filter } = req.body;
    const requestId = req.id;
    
    if (!resource) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Resource type is required',
        requestId
      });
    }
    
    if (!ids && !filter) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Either ids or filter must be provided',
        requestId
      });
    }
    
    const db = DatabaseService.getInstance().getDatabase();
    let query = '';
    let params: any[] = [];
    
    if (ids && Array.isArray(ids)) {
      // Bulk delete by IDs
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      query = `DELETE FROM ${resource} WHERE id IN (${placeholders}) RETURNING id`;
      params = ids;
    } else if (filter) {
      // Build WHERE clause from filter
      const conditions = Object.entries(filter).map(([key, value]) => {
        params.push(value);
        return `${key} = $${params.length}`;
      }).join(' AND ');
      
      query = `DELETE FROM ${resource} WHERE ${conditions} RETURNING id`;
    }
    
    const result = await db.all(query, params);
    
    logger.info(`[BULK] Deleted ${result.length} ${resource} records`, {
      requestId,
      userId: (req as any).user?.id,
      deletedCount: result.length
    });
    
    res.json({
      deleted: result.length,
      ids: result.map((r: any) => r.id),
      requestId
    });
    
  } catch (error: any) {
    logger.error('[BULK] Bulk delete failed', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      requestId: req.id
    });
  }
});

/**
 * Bulk update - update multiple records at once
 * PATCH /api/bulk
 */
router.patch('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { resource, ids, data, filter } = req.body;
    const requestId = req.id;
    
    if (!resource) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Resource type is required',
        requestId
      });
    }
    
    if (!data) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Data to update is required',
        requestId
      });
    }
    
    if (!ids && !filter) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Either ids or filter must be provided',
        requestId
      });
    }
    
    const db = DatabaseService.getInstance().getDatabase();
    const updateFields = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
    let query = '';
    let params: any[] = [];
    
    if (ids && Array.isArray(ids)) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      query = `UPDATE ${resource} SET ${updateFields}, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id, *`;
      params = [data, ...ids];
    } else if (filter) {
      const conditions = Object.entries(filter).map(([key, value]) => {
        params.push(value);
        return `${key} = $${params.length}`;
      }).join(' AND ');
      
      query = `UPDATE ${resource} SET ${updateFields}, updated_at = NOW() WHERE ${conditions} RETURNING id, *`;
      params.unshift(data);
    }
    
    const result = await db.all(query, params);
    
    logger.info(`[BULK] Updated ${result.length} ${resource} records`, {
      requestId,
      userId: (req as any).user?.id,
      updatedCount: result.length
    });
    
    res.json({
      updated: result.length,
      records: result,
      requestId
    });
    
  } catch (error: any) {
    logger.error('[BULK] Bulk update failed', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      requestId: req.id
    });
  }
});

/**
 * Bulk create - create multiple records at once
 * PUT /api/bulk
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { resource, records } = req.body;
    const requestId = req.id;
    
    if (!resource) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Resource type is required',
        requestId
      });
    }
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Records array is required and must not be empty',
        requestId
      });
    }
    
    if (records.length > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 100 records allowed per request',
        requestId
      });
    }
    
    const db = DatabaseService.getInstance().getDatabase();
    
    // Get column names from first record
    const columns = Object.keys(records[0]);
    const values: any[][] = [];
    const params: any[] = [];
    
    for (const record of records) {
      const row = columns.map((_, i) => {
        params.push(record[columns[i]]);
        return `$${params.length}`;
      });
      values.push(row);
    }
    
    const columnList = columns.join(', ');
    const valueSets = values.map(v => `(${v.join(', ')})`).join(', ');
    
    const query = `
      INSERT INTO ${resource} (${columnList}, created_at, updated_at)
      VALUES ${valueSets}, NOW(), NOW()
      RETURNING id, *
    `;
    
    const result = await db.all(query, params);
    
    logger.info(`[BULK] Created ${result.length} ${resource} records`, {
      requestId,
      userId: (req as any).user?.id,
      createdCount: result.length
    });
    
    res.status(201).json({
      created: result.length,
      records: result,
      requestId
    });
    
  } catch (error: any) {
    logger.error('[BULK] Bulk create failed', { error: error.message, requestId: req.id });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      requestId: req.id
    });
  }
});

/**
 * Execute a single operation
 */
async function executeOperation(
  operation: BulkOperation,
  req: Request,
  res: Response
): Promise<any> {
  const { method, resource, data = {}, filter = {} } = operation;
  const id = operation.id;
  
  switch (method) {
    case 'CREATE':
      return handleCreate(resource, data);
    case 'UPDATE':
      if (!id) throw new Error('ID is required for UPDATE operation');
      return handleUpdate(resource, id, data);
    case 'DELETE':
      if (!id && !Object.keys(filter).length) throw new Error('ID or filter is required for DELETE operation');
      return handleDelete(resource, id, filter);
    case 'PATCH':
      if (!id) throw new Error('ID is required for PATCH operation');
      return handlePatch(resource, id, data);
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleCreate(resource: string, data: Record<string, any>): Promise<any> {
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
  return result[0];
}

async function handleUpdate(resource: string, id: string, data: Record<string, any>): Promise<any> {
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
    throw new Error(`Resource not found: ${id}`);
  }
  
  return result[0];
}

async function handleDelete(resource: string, id?: string, filter?: Record<string, any>): Promise<any> {
  const db = DatabaseService.getInstance().getDatabase();
  
  if (id) {
    const query = `DELETE FROM ${resource} WHERE id = $1 RETURNING id`;
    const result = await db.all(query, [id]);
    
    if (result.length === 0) {
      throw new Error(`Resource not found: ${id}`);
    }
    
    return { deleted: true, id };
  } else if (filter) {
    const conditions = Object.entries(filter).map(([key, value], i) => {
      return `${key} = $${i + 1}`;
    }).join(' AND ');
    
    const query = `DELETE FROM ${resource} WHERE ${conditions} RETURNING id`;
    const result = await db.all(query, Object.values(filter));
    
    return { deleted: result.length };
  }
  
  throw new Error('Either id or filter must be provided');
}

async function handlePatch(resource: string, id: string, data: Record<string, any>): Promise<any> {
  // Patch is same as update
  return handleUpdate(resource, id, data);
}

export default router;
