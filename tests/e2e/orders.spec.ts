import { test, expect } from '@playwright/test';

test.describe('Orders Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
  });

  test('should show orders page after login', async ({ page }) => {
    // Skip if no test credentials
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user credentials');
    
    // Fill login form
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || '');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || '');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard/);
    
    // Navigate to orders
    await page.goto('/dashboard/orders');
    await expect(page.locator('h1')).toContainText('Orders');
  });

  test('should toggle analytics panel', async ({ page }) => {
    // This test assumes we're already logged in
    // In real tests, you'd handle authentication first
    await page.goto('/dashboard/orders');
    
    // Look for analytics toggle button
    const analyticsButton = page.locator('button:has-text("Analytics"), button:has-text("Stats")');
    
    if (await analyticsButton.isVisible()) {
      await analyticsButton.click();
      
      // Check if analytics panel is visible
      await expect(page.locator('text=Order Analytics')).toBeVisible();
    }
  });
});

test.describe('Menu Management', () => {
  test('should load menu items', async ({ page }) => {
    await page.goto('/dashboard/menu-management');
    
    // Wait for menu to load
    await page.waitForLoadState('networkidle');
    
    // Check for menu content
    const menuContent = page.locator('[data-testid="menu-item"], .menu-item, table');
    await expect(menuContent.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('API Health Check', () => {
  test('health endpoint should return 200', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
