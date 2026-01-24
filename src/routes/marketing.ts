import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

const router = Router();

// Initialize Twilio client (use environment variables in production)
let twilioClient: any = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Format phone number to E.164 format for Twilio
 * Handles various input formats and adds +1 country code for US numbers
 */
function formatPhoneNumber(phone: string): { formatted: string; isValid: boolean; error?: string } {
  if (!phone) {
    return { formatted: '', isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, preserve it
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Check if it's already in E.164 format with country code
  if (hasPlus && cleaned.length >= 10 && cleaned.length <= 15) {
    return { formatted: `+${cleaned}`, isValid: true };
  }

  // For US numbers (10 digits without country code)
  if (cleaned.length === 10) {
    return { formatted: `+1${cleaned}`, isValid: true };
  }

  // For US numbers with country code already (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return { formatted: `+${cleaned}`, isValid: true };
  }

  // For international numbers that may have been provided without +
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    // Assume it needs +1 if it's exactly 10 digits, otherwise assume country code is included
    if (cleaned.length === 10) {
      return { formatted: `+1${cleaned}`, isValid: true };
    }
    return { formatted: `+${cleaned}`, isValid: true };
  }

  return {
    formatted: phone,
    isValid: false,
    error: `Invalid phone number format. Expected 10 digits (e.g., 5551234567) or full E.164 format (e.g., +15551234567). Got: ${phone}`
  };
}

/**
 * Validate phone number format
 */
function validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
  const result = formatPhoneNumber(phone);
  return { isValid: result.isValid, error: result.error };
}

// Initialize email transporter (configure for your email provider)
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_app_password'
  }
});

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * GET /api/marketing/customers
 * Get all customers with contact preferences
 */
router.get('/customers', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const customers = await db.all(`
    SELECT 
      id,
      name,
      email,
      phone,
      preferences,
      tags,
      total_orders,
      total_spent,
      last_order_date,
      opt_in_sms,
      opt_in_email,
      created_at
    FROM customers 
    WHERE restaurant_id = ?
    ORDER BY last_order_date DESC, name ASC
  `, [restaurantId]);

  const formattedCustomers = customers.map((customer: any) => ({
    ...customer,
    preferences: JSON.parse(customer.preferences || '{}'),
    tags: JSON.parse(customer.tags || '[]'),
    opt_in_sms: Boolean(customer.opt_in_sms),
    opt_in_email: Boolean(customer.opt_in_email)
  }));

  res.json({
    success: true,
    data: formattedCustomers
  });
}));

/**
 * POST /api/marketing/customers
 * Add or update customer information
 */
