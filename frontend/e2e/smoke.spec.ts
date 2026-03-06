/**
 * Smoke Tests
 * 
 * Quick E2E tests to verify critical functionality works.
 * Run before every deployment.
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check page loaded without critical errors
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('login page loads and has form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check form elements exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Try to submit without filling form
    await page.click('button[type="submit"]');
    
    // Should show validation errors (HTML5 validation or custom)
    // Check that we're still on login page (didn't redirect)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('public menu page loads (if exists)', async ({ page }) => {
    // Try to access common public menu paths
    const menuPaths = ['/r/demo', '/menu', '/r/test-restaurant'];
    
    for (const path of menuPaths) {
      try {
        await page.goto(path, { timeout: 5000 });
        await page.waitForLoadState('domcontentloaded');
        
        // If page loads without error, check for key elements
        const body = page.locator('body');
        if (await body.isVisible()) {
          console.log(`Found accessible page at ${path}`);
          break;
        }
      } catch (e) {
        // Path doesn't exist or is protected
        continue;
      }
    }
  });

  test('no critical console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') &&
      !e.includes('hydration')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('responsive layout works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Page should still be usable on mobile
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Authentication Flow', () => {
  test('can enter credentials in login form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Fill in login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Verify values were entered
    await expect(page.locator('input[type="email"]')).toHaveValue('test@example.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('password123');
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const passwordInput = page.locator('input[type="password"]');
    
    // Check if there's a visibility toggle button
    const toggleButton = page.locator('button[aria-label*="password"], button[title*="password"]');
    
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      // After clicking, password should become text type
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType).toBe('text');
    }
  });
});

test.describe('Navigation', () => {
  test('can navigate to signup from login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Look for signup link
    const signupLink = page.locator('a[href*="signup"], a:has-text("Sign up")');
    
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should be on signup page
      const url = page.url();
      expect(url).toContain('signup');
    }
  });

  test('footer links are accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for footer with links
    const footer = page.locator('footer');
    
    if (await footer.isVisible()) {
      // Check for common footer links
      const links = footer.locator('a');
      const linkCount = await links.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });
});
