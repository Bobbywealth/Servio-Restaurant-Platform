/**
 * Dashboard E2E Tests
 * 
 * Tests for dashboard page:
 * - Dashboard page loading
 * - Real-time order updates
 * - Stats cards display
 * - Quick action buttons
 * - Navigation to sub-pages
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to dashboard
    await authenticatedPage.goto('/dashboard');
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should display dashboard title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/dashboard/i);
  });

  test('should display stats cards', async ({ authenticatedPage }) => {
    // Check for main stats cards
    await expect(authenticatedPage.locator('[data-testid="stat-card-orders"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="stat-card-revenue"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="stat-card-staff"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="stat-card-pending"]')).toBeVisible();
  });

  test('should display orders list', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="recent-orders"]')).toBeVisible();
  });

  test('should display quick action buttons', async ({ authenticatedPage }) => {
    // Check for quick action buttons
    await expect(authenticatedPage.locator('[data-testid="quick-action-new-order"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="quick-action-menu"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="quick-action-staff"]')).toBeVisible();
  });

  test('should navigate to new order page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="quick-action-new-order"]');
    await expect(authenticatedPage).toHaveURL(/\/orders\/new/);
  });

  test('should navigate to menu page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="quick-action-menu"]');
    await expect(authenticatedPage).toHaveURL(/\/menu/);
  });

  test('should navigate to staff page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="quick-action-staff"]');
    await expect(authenticatedPage).toHaveURL(/\/staff/);
  });
});

test.describe('Dashboard Stats', () => {
  test('should display order count', async ({ authenticatedPage }) => {
    const ordersCard = authenticatedPage.locator('[data-testid="stat-card-orders"]');
    await expect(ordersCard.locator('[data-testid="stat-value"]')).not.toBeEmpty();
  });

  test('should display revenue', async ({ authenticatedPage }) => {
    const revenueCard = authenticatedPage.locator('[data-testid="stat-card-revenue"]');
    await expect(revenueCard.locator('[data-testid="stat-value"]')).not.toBeEmpty();
  });

  test('should display staff count', async ({ authenticatedPage }) => {
    const staffCard = authenticatedPage.locator('[data-testid="stat-card-staff"]');
    await expect(staffCard.locator('[data-testid="stat-value"]')).not.toBeEmpty();
  });

  test('should display pending orders count', async ({ authenticatedPage }) => {
    const pendingCard = authenticatedPage.locator('[data-testid="stat-card-pending"]');
    await expect(pendingCard.locator('[data-testid="stat-value"]')).not.toBeEmpty();
  });
});

test.describe('Recent Orders', () => {
  test('should display recent orders table', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="recent-orders-table"]')).toBeVisible();
  });

  test('should show order details on click', async ({ authenticatedPage }) => {
    // Click on first order if exists
    const firstOrder = authenticatedPage.locator('[data-testid="order-row"]').first();
    if (await firstOrder.isVisible()) {
      await firstOrder.click();
      await expect(authenticatedPage.locator('[data-testid="order-detail"]')).toBeVisible();
    }
  });
});

test.describe('Dashboard Navigation', () => {
  test('should navigate to orders page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('text=Orders');
    await expect(authenticatedPage).toHaveURL(/\/orders/);
  });

  test('should navigate to menu page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('text=Menu');
    await expect(authenticatedPage).toHaveURL(/\/menu/);
  });

  test('should navigate to staff page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('text=Staff');
    await expect(authenticatedPage).toHaveURL(/\/staff/);
  });

  test('should navigate to inventory page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('text=Inventory');
    await expect(authenticatedPage).toHaveURL(/\/inventory/);
  });

  test('should navigate to settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('text=Settings');
    await expect(authenticatedPage).toHaveURL(/\/settings/);
  });
});

test.describe('Real-time Updates', () => {
  test('should receive real-time order updates', async ({ authenticatedPage, browser }) => {
    // This test requires WebSocket connection
    // Create a second browser context to simulate order creation
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    // Login as owner
    await page2.goto('/login');
    await page2.fill('input[type="email"]', 'owner@testrestaurant.com');
    await page2.fill('input[type="password"]', 'password123');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/dashboard');
    
    // Create new order in second context
    await page2.goto('/orders/new');
    
    // The first page should receive the order via WebSocket
    // This is a placeholder - actual implementation depends on WebSocket setup
    await expect(authenticatedPage.locator('[data-testid="notification"]')).toBeVisible({ timeout: 10000 });
    
    await context2.close();
  });
});

test.describe('Dashboard Responsiveness', () => {
  test('should display correctly on mobile', async ({ authenticatedPage }) => {
    // Set mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    // Dashboard should still be functional
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(authenticatedPage.locator('h1')).toContainText(/dashboard/i);
  });

  test('should display correctly on tablet', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should display correctly on desktop', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 1920, height: 1080 });
    
    await expect(authenticatedPage.locator('[data-testid="dashboard"]')).toBeVisible();
  });
});