router.post('/customers', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    preferences = {},
    tags = [],
    optInSms = false,
    optInEmail = false
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!name && !email && !phone) {
    return res.status(400).json({
      success: false,
      error: { message: 'At least name, email, or phone is required' }
    });
  }

  // Check if customer already exists
  let existingCustomer = null;
  if (email) {
    existingCustomer = await db.get(
      'SELECT * FROM customers WHERE restaurant_id = ? AND email = ?',
      [restaurantId, email]
    );
  } else if (phone) {
    existingCustomer = await db.get(
      'SELECT * FROM customers WHERE restaurant_id = ? AND phone = ?',
      [restaurantId, phone]
    );
  }

  let customerId: string;

  if (existingCustomer) {
    // Update existing customer
    customerId = existingCustomer.id;
    await db.run(`
      UPDATE customers 
      SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        preferences = ?,
        tags = ?,
        opt_in_sms = ?,
        opt_in_email = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name,
      email,
      phone,
      JSON.stringify(preferences),
      JSON.stringify(tags),
      optInSms ? 1 : 0,
      optInEmail ? 1 : 0,
      existingCustomer.id
    ]);

    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [existingCustomer.id]);
    
    res.json({
      success: true,
      data: {
        ...updatedCustomer,
        preferences: JSON.parse(updatedCustomer.preferences || '{}'),
        tags: JSON.parse(updatedCustomer.tags || '[]'),
        opt_in_sms: Boolean(updatedCustomer.opt_in_sms),
        opt_in_email: Boolean(updatedCustomer.opt_in_email)
      }
    });
  } else {
    // Create new customer
    customerId = uuidv4();

    await db.run(`
      INSERT INTO customers (
        id, restaurant_id, name, email, phone, preferences, tags,
        opt_in_sms, opt_in_email, total_orders, total_spent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `, [
      customerId,
      restaurantId,
      name,
      email,
      phone,
      JSON.stringify(preferences),
      JSON.stringify(tags),
      optInSms ? 1 : 0,
      optInEmail ? 1 : 0
    ]);

    const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    
    res.status(201).json({
      success: true,
      data: {
        ...newCustomer,
        preferences: JSON.parse(newCustomer.preferences || '{}'),
        tags: JSON.parse(newCustomer.tags || '[]'),
        opt_in_sms: Boolean(newCustomer.opt_in_sms),
        opt_in_email: Boolean(newCustomer.opt_in_email)
      }
    });
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'customer_upsert',
    'customer',
    existingCustomer?.id || customerId,
    { name, email, phone, optInSms, optInEmail }
  );
}));

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * GET /api/marketing/campaigns
 * Get all marketing campaigns
 */
router.get('/campaigns', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const campaigns = await db.all(`
    SELECT 
      id,
      name,
      type,
      status,
      message,
      target_criteria,
      scheduled_at,
      sent_at,
      total_recipients,
      successful_sends,
      failed_sends,
      created_at
    FROM marketing_campaigns 
    WHERE restaurant_id = ?
    ORDER BY created_at DESC
  `, [restaurantId]);

  const formattedCampaigns = campaigns.map((campaign: any) => ({
    ...campaign,
    target_criteria: JSON.parse(campaign.target_criteria || '{}')
  }));

  res.json({
    success: true,
    data: formattedCampaigns
  });
}));

/**
 * POST /api/marketing/campaigns
 * Create a new marketing campaign
 */
router.post('/campaigns', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    type, // 'sms' or 'email'
    message,
    subject, // for email campaigns
    targetCriteria = {},
    scheduleAt
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  if (!name || !type || !message) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name, type, and message are required' }
    });
  }

  if (!['sms', 'email'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Type must be either "sms" or "email"' }
    });
  }

  const campaignId = uuidv4();
  const now = new Date();
  const scheduledAt = scheduleAt ? new Date(scheduleAt) : now;

  await db.run(`
    INSERT INTO marketing_campaigns (
      id, restaurant_id, name, type, status, message, subject,
      target_criteria, scheduled_at, total_recipients
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [
    campaignId,
    restaurantId,
    name,
    type,
    scheduledAt <= now ? 'sending' : 'scheduled',
    message,
    subject || null,
    JSON.stringify(targetCriteria),
    scheduledAt.toISOString()
  ]);

  const newCampaign = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [campaignId]);

  // If scheduled for now or past, send immediately
  if (scheduledAt <= now) {
    // Queue for sending (in production, use a job queue like Bull)
    setImmediate(() => sendCampaign(campaignId));
  }

  await DatabaseService.getInstance().logAudit(
    restaurantId!,
    req.user?.id || 'system',
    'create_campaign',
    'marketing_campaign',
    campaignId,
    { name, type, scheduled_at: scheduledAt.toISOString() }
  );

  res.status(201).json({
    success: true,
    data: {
      ...newCampaign,
      target_criteria: JSON.parse(newCampaign.target_criteria || '{}')
    }
  });
}));

/**
 * POST /api/marketing/campaigns/:id/send
 * Send a campaign immediately
 */
router.post('/campaigns/:id/send', asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const db = DatabaseService.getInstance().getDatabase();

  const campaign = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
  
  if (!campaign) {
    return res.status(404).json({
      success: false,
      error: { message: 'Campaign not found' }
    });
  }

  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return res.status(400).json({
      success: false,
      error: { message: 'Campaign already sent or is being sent' }
    });
  }

  await db.run(
    'UPDATE marketing_campaigns SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['sending', id]
  );

  // Queue for sending
  setImmediate(() => sendCampaign(id));

  res.json({
    success: true,
    message: 'Campaign queued for sending'
  });
}));

