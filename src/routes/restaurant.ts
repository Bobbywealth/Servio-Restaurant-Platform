import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import QRCode from 'qrcode';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const ensureUploadsDir = async (subdir: string = '') => {
  const uploadsPath = path.join(process.cwd(), 'uploads', 'restaurants', subdir);
  try {
    await fs.access(uploadsPath);
  } catch {
    await fs.mkdir(uploadsPath, { recursive: true });
  }
  return uploadsPath;
};

// ============================================================================
// RESTAURANT PROFILE MANAGEMENT
// ============================================================================

/**
 * GET /api/restaurant/profile
 * Get restaurant profile information
 */
router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001'; // Default restaurant

  const restaurant = await db.get(`
    SELECT 
      id, name, slug, address, phone, email, website, description,
      cuisine_type, price_range, logo_url, cover_image_url, custom_domain,
      social_links, menu_pdf_url, online_ordering_enabled, delivery_enabled,
      pickup_enabled, delivery_radius, delivery_fee, minimum_order,
      operating_hours, timezone, settings, is_active, created_at, updated_at
    FROM restaurants 
    WHERE id = ?
  `, [restaurantId]);

  if (!restaurant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Restaurant not found' }
    });
  }

  // Parse JSON fields
  const formattedRestaurant = {
    ...restaurant,
    address: JSON.parse(restaurant.address || '{}'),
    social_links: JSON.parse(restaurant.social_links || '{}'),
    operating_hours: JSON.parse(restaurant.operating_hours || '{}'),
    settings: JSON.parse(restaurant.settings || '{}'),
    online_ordering_enabled: Boolean(restaurant.online_ordering_enabled),
    delivery_enabled: Boolean(restaurant.delivery_enabled),
    pickup_enabled: Boolean(restaurant.pickup_enabled),
    is_active: Boolean(restaurant.is_active)
  };

  res.json({
    success: true,
    data: formattedRestaurant
  });
}));

/**
 * PUT /api/restaurant/profile
 * Update restaurant profile
 */
router.put('/profile', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]), asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    cuisineType,
    priceRange,
    phone,
    email,
    website,
    address,
    socialLinks,
    operatingHours,
    onlineOrderingEnabled,
    deliveryEnabled,
    pickupEnabled,
    deliveryRadius,
    deliveryFee,
    minimumOrder,
    customDomain
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  const existingRestaurant = await db.get('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
  if (!existingRestaurant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Restaurant not found' }
    });
  }

  // Handle image uploads
  let logoUrl = existingRestaurant.logo_url;
  let coverImageUrl = existingRestaurant.cover_image_url;

  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const uploadsPath = await ensureUploadsDir();

    // Process logo upload
    if (files.logo && files.logo[0]) {
      const logoFile = files.logo[0];
      const logoFileName = `logo-${restaurantId}-${Date.now()}.webp`;
      const logoPath = path.join(uploadsPath, logoFileName);
      
      await sharp(logoFile.buffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(logoPath);
      
      logoUrl = `/uploads/restaurants/${logoFileName}`;
    }

    // Process cover image upload
    if (files.coverImage && files.coverImage[0]) {
      const coverFile = files.coverImage[0];
      const coverFileName = `cover-${restaurantId}-${Date.now()}.webp`;
      const coverPath = path.join(uploadsPath, coverFileName);
      
      await sharp(coverFile.buffer)
        .resize(1200, 600, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(coverPath);
      
      coverImageUrl = `/uploads/restaurants/${coverFileName}`;
    }
  }

  // Build update query
  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(name);
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
  }
  if (cuisineType !== undefined) {
    updateFields.push('cuisine_type = ?');
    updateValues.push(cuisineType);
  }
  if (priceRange !== undefined) {
    updateFields.push('price_range = ?');
    updateValues.push(priceRange);
  }
  if (phone !== undefined) {
    updateFields.push('phone = ?');
    updateValues.push(phone);
  }
  if (email !== undefined) {
    updateFields.push('email = ?');
    updateValues.push(email);
  }
  if (website !== undefined) {
    updateFields.push('website = ?');
    updateValues.push(website);
  }
  if (address !== undefined) {
    updateFields.push('address = ?');
    updateValues.push(JSON.stringify(address));
  }
  if (socialLinks !== undefined) {
    updateFields.push('social_links = ?');
    updateValues.push(JSON.stringify(socialLinks));
  }
  if (operatingHours !== undefined) {
    updateFields.push('operating_hours = ?');
    updateValues.push(JSON.stringify(operatingHours));
  }
  if (onlineOrderingEnabled !== undefined) {
    updateFields.push('online_ordering_enabled = ?');
    updateValues.push(onlineOrderingEnabled ? 1 : 0);
  }
  if (deliveryEnabled !== undefined) {
    updateFields.push('delivery_enabled = ?');
    updateValues.push(deliveryEnabled ? 1 : 0);
  }
  if (pickupEnabled !== undefined) {
    updateFields.push('pickup_enabled = ?');
    updateValues.push(pickupEnabled ? 1 : 0);
  }
  if (deliveryRadius !== undefined) {
    updateFields.push('delivery_radius = ?');
    updateValues.push(deliveryRadius);
  }
  if (deliveryFee !== undefined) {
    updateFields.push('delivery_fee = ?');
    updateValues.push(deliveryFee);
  }
  if (minimumOrder !== undefined) {
    updateFields.push('minimum_order = ?');
    updateValues.push(minimumOrder);
  }
  if (customDomain !== undefined) {
    updateFields.push('custom_domain = ?');
    updateValues.push(customDomain);
  }

  // Always update logo and cover image URLs and timestamp
  updateFields.push('logo_url = ?', 'cover_image_url = ?', 'updated_at = CURRENT_TIMESTAMP');
  updateValues.push(logoUrl, coverImageUrl, restaurantId);

  await db.run(`
    UPDATE restaurants 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `, updateValues);

  // Get updated restaurant
  const updatedRestaurant = await db.get(`
    SELECT * FROM restaurants WHERE id = ?
  `, [restaurantId]);

  await DatabaseService.getInstance().logAudit(
    'system',
    'update_restaurant_profile',
    'restaurant',
    restaurantId,
    { name, description, cuisineType }
  );

  logger.info(`Restaurant profile updated: ${name || existingRestaurant.name}`);

  res.json({
    success: true,
    data: {
      ...updatedRestaurant,
      address: JSON.parse(updatedRestaurant.address || '{}'),
      social_links: JSON.parse(updatedRestaurant.social_links || '{}'),
      operating_hours: JSON.parse(updatedRestaurant.operating_hours || '{}'),
      settings: JSON.parse(updatedRestaurant.settings || '{}')
    }
  });
}));

