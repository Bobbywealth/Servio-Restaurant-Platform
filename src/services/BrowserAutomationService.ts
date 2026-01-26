import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import crypto from 'crypto';

export interface PlatformCredentials {
  id: string;
  restaurantId: string;
  platform: 'doordash' | 'ubereats' | 'grubhub' | 'postmates';
  username: string;
  passwordEncrypted: string;
  portalUrl?: string;
  isActive: boolean;
  syncConfig: Record<string, any>;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  category?: string;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
  details: Record<string, any>;
}

export class BrowserAutomationService {
  private static instance: BrowserAutomationService;
  private browser: Browser | null = null;
  private encryptionKey: string;

  private constructor() {
    // Use JWT secret for encryption (in production, use a separate key)
    this.encryptionKey = process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me';
  }

  public static getInstance(): BrowserAutomationService {
    if (!BrowserAutomationService.instance) {
      BrowserAutomationService.instance = new BrowserAutomationService();
    }
    return BrowserAutomationService.instance;
  }

  /**
   * Initialize browser instance with anti-detection measures
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      // Allow headless override via environment variable
      const headlessMode = process.env.HEADLESS !== 'false';

      this.browser = await chromium.launch({
        headless: headlessMode,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',

          // Anti-detection arguments
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--start-maximized',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      logger.info(`Browser launched in ${headlessMode ? 'headless' : 'headed'} mode`);
    }
    return this.browser;
  }

  /**
   * Create stealth context with realistic fingerprint
   */
  private async createStealthContext(): Promise<BrowserContext> {
    const browser = await this.initBrowser();

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },

      // Realistic user agent (update periodically)
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

