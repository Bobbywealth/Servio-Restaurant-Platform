/**
 * Enhanced Browser Automation Service with Session Persistence
 *
 * This solves the multi-restaurant problem by:
 * 1. Saving browser sessions (cookies, local storage) per restaurant
 * 2. Reusing sessions instead of logging in every time
 * 3. Reducing suspicious repeated logins from same IP
 * 4. Making syncs faster (skip login step)
 *
 * Usage:
 * 1. First time: User logs in manually (HEADLESS=false)
 * 2. Session saved to: data/sessions/restaurant-{id}-{platform}.json
 * 3. Future syncs: Reuse session automatically
 * 4. Session expires: User logs in again manually
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface SessionInfo {
  restaurantId: string;
  platform: string;
  createdAt: Date;
  lastUsedAt: Date;
  isValid: boolean;
}

export class BrowserAutomationServiceWithSessions {
  private static instance: BrowserAutomationServiceWithSessions;
  private browser: Browser | null = null;
  private sessionsDir: string;

  private constructor() {
    // Sessions directory
    this.sessionsDir = path.join(process.cwd(), 'data', 'sessions');
    this.ensureSessionsDirectory();
  }

  public static getInstance(): BrowserAutomationServiceWithSessions {
    if (!BrowserAutomationServiceWithSessions.instance) {
      BrowserAutomationServiceWithSessions.instance = new BrowserAutomationServiceWithSessions();
    }
    return BrowserAutomationServiceWithSessions.instance;
  }

  /**
   * Ensure sessions directory exists with proper permissions
   */
  private ensureSessionsDirectory(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true, mode: 0o700 });
      logger.info(`Created sessions directory: ${this.sessionsDir}`);
    }
  }

  /**
   * Get session file path for a restaurant and platform
   */
  private getSessionPath(restaurantId: string, platform: string): string {
    return path.join(this.sessionsDir, `restaurant-${restaurantId}-${platform}.json`);
  }

  /**
   * Check if session exists
   */
  public sessionExists(restaurantId: string, platform: string): boolean {
    const sessionPath = this.getSessionPath(restaurantId, platform);
    return fs.existsSync(sessionPath);
  }

  /**
   * Get session info
   */
  public getSessionInfo(restaurantId: string, platform: string): SessionInfo | null {
    if (!this.sessionExists(restaurantId, platform)) {
      return null;
    }

    const sessionPath = this.getSessionPath(restaurantId, platform);
    try {
      const stats = fs.statSync(sessionPath);
      // Read but don't parse - we only need file stats for session info
      fs.readFileSync(sessionPath, 'utf8');

      // Check if session is old (> 30 days)
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      const isValid = ageInDays < 30;

      return {
        restaurantId,
        platform,
        createdAt: new Date(stats.birthtimeMs),
        lastUsedAt: new Date(stats.mtimeMs),
        isValid
      };
    } catch (error) {
      logger.error(`Failed to read session info: ${error}`);
      return null;
    }
  }

  /**
   * Delete session
   */
  public deleteSession(restaurantId: string, platform: string): void {
    const sessionPath = this.getSessionPath(restaurantId, platform);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      logger.info(`Deleted session: ${sessionPath}`);
    }
  }

  /**
   * Save browser session
   */
  private async saveSession(
    context: BrowserContext,
    restaurantId: string,
    platform: string
  ): Promise<void> {
    const sessionPath = this.getSessionPath(restaurantId, platform);

    await context.storageState({ path: sessionPath });

    // Set restrictive permissions
    fs.chmodSync(sessionPath, 0o600);

    logger.info(`Session saved: ${sessionPath}`);
  }

  /**
   * Load browser session
   */
  private async loadSession(
    restaurantId: string,
    platform: string
  ): Promise<BrowserContext | null> {
    if (!this.sessionExists(restaurantId, platform)) {
      return null;
    }

    const sessionInfo = this.getSessionInfo(restaurantId, platform);
    if (!sessionInfo || !sessionInfo.isValid) {
      logger.warn(`Session expired for restaurant ${restaurantId} - ${platform}`);
      this.deleteSession(restaurantId, platform);
      return null;
    }

    try {
      const browser = await this.initBrowser();
      const sessionPath = this.getSessionPath(restaurantId, platform);

      const context = await browser.newContext({
        storageState: sessionPath,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Update last used time
      fs.utimesSync(sessionPath, new Date(), new Date());

      logger.info(`Session loaded: ${sessionPath}`);
      return context;
    } catch (error) {
      logger.error(`Failed to load session: ${error}`);
      this.deleteSession(restaurantId, platform);
      return null;
    }
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      const headlessMode = process.env.HEADLESS !== 'false';

      this.browser = await chromium.launch({
        headless: headlessMode,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--start-maximized'
        ]
      });

      logger.info(`Browser launched in ${headlessMode ? 'headless' : 'headed'} mode`);
    }
    return this.browser;
  }

  /**
   * Initialize session (manual login with UI)
   * User logs in manually, session is saved automatically
   */
  public async initSession(
    restaurantId: string,
    platform: 'doordash' | 'ubereats',
    _username: string,
    _password: string
  ): Promise<{ success: boolean; message: string }> {
    // Force headed mode for manual login
    const originalHeadless = process.env.HEADLESS;
    process.env.HEADLESS = 'false';

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });

      const page = await context.newPage();

      // Navigate to login page
      const loginUrl = platform === 'doordash'
        ? 'https://merchant-portal.doordash.com'
        : 'https://restaurant.uber.com/login';

      logger.info(`Opening ${platform} login page...`);
      logger.info(`Please login manually in the browser window that opens...`);

      await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });

      // Wait for user to login manually (detect URL change away from login)
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const url = page.url();

        // Check if logged in (URL no longer contains 'login' or 'signin')
        if (!url.includes('login') && !url.includes('signin')) {
          logger.info('Login detected! Saving session...');

          // Save the session
          await this.saveSession(context, restaurantId, platform);

          await context.close();

          return {
            success: true,
            message: 'Session initialized successfully. Future syncs will reuse this session.'
          };
        }

        attempts++;
      }

      await context.close();

      return {
        success: false,
        message: 'Login timeout. Please try again and complete login within 2 minutes.'
      };

    } catch (error: any) {
      logger.error(`Session init failed: ${error}`);
      return {
        success: false,
        message: `Failed to initialize session: ${error.message}`
      };
    } finally {
      // Restore original headless setting
      if (originalHeadless) {
        process.env.HEADLESS = originalHeadless;
      }
    }
  }

  /**
   * Sync with session reuse
   */
  public async syncWithSession(
    restaurantId: string,
    platform: 'doordash' | 'ubereats',
    menuItems: Array<any>,
    syncType: string
  ): Promise<any> {
    // Try to load existing session
    let context = await this.loadSession(restaurantId, platform);

    if (!context) {
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: ['No valid session found. Please initialize session first via /init-session endpoint.'],
        details: { needsSessionInit: true }
      };
    }

    try {
      const page = await context.newPage();

      // Navigate to platform (should already be logged in!)
      const portalUrl = platform === 'doordash'
        ? 'https://merchant-portal.doordash.com/menu'
        : 'https://restaurant.uber.com/menu';

      logger.info(`Navigating to ${portalUrl} (using saved session)...`);
      await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Check if still logged in
      const url = page.url();
      if (url.includes('login') || url.includes('signin')) {
        logger.warn('Session expired, user needs to re-login');
        this.deleteSession(restaurantId, platform);

        return {
          success: false,
          itemsSynced: 0,
          itemsFailed: 0,
          errors: ['Session expired. Please re-initialize session via /init-session endpoint.'],
          details: { sessionExpired: true, needsSessionInit: true }
        };
      }

      logger.info(`✓ Session valid! Already logged in to ${platform}`);

      // TODO: Implement actual sync logic here
      // This would be similar to the existing syncDoorDash/syncUberEats methods
      // but without the login step

      const result = {
        success: true,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [],
        details: {
          usedSession: true,
          platform,
          syncType
        }
      };

      await page.close();
      return result;

    } catch (error: any) {
      logger.error(`Sync with session failed: ${error}`);
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [error.message],
        details: { error: error.stack }
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Test if session is still valid
   */
  public async testSession(
    restaurantId: string,
    platform: 'doordash' | 'ubereats'
  ): Promise<{ valid: boolean; message: string }> {
    const context = await this.loadSession(restaurantId, platform);

    if (!context) {
      return {
        valid: false,
        message: 'No session found or session expired'
      };
    }

    try {
      const page = await context.newPage();

      const testUrl = platform === 'doordash'
        ? 'https://merchant-portal.doordash.com'
        : 'https://restaurant.uber.com';

      await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const url = page.url();
      const isValid = !url.includes('login') && !url.includes('signin');

      await page.close();
      await context.close();

      if (!isValid) {
        this.deleteSession(restaurantId, platform);
      }

      return {
        valid: isValid,
        message: isValid
          ? 'Session is valid and active'
          : 'Session expired, please re-initialize'
      };

    } catch (error: any) {
      await context.close();
      return {
        valid: false,
        message: `Test failed: ${error.message}`
      };
    }
  }

  /**
   * List all sessions
   */
  public listSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    if (!fs.existsSync(this.sessionsDir)) {
      return sessions;
    }

    const files = fs.readdirSync(this.sessionsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      // Parse filename: restaurant-{id}-{platform}.json
      const match = file.match(/^restaurant-(.+)-(.+)\.json$/);
      if (!match) continue;

      const [, restaurantId, platform] = match;
      const info = this.getSessionInfo(restaurantId, platform);

      if (info) {
        sessions.push(info);
      }
    }

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): number {
    const sessions = this.listSessions();
    let cleaned = 0;

    for (const session of sessions) {
      if (!session.isValid) {
        this.deleteSession(session.restaurantId, session.platform);
        cleaned++;
      }
    }

    logger.info(`Cleaned up ${cleaned} expired sessions`);
    return cleaned;
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
}