// ============================================================================
// RESTAURANT THEMES
// ============================================================================

/**
 * GET /api/restaurant/theme
 * Get restaurant theme settings
 */
router.get('/theme', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  const theme = await db.get(`
    SELECT * FROM restaurant_themes 
    WHERE restaurant_id = ? AND is_active = TRUE
  `, [restaurantId]);

  if (!theme) {
    // Return default theme
    res.json({
      success: true,
      data: {
        id: null,
        restaurant_id: restaurantId,
        name: 'Default',
        primary_color: '#ff6b35',
        secondary_color: '#f7931e',
        text_color: '#333333',
        background_color: '#ffffff',
        font_family: 'Inter',
        layout_style: 'modern',
        custom_css: null,
        is_active: true
      }
    });
  } else {
    res.json({
      success: true,
      data: {
        ...theme,
        is_active: Boolean(theme.is_active)
      }
    });
  }
}));

/**
 * PUT /api/restaurant/theme
 * Update restaurant theme
 */
router.put('/theme', asyncHandler(async (req: Request, res: Response) => {
  const {
    name = 'Custom Theme',
    primaryColor,
    secondaryColor,
    textColor,
    backgroundColor,
    fontFamily,
    layoutStyle,
    customCss
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  // Check if theme exists
  const existingTheme = await db.get(`
    SELECT * FROM restaurant_themes 
    WHERE restaurant_id = ? AND is_active = TRUE
  `, [restaurantId]);

  if (existingTheme) {
    // Update existing theme
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (primaryColor !== undefined) {
      updateFields.push('primary_color = ?');
      updateValues.push(primaryColor);
    }
    if (secondaryColor !== undefined) {
      updateFields.push('secondary_color = ?');
      updateValues.push(secondaryColor);
    }
    if (textColor !== undefined) {
      updateFields.push('text_color = ?');
      updateValues.push(textColor);
    }
    if (backgroundColor !== undefined) {
      updateFields.push('background_color = ?');
      updateValues.push(backgroundColor);
    }
    if (fontFamily !== undefined) {
      updateFields.push('font_family = ?');
      updateValues.push(fontFamily);
    }
    if (layoutStyle !== undefined) {
      updateFields.push('layout_style = ?');
      updateValues.push(layoutStyle);
    }
    if (customCss !== undefined) {
      updateFields.push('custom_css = ?');
      updateValues.push(customCss);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(existingTheme.id);

    await db.run(`
      UPDATE restaurant_themes 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    const updatedTheme = await db.get('SELECT * FROM restaurant_themes WHERE id = ?', [existingTheme.id]);
    
    res.json({
      success: true,
      data: {
        ...updatedTheme,
        is_active: Boolean(updatedTheme.is_active)
      }
    });
  } else {
    // Create new theme
    const themeId = uuidv4();

    await db.run(`
      INSERT INTO restaurant_themes (
        id, restaurant_id, name, primary_color, secondary_color, 
        text_color, background_color, font_family, layout_style, custom_css, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      themeId,
      restaurantId,
      name,
      primaryColor || '#ff6b35',
      secondaryColor || '#f7931e',
      textColor || '#333333',
      backgroundColor || '#ffffff',
      fontFamily || 'Inter',
      layoutStyle || 'modern',
      customCss
    ]);

    const newTheme = await db.get('SELECT * FROM restaurant_themes WHERE id = ?', [themeId]);
    
    res.status(201).json({
      success: true,
      data: {
        ...newTheme,
        is_active: Boolean(newTheme.is_active)
      }
    });
  }

  await DatabaseService.getInstance().logAudit(
    'system',
    'update_restaurant_theme',
    'restaurant_theme',
    existingTheme?.id || 'new',
    { name, primaryColor, secondaryColor }
  );
}));

// ============================================================================
// RESTAURANT LINKS
// ============================================================================

/**
 * GET /api/restaurant/links
 * Get all restaurant links
 */
router.get('/links', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  const links = await db.all(`
    SELECT 
      id, name, description, url_path, target_url, link_type,
      is_active, click_count, qr_code_url, custom_styling, created_at
    FROM restaurant_links 
    WHERE restaurant_id = ?
    ORDER BY link_type, name
  `, [restaurantId]);

  const formattedLinks = links.map((link: any) => ({
    ...link,
    is_active: Boolean(link.is_active),
    custom_styling: JSON.parse(link.custom_styling || '{}')
  }));

  res.json({
    success: true,
    data: formattedLinks
  });
}));

