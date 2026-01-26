import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger';

/**
 * ENHANCED Browser Automation with Anti-Detection
 *
 * This version includes techniques to avoid bot detection:
 * 1. Stealth mode configuration
 * 2. Session persistence
 * 3. Random delays to mimic human behavior
 * 4. Proper user agent and headers
 */

export class EnhancedBrowserAutomationService {
  private browser: Browser | null = null;

  /**
   * Initialize browser with anti-detection measures
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true, // Can set to false for debugging
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',

          // Anti-detection args
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080',
          '--start-maximized'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Create context with realistic browser fingerprint
   */
  private async createStealthContext(): Promise<BrowserContext> {
    const browser = await this.initBrowser();

    const context = await browser.newContext({
      // Realistic viewport
      viewport: { width: 1920, height: 1080 },

      // Realistic user agent (update periodically)
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

      // Browser locale and timezone
      locale: 'en-US',
      timezoneId: 'America/New_York',

      // Enable JavaScript
      javaScriptEnabled: true,

      // Set permissions
      permissions: ['geolocation'],

      // Extra HTTP headers
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
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Override plugins to make it look real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Chrome runtime
      (window as any).chrome = {
        runtime: {}
      };

      // Permissions API
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
   * Type text like a human (with random delays)
   */
  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await this.humanDelay(100, 300);

    for (const char of text) {
      await page.type(selector, char);
      await this.humanDelay(50, 150); // Random delay between keystrokes
    }
  }

  /**
   * Login to DoorDash with stealth mode
   */
  async stealthLoginDoorDash(username: string, password: string): Promise<{ success: boolean; message: string }> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    try {
      logger.info('Starting stealth login to DoorDash...');

      // Navigate
      await page.goto('https://merchant-portal.doordash.com', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.humanDelay(2000, 3000);

      // Check for login page
      const emailSelector = 'input[name="email"], input[type="email"], #email';
      await page.waitForSelector(emailSelector, { timeout: 10000 });

      // Fill email (human-like)
      await this.humanType(page, emailSelector, username);
      await this.humanDelay(500, 1000);

      // Check if there's a "Next" button (two-step login)
      const nextButton = await page.$('button:has-text("Next"), button:has-text("Continue")');
      if (nextButton) {
        await nextButton.click();
        await this.humanDelay(2000, 3000);
      }

      // Fill password
      const passwordSelector = 'input[name="password"], input[type="password"], #password';
      await page.waitForSelector(passwordSelector, { timeout: 10000 });
      await this.humanType(page, passwordSelector, password);
      await this.humanDelay(500, 1000);

      // Click login
      await page.click('button[type="submit"]');

      // Wait for navigation or error
      await this.humanDelay(5000, 7000);

      // Check if we're logged in
      const url = page.url();

      if (url.includes('login') || url.includes('signin')) {
        // Check for captcha
        const captcha = await page.$('[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"]');
        if (captcha) {
          logger.warn('Captcha detected on DoorDash login');
          return {
            success: false,
            message: 'Captcha detected. Cannot proceed in headless mode. Try Option 2 or 3.'
          };
        }

        return {
          success: false,
          message: 'Login failed - invalid credentials or security block'
        };
      }

      logger.info('DoorDash login successful (stealth mode)');
      return { success: true, message: 'Login successful' };

    } catch (error: any) {
      logger.error('Stealth login failed:', error);
      return { success: false, message: `Error: ${error.message}` };
    } finally {
      await context.close();
    }
  }
}
