import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

interface CallLogEntry {
  id: string;
  type: 'inbound' | 'outbound' | 'alert';
  phone_number: string;
  customer_name?: string;
  duration?: number;
  status: 'completed' | 'missed' | 'failed' | 'in_progress';
  outcome?: 'order_placed' | 'inquiry' | 'complaint' | 'no_answer';
  call_sid?: string;
  order_total?: number;
  created_at: string;
  ended_at?: string;
  notes?: string;
}

interface CallStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  ordersPlaced: number;
  totalRevenue: number;
  avgDuration: number;
  answerRate: number;
  conversionRate: number;
}

/**
 * Get date range filter for SQL queries
 */
function getDateFilter(dateRange: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let startDate: Date;

  switch (dateRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      endDate.setTime(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    }
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    case 'all':
    default:
      startDate = new Date(2020, 0, 1); // Far back date
      break;
  }

  return { startDate, endDate };
}

/**
 * Extract call duration from audit metadata or calculate from timestamps
 */
function extractCallDuration(metadata: any, createdAt: string, endedAt?: string): number | undefined {
  // Try to get duration from metadata first
  if (metadata?.duration && typeof metadata.duration === 'number') {
    return metadata.duration;
  }
  
  // Calculate from timestamps if available
  if (endedAt) {
    const start = new Date(createdAt);
    const end = new Date(endedAt);
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }
  
  return undefined;
}

/**
 * Get call logs with filtering and pagination
 */
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const { dateRange = 'today', statusFilter = 'all', search = '', page = 1, limit = 50 } = req.query;
    const restaurantId = req.user?.restaurantId;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID required' 
      });
    }

    const db = DatabaseService.getInstance().getDatabase();
    const { startDate, endDate } = getDateFilter(dateRange as string);
    
    // Build the main query to get call-related data from multiple sources
    let whereConditions = ['r.id = ?'];
    let params = [restaurantId];
    
    // Date filtering
    if (dateRange !== 'all') {
      whereConditions.push('(a.created_at >= ? AND a.created_at <= ?)');
      params.push(startDate.toISOString(), endDate.toISOString());
    }
    
    // Search filtering
    if (search) {
      whereConditions.push('(ac.phone_number LIKE ? OR o.customer_phone LIKE ? OR a.metadata LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Complex query that joins multiple sources of call data
    const query = `
      SELECT DISTINCT
        COALESCE(ac.id, a.resource_id, o.id) as id,
        CASE 
          WHEN ac.id IS NOT NULL THEN 'alert'
          WHEN a.action LIKE '%phone%' OR a.action LIKE '%call%' THEN 'inbound'
          ELSE 'inbound'
        END as type,
        COALESCE(ac.phone_number, o.customer_phone, JSON_EXTRACT(a.metadata, '$.customerNumber')) as phone_number,
        o.customer_name as customer_name,
        CASE 
          WHEN ac.status = 'completed' THEN 'completed'
          WHEN ac.status = 'failed' THEN 'failed'
          WHEN o.status = 'cancelled' THEN 'missed'
          WHEN o.id IS NOT NULL THEN 'completed'
          ELSE 'completed'
        END as status,
        CASE
          WHEN o.id IS NOT NULL THEN 'order_placed'
          WHEN a.action LIKE '%menu%' OR a.action LIKE '%search%' THEN 'inquiry'
          ELSE 'inquiry'
        END as outcome,
        ac.call_sid,
        o.total_amount as order_total,
        COALESCE(ac.created_at, o.created_at, a.created_at) as created_at,
        ac.updated_at as ended_at,
        ac.message as notes,
        JSON_EXTRACT(a.metadata, '$.duration') as duration_seconds
      FROM restaurants r
      LEFT JOIN alert_calls ac ON ac.restaurant_id = r.id
      LEFT JOIN orders o ON o.restaurant_id = r.id AND o.source IN ('phone', 'vapi')
      LEFT JOIN audit_logs a ON a.restaurant_id = r.id AND (
        a.action LIKE '%phone%' OR 
        a.action LIKE '%call%' OR 
        a.resource_type = 'call'
      )
      ${whereClause}
      ORDER BY COALESCE(ac.created_at, o.created_at, a.created_at) DESC
      LIMIT ? OFFSET ?
    `;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    params.push(limit as string, offset.toString());

    const rawResults = await db.all(query, params);
    
    // Process and deduplicate results
    const callMap = new Map<string, CallLogEntry>();
    
    rawResults.forEach((row: any) => {
      if (!row.phone_number) return; // Skip entries without phone numbers
      
      const callId = row.id || `${row.phone_number}_${row.created_at}`;
      const duration = row.duration_seconds ? parseInt(row.duration_seconds) : extractCallDuration(null, row.created_at, row.ended_at);
      
      const callEntry: CallLogEntry = {
        id: callId,
        type: row.type as any,
        phone_number: row.phone_number,
        customer_name: row.customer_name,
        duration,
        status: row.status as any,
        outcome: row.outcome as any,
        call_sid: row.call_sid,
        order_total: row.order_total ? parseFloat(row.order_total) : undefined,
        created_at: row.created_at,
        ended_at: row.ended_at,
        notes: row.notes
      };
      
      // Only keep the most complete entry for each call
      const existing = callMap.get(callId);
      if (!existing || (callEntry.order_total && !existing.order_total)) {
        callMap.set(callId, callEntry);
      }
    });
    
    let calls = Array.from(callMap.values());
    
    // Apply status filtering
    if (statusFilter !== 'all') {
      calls = calls.filter(call => call.status === statusFilter);
    }
    
    // Sort by created_at descending
    calls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    res.json({
      success: true,
      data: calls.slice(0, parseInt(limit as string)) // Apply limit after processing
    });

  } catch (error) {
    logger.error('Error fetching voice hub calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call data'
    });
  }
});