// ============================================================================
// SMS & EMAIL SENDING
// ============================================================================

/**
 * POST /api/marketing/send-sms
 * Send individual SMS
 */
router.post('/send-sms', asyncHandler(async (req: Request, res: Response) => {
  const { phone, message, customerId } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: { message: 'Phone and message are required' }
    });
  }

  // Format and validate phone number
  const phoneResult = formatPhoneNumber(phone);
  if (!phoneResult.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid phone number format',
        details: phoneResult.error,
        tip: 'Enter 10 digits (e.g., 5551234567) or full format with country code (e.g., +15551234567)'
      }
    });
  }

  const formattedPhone = phoneResult.formatted;

  if (!twilioClient) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'SMS service not configured',
        details: 'Twilio credentials are not set up. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
        simulated: true
      }
    });
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Twilio phone number not configured',
        details: 'TWILIO_PHONE_NUMBER environment variable is not set.'
      }
    });
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    // Log the SMS send
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(`
      INSERT INTO marketing_sends (
        id, customer_id, type, recipient, message, status, external_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      customerId || null,
      'sms',
      formattedPhone,
      message,
      'sent',
      result.sid
    ]);

    logger.info(`SMS sent to ${formattedPhone}: ${result.sid}`);

    res.json({
      success: true,
      data: {
        sid: result.sid,
        status: result.status,
        to: formattedPhone,
        actuallyDelivered: true
      },
      message: `SMS successfully sent to ${formattedPhone}`
    });
  } catch (error: any) {
    logger.error('SMS send error:', error);

    // Log the failed send
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(`
      INSERT INTO marketing_sends (
        id, customer_id, type, recipient, message, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      customerId || null,
      'sms',
      formattedPhone,
      message,
      'failed',
      error.message
    ]);

    // Provide more helpful error messages for common Twilio errors
    let userMessage = 'Failed to send SMS';
    let details = error.message;

    if (error.code === 21211) {
      userMessage = 'Invalid phone number';
      details = `The phone number ${formattedPhone} is not a valid mobile number.`;
    } else if (error.code === 21408) {
      userMessage = 'Permission denied';
      details = 'Your Twilio account does not have permission to send SMS to this region.';
    } else if (error.code === 21610) {
      userMessage = 'Unsubscribed recipient';
      details = 'This phone number has opted out of receiving SMS messages.';
    } else if (error.code === 21614) {
      userMessage = 'Invalid destination';
      details = `Cannot send SMS to ${formattedPhone}. The number may be a landline or VoIP number.`;
    }

    res.status(500).json({
      success: false,
      error: {
        message: userMessage,
        details,
        twilioCode: error.code
      }
    });
  }
}));

/**
 * POST /api/marketing/send-test-sms
 * Send a test SMS to a custom phone number (for testing Twilio configuration)
 */
