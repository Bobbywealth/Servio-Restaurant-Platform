import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type { AuthUser } from '../types/auth';

const router = Router();

// Extended AuthUser type with company-specific properties
type CompanyAuthUser = AuthUser & {
  companyId?: string;
  companyRole?: 'super_admin' | 'admin' | 'manager' | 'viewer';
};

const COMPANY_ADMIN_ROLES = new Set(['super_admin', 'admin']);

/**
 * Helper: Get company ID from request (from user context or params)
 */
const getCompanyId = (req: Request): string | null => {
  const user = req.user as CompanyAuthUser | undefined;
  return user?.companyId || (req.params as any).companyId || null;
};

/**
 * Helper: Check if user has company admin access
 */
const canManageCompany = (req: Request): boolean => {
  const user = req.user as CompanyAuthUser | undefined;
  if (!user) return false;
  if (COMPANY_ADMIN_ROLES.has(user.companyRole as string)) return true;
  return false;
};

/**
 * Helper: Check if user can manage company users
 */
const canManageUsers = (req: Request): boolean => {
  const user = req.user as CompanyAuthUser | undefined;
  if (!user) return false;
  if (user.companyRole === 'super_admin' || user.companyRole === 'admin') return true;
  return false;
};

// ============================================================================
// COMPANY ROUTES
// ============================================================================

/**
 * GET /api/company
 * Get current user's company details
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const company = await db.get<any>(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM restaurants WHERE company_id = c.id) as restaurant_count
     FROM companies c 
     WHERE c.id = ? AND c.is_active = TRUE`,
    [companyId]
  );

  if (!company) {
    return res.status(404).json({
      success: false,
      error: { message: 'Company not found' }
    });
  }

  // Parse settings if it's a string
  if (typeof company.settings === 'string') {
    try {
      company.settings = JSON.parse(company.settings);
    } catch {
      company.settings = {};
    }
  }

  // Parse billing_info if it's a string
  if (typeof company.billing_info === 'string') {
    try {
      company.billing_info = JSON.parse(company.billing_info);
    } catch {
      company.billing_info = {};
    }
  }

  return res.json({
    success: true,
    data: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logo_url: company.logo_url,
      billing_email: company.billing_email,
      settings: company.settings,
      subscription_tier: company.subscription_tier,
      subscription_status: company.subscription_status,
      restaurant_count: company.restaurant_count,
      created_at: company.created_at,
      updated_at: company.updated_at
    }
  });
}));

/**
 * PUT /api/company
 * Update company settings
 */
router.put('/', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  if (!canManageCompany(req)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to manage company settings' }
    });
  }

  const { name, logo_url, billing_email, settings } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  
  // Check if company exists
  const existing = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { message: 'Company not found' }
    });
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (logo_url !== undefined) {
    updates.push('logo_url = ?');
    values.push(logo_url);
  }
  if (billing_email !== undefined) {
    updates.push('billing_email = ?');
    values.push(billing_email);
  }
  if (settings !== undefined) {
    updates.push('settings = ?');
    values.push(typeof settings === 'string' ? settings : JSON.stringify(settings));
  }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No valid fields to update' }
    });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(companyId);

  await db.run(
    `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  // Log audit
  await DatabaseService.getInstance().logAudit(
    companyId,
    (req.user as CompanyAuthUser)?.id || 'system',
    'update_company',
    'company',
    companyId,
    { updated_fields: Object.keys(req.body) }
  );

  logger.info(`Company ${companyId} settings updated by user ${(req.user as CompanyAuthUser)?.id}`);

  // Fetch updated company
  const updatedCompany = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);

  return res.json({
    success: true,
    data: {
      id: updatedCompany.id,
      name: updatedCompany.name,
      slug: updatedCompany.slug,
      logo_url: updatedCompany.logo_url,
      billing_email: updatedCompany.billing_email,
      settings: typeof updatedCompany.settings === 'string' 
        ? JSON.parse(updatedCompany.settings) 
        : updatedCompany.settings,
      subscription_tier: updatedCompany.subscription_tier,
      updated_at: updatedCompany.updated_at
    }
  });
}));

// ============================================================================
// RESTAURANT ROUTES (under company)
// ============================================================================

/**
 * GET /api/company/restaurants
 * List all restaurants in the company
 */
router.get('/restaurants', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  const restaurants = await db.all<any>(
    `SELECT r.id, r.name, r.slug, r.address, r.is_active, r.created_at,
            (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = r.id) as menu_item_count,
            (SELECT COUNT(*) FROM orders WHERE restaurant_id = r.id AND status = 'completed') as completed_orders_count
     FROM restaurants r 
     WHERE r.company_id = ?
     ORDER BY r.name ASC`,
    [companyId]
  );

  return res.json({
    success: true,
    data: {
      restaurants: restaurants.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        address: r.address,
        is_active: r.is_active,
        created_at: r.created_at,
        metrics: {
          menu_item_count: r.menu_item_count,
          completed_orders_count: r.completed_orders_count
        }
      })),
      total_count: restaurants.length
    }
  });
}));

/**
 * POST /api/company/restaurants
 * Create a new restaurant under the company
 */
router.post('/restaurants', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  if (!canManageCompany(req)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to create restaurants' }
    });
  }

  const { name, slug, address, phone, settings } = req.body;

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name and slug are required' }
    });
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Slug must contain only lowercase letters, numbers, and hyphens' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Check slug uniqueness across all restaurants
  const existingSlug = await db.get(
    'SELECT id FROM restaurants WHERE slug = ?',
    [slug.toLowerCase()]
  );
  if (existingSlug) {
    return res.status(400).json({
      success: false,
      error: { message: 'Restaurant slug already exists' }
    });
  }

  // Get company details for default settings
  const company = await db.get('SELECT settings FROM companies WHERE id = ?', [companyId]);
  if (!company) {
    return res.status(404).json({
      success: false,
      error: { message: 'Company not found' }
    });
  }

  const restaurantId = uuidv4();
  const restaurantSettings = typeof settings === 'object' ? settings : {};

  await db.run(
    `INSERT INTO restaurants (id, name, slug, address, phone, company_id, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [restaurantId, name, slug.toLowerCase(), address || null, phone || null, companyId, JSON.stringify(restaurantSettings)]
  );

  // Log audit
  await DatabaseService.getInstance().logAudit(
    restaurantId,
    (req.user as CompanyAuthUser)?.id || 'system',
    'create_restaurant',
    'restaurant',
    restaurantId,
    { company_id: companyId, name, slug }
  );

  logger.info(`New restaurant "${name}" created under company ${companyId} by user ${(req.user as CompanyAuthUser)?.id}`);

  return res.status(201).json({
    success: true,
    data: {
      id: restaurantId,
      name,
      slug: slug.toLowerCase(),
      address,
      phone,
      company_id: companyId,
      is_active: true,
      created_at: new Date().toISOString()
    }
  });
}));

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