/**
 * Get call statistics and analytics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { dateRange = 'today' } = req.query;
    const restaurantId = req.user?.restaurantId;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID required' 
      });
    }

    const db = DatabaseService.getInstance().getDatabase();
    const { startDate, endDate } = getDateFilter(dateRange as string);
    
    // Get comprehensive call statistics
    const statsQuery = `
      SELECT
        COUNT(DISTINCT COALESCE(ac.id, a.resource_id, o.id)) as total_calls,
        COUNT(DISTINCT CASE 
          WHEN (ac.status = 'completed' OR o.id IS NOT NULL) 
          THEN COALESCE(ac.id, a.resource_id, o.id) 
        END) as answered_calls,
        COUNT(DISTINCT CASE 
          WHEN (ac.status = 'failed' OR ac.status = 'missed') 
          THEN ac.id 
        END) as missed_calls,
        COUNT(DISTINCT o.id) as orders_placed,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        AVG(CASE 
          WHEN JSON_EXTRACT(a.metadata, '$.duration') IS NOT NULL 
          THEN CAST(JSON_EXTRACT(a.metadata, '$.duration') AS INTEGER)
          ELSE NULL 
        END) as avg_duration
      FROM restaurants r
      LEFT JOIN alert_calls ac ON ac.restaurant_id = r.id 
        AND ac.created_at >= ? AND ac.created_at <= ?
      LEFT JOIN orders o ON o.restaurant_id = r.id 
        AND o.source IN ('phone', 'vapi')
        AND o.created_at >= ? AND o.created_at <= ?
      LEFT JOIN audit_logs a ON a.restaurant_id = r.id 
        AND (a.action LIKE '%phone%' OR a.action LIKE '%call%' OR a.resource_type = 'call')
        AND a.created_at >= ? AND a.created_at <= ?
      WHERE r.id = ?
    `;

    const statsParams = [
      startDate.toISOString(), endDate.toISOString(), // alert_calls
      startDate.toISOString(), endDate.toISOString(), // orders  
      startDate.toISOString(), endDate.toISOString(), // audit_logs
      restaurantId
    ];

    const statsResult = await db.get(statsQuery, statsParams);
    
    if (!statsResult) {
      return res.json({
        success: true,
        data: {
          totalCalls: 0,
          answeredCalls: 0,
          missedCalls: 0,
          ordersPlaced: 0,
          totalRevenue: 0,
          avgDuration: 0,
          answerRate: 0,
          conversionRate: 0
        }
      });
    }

    const stats: CallStats = {
      totalCalls: statsResult.total_calls || 0,
      answeredCalls: statsResult.answered_calls || 0,
      missedCalls: statsResult.missed_calls || 0,
      ordersPlaced: statsResult.orders_placed || 0,
      totalRevenue: parseFloat(statsResult.total_revenue) || 0,
      avgDuration: Math.round(statsResult.avg_duration || 0),
      answerRate: statsResult.total_calls > 0 
        ? ((statsResult.answered_calls / statsResult.total_calls) * 100) 
        : 0,
      conversionRate: statsResult.answered_calls > 0 
        ? ((statsResult.orders_placed / statsResult.answered_calls) * 100) 
        : 0
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching voice hub stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call statistics'
    });
  }
});

/**
 * Export call data as CSV
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { dateRange = 'month' } = req.query;
    const restaurantId = req.user?.restaurantId;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID required' 
      });
    }

    const db = DatabaseService.getInstance().getDatabase();
    const { startDate, endDate } = getDateFilter(dateRange as string);
    
    // Get all call data for export
    const query = `
      SELECT
        COALESCE(ac.phone_number, o.customer_phone) as phone_number,
        COALESCE(o.customer_name, 'Unknown') as customer_name,
        CASE 
          WHEN ac.id IS NOT NULL THEN 'Alert Call'
          WHEN o.id IS NOT NULL THEN 'Order Call'
          ELSE 'Inquiry Call'
        END as call_type,
        COALESCE(ac.status, CASE WHEN o.id IS NOT NULL THEN 'completed' ELSE 'unknown' END) as status,
        CASE
          WHEN o.id IS NOT NULL THEN 'Order Placed'
          ELSE 'Inquiry'
        END as outcome,
        o.total_amount as order_total,
        COALESCE(ac.created_at, o.created_at) as call_date,
        ac.message as notes
      FROM restaurants r
      LEFT JOIN alert_calls ac ON ac.restaurant_id = r.id 
        AND ac.created_at >= ? AND ac.created_at <= ?
      LEFT JOIN orders o ON o.restaurant_id = r.id 
        AND o.source IN ('phone', 'vapi')
        AND o.created_at >= ? AND o.created_at <= ?
      WHERE r.id = ? 
        AND (ac.id IS NOT NULL OR o.id IS NOT NULL)
      ORDER BY COALESCE(ac.created_at, o.created_at) DESC
    `;

    const exportData = await db.all(query, [
      startDate.toISOString(), endDate.toISOString(),
      startDate.toISOString(), endDate.toISOString(),
      restaurantId
    ]);

    // Generate CSV
    const csvHeaders = [
      'Phone Number',
      'Customer Name', 
      'Call Type',
      'Status',
      'Outcome',
      'Order Total',
      'Call Date',
      'Notes'
    ].join(',');

    const csvRows = exportData.map(row => [
      `"${row.phone_number || ''}"`,
      `"${row.customer_name || ''}"`,
      `"${row.call_type || ''}"`,
      `"${row.status || ''}"`,
      `"${row.outcome || ''}"`,
      `"${row.order_total || ''}"`,
      `"${row.call_date ? new Date(row.call_date).toLocaleString() : ''}"`,
      `"${(row.notes || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="voice-hub-calls-${dateRange}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    logger.error('Error exporting voice hub data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export call data'
    });
  }
});

export default router;