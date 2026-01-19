import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

interface IntegrationCreateRequest {
  name: string;
  apiType: string;
  protocol?: 'json' | 'xml' | 'rest' | 'webhook';
  protocolVersion?: string;
  endpoint?: string;
  contactEmail?: string;
  description?: string;
  config?: Record<string, any>;
}

interface IntegrationUpdateRequest extends Partial<IntegrationCreateRequest> {
  status?: 'active' | 'inactive' | 'pending' | 'error';
}

/**
 * GET /api/integrations
 * Get all integrations for the restaurant
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { search, status, limit = 50, offset = 0 } = req.query;
  const db = DatabaseService.getInstance().getDatabase();

  let query = 'SELECT * FROM integrations';
  const params: any[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(name LIKE ? OR api_type LIKE ? OR contact_email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const integrations = await db.all(query, params);

  // Parse JSON fields and format dates
  const formattedIntegrations = integrations.map((integration: any) => ({
    ...integration,
    config: integration.config ? JSON.parse(integration.config) : null,
    lastSync: integration.last_sync ? new Date(integration.last_sync) : null,
    createdAt: new Date(integration.created_at),
    updatedAt: new Date(integration.updated_at)
  }));

  // Get total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM integrations';
  const countParams: any[] = [];

  if (conditions.length > 0) {
    countQuery += ' WHERE ' + conditions.join(' AND ');
    countParams.push(...params.slice(0, -2)); // Remove limit and offset params
  }

  const [{ total }] = await db.all(countQuery, countParams);

  res.json({
    integrations: formattedIntegrations,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: Number(offset) + formattedIntegrations.length < total
    }
  });
}));

/**
 * GET /api/integrations/:id
 * Get a specific integration
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);

  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  const formattedIntegration = {
    ...integration,
    config: integration.config ? JSON.parse(integration.config) : null,
    lastSync: integration.last_sync ? new Date(integration.last_sync) : null,
    createdAt: new Date(integration.created_at),
    updatedAt: new Date(integration.updated_at)
  };

  res.json({ integration: formattedIntegration });
}));

/**
 * POST /api/integrations
 * Create a new integration
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    apiType,
    protocol = 'json',
    protocolVersion = 'v1',
    endpoint,
    contactEmail,
    description,
    config = {}
  }: IntegrationCreateRequest = req.body;

  if (!name || !apiType) {
    return res.status(400).json({ error: 'Name and API type are required' });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Generate unique keys and ID
  const integrationId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const referenceId = crypto.randomBytes(20).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const restaurantKey = crypto.randomBytes(8).toString('hex').toUpperCase();
  const masterKey = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

  const now = new Date().toISOString();

  try {
    await db.run(`
      INSERT INTO integrations (
        id, name, api_type, status, protocol, protocol_version, 
        endpoint, contact_email, description, reference_id, 
        restaurant_key, master_key, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      integrationId,
      name,
      apiType,
      'pending',
      protocol,
      protocolVersion,
      endpoint || null,
      contactEmail || null,
      description || null,
      referenceId,
      restaurantKey,
      masterKey,
      JSON.stringify(config),
      now,
      now
    ]);

    const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [integrationId]);

    const formattedIntegration = {
      ...integration,
      config: integration.config ? JSON.parse(integration.config) : null,
      lastSync: integration.last_sync ? new Date(integration.last_sync) : null,
      createdAt: new Date(integration.created_at),
      updatedAt: new Date(integration.updated_at)
    };

    logger.info(`Integration created: ${name} (${apiType})`, { integrationId });

    res.status(201).json({ integration: formattedIntegration });
  } catch (error: any) {
    logger.error('Failed to create integration:', error);
    
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Integration with this name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create integration' });
  }
}));

/**
 * PUT /api/integrations/:id
 * Update an integration
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates: IntegrationUpdateRequest = req.body;
  const db = DatabaseService.getInstance().getDatabase();

  // Check if integration exists
  const existing = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  const allowedFields = [
    'name', 'api_type', 'status', 'protocol', 'protocol_version',
    'endpoint', 'contact_email', 'description', 'config'
  ];

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(dbKey) && value !== undefined) {
      updateFields.push(`${dbKey} = ?`);
      updateValues.push(key === 'config' ? JSON.stringify(value) : value);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_at = ?');
  updateValues.push(new Date().toISOString());
  updateValues.push(id);

  try {
    await db.run(
      `UPDATE integrations SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updated = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
    
    const formattedIntegration = {
      ...updated,
      config: updated.config ? JSON.parse(updated.config) : null,
      lastSync: updated.last_sync ? new Date(updated.last_sync) : null,
      createdAt: new Date(updated.created_at),
      updatedAt: new Date(updated.updated_at)
    };

    logger.info(`Integration updated: ${existing.name}`, { integrationId: id, updates });

    res.json({ integration: formattedIntegration });
  } catch (error: any) {
    logger.error('Failed to update integration:', error);
    
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Integration with this name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update integration' });
  }
}));

/**
 * POST /api/integrations/:id/toggle
 * Toggle integration status (active/inactive)
 */