/**
 * GET /api/company/analytics
 * Cross-restaurant aggregated analytics
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();
  
  // Get restaurant IDs for this company
  const restaurants = await db.all<any>(
    'SELECT id, name, slug FROM restaurants WHERE company_id = ?',
    [companyId]
  );

  if (restaurants.length === 0) {
    return res.json({
      success: true,
      data: {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        byRestaurant: [],
        byChannel: {}
      }
    });
  }

  const restaurantIds = restaurants.map(r => r.id).join("','");

  // Get aggregated analytics
  const revenueData = await db.get<any>(
    `SELECT 
       COALESCE(SUM(total_amount), 0) as totalRevenue,
       COUNT(*) as totalOrders,
       COALESCE(AVG(total_amount), 0) as avgOrderValue
     FROM orders 
     WHERE restaurant_id IN ('${restaurantIds}') 
     AND status = 'completed'`
  );

  // Get by-restaurant breakdown
  const byRestaurant = await db.all<any>(
    `SELECT 
       r.id, r.name, r.slug,
       COALESCE(SUM(o.total_amount), 0) as revenue,
       COUNT(o.id) as order_count,
       COALESCE(AVG(o.total_amount), 0) as avg_order_value
     FROM restaurants r
     LEFT JOIN orders o ON r.id = o.restaurant_id AND o.status = 'completed'
     WHERE r.company_id = ?
     GROUP BY r.id
     ORDER BY revenue DESC`,
    [companyId]
  );

  // Get by-channel breakdown
  const byChannel = await db.all<any>(
    `SELECT 
       channel,
       COUNT(*) as order_count,
       COALESCE(SUM(total_amount), 0) as revenue
     FROM orders 
     WHERE restaurant_id IN ('${restaurantIds}') 
     AND status = 'completed'
     GROUP BY channel`
  );

  const channelBreakdown: Record<string, { orders: number; revenue: number }> = {};
  byChannel.forEach((c: any) => {
    channelBreakdown[c.channel || 'unknown'] = {
      orders: c.order_count,
      revenue: c.revenue
    };
  });

  return res.json({
    success: true,
    data: {
      totalRevenue: revenueData.totalRevenue || 0,
      totalOrders: revenueData.totalOrders || 0,
      avgOrderValue: Math.round((revenueData.avgOrderValue || 0) * 100) / 100,
      byRestaurant: byRestaurant.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        revenue: r.revenue,
        order_count: r.order_count,
        avg_order_value: Math.round((r.avg_order_value || 0) * 100) / 100
      })),
      byChannel: channelBreakdown
    }
  });
}));

// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/company/users
 * List all users in the company
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const users = await db.all<any>(
    `SELECT cu.id as company_user_id, cu.role, cu.permissions, cu.invited_by, 
            cu.invited_at, cu.accepted_at, cu.created_at as company_created_at,
            u.id as user_id, u.name, u.email, u.restaurant_id, u.role as user_role, u.is_active
     FROM company_users cu
     JOIN users u ON cu.user_id = u.id
     WHERE cu.company_id = ?
     ORDER BY cu.created_at DESC`,
    [companyId]
  );

  // Get restaurant access for each user
  const usersWithAccess = await Promise.all(users.map(async (user: any) => {
    // Get restaurants this user has access to
    const userRestaurants = await db.all<any>(
      `SELECT r.id, r.name, r.slug 
       FROM restaurants r 
       WHERE r.company_id = ? 
       AND (r.id = ? OR r.company_id IS NOT NULL)`,
      [companyId, user.restaurant_id]
    );

    return {
      id: user.user_id,
      company_user_id: user.company_user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
      restaurant_access: userRestaurants.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug
      })),
      invited_by: user.invited_by,
      invited_at: user.invited_at,
      accepted_at: user.accepted_at,
      created_at: user.company_created_at
    };
  }));

  return res.json({
    success: true,
    data: {
      users: usersWithAccess,
      total_count: usersWithAccess.length
    }
  });
}));

/**
 * POST /api/company/users/invite
 * Invite a user to the company
 */
