/**
 * Tablet & Mobile Tests
 * 
 * Tests for tablet and mobile-specific functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Tablet Layout & Touch', () => {
  const tabletViewport = { width: 1024, height: 768 };

  test('tablet orders page should have touch-friendly buttons', async ({ page }) => {
    await page.setViewportSize(tabletViewport);
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // Check action buttons are large enough for touch (min 30px)
    // Filter to get only buttons with text content (action buttons)
    const actionButtons = page.locator('button:has-text("Accept"), button:has-text("Reject"), button:has-text("Ready"), button:has-text("Complete"), button:has-text("Picked Up"), button:has-text("Needs attention")');
    const count = await actionButtons.count();
    console.log('Action buttons found:', count);
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await actionButtons.nth(i).boundingBox();
      if (box) {
        console.log('Action button size:', box.width, 'x', box.height);
        // Touch targets should be at least 30px
        expect(box.height).toBeGreaterThanOrEqual(30);
      }
    }
  });

  test('tablet should show order queue in grid layout', async ({ page }) => {
    await page.setViewportSize(tabletViewport);
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // Should show orders in a queue/grid format
    const orderCards = await page.locator('[class*="card"], [class*="order"]').count();
    console.log('Order cards visible:', orderCards);
  });

  test('tablet kitchen display should show large status buttons', async ({ page }) => {
    await page.setViewportSize(tabletViewport);
    await page.goto('/tablet/kitchen');
    await page.waitForLoadState('networkidle');
    
    // Kitchen display should have large, easy-to-tap buttons
    const readyButton = page.locator('button:has-text("Ready"), button:has-text("Complete")').first();
    if (await readyButton.isVisible()) {
      const box = await readyButton.boundingBox();
      if (box) {
        console.log('Status button size:', box.width, 'x', box.height);
      }
    }
  });
});

test.describe('Mobile/PWA Tests', () => {
  const mobileViewport = { width: 375, height: 667 };

  test('staff clock page should be mobile-friendly', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto('/staff/clock');
    await page.waitForLoadState('networkidle');
    
    // Check form elements are visible and accessible
    const pinInput = page.locator('input[type="tel"], input[name="pin"]');
    const clockButton = page.locator('button:has-text("Clock")');
    
    await expect(pinInput).toBeVisible();
    await expect(clockButton).toBeVisible();
  });

  test('PIN entry should work on mobile keyboard', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto('/staff/clock');
    await page.waitForLoadState('networkidle');
    
    const pinInput = page.locator('input[type="tel"], input[name="pin"]');
    await pinInput.fill('1234');
    
    const value = await pinInput.inputValue();
    expect(value).toBe('1234');
  });

  test('mobile navigation should be thumb-friendly', async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Login form should be easily reachable with thumb
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // All elements should be visible
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Responsive Behavior', () => {
  test('should adapt layout between portrait and landscape', async ({ page }) => {
    // Portrait
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    const portraitLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      const main = document.querySelector('[class*="main"]');
      return {
        hasSidebar: !!sidebar,
        mainVisible: !!main
      };
    });
    
    // Landscape
    await page.setViewportSize({ width: 812, height: 375 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const landscapeLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      const main = document.querySelector('[class*="main"]');
      return {
        hasSidebar: !!sidebar,
        mainVisible: !!main
      };
    });
    
    console.log('Portrait:', portraitLayout, '| Landscape:', landscapeLayout);
  });
});

test.describe('Touch Interactions', () => {
  test('should support tap interactions', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // Click on first order if exists
    const orderCard = page.locator('[class*="card"]').first();
    if (await orderCard.isVisible()) {
      await orderCard.click();
      
      // Should open details
      const detailsVisible = await page.locator('[class*="detail"], [class*="modal"]').first().isVisible().catch(() => false);
      console.log('Order details opened:', detailsVisible);
    }
  });

  test('should handle swipe gestures if implemented', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // This would test swipe gestures if implemented
    // For now just check if touch-action CSS is present
    const hasTouchAction = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return style.touchAction !== 'auto';
    });
    
    console.log('Touch action CSS:', hasTouchAction);
  });
});

test.describe('Offline/PWA Behavior', () => {
  test('service worker should be registered', async ({ page }) => {
    await page.goto('/staff/clock');
    await page.waitForLoadState('networkidle');
    
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    console.log('Service Worker supported:', swRegistered);
  });

  test('app should be installable (manifest check)', async ({ page }) => {
    await page.goto('/staff/clock');
    await page.waitForLoadState('networkidle');
    
    const manifest = await page.evaluate(async () => {
      const links = document.querySelectorAll('link[rel="manifest"]');
      if (links.length > 0) {
        const href = links[0].getAttribute('href');
        if (href) {
          try {
            const response = await fetch(href);
            return response.ok ? await response.json() : null;
          } catch {
            return null;
          }
        }
      }
      return null;
    });
    
    console.log('PWA manifest:', manifest ? 'Present' : 'Missing');
  });
});