/**
 * POST /api/restaurant/links
 * Create a new restaurant link
 */
router.post('/links', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    urlPath,
    targetUrl,
    linkType = 'custom',
    customStyling = {}
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();
  const restaurantId = '00000000-0000-0000-0000-000000000001';

  if (!name || !urlPath) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name and URL path are required' }
    });
  }

  // Check if URL path already exists
  const existingLink = await db.get(
    'SELECT id FROM restaurant_links WHERE restaurant_id = ? AND url_path = ?',
    [restaurantId, urlPath]
  );

  if (existingLink) {
    return res.status(400).json({
      success: false,
      error: { message: 'URL path already exists' }
    });
  }

  const linkId = uuidv4();
  
  // Generate QR code for the link
  const baseUrl = process.env.BASE_URL || 'https://servio.com';
  const fullUrl = `${baseUrl}/r/${restaurantId}/${urlPath}`;
  
  const qrCodePath = await ensureUploadsDir('qr-codes');
  const qrFileName = `qr-${linkId}.png`;
  const qrFilePath = path.join(qrCodePath, qrFileName);
  
  await QRCode.toFile(qrFilePath, fullUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  
  const qrCodeUrl = `/uploads/restaurants/qr-codes/${qrFileName}`;

  await db.run(`
    INSERT INTO restaurant_links (
      id, restaurant_id, name, description, url_path, target_url,
      link_type, qr_code_url, custom_styling, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, [
    linkId,
    restaurantId,
    name,
    description,
    urlPath,
    targetUrl,
    linkType,
    qrCodeUrl,
    JSON.stringify(customStyling)
  ]);

  const newLink = await db.get('SELECT * FROM restaurant_links WHERE id = ?', [linkId]);

  await DatabaseService.getInstance().logAudit(
    'system',
    'create_restaurant_link',
    'restaurant_link',
    linkId,
    { name, urlPath, linkType }
  );

  logger.info(`Restaurant link created: ${name} (${urlPath})`);

  res.status(201).json({
    success: true,
    data: {
      ...newLink,
      is_active: Boolean(newLink.is_active),
      custom_styling: JSON.parse(newLink.custom_styling || '{}')
    }
  });
}));

/**
 * PUT /api/restaurant/links/:id
 * Update a restaurant link
 */
router.put('/links/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    urlPath,
    targetUrl,
    linkType,
    isActive,
    customStyling
  } = req.body;

  const db = DatabaseService.getInstance().getDatabase();

  const existingLink = await db.get('SELECT * FROM restaurant_links WHERE id = ?', [id]);
  if (!existingLink) {
    return res.status(404).json({
      success: false,
      error: { message: 'Link not found' }
    });
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(name);
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(description);
  }
  if (urlPath !== undefined) {
    // Check if new URL path conflicts
    if (urlPath !== existingLink.url_path) {
      const conflictingLink = await db.get(
        'SELECT id FROM restaurant_links WHERE restaurant_id = ? AND url_path = ? AND id != ?',
        [existingLink.restaurant_id, urlPath, id]
      );
      
      if (conflictingLink) {
        return res.status(400).json({
          success: false,
          error: { message: 'URL path already exists' }
        });
      }
    }
    
    updateFields.push('url_path = ?');
    updateValues.push(urlPath);
  }
  if (targetUrl !== undefined) {
    updateFields.push('target_url = ?');
    updateValues.push(targetUrl);
  }
  if (linkType !== undefined) {
    updateFields.push('link_type = ?');
    updateValues.push(linkType);
  }
  if (isActive !== undefined) {
    updateFields.push('is_active = ?');
    updateValues.push(isActive ? 1 : 0);
  }
  if (customStyling !== undefined) {
    updateFields.push('custom_styling = ?');
    updateValues.push(JSON.stringify(customStyling));
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.run(`
      UPDATE restaurant_links 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
  }

  const updatedLink = await db.get('SELECT * FROM restaurant_links WHERE id = ?', [id]);

  await DatabaseService.getInstance().logAudit(
    'system',
    'update_restaurant_link',
    'restaurant_link',
    id,
    { name, urlPath, linkType }
  );

  res.json({
    success: true,
    data: {
      ...updatedLink,
      is_active: Boolean(updatedLink.is_active),
      custom_styling: JSON.parse(updatedLink.custom_styling || '{}')
    }
  });
}));