router.post('/send-test-sms', asyncHandler(async (req: Request, res: Response) => {
  const { phone, message } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: { message: 'Phone number is required' }
    });
  }

  // Format and validate phone number
  const phoneResult = formatPhoneNumber(phone);
  if (!phoneResult.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid phone number format',
        details: phoneResult.error,
        tip: 'Enter 10 digits (e.g., 5551234567) or full format with country code (e.g., +15551234567)',
        originalInput: phone,
        attemptedFormat: phoneResult.formatted
      }
    });
  }

  const formattedPhone = phoneResult.formatted;
  const testMessage = message || `Test SMS from Servio Restaurant Platform. Your SMS configuration is working correctly! Sent at ${new Date().toLocaleString()}`;

  // Check Twilio configuration
  const configStatus = {
    hasSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasToken: !!process.env.TWILIO_AUTH_TOKEN,
    hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
    clientInitialized: !!twilioClient
  };

  if (!twilioClient) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'SMS service not configured',
        details: 'Twilio credentials are missing or invalid.',
        configStatus
      }
    });
  }

  try {
    const result = await twilioClient.messages.create({
      body: testMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    logger.info(`Test SMS sent to ${formattedPhone}: ${result.sid}`);

    await DatabaseService.getInstance().logAudit(
      restaurantId!,
      req.user?.id || 'system',
      'send_test_sms',
      'marketing',
      null,
      { phone: formattedPhone, sid: result.sid }
    );

    res.json({
      success: true,
      data: {
        sid: result.sid,
        status: result.status,
        to: formattedPhone,
        from: process.env.TWILIO_PHONE_NUMBER,
        actuallyDelivered: true
      },
      message: `Test SMS successfully sent to ${formattedPhone}. Check your phone!`
    });
  } catch (error: any) {
    logger.error('Test SMS send error:', error);

    let userMessage = 'Failed to send test SMS';
    let details = error.message;

    if (error.code === 21211) {
      userMessage = 'Invalid phone number';
      details = `The phone number ${formattedPhone} is not valid. Make sure it's a real mobile number.`;
    } else if (error.code === 21408) {
      userMessage = 'Permission denied';
      details = 'Your Twilio account does not have permission to send SMS to this region. Check your Twilio geographic permissions.';
    } else if (error.code === 21614) {
      userMessage = 'Invalid destination';
      details = `Cannot send SMS to ${formattedPhone}. The number may be a landline or VoIP number that cannot receive SMS.`;
    }

    res.status(500).json({
      success: false,
      error: {
        message: userMessage,
        details,
        twilioCode: error.code,
        formattedPhone,
        configStatus
      }
    });
  }
}));

/**
 * GET /api/marketing/validate-phone
 * Validate and format a phone number
 */
router.get('/validate-phone', asyncHandler(async (req: Request, res: Response) => {
  const phone = req.query.phone as string;

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: { message: 'Phone number is required as query parameter' }
    });
  }

  const result = formatPhoneNumber(phone);

  res.json({
    success: result.isValid,
    data: {
      original: phone,
      formatted: result.formatted,
      isValid: result.isValid,
      error: result.error
    }
  });
}));

/**
 * GET /api/marketing/sms-config-status
 * Check if SMS/Twilio is properly configured
 */
router.get('/sms-config-status', asyncHandler(async (req: Request, res: Response) => {
  const configStatus = {
    hasSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasToken: !!process.env.TWILIO_AUTH_TOKEN,
    hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
    clientInitialized: !!twilioClient,
    isFullyConfigured: !!twilioClient && !!process.env.TWILIO_PHONE_NUMBER
  };

  res.json({
    success: true,
    data: configStatus,
    message: configStatus.isFullyConfigured
      ? 'SMS service is fully configured and ready to send messages'
      : 'SMS service is not fully configured. Check your Twilio environment variables.'
  });
}));

/**
 * POST /api/marketing/send-email
 * Send individual email
 */