router.post('/users/invite', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  if (!canManageUsers(req)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to invite users' }
    });
  }

  const { email, role, permissions } = req.body;

  if (!email || !role) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email and role are required' }
    });
  }

  // Validate role
  const validRoles = ['super_admin', 'admin', 'manager', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid role. Must be one of: super_admin, admin, manager, viewer' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Check if company exists
  const company = await db.get('SELECT name FROM companies WHERE id = ?', [companyId]);
  if (!company) {
    return res.status(404).json({
      success: false,
      error: { message: 'Company not found' }
    });
  }

  // Check if user already exists
  const existingUser = await db.get('SELECT id, name, email FROM users WHERE email = ?', [email]);

  let companyUserId: string;
  let userId: string;
  let isNewUser = false;

  if (existingUser) {
    userId = existingUser.id;
    // Check if user is already in this company
    const existingCompanyUser = await db.get(
      'SELECT id FROM company_users WHERE company_id = ? AND user_id = ?',
      [companyId, userId]
    );
    if (existingCompanyUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'User is already a member of this company' }
      });
    }
    companyUserId = uuidv4();
  } else {
    // Create new user account
    isNewUser = true;
    userId = uuidv4();
    companyUserId = uuidv4();
    
    await db.run(
      `INSERT INTO users (id, name, email, restaurant_id, role, created_at)
       VALUES (?, ?, ?, ?, 'staff', CURRENT_TIMESTAMP)`,
      [userId, email.split('@')[0], email, null]
    );
  }

  // Add user to company
  await db.run(
    `INSERT INTO company_users (id, company_id, user_id, role, permissions, invited_by, invited_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [companyUserId, companyId, userId, role, JSON.stringify(permissions || [])]
  );

  // Log audit
  await DatabaseService.getInstance().logAudit(
    companyId,
    (req.user as CompanyAuthUser)?.id || 'system',
    'invite_company_user',
    'company_user',
    companyUserId,
    { email, role, is_new_user: isNewUser }
  );

  // Send invitation (stub - console log for now)
  console.log(`[INVITATION STUB] Sending invitation email to ${email}`);
  console.log(`  Company: ${company.name}`);
  console.log(`  Role: ${role}`);
  console.log(`  Invited by: ${(req.user as CompanyAuthUser)?.email}`);
  console.log(`  Invitation link: https://servio.solutions/invite/${companyUserId}`);

  logger.info(`User ${email} invited to company ${companyId} by user ${(req.user as CompanyAuthUser)?.id}`);

  return res.status(201).json({
    success: true,
    data: {
      id: companyUserId,
      user_id: userId,
      email,
      role,
      permissions: permissions || [],
      status: 'pending',
      invited_at: new Date().toISOString()
    }
  });
}));

/**
 * PUT /api/company/users/:userId/role
 * Update user's company role
 */
