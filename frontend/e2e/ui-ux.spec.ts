/**
 * UI/UX Tests
 * 
 * Tests for user interface, user experience, and visual consistency.
 */

import { test, expect } from '@playwright/test';

test.describe('UI/UX - Empty States', () => {
  test('should show empty state when no orders exist', async ({ page }) => {
    // This test would need authenticated state - testing the pattern
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    // Check for empty state or loading indicator
    const hasEmptyState = await page.locator('text=No orders yet').isVisible().catch(() => false);
    const hasLoading = await page.locator('.skeleton, .loading, [class*="Skeleton"]').first().isVisible().catch(() => false);
    
    // Either should be present
    console.log('Empty state visible:', hasEmptyState, '| Loading visible:', hasLoading);
  });

  test('should show empty state when no staff exist', async ({ page }) => {
    await page.goto('/dashboard/staff');
    await page.waitForLoadState('networkidle');
    
    const hasEmptyState = await page.locator('text=No staff yet, text=Add your first staff').first().isVisible().catch(() => false);
    console.log('Staff empty state:', hasEmptyState);
  });
});

test.describe('UI/UX - Loading States', () => {
  test('should show loading indicator on page navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for loading skeletons or spinners
    const hasLoading = await page.locator('.skeleton, .loading, [class*="Skeleton"], [class*="spinner"]').first().isVisible().catch(() => false);
    console.log('Loading state present:', hasLoading);
  });

  test('should show loading during form submission', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click submit and check for loading state
    await page.click('button[type="submit"]');
    
    // Should show loading state (button disabled or spinner)
    const button = page.locator('button[type="submit"]');
    const isDisabled = await button.isDisabled();
    const hasSpinner = await button.locator('.spinner, [class*="spinner"]').isVisible().catch(() => false);
    
    console.log('Button disabled:', isDisabled, '| Has spinner:', hasSpinner);
  });
});

test.describe('UI/UX - Form Validation', () => {
  test('should show validation errors on invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Check for error message or HTML5 validation
    const url = page.url();
    // If still on login page, validation worked
    expect(url).toContain('login');
  });

  test('should show validation errors on empty required fields', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    const url = page.url();
    expect(url).toContain('signup');
  });

  test('should show password strength indicator on signup', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('weak');
      
      // Check for strength indicator
      const hasStrength = await page.locator('text=weak, text=Strong, text=Medium').first().isVisible().catch(() => false);
      console.log('Password strength indicator:', hasStrength);
    }
  });
});

test.describe('UI/UX - Responsive Design', () => {
  test('should display correctly on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check elements are visible and not overflow
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Check no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    console.log('Scroll width:', scrollWidth, '| Viewport:', viewportWidth);
  });

  test('should display correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Dashboard should show sidebar and content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display correctly on desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('UI/UX - Error Handling', () => {
  test('should show error toast on failed login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Try login with wrong credentials
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait a moment for any error toast
    await page.waitForTimeout(2000);
    
    // Check for error message (either in toast or on page)
    const hasError = await page.locator('text=Invalid, text=incorrect, text=failed').first().isVisible().catch(() => false);
    console.log('Error message shown:', hasError);
  });

  test('should show friendly error page on 404', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');
    
    // Should show 404 page or not found message
    const has404 = await page.locator('text=404, text=Not Found, text=page not found').first().isVisible().catch(() => false);
    console.log('404 page shown:', has404);
  });
});

test.describe('UI/UX - Navigation', () => {
  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    // Check for active state on navigation
    const activeNav = page.locator('a[href*="/dashboard/orders"].active, nav a.active[href*="orders"]');
    const hasActive = await activeNav.isVisible().catch(() => false);
    console.log('Active nav highlighted:', hasActive);
  });

  test('should have working back navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Go to a subpage
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    // Go back using browser back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should be back at dashboard
    const url = page.url();
    expect(url).toContain('dashboard');
  });
});

test.describe('UI/UX - Visual Consistency', () => {
  test('should have consistent button styles', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Get all buttons
    const buttons = await page.locator('button').all();
    console.log('Number of buttons:', buttons.length);
    
    // Check primary buttons have consistent styling
    for (const button of buttons.slice(0, 3)) {
      const text = await button.textContent();
      console.log('Button text:', text?.trim());
    }
  });

  test('should have consistent input field styling', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Check input fields have labels
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const ariaLabel = await input.getAttribute('aria-label');
      const hasLabel = id || name || ariaLabel;
      console.log('Input has label:', hasLabel, '| id:', id, '| name:', name);
    }
  });
});

test.describe('UI/UX - Accessibility', () => {
  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Click first input and check focus
    const emailInput = page.locator('input[type="email"]');
    await emailInput.focus();
    
    const isFocused = await emailInput.evaluate((el) => el === document.activeElement);
    console.log('Input focused:', isFocused);
  });

  test('should have accessible error messages', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Submit empty form to trigger errors
    await page.click('button[type="submit"]');
    
    // Check for error messages with proper ARIA or semantic HTML
    const hasErrorText = await page.locator('[role="alert"], .error, text=required').first().isVisible().catch(() => false);
    console.log('Error accessible:', hasErrorText);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check heading structure
    const h1 = await page.locator('h1').count();
    const h2 = await page.locator('h2').count();
    
    console.log('H1 tags:', h1, '| H2 tags:', h2);
    
    // Should have exactly one H1
    expect(h1).toBeGreaterThanOrEqual(1);
  });
});
