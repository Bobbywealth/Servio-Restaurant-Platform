/**
 * Inventory E2E Tests
 * 
 * Tests for inventory management page:
 * - Inventory list display
 * - Stock adjustments
 * - Low stock alerts
 * - Receipt image analysis
 * - Inventory search and filters
 */

import { test, expect } from '../fixtures/test-fixtures';
import { waitForToast } from '../helpers/test-helpers';

test.describe('Inventory List', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inventory');
    await expect(authenticatedPage.locator('[data-testid="inventory-page"]')).toBeVisible();
  });

  test('should display inventory page title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/inventory/i);
  });

  test('should display inventory table', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="inventory-table"]')).toBeVisible();
  });

  test('should display add item button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="add-item-button"]')).toBeVisible();
  });

  test('should display low stock count', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="low-stock-count"]')).toBeVisible();
  });

  test('should display inventory value', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="inventory-value"]')).toBeVisible();
  });
});

test.describe('Add Inventory Item', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    await expect(authenticatedPage.locator('[data-testid="item-modal"]')).toBeVisible();
  });

  test('should show error for missing name', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="currentStock"]', '100');
    await authenticatedPage.fill('input[name="unit"]', 'units');
    await authenticatedPage.fill('input[name="reorderLevel"]', '20');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/name is required/i);
  });

  test('should create inventory item', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'Tomatoes');
    await authenticatedPage.fill('input[name="currentStock"]', '100');
    await authenticatedPage.fill('input[name="unit"]', 'lbs');
    await authenticatedPage.fill('input[name="reorderLevel"]', '20');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Inventory item created', 'success');
  });

  test('should create item with supplier', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'Fresh Produce');
    await authenticatedPage.fill('input[name="currentStock"]', '50');
    await authenticatedPage.fill('input[name="unit"]', 'cases');
    await authenticatedPage.fill('input[name="reorderLevel"]', '10');
    await authenticatedPage.fill('input[name="supplier"]', 'Local Farms Inc.');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Inventory item created', 'success');
  });
});

test.describe('Edit Inventory Item', () => {
  test('should open edit modal', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="edit-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="item-modal"]')).toBeVisible();
  });

  test('should update item name', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="edit-button"]').click();
    
    await authenticatedPage.fill('input[name="name"]', 'Updated Item Name');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Inventory item updated', 'success');
  });

  test('should update reorder level', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="edit-button"]').click();
    
    await authenticatedPage.fill('input[name="reorderLevel"]', '30');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Inventory item updated', 'success');
  });
});

test.describe('Stock Adjustments', () => {
  test('should open adjust modal', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="adjust-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="adjust-modal"]')).toBeVisible();
  });

  test('should add stock', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]:has-text("Tomatoes")').first();
    if (await item.isVisible()) {
      await item.hover();
      await item.locator('[data-testid="adjust-button"]').click();
      
      await authenticatedPage.fill('input[name="adjustment"]', '50');
      await authenticatedPage.selectOption('select[name="reason"]', 'received');
      await authenticatedPage.fill('textarea[name="notes"]', 'Weekly delivery');
      
      await authenticatedPage.click('button:has-text("Adjust")');
      
      await waitForToast(authenticatedPage, 'Stock adjusted successfully', 'success');
    }
  });

  test('should remove stock', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="adjust-button"]').click();
    
    await authenticatedPage.fill('input[name="adjustment"]', '-10');
    await authenticatedPage.selectOption('select[name="reason"]', 'spoilage');
    
    await authenticatedPage.click('button:has-text("Adjust")');
    
    await waitForToast(authenticatedPage, 'Stock adjusted successfully', 'success');
  });

  test('should show error for adjustment exceeding stock', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.hover();
    await item.locator('[data-testid="adjust-button"]').click();
    
    await authenticatedPage.fill('input[name="adjustment"]', '-1000');
    await authenticatedPage.selectOption('select[name="reason"]', 'other');
    
    await authenticatedPage.click('button:has-text("Adjust")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/cannot reduce stock below zero/i);
  });

  test('should display adjustment history', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="inventory-row"]').first();
    await item.locator('[data-testid="history-link"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="adjustment-history"]')).toBeVisible();
  });
});

test.describe('Low Stock Alerts', () => {
  test('should highlight low stock items', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="low-stock-badge"]').first()).toBeVisible();
  });

  test('should filter low stock items', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="filter-low-stock"]');
    
    await expect(authenticatedPage.locator('[data-testid="inventory-row"]').first()).toHaveClass(/low-stock/);
  });

  test('should show low stock count', async ({ authenticatedPage }) => {
    const count = await authenticatedPage.locator('[data-testid="low-stock-count"]').textContent();
    expect(parseInt(count!)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Receipt Analysis', () => {
  test('should display analyze button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="analyze-receipt-button"]')).toBeVisible();
  });

  test('should open analyze modal', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="analyze-receipt-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="analyze-modal"]')).toBeVisible();
  });

  test('should show error for invalid file type', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="analyze-receipt-button"]');
    
    await authenticatedPage.setInputFiles('input[type="file"]', 'test-files/document.pdf');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/invalid file type/i);
  });

  test('should analyze receipt image', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="analyze-receipt-button"]');
    
    await authenticatedPage.setInputFiles('input[type="file"]', 'test-files/receipt.jpg');
    await authenticatedPage.click('button:has-text("Analyze")');
    
    // Wait for analysis to complete
    await expect(authenticatedPage.locator('[data-testid="analysis-progress"]')).toBeVisible({ timeout: 5000 });
    await waitForToast(authenticatedPage, 'Receipt analyzed successfully', 'success');
  });

  test('should add analyzed items to inventory', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="analyze-receipt-button"]');
    await authenticatedPage.setInputFiles('input[type="file"]', 'test-files/receipt.jpg');
    await authenticatedPage.click('button:has-text("Analyze")');
    
    // Wait for analysis
    await waitForToast(authenticatedPage, 'Receipt analyzed successfully', 'success');
    
    // Select items to add
    await authenticatedPage.check('[data-testid="select-item"]:has-text("Tomatoes")');
    await authenticatedPage.check('[data-testid="select-item"]:has-text("Onions")');
    
    await authenticatedPage.click('button:has-text("Add to Inventory")');
    
    await waitForToast(authenticatedPage, 'Items added to inventory', 'success');
  });
});

test.describe('Inventory Search and Filter', () => {
  test('should search inventory items', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('[data-testid="search-input"]', 'Tomatoes');
    
    await expect(authenticatedPage.locator('[data-testid="inventory-row"]').first()).toContainText(/tomatoes/i);
  });

  test('should filter by category', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="categoryFilter"]', 'produce');
    
    await expect(authenticatedPage.locator('[data-testid="inventory-row"]').first()).toBeVisible();
  });

  test('should show empty state for no results', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('[data-testid="search-input"]', 'nonexistent item xyz');
    
    await expect(authenticatedPage.locator('[data-testid="no-items-message"]')).toBeVisible();
  });
});

test.describe('Inventory Export', () => {
  test('should display export button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="export-button"]')).toBeVisible();
  });

  test('should export inventory as CSV', async ({ authenticatedPage }) => {
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="export-button"]');
    await downloadPromise;
    
    await waitForToast(authenticatedPage, 'Inventory exported', 'success');
  });
});
