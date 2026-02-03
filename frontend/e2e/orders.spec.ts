/**
 * Orders E2E Tests
 * 
 * Tests for orders page:
 * - Orders list page loading
 * - Order status filters
 * - New order creation
 * - Order detail view
 * - Order status updates
 * - Real-time order notifications
 */

import { test, expect } from '../fixtures/test-fixtures';
import { fillForm, submitForm, waitForApiResponse, waitForToast } from '../helpers/test-helpers';

test.describe('Orders List', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders');
    await expect(authenticatedPage.locator('[data-testid="orders-page"]')).toBeVisible();
  });

  test('should display orders page title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/orders/i);
  });

  test('should display orders table', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
  });

  test('should display create order button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="create-order-button"]')).toBeVisible();
  });

  test('should navigate to new order page', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="create-order-button"]');
    await expect(authenticatedPage).toHaveURL(/\/orders\/new/);
  });
});

test.describe('Order Status Filters', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders');
  });

  test('should filter by pending status', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-pending"]');
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
    // All displayed orders should be pending
    const statusBadges = authenticatedPage.locator('[data-testid="order-status"]');
    await expect(statusBadges.first()).toContainText(/pending/i);
  });

  test('should filter by preparing status', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-preparing"]');
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
  });

  test('should filter by ready status', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-ready"]');
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
  });

  test('should filter by completed status', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-completed"]');
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
  });

  test('should show all orders when no filter selected', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-all"]');
    await expect(authenticatedPage.locator('[data-testid="orders-table"]')).toBeVisible();
  });
});

test.describe('New Order Creation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/new');
    await expect(authenticatedPage.locator('[data-testid="new-order-form"]')).toBeVisible();
  });

  test('should display new order form', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/new order/i);
  });

  test('should show error for missing customer name', async ({ authenticatedPage }) => {
    // Fill only phone, leave name empty
    await authenticatedPage.fill('input[name="customerPhone"]', '+1234567890');
    await submitForm(authenticatedPage);
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/customer name is required/i);
  });

  test('should show error for missing customer phone', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="customerName"]', 'John Doe');
    await submitForm(authenticatedPage);
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/customer phone is required/i);
  });

  test('should show error for empty items', async ({ authenticatedPage }) => {
    await fillForm(authenticatedPage, {
      'input[name="customerName"]': 'John Doe',
      'input[name="customerPhone"]': '+1234567890',
    });
    await submitForm(authenticatedPage);
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/at least one item is required/i);
  });

  test('should create order successfully', async ({ authenticatedPage }) => {
    // Fill customer info
    await fillForm(authenticatedPage, {
      'input[name="customerName"]': 'John Doe',
      'input[name="customerPhone"]': '+1234567890',
    });
    
    // Add menu item
    await authenticatedPage.click('[data-testid="add-item-button"]');
    await authenticatedPage.selectOption('[data-testid="menu-item-select"]', 'burger');
    await authenticatedPage.fill('[data-testid="quantity-input"]', '2');
    await authenticatedPage.click('[data-testid="add-to-order-button"]');
    
    // Submit form
    await submitForm(authenticatedPage);
    
    // Should redirect to orders page with success message
    await expect(authenticatedPage).toHaveURL(/\/orders/);
    await waitForToast(authenticatedPage, 'Order created successfully', 'success');
  });
});

test.describe('Order Details', () => {
  test('should display order details', async ({ authenticatedPage }) => {
    // Navigate to existing order
    await authenticatedPage.goto('/orders/order-123');
    
    await expect(authenticatedPage.locator('[data-testid="order-detail"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="order-customer"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="order-items"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="order-total"]')).toBeVisible();
  });

  test('should display order status', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await expect(authenticatedPage.locator('[data-testid="order-status"]')).toBeVisible();
  });

  test('should display order notes', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await expect(authenticatedPage.locator('[data-testid="order-notes"]')).toBeVisible();
  });
});

test.describe('Order Status Updates', () => {
  test('should update order status to preparing', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await authenticatedPage.click('[data-testid="status-preparing-button"]');
    await expect(authenticatedPage.locator('[data-testid="order-status"]')).toContainText(/preparing/i);
    await waitForToast(authenticatedPage, 'Order status updated', 'success');
  });

  test('should update order status to ready', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await authenticatedPage.click('[data-testid="status-ready-button"]');
    await expect(authenticatedPage.locator('[data-testid="order-status"]')).toContainText(/ready/i);
    await waitForToast(authenticatedPage, 'Order status updated', 'success');
  });

  test('should update order status to completed', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await authenticatedPage.click('[data-testid="status-complete-button"]');
    await expect(authenticatedPage.locator('[data-testid="order-status"]')).toContainText(/completed/i);
    await waitForToast(authenticatedPage, 'Order completed', 'success');
  });

  test('should cancel order', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await authenticatedPage.click('[data-testid="cancel-order-button"]');
    await authenticatedPage.click('[data-testid="confirm-cancel-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="order-status"]')).toContainText(/cancelled/i);
    await waitForToast(authenticatedPage, 'Order cancelled', 'warning');
  });
});

test.describe('Order Search', () => {
  test('should search orders by customer name', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders');
    
    await authenticatedPage.fill('[data-testid="search-input"]', 'John');
    await expect(authenticatedPage.locator('[data-testid="order-row"]').first()).toContainText(/john/i);
  });

  test('should search orders by phone', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders');
    
    await authenticatedPage.fill('[data-testid="search-input"]', '1234567890');
    await expect(authenticatedPage.locator('[data-testid="order-row"]').first()).toContainText(/1234567890/i);
  });

  test('should show no results for non-existent order', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders');
    
    await authenticatedPage.fill('[data-testid="search-input"]', 'nonexistent');
    await expect(authenticatedPage.locator('[data-testid="no-orders-message"]')).toBeVisible();
  });
});

test.describe('Order Actions', () => {
  test('should print order', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    // Mock print dialog
    const printPromise = authenticatedPage.waitForEvent('popup');
    await authenticatedPage.click('[data-testid="print-button"]');
    await printPromise;
  });

  test('should duplicate order', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/orders/order-123');
    
    await authenticatedPage.click('[data-testid="duplicate-button"]');
    await expect(authenticatedPage).toHaveURL(/\/orders\/new/);
  });
});