router.post('/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  const newStatus = integration.status === 'active' ? 'inactive' : 'active';
  
  await db.run(
    'UPDATE integrations SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, new Date().toISOString(), id]
  );

  const updated = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  const formattedIntegration = {
    ...updated,
    config: updated.config ? JSON.parse(updated.config) : null,
    lastSync: updated.last_sync ? new Date(updated.last_sync) : null,
    createdAt: new Date(updated.created_at),
    updatedAt: new Date(updated.updated_at)
  };

  logger.info(`Integration status toggled: ${integration.name} -> ${newStatus}`, { integrationId: id });

  res.json({ integration: formattedIntegration });
}));

/**
 * POST /api/integrations/:id/sync
 * Trigger a manual sync for an integration
 */
router.post('/:id/sync', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  if (integration.status !== 'active') {
    return res.status(400).json({ error: 'Integration must be active to sync' });
  }

  // Update last sync time
  await db.run(
    'UPDATE integrations SET last_sync = ?, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), new Date().toISOString(), id]
  );

  const updated = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  const formattedIntegration = {
    ...updated,
    config: updated.config ? JSON.parse(updated.config) : null,
    lastSync: updated.last_sync ? new Date(updated.last_sync) : null,
    createdAt: new Date(updated.created_at),
    updatedAt: new Date(updated.updated_at)
  };

  logger.info(`Manual sync triggered for integration: ${integration.name}`, { integrationId: id });

  res.json({ 
    integration: formattedIntegration,
    message: 'Sync initiated successfully'
  });
}));

/**
 * DELETE /api/integrations/:id
 * Delete an integration
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  await db.run('DELETE FROM integrations WHERE id = ?', [id]);

  logger.info(`Integration deleted: ${integration.name}`, { integrationId: id });

  res.json({ message: 'Integration deleted successfully' });
}));

/**
 * POST /api/integrations/:id/test
 * Test integration connectivity
 */
router.post('/:id/test', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
  
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  try {
    // Placeholder for actual integration testing
    // This would normally make HTTP requests to test the integration
    let testResult;
    
    if (integration.endpoint) {
      // Simulate testing the endpoint
      testResult = {
        success: true,
        latency: Math.floor(Math.random() * 500) + 100, // Mock latency
        timestamp: new Date().toISOString(),
        status: 'Connection successful'
      };
    } else {
      testResult = {
        success: false,
        error: 'No endpoint configured for testing',
        timestamp: new Date().toISOString()
      };
    }

    logger.info(`Integration test performed: ${integration.name}`, { 
      integrationId: id, 
      testResult 
    });

    res.json({
      integration: {
        id: integration.id,
        name: integration.name,
        status: integration.status
      },
      testResult
    });
  } catch (error: any) {
    logger.error('Integration test failed:', error);
    
    res.status(500).json({
      integration: {
        id: integration.id,
        name: integration.name,
        status: integration.status
      },
      testResult: {
        success: false,
        error: error.message || 'Test failed',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export default router;