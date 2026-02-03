/**
 * Menu Management E2E Tests
 * 
 * Tests for menu management page:
 * - Menu categories display
 * - Menu items CRUD
 * - Item sizes and modifiers
 * - Menu import functionality
 * - Modifier group assignments
 */

import { test, expect } from '../fixtures/test-fixtures';
import { waitForToast } from '../helpers/test-helpers';

test.describe('Menu List', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/menu');
    await expect(authenticatedPage.locator('[data-testid="menu-page"]')).toBeVisible();
  });

  test('should display menu page title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/menu/i);
  });

  test('should display categories section', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="categories-section"]')).toBeVisible();
  });

  test('should display items section', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="items-section"]')).toBeVisible();
  });

  test('should display add category button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="add-category-button"]')).toBeVisible();
  });

  test('should display add item button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="add-item-button"]')).toBeVisible();
  });
});

test.describe('Categories', () => {
  test('should display categories list', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="category-card"]')).toHaveCountGreaterThan(0);
  });

  test('should create new category', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-category-button"]');
    await expect(authenticatedPage.locator('[data-testid="category-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="name"]', 'New Category');
    await authenticatedPage.fill('input[name="sortOrder"]', '5');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Category created successfully', 'success');
  });

  test('should edit category', async ({ authenticatedPage }) => {
    const category = authenticatedPage.locator('[data-testid="category-card"]').first();
    await category.hover();
    await category.locator('[data-testid="edit-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="category-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="name"]', 'Updated Category');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Category updated successfully', 'success');
  });

  test('should delete category', async ({ authenticatedPage }) => {
    const category = authenticatedPage.locator('[data-testid="category-card"]').first();
    await category.hover();
    await category.locator('[data-testid="delete-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await authenticatedPage.click('button:has-text("Delete")');
    
    await waitForToast(authenticatedPage, 'Category deleted', 'warning');
  });

  test('should reorder categories', async ({ authenticatedPage }) => {
    // Drag and drop categories
    const category1 = authenticatedPage.locator('[data-testid="category-card"]').first();
    const category2 = authenticatedPage.locator('[data-testid="category-card"]').nth(1);
    
    await category1.dragTo(category2);
    
    await waitForToast(authenticatedPage, 'Categories reordered', 'success');
  });
});

test.describe('Menu Items', () => {
  test('should display menu items list', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="menu-item"]')).toHaveCountGreaterThan(0);
  });

  test('should create new menu item', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    await expect(authenticatedPage.locator('[data-testid="item-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="name"]', 'Delicious Burger');
    await authenticatedPage.fill('textarea[name="description"]', 'A tasty burger with all the fixings');
    await authenticatedPage.fill('input[name="price"]', '12.99');
    await authenticatedPage.selectOption('select[name="categoryId"]', { index: 0 });
    await authenticatedPage.check('input[name="available"]');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Menu item created successfully', 'success');
  });

  test('should show error for missing name', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    
    await authenticatedPage.fill('input[name="price"]', '12.99');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/name is required/i);
  });

  test('should show error for invalid price', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    
    await authenticatedPage.fill('input[name="name"]', 'Burger');
    await authenticatedPage.fill('input[name="price"]', '-5.00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/invalid price/i);
  });

  test('should edit menu item', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="menu-item"]').first();
    await item.hover();
    await item.locator('[data-testid="edit-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="item-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="price"]', '14.99');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Menu item updated successfully', 'success');
  });

  test('should toggle item availability', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="menu-item"]').first();
    const toggle = item.locator('[data-testid="availability-toggle"]');
    
    await toggle.click();
    
    await waitForToast(authenticatedPage, 'Item availability updated', 'success');
  });

  test('should delete menu item', async ({ authenticatedPage }) => {
    const item = authenticatedPage.locator('[data-testid="menu-item"]').first();
    await item.hover();
    await item.locator('[data-testid="delete-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await authenticatedPage.click('button:has-text("Delete")');
    
    await waitForToast(authenticatedPage, 'Menu item deleted', 'warning');
  });
});

test.describe('Item Sizes', () => {
  test('should display sizes section', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    await authenticatedPage.click('text=Sizes');
    
    await expect(authenticatedPage.locator('[data-testid="sizes-section"]')).toBeVisible();
  });

  test('should add size to item', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-item-button"]');
    await authenticatedPage.click('text=Sizes');
    await authenticatedPage.click('[data-testid="add-size-button"]');
    
    await authenticatedPage.fill('input[name="name"]', 'Large');
    await authenticatedPage.fill('input[name="multiplier"]', '1.5');
    
    await authenticatedPage.click('button:has-text("Add Size")');
    
    await expect(authenticatedPage.locator('text=Large (1.5x)')).toBeVisible();
  });
});

test.describe('Modifiers', () => {
  test('should display modifiers section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/menu/modifiers');
    
    await expect(authenticatedPage.locator('[data-testid="modifiers-page"]')).toBeVisible();
  });

  test('should create modifier group', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/menu/modifiers');
    await authenticatedPage.click('[data-testid="add-group-button"]');
    
    await authenticatedPage.fill('input[name="name"]', 'Toppings');
    await authenticatedPage.selectOption('select[name="type"]', 'multiple');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Modifier group created', 'success');
  });

  test('should add modifier option', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/menu/modifiers');
    
    const group = authenticatedPage.locator('[data-testid="modifier-group"]').first();
    await group.locator('[data-testid="add-option-button"]').click();
    
    await authenticatedPage.fill('input[name="name"]', 'Extra Cheese');
    await authenticatedPage.fill('input[name="price"]', '1.50');
    
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=Extra Cheese (+$1.50)')).toBeVisible();
  });
});

test.describe('Menu Import', () => {
  test('should display import button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="import-button"]')).toBeVisible();
  });

  test('should open import modal', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="import-button"]');
    
    await expect(authenticatedPage.locator('[data-testid="import-modal"]')).toBeVisible();
  });

  test('should show error for invalid file type', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="import-button"]');
    
    await authenticatedPage.setInputFiles('input[type="file"]', 'test-files/invalid.txt');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/invalid file type/i);
  });

  test('should import menu from CSV', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="import-button"]');
    
    await authenticatedPage.setInputFiles('input[type="file"]', 'test-files/menu.csv');
    await authenticatedPage.click('button:has-text("Import")');
    
    await waitForToast(authenticatedPage, 'Menu imported successfully', 'success');
  });
});

test.describe('Menu Search and Filter', () => {
  test('should search menu items', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('[data-testid="search-input"]', 'burger');
    
    await expect(authenticatedPage.locator('[data-testid="menu-item"]').first()).toContainText(/burger/i);
  });

  test('should filter by category', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="categoryFilter"]', { index: 0 });
    
    await expect(authenticatedPage.locator('[data-testid="menu-item"]').first()).toBeVisible();
  });

  test('should show out of stock items', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="show-unavailable"]');
    
    await expect(authenticatedPage.locator('[data-testid="menu-item"]')).toHaveCountGreaterThan(0);
  });
});