/**
 * DELETE /api/restaurant/links/:id
 * Delete a restaurant link
 */
router.delete('/links/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const link = await db.get('SELECT * FROM restaurant_links WHERE id = ?', [id]);
  if (!link) {
    return res.status(404).json({
      success: false,
      error: { message: 'Link not found' }
    });
  }

  await db.run('DELETE FROM restaurant_links WHERE id = ?', [id]);

  // Clean up QR code file
  if (link.qr_code_url) {
    const qrFilePath = path.join(process.cwd(), 'uploads', 'restaurants', 'qr-codes', path.basename(link.qr_code_url));
    try {
      await fs.unlink(qrFilePath);
    } catch (error) {
      logger.warn(`Failed to delete QR code file: ${qrFilePath}`);
    }
  }

  await DatabaseService.getInstance().logAudit(
    'system',
    'delete_restaurant_link',
    'restaurant_link',
    id,
    { linkName: link.name, urlPath: link.url_path }
  );

  res.json({
    success: true,
    message: 'Link deleted successfully'
  });
}));

/**
 * POST /api/restaurant/links/:id/click
 * Track link click
 */
router.post('/links/:id/click', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = DatabaseService.getInstance().getDatabase();

  const link = await db.get('SELECT * FROM restaurant_links WHERE id = ?', [id]);
  if (!link) {
    return res.status(404).json({
      success: false,
      error: { message: 'Link not found' }
    });
  }

  // Increment click count
  await db.run(
    'UPDATE restaurant_links SET click_count = click_count + 1 WHERE id = ?',
    [id]
  );

  // Log the click for analytics
  await db.run(`
    INSERT INTO analytics_events (restaurant_id, event_type, properties)
    VALUES (?, ?, ?)
  `, [
    link.restaurant_id,
    'link_click',
    JSON.stringify({ 
      link_id: id, 
      link_name: link.name, 
      url_path: link.url_path,
      timestamp: new Date().toISOString()
    })
  ]);

  res.json({
    success: true,
    data: {
      click_count: link.click_count + 1
    }
  });
}));

export default router;