router.put('/users/:userId/role', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  if (!canManageUsers(req)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not authorized to update user roles' }
    });
  }

  const { userId } = req.params;
  const { role, permissions } = req.body;

  if (!role) {
    return res.status(400).json({
      success: false,
      error: { message: 'Role is required' }
    });
  }

  // Validate role
  const validRoles = ['super_admin', 'admin', 'manager', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid role. Must be one of: super_admin, admin, manager, viewer' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Check if company user exists
  const companyUser = await db.get(
    'SELECT * FROM company_users WHERE company_id = ? AND user_id = ?',
    [companyId, userId]
  );
  if (!companyUser) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found in this company' }
    });
  }

  // Prevent demoting yourself from super_admin if you're the only one
  if (role !== 'super_admin' && companyUser.role === 'super_admin') {
    const superAdminCount = await db.get(
      'SELECT COUNT(*) as count FROM company_users WHERE company_id = ? AND role = ?',
      [companyId, 'super_admin']
    );
    if (superAdminCount.count === 1) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot demote the only super admin' }
      });
    }
  }

  await db.run(
    `UPDATE company_users 
     SET role = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE company_id = ? AND user_id = ?`,
    [role, JSON.stringify(permissions || []), companyId, userId]
  );

  // Log audit
  await DatabaseService.getInstance().logAudit(
    companyId,
    (req.user as CompanyAuthUser)?.id || 'system',
    'update_company_user_role',
    'company_user',
    companyUser.id,
    { new_role: role, previous_role: companyUser.role }
  );

  logger.info(`User ${userId} role updated to ${role} in company ${companyId}`);

  return res.json({
    success: true,
    data: {
      id: companyUser.id,
      user_id: userId,
      role,
      permissions: permissions || [],
      updated_at: new Date().toISOString()
    }
  });
}));

// ============================================================================
// BILLING ROUTES
// ============================================================================

/**
 * GET /api/company/billing
 * Get subscription info and billing history
 */
router.get('/billing', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  const subscription = await db.get<any>(
    `SELECT c.id, c.name, c.subscription_tier, c.subscription_status, 
            c.billing_info, c.billing_email,
            (SELECT COUNT(*) FROM restaurants WHERE company_id = c.id) as restaurant_count,
            (SELECT COUNT(*) FROM users u JOIN company_users cu ON u.id = cu.user_id WHERE cu.company_id = c.id) as user_count
     FROM companies c 
     WHERE c.id = ?`,
    [companyId]
  );

  if (!subscription) {
    return res.status(404).json({
      success: false,
      error: { message: 'Company not found' }
    });
  }

  // Get billing history
  const billingHistory = await db.all<any>(
    `SELECT id, amount_cents, currency, status, invoice_url, period_start, period_end, created_at
     FROM company_billing_history
     WHERE company_id = ?
     ORDER BY created_at DESC
     LIMIT 12`,
    [companyId]
  );

  return res.json({
    success: true,
    data: {
      subscription: {
        tier: subscription.subscription_tier,
        status: subscription.subscription_status,
        restaurant_count: subscription.restaurant_count,
        user_count: subscription.user_count
      },
      billing_info: typeof subscription.billing_info === 'string'
        ? JSON.parse(subscription.billing_info)
        : subscription.billing_info,
      billing_email: subscription.billing_email,
      billing_history: billingHistory.map(h => ({
        id: h.id,
        amount: h.amount_cents / 100,
        currency: h.currency,
        status: h.status,
        invoice_url: h.invoice_url,
        period_start: h.period_start,
        period_end: h.period_end,
        created_at: h.created_at
      }))
    }
  });
}));

// ============================================================================
// AUDIT LOG ROUTES
// ============================================================================

/**
 * GET /api/company/audit-logs
 * Company-wide audit logs
 */
router.get('/audit-logs', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Company ID is required' }
    });
  }

  const db = DatabaseService.getInstance().getDatabase();

  // Get restaurant IDs for this company
  const restaurants = await db.all<any>(
    'SELECT id FROM restaurants WHERE company_id = ?',
    [companyId]
  );

  if (restaurants.length === 0) {
    return res.json({
      success: true,
      data: {
        logs: [],
        total_count: 0
      }
    });
  }

  const restaurantIds = restaurants.map(r => r.id).join("','");

  // Get audit logs (from audit_logs table or fallback to company_logs)
  let logs: any[] = [];
  try {
    logs = await db.all<any>(
      `SELECT id, restaurant_id, user_id, action, entity_type, entity_id, details, created_at
       FROM audit_logs
       WHERE restaurant_id IN ('${restaurantIds}')
       ORDER BY created_at DESC
       LIMIT 100`,
      []
    );
  } catch {
    // If audit_logs table doesn't exist, return empty
    logger.warn('Audit logs table not found');
  }

  // Enrich logs with user names
  const enrichedLogs = await Promise.all(logs.map(async (log: any) => {
    const user = await db.get('SELECT name, email FROM users WHERE id = ?', [log.user_id]);
    return {
      id: log.id,
      user: user ? { name: user.name, email: user.email } : null,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      created_at: log.created_at
    };
  }));

  return res.json({
    success: true,
    data: {
      logs: enrichedLogs,
      total_count: enrichedLogs.length
    }
  });
}));

export default router;