      locale: 'en-US',
      timezoneId: 'America/New_York',
      javaScriptEnabled: true,

      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Inject anti-detection scripts
    await context.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Make plugins look real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Add chrome runtime
      (window as any).chrome = { runtime: {} };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );
    });

    return context;
  }

  /**
   * Random delay to mimic human behavior
   */
  private async humanDelay(min: number = 500, max: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Type text like a human with random delays
   */
  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await this.humanDelay(100, 300);

    for (const char of text) {
      await page.type(selector, char);
      await this.humanDelay(50, 150);
    }
  }

  /**
   * Check if page has captcha
   */
  private async detectCaptcha(page: Page): Promise<boolean> {
    try {
      const captchaSelectors = [
        '[class*="captcha"]',
        '[id*="captcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '[class*="challenge"]',
        '#challenge-form'
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          logger.warn(`Captcha detected: ${selector}`);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Close browser instance
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Encrypt password for storage
   */
  public encryptPassword(password: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt password for use
   */
  private decryptPassword(encryptedPassword: string): string {
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Save platform credentials
   */
  public async saveCredentials(credentials: {
    restaurantId: string;
    platform: string;
    username: string;
    password: string;
    portalUrl?: string;
    syncConfig?: Record<string, any>;
  }): Promise<PlatformCredentials> {
    const db = DatabaseService.getInstance().getDatabase();
    const id = crypto.randomUUID();
    const encryptedPassword = this.encryptPassword(credentials.password);

    await db.run(`
      INSERT INTO delivery_platform_credentials
      (id, restaurant_id, platform, username, password_encrypted, portal_url, sync_config, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      credentials.restaurantId,
      credentials.platform,
      credentials.username,
      encryptedPassword,
      credentials.portalUrl || null,
      JSON.stringify(credentials.syncConfig || {}),
      true
    ]);

    logger.info(`Saved credentials for ${credentials.platform} - Restaurant: ${credentials.restaurantId}`);

    return {
      id,
      restaurantId: credentials.restaurantId,
      platform: credentials.platform as any,
      username: credentials.username,
      passwordEncrypted: encryptedPassword,
      portalUrl: credentials.portalUrl,
      isActive: true,
      syncConfig: credentials.syncConfig || {}
    };
  }

  /**
   * Get credentials for a restaurant and platform
   */
  public async getCredentials(restaurantId: string, platform: string): Promise<PlatformCredentials | null> {
    const db = DatabaseService.getInstance().getDatabase();
    const row = await db.get(`
      SELECT id, restaurant_id, platform, username, password_encrypted, portal_url,
             is_active, sync_config, last_sync_at, last_sync_status
      FROM delivery_platform_credentials
      WHERE restaurant_id = ? AND platform = ? AND is_active = 1
    `, [restaurantId, platform]);

    if (!row) return null;

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      platform: row.platform,
      username: row.username,
      passwordEncrypted: row.password_encrypted,
      portalUrl: row.portal_url,
      isActive: row.is_active === 1,
      syncConfig: JSON.parse(row.sync_config || '{}')
    };
  }

  /**
   * Get all credentials for a restaurant
   */
  public async getAllCredentials(restaurantId: string): Promise<PlatformCredentials[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const rows = await db.all(`
      SELECT id, restaurant_id, platform, username, password_encrypted, portal_url,
             is_active, sync_config, last_sync_at, last_sync_status
      FROM delivery_platform_credentials
      WHERE restaurant_id = ? AND is_active = 1
      ORDER BY platform
    `, [restaurantId]);

    return rows.map(row => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      platform: row.platform,
      username: row.username,
      passwordEncrypted: row.password_encrypted,
      portalUrl: row.portal_url,
      isActive: row.is_active === 1,
      syncConfig: JSON.parse(row.sync_config || '{}')
    }));
  }

  /**
   * Log sync operation
   */
  private async logSync(
    credentialId: string,
    restaurantId: string,
    platform: string,
    syncType: string,
    status: 'running' | 'success' | 'failed' | 'partial',
    result?: Partial<SyncResult>
  ): Promise<string> {
    const db = DatabaseService.getInstance().getDatabase();
    const id = crypto.randomUUID();

    await db.run(`
      INSERT INTO delivery_platform_sync_logs
      (id, credential_id, restaurant_id, platform, sync_type, status,
       items_synced, items_failed, error_message, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      credentialId,
      restaurantId,
      platform,
      syncType,
      status,
      result?.itemsSynced || 0,
      result?.itemsFailed || 0,
      result?.errors?.join('; ') || null,
      JSON.stringify(result?.details || {})
    ]);

    return id;
  }

  /**
   * Update sync log status
   */
  private async updateSyncLog(logId: string, status: string, result?: Partial<SyncResult>): Promise<void> {
    const db = DatabaseService.getInstance().getDatabase();

    await db.run(`
      UPDATE delivery_platform_sync_logs
      SET status = ?,
          items_synced = ?,
          items_failed = ?,
          error_message = ?,
          details = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      status,
      result?.itemsSynced || 0,
      result?.itemsFailed || 0,
      result?.errors?.join('; ') || null,
      JSON.stringify(result?.details || {}),
      logId
    ]);
  }

  /**
   * Get menu items for a restaurant
   */
  public async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    const db = DatabaseService.getInstance().getDatabase();
    const rows = await db.all(`
      SELECT id, name, description, price, is_available, category_id
      FROM menu_items
      WHERE restaurant_id = ?
      ORDER BY name
    `, [restaurantId]);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      isAvailable: row.is_available === 1,
      category: row.category_id
    }));
  }

  /**
   * Main sync method - routes to platform-specific implementation
   */
  public async syncMenuToPlatform(
    restaurantId: string,
    platform: 'doordash' | 'ubereats' | 'grubhub' | 'postmates',
    syncType: 'menu_update' | 'stock_update' | 'price_update' | 'full_sync' = 'full_sync'
  ): Promise<SyncResult> {
    logger.info(`Starting ${syncType} for ${platform} - Restaurant: ${restaurantId}`);

    // Get credentials
    const credentials = await this.getCredentials(restaurantId, platform);
    if (!credentials) {
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [`No credentials found for ${platform}`],
        details: {}
      };
    }

    // Create sync log
    const logId = await this.logSync(
      credentials.id,
      restaurantId,
      platform,
      syncType,
      'running'
    );

    try {
      // Get menu items
      const menuItems = await this.getMenuItems(restaurantId);

      // Route to platform-specific implementation
      let result: SyncResult;
      switch (platform) {
        case 'doordash':
          result = await this.syncDoorDash(credentials, menuItems, syncType);
          break;
        case 'ubereats':
          result = await this.syncUberEats(credentials, menuItems, syncType);
          break;
        case 'grubhub':
        case 'postmates':
          result = {
            success: false,
            itemsSynced: 0,
            itemsFailed: 0,
            errors: [`${platform} integration not yet implemented`],
            details: {}
          };
          break;
        default:
          result = {
            success: false,
            itemsSynced: 0,
            itemsFailed: 0,
            errors: [`Unknown platform: ${platform}`],
            details: {}
          };
      }

      // Update sync log
      const status = result.success ? 'success' : (result.itemsSynced > 0 ? 'partial' : 'failed');
      await this.updateSyncLog(logId, status, result);

      // Update credentials last sync
      const db = DatabaseService.getInstance().getDatabase();
      await db.run(`
        UPDATE delivery_platform_credentials
        SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = ?
        WHERE id = ?
      `, [status, credentials.id]);

      return result;
    } catch (error: any) {
      logger.error(`Sync failed for ${platform}:`, error);
      const result = {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [error.message],
        details: { error: error.stack }
      };
      await this.updateSyncLog(logId, 'failed', result);
      return result;
    }
  }

  /**
   * DoorDash-specific sync implementation with stealth mode
   */
  private async syncDoorDash(
    credentials: PlatformCredentials,
    menuItems: MenuItem[],
    syncType: string
  ): Promise<SyncResult> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    const result: SyncResult = {
      success: false,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [],
      details: {}
    };

    try {
      const password = this.decryptPassword(credentials.passwordEncrypted);

      // Navigate to DoorDash Merchant Portal
      const portalUrl = credentials.portalUrl || 'https://merchant-portal.doordash.com';
      logger.info(`Navigating to ${portalUrl}...`);
      await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Check for captcha before login
      if (await this.detectCaptcha(page)) {
        throw new Error('Captcha detected before login. Set HEADLESS=false to solve manually.');
      }

      // Login with human-like behavior
      logger.info('Attempting DoorDash login with stealth mode...');
      const emailSelector = 'input[name="email"], input[type="email"], #email';
      const passwordSelector = 'input[name="password"], input[type="password"], #password';

      // Type email like a human
      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.humanType(page, emailSelector, credentials.username);
      await this.humanDelay(500, 1000);

      // Check for "Next" button (two-step login)
      const nextButton = await page.$('button:has-text("Next"), button:has-text("Continue")');
      if (nextButton) {
        await nextButton.click();
        await this.humanDelay(2000, 3000);
      }

      // Type password like a human
      await page.waitForSelector(passwordSelector, { timeout: 10000 });
      await this.humanType(page, passwordSelector, password);
      await this.humanDelay(500, 1000);

      // Click login button
      await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")');
      await this.humanDelay(5000, 7000);

      // Check for captcha after login attempt
      if (await this.detectCaptcha(page)) {
        throw new Error('Captcha detected after login. Set HEADLESS=false to solve manually.');
      }

      // Check if login was successful
      const url = page.url();
      if (url.includes('login') || url.includes('signin')) {
        throw new Error('Login failed - still on login page. Check credentials or captcha.');
      }

      logger.info('DoorDash login successful (stealth mode)');

      // Navigate to menu management
      logger.info('Navigating to menu management...');
      await page.goto(`${portalUrl}/menu`, { waitUntil: 'networkidle', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Sync each menu item with human-like behavior
      for (const item of menuItems) {
        try {
          // Search for the item (human typing)
          const searchSelector = 'input[placeholder*="Search"], input[type="search"]';
          if (await page.$(searchSelector)) {
            await this.humanType(page, searchSelector, item.name);
            await this.humanDelay(800, 1500);
          }

          // Try to find and update the item
          const itemRow = await page.locator(`text="${item.name}"`).first();

          if (await itemRow.isVisible()) {
            // Click to edit
            await itemRow.click();
            await this.humanDelay(1000, 2000);

            // Update availability toggle
            if (syncType === 'stock_update' || syncType === 'full_sync') {
              const toggleSelector = 'button[role="switch"], input[type="checkbox"][aria-label*="available"]';
              const toggle = page.locator(toggleSelector).first();

              if (await toggle.isVisible()) {
                const isCurrentlyEnabled = await toggle.getAttribute('aria-checked') === 'true';
                if (isCurrentlyEnabled !== item.isAvailable) {
                  await toggle.click();
                  await this.humanDelay(500, 800);
                }
              }
            }

            // Update price
            if (syncType === 'price_update' || syncType === 'full_sync') {
              const priceInput = page.locator('input[name*="price"], input[aria-label*="price"]').first();
              if (await priceInput.isVisible()) {
                await priceInput.fill(''); // Clear first
                await this.humanDelay(200, 400);
                await this.humanType(page, 'input[name*="price"], input[aria-label*="price"]', item.price.toFixed(2));
                await this.humanDelay(500, 800);
              }
            }

            // Save changes
            await page.click('button:has-text("Save"), button:has-text("Update")');
            await this.humanDelay(1500, 2500);

            result.itemsSynced++;
            logger.info(`✓ Synced: ${item.name}`);
          } else {
            result.itemsFailed++;
            result.errors.push(`Item not found: ${item.name}`);
          }
        } catch (error: any) {
          result.itemsFailed++;
          result.errors.push(`Failed to sync ${item.name}: ${error.message}`);
          logger.error(`Failed to sync item ${item.name}:`, error);
        }
      }

      result.success = result.itemsSynced > 0;
      result.details = {
        platform: 'doordash',
        syncType,
        totalItems: menuItems.length
      };

    } catch (error: any) {
      logger.error('DoorDash sync error:', error);
      result.errors.push(error.message);
      result.details.error = error.stack;
    } finally {
      await context.close();
    }

    return result;
  }

  /**
   * UberEats-specific sync implementation with stealth mode
   */
  private async syncUberEats(
    credentials: PlatformCredentials,
    menuItems: MenuItem[],
    syncType: string
  ): Promise<SyncResult> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    const result: SyncResult = {
      success: false,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [],
      details: {}
    };

    try {
      const password = this.decryptPassword(credentials.passwordEncrypted);

      // Navigate to UberEats Manager
      const portalUrl = credentials.portalUrl || 'https://restaurant.uber.com';
      logger.info(`Navigating to ${portalUrl}/login...`);
      await page.goto(`${portalUrl}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Check for captcha before login
      if (await this.detectCaptcha(page)) {
        throw new Error('Captcha detected before login. Set HEADLESS=false to solve manually.');
      }

      // Login with human-like behavior
      logger.info('Attempting UberEats login with stealth mode...');
      const emailSelector = 'input[type="email"], input[name="email"], #email';
      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.humanType(page, emailSelector, credentials.username);
      await this.humanDelay(500, 1000);

      // Click next/continue
      await page.click('button:has-text("Next"), button:has-text("Continue"), button[type="submit"]');
      await this.humanDelay(2000, 3000);

      // Enter password
      const passwordSelector = 'input[type="password"], input[name="password"], #password';
      await page.waitForSelector(passwordSelector, { timeout: 10000 });
      await this.humanType(page, passwordSelector, password);
      await this.humanDelay(500, 1000);

      // Click login
      await page.click('button:has-text("Sign In"), button:has-text("Log In"), button[type="submit"]');
      await this.humanDelay(5000, 7000);

      // Check for captcha after login attempt
      if (await this.detectCaptcha(page)) {
        throw new Error('Captcha detected after login. Set HEADLESS=false to solve manually.');
      }

      // Check if login was successful
      const url = page.url();
      if (url.includes('login') || url.includes('signin')) {
        throw new Error('Login failed - still on login page. Check credentials or captcha.');
      }

      logger.info('UberEats login successful (stealth mode)');

      // Navigate to menu management
      logger.info('Navigating to menu management...');
      await page.goto(`${portalUrl}/menu`, { waitUntil: 'networkidle', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Sync each menu item with human-like behavior
      for (const item of menuItems) {
        try {
          // Search for the item
          const searchSelector = 'input[placeholder*="Search"], input[type="search"]';
          if (await page.locator(searchSelector).isVisible()) {
            await this.humanType(page, searchSelector, item.name);
            await this.humanDelay(800, 1500);
          }

          // Try to find and update the item
          const itemCard = await page.locator(`text="${item.name}"`).first();

          if (await itemCard.isVisible()) {
            await itemCard.click();
            await this.humanDelay(1500, 2500);

            // Update availability toggle
            if (syncType === 'stock_update' || syncType === 'full_sync') {
              const availabilityToggle = page.locator('[data-testid*="availability"], button[role="switch"]').first();

              if (await availabilityToggle.isVisible()) {
                const isCurrentlyEnabled = await availabilityToggle.getAttribute('aria-checked') === 'true';
                if (isCurrentlyEnabled !== item.isAvailable) {
                  await availabilityToggle.click();
                  await this.humanDelay(500, 800);
                }
              }
            }

            // Update price
            if (syncType === 'price_update' || syncType === 'full_sync') {
              const priceInput = page.locator('input[data-testid*="price"], input[name*="price"]').first();
              if (await priceInput.isVisible()) {
                await priceInput.fill(''); // Clear first
                await this.humanDelay(200, 400);
                await this.humanType(page, 'input[data-testid*="price"], input[name*="price"]', item.price.toFixed(2));
                await this.humanDelay(500, 800);
              }
            }

            // Save changes
            await page.click('button:has-text("Save"), button:has-text("Done"), button:has-text("Update")');
            await this.humanDelay(1500, 2500);

            result.itemsSynced++;
            logger.info(`✓ Synced: ${item.name}`);
          } else {
            result.itemsFailed++;
            result.errors.push(`Item not found: ${item.name}`);
          }
        } catch (error: any) {
          result.itemsFailed++;
          result.errors.push(`Failed to sync ${item.name}: ${error.message}`);
          logger.error(`Failed to sync item ${item.name}:`, error);
        }
      }

      result.success = result.itemsSynced > 0;
      result.details = {
        platform: 'ubereats',
        syncType,
        totalItems: menuItems.length
      };

    } catch (error: any) {
      logger.error('UberEats sync error:', error);
      result.errors.push(error.message);
      result.details.error = error.stack;
    } finally {
      await context.close();
    }

    return result;
  }

  /**
   * Test platform credentials with stealth mode
   */
  public async testCredentials(
    platform: string,
    username: string,
    password: string,
    portalUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    try {
      let loginUrl = portalUrl;
      if (!loginUrl) {
        loginUrl = platform === 'doordash'
          ? 'https://merchant-portal.doordash.com'
          : 'https://restaurant.uber.com/login';
      }

      logger.info(`Testing credentials for ${platform}...`);
      await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.humanDelay(2000, 3000);

      // Check for captcha
      if (await this.detectCaptcha(page)) {
        return {
          success: false,
          message: 'Captcha detected. Set HEADLESS=false to solve manually.'
        };
      }

      // Try to login with human-like behavior
      const emailSelector = 'input[type="email"], input[name="email"]';
      const passwordSelector = 'input[type="password"], input[name="password"]';

      await page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.humanType(page, emailSelector, username);
      await this.humanDelay(500, 1000);

      if (platform === 'ubereats') {
        await page.click('button:has-text("Next"), button:has-text("Continue")');
        await this.humanDelay(2000, 3000);
      }

      await page.waitForSelector(passwordSelector, { timeout: 10000 });
      await this.humanType(page, passwordSelector, password);
      await this.humanDelay(500, 1000);

      await page.click('button[type="submit"]');
      await this.humanDelay(5000, 7000);

      // Check for captcha after login
      if (await this.detectCaptcha(page)) {
        return {
          success: false,
          message: 'Captcha detected after login. Set HEADLESS=false to solve manually.'
        };
      }

      // Check if login successful
      const url = page.url();
      if (url.includes('login') || url.includes('signin')) {
        return { success: false, message: 'Login failed - invalid credentials or blocked' };
      }

      logger.info(`Credentials verified for ${platform}`);
      return { success: true, message: 'Credentials verified successfully' };
    } catch (error: any) {
      logger.error(`Test failed for ${platform}:`, error);
      return { success: false, message: `Test failed: ${error.message}` };
    } finally {
      await context.close();
    }
  }
}