router.post('/send-email', asyncHandler(async (req: Request, res: Response) => {
  const { email, subject, message, customerId } = req.body;

  if (!email || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email, subject, and message are required' }
    });
  }

  try {
    const result = await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@servio.com',
      to: email,
      subject: subject,
      html: message,
      text: message.replace(/<[^>]*>/g, '') // Strip HTML for plain text
    });

    // Log the email send
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(`
      INSERT INTO marketing_sends (
        id, customer_id, type, recipient, subject, message, status, external_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      customerId,
      'email',
      email,
      subject,
      message,
      'sent',
      result.messageId
    ]);

    logger.info(`Email sent to ${email}: ${result.messageId}`);

    res.json({
      success: true,
      data: {
        messageId: result.messageId
      }
    });
  } catch (error: any) {
    logger.error('Email send error:', error);

    // Log the failed send
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(`
      INSERT INTO marketing_sends (
        id, customer_id, type, recipient, subject, message, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      customerId,
      'email',
      email,
      subject,
      message,
      'failed',
      error.message
    ]);

    res.status(500).json({
      success: false,
      error: { message: 'Failed to send email', details: error.message }
    });
  }
}));

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * GET /api/marketing/analytics
 * Get marketing analytics and statistics
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const { timeframe = '30d' } = req.query;
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;
  const optedInValue = db.dialect === 'postgres' ? true : 1;

  // Calculate date range
  const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const [
    customerStats,
    campaignStats,
    sendStats,
    recentSends
  ] = await Promise.all([
    // Customer statistics
    db.get(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN opt_in_sms = ? THEN 1 END) as sms_subscribers,
        COUNT(CASE WHEN opt_in_email = ? THEN 1 END) as email_subscribers,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_customers
      FROM customers 
      WHERE restaurant_id = ?
    `, [optedInValue, optedInValue, startDate.toISOString(), restaurantId]),

    // Campaign statistics
    db.get(`
      SELECT 
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_campaigns,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as recent_campaigns
      FROM marketing_campaigns 
      WHERE restaurant_id = ?
    `, [startDate.toISOString(), restaurantId]),

    // Send statistics
    db.get(`
      SELECT 
        COUNT(*) as total_sends,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_sends,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sends,
        COUNT(CASE WHEN type = 'sms' AND status = 'sent' THEN 1 END) as sms_sent,
        COUNT(CASE WHEN type = 'email' AND status = 'sent' THEN 1 END) as emails_sent
      FROM marketing_sends 
      INNER JOIN customers ON marketing_sends.customer_id = customers.id
      WHERE marketing_sends.created_at >= ?
        AND customers.restaurant_id = ?
    `, [startDate.toISOString(), restaurantId]),

    // Recent send activity
    db.all(`
      SELECT 
        marketing_sends.type,
        marketing_sends.recipient,
        marketing_sends.subject,
        marketing_sends.status,
        marketing_sends.created_at
      FROM marketing_sends 
      INNER JOIN customers ON marketing_sends.customer_id = customers.id
      WHERE marketing_sends.created_at >= ?
        AND customers.restaurant_id = ?
      ORDER BY marketing_sends.created_at DESC
      LIMIT 10
    `, [startDate.toISOString(), restaurantId])
  ]);

  res.json({
    success: true,
    data: {
      timeframe,
      customers: customerStats,
      campaigns: campaignStats,
      sends: sendStats,
      recent_activity: recentSends
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send a marketing campaign
 */
async function sendCampaign(campaignId: string) {
  const db = DatabaseService.getInstance().getDatabase();
  const optedInValue = db.dialect === 'postgres' ? true : 1;
  
  try {
    const campaign = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [campaignId]);
    if (!campaign) return;

    const targetCriteria = JSON.parse(campaign.target_criteria || '{}');
    
    // Build customer query based on criteria
    let customerQuery = 'SELECT * FROM customers WHERE restaurant_id = ?';
    const queryParams = [campaign.restaurant_id];

    if (campaign.type === 'sms') {
      customerQuery += ' AND opt_in_sms = ? AND phone IS NOT NULL';
      queryParams.push(optedInValue);
    } else if (campaign.type === 'email') {
      customerQuery += ' AND opt_in_email = ? AND email IS NOT NULL';
      queryParams.push(optedInValue);
    }

    if (targetCriteria.tags && targetCriteria.tags.length > 0) {
      customerQuery += ' AND (';
      targetCriteria.tags.forEach((tag: string, index: number) => {
        if (index > 0) customerQuery += ' OR ';
        if (db.dialect === 'postgres') {
          customerQuery += 'tags ILIKE ?';
          queryParams.push(`%\"${tag}\"%`);
        } else {
          customerQuery += 'JSON_EXTRACT(tags, ?) LIKE ?';
          queryParams.push(`$[*]`, `%${tag}%`);
        }
      });
      customerQuery += ')';
    }

    const customers = await db.all(customerQuery, queryParams);
    
    await db.run(
      'UPDATE marketing_campaigns SET total_recipients = ?, status = ? WHERE id = ?',
      [customers.length, 'sending', campaignId]
    );

    let successful = 0;
    let failed = 0;

    // Send to each customer
    for (const customer of customers) {
      try {
        if (campaign.type === 'sms') {
          if (!twilioClient) {
            throw new Error('SMS service not configured');
          }
          // Format phone number before sending
          const phoneResult = formatPhoneNumber(customer.phone);
          if (!phoneResult.isValid) {
            throw new Error(`Invalid phone number format: ${customer.phone}`);
          }
          await twilioClient.messages.create({
            body: campaign.message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneResult.formatted
          });
        } else if (campaign.type === 'email') {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@servio.com',
            to: customer.email,
            subject: campaign.subject || 'Message from Restaurant',
            html: campaign.message,
            text: campaign.message.replace(/<[^>]*>/g, '')
          });
        }

        // Log successful send
        await db.run(`
          INSERT INTO marketing_sends (
            id, campaign_id, customer_id, type, recipient, subject, message, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          campaignId,
          customer.id,
          campaign.type,
          campaign.type === 'sms' ? customer.phone : customer.email,
          campaign.subject,
          campaign.message,
          'sent'
        ]);

        successful++;
      } catch (error: any) {
        // Log failed send
        await db.run(`
          INSERT INTO marketing_sends (
            id, campaign_id, customer_id, type, recipient, subject, message, status, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          campaignId,
          customer.id,
          campaign.type,
          campaign.type === 'sms' ? customer.phone : customer.email,
          campaign.subject,
          campaign.message,
          'failed',
          error.message
        ]);

        failed++;
        logger.error(`Failed to send ${campaign.type} to ${customer.email || customer.phone}:`, error);
      }
    }

    // Update campaign with results
    await db.run(`
      UPDATE marketing_campaigns 
      SET status = ?, successful_sends = ?, failed_sends = ?, sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, ['sent', successful, failed, campaignId]);

    logger.info(`Campaign ${campaignId} completed: ${successful} sent, ${failed} failed`);

  } catch (error) {
    logger.error(`Campaign ${campaignId} failed:`, error);

    await db.run(
      'UPDATE marketing_campaigns SET status = ? WHERE id = ?',
      ['failed', campaignId]
    );
  }
}

// ============================================================================
// STAFF MESSAGING
// ============================================================================

/**
 * POST /api/marketing/send-staff-message
 * Send message to a specific staff member
 */
router.post('/send-staff-message', asyncHandler(async (req: Request, res: Response) => {
  const { staffId, message, method = 'both' } = req.body;

  if (!staffId || !message) {
    return res.status(400).json({
      success: false,
      error: { message: 'Staff ID and message are required' }
    });
  }

  const { OrderNotificationService } = await import('../services/OrderNotificationService');
  const notificationService = OrderNotificationService.getInstance();

  try {
    const results = await notificationService.sendStaffMessage(staffId, message, method);

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    logger.error('Staff message error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send message to staff', details: error.message }
    });
  }
}));

/**
 * POST /api/marketing/broadcast-staff
 * Broadcast message to all staff
 */
router.post('/broadcast-staff', asyncHandler(async (req: Request, res: Response) => {
  const { message, method = 'both' } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: { message: 'Message is required' }
    });
  }

  const { OrderNotificationService } = await import('../services/OrderNotificationService');
  const notificationService = OrderNotificationService.getInstance();

  try {
    const results = await notificationService.broadcastToStaff(restaurantId!, message, method);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      data: {
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error: any) {
    logger.error('Staff broadcast error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to broadcast to staff', details: error.message }
    });
  }
}));

/**
 * GET /api/marketing/staff
 * Get all staff for messaging
 */
router.get('/staff', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = req.user?.restaurantId;

  const staff = await db.all(`
    SELECT
      id,
      name,
      email,
      phone,
      role,
      status
    FROM staff
    WHERE restaurant_id = ?
    ORDER BY name ASC
  `, [restaurantId]);

  res.json({
    success: true,
    data: staff
  });
}));

export default router;
