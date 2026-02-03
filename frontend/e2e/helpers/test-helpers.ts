/**
 * E2E Test Helpers
 * 
 * Utility functions for E2E tests:
 * - Authentication helpers (login/logout)
 * - Restaurant selection helpers
 * - Navigation helpers
 * - Form filling helpers
 * - Assertion helpers
 */

import { test as baseTest, expect } from '@playwright/test';

/**
 * Custom test fixtures for the application
 */
export const test = baseTest.extend<{
  authenticatedPage: any;
  restaurantPage: any;
}>({
  /**
   * Fixture that provides an authenticated page
   */
  authenticatedPage: async ({ page }, use) => {
    // Login before each test that uses this fixture
    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@testrestaurant.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    await use(page);
    
    // Cleanup - logout after test
    await page.goto('/logout');
  },

  /**
   * Fixture that provides a page with restaurant selected
   */
  restaurantPage: async ({ page }, use) => {
    // Navigate to dashboard and ensure restaurant is selected
    await page.goto('/dashboard');
    
    // If restaurant selection modal appears, select a restaurant
    const restaurantCard = page.locator('[data-testid="restaurant-card"]').first();
    if (await restaurantCard.isVisible({ timeout: 3000 })) {
      await restaurantCard.click();
    }
    
    await use(page);
  },
});

/**
 * Helper to login with credentials
 */
export async function login(
  page: any,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

/**
 * Helper to logout
 */
export async function logout(page: any): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL('/login');
}

/**
 * Helper to select a restaurant
 */
export async function selectRestaurant(
  page: any,
  restaurantName?: string
): Promise<void> {
  await page.goto('/dashboard');
  
  if (restaurantName) {
    await page.click(`text=${restaurantName}`);
  } else {
    // Select first available restaurant
    await page.locator('[data-testid="restaurant-card"]').first().click();
  }
  
  // Wait for dashboard to load
  await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
}

/**
 * Helper to navigate to a page
 */
export async function navigateTo(
  page: any,
  path: string,
  expectedTitle?: string
): Promise<void> {
  await page.goto(path);
  
  if (expectedTitle) {
    await expect(page.locator('h1')).toHaveText(expectedTitle);
  }
}

/**
 * Helper to fill a form with data
 */
export async function fillForm(
  page: any,
  data: Record<string, string | number | boolean>
): Promise<void> {
  for (const [selector, value] of Object.entries(data)) {
    const field = page.locator(selector);
    
    if (typeof value === 'boolean') {
      if (value) {
        await field.check();
      } else {
        await field.uncheck();
      }
    } else if (typeof value === 'string' && value.includes('/')) {
      // Handle file uploads
      await field.setInputFiles(value);
    } else {
      await field.fill(String(value));
    }
  }
}

/**
 * Helper to submit a form
 */
export async function submitForm(
  page: any,
  submitButtonSelector: string = 'button[type="submit"]'
): Promise<void> {
  await page.click(submitButtonSelector);
}

/**
 * Helper to wait for API response
 */
export async function waitForApiResponse(
  page: any,
  urlPattern: string,
  statusCode: number = 200
): Promise<void> {
  const response = await page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() === statusCode
  );
  expect(response.ok()).toBeTruthy();
}

/**
 * Helper to wait for toast notification
 */
export async function waitForToast(
  page: any,
  message: string,
  type: 'success' | 'error' | 'warning' = 'success'
): Promise<void> {
  const toast = page.locator(`.toast-${type}`, { hasText: message });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to assert element exists
 */
export function expectElementToBeVisible(
  page: any,
  selector: string
): void {
  expect(page.locator(selector)).toBeVisible();
}

/**
 * Helper to assert element has text
 */
export function expectElementToHaveText(
  page: any,
  selector: string,
  text: string | RegExp
): void {
  expect(page.locator(selector)).toHaveText(text);
}

/**
 * Helper to assert element contains text
 */
export function expectElementToContainText(
  page: any,
  selector: string,
  text: string
): void {
  expect(page.locator(selector)).toContainText(text);
}

/**
 * Helper to wait for loading to complete
 */
export async function waitForLoading(
  page: any,
  loadingSelector: string = '[data-testid="loading"]'
): Promise<void> {
  await expect(page.locator(loadingSelector)).not.toBeVisible({ timeout: 10000 });
}

/**
 * Helper to wait for empty state
 */
export async function waitForEmptyState(
  page: any,
  emptySelector: string = '[data-testid="empty-state"]'
): Promise<void> {
  await expect(page.locator(emptySelector)).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to delete an item from a list
 */
export async function deleteItem(
  page: any,
  itemName: string,
  confirmDelete: boolean = true
): Promise<void> {
  // Find the item in the list
  const itemRow = page.locator('tr', { hasText: itemName });
  await expect(itemRow).toBeVisible();
  
  // Click delete button
  await itemRow.locator('[data-testid="delete-button"]').click();
  
  if (confirmDelete) {
    // Confirm deletion in modal
    await page.locator('button:has-text("Delete")').click();
  }
}

/**
 * Helper to edit an item
 */
export async function editItem(
  page: any,
  itemName: string
): Promise<void> {
  // Find the item in the list
  const itemRow = page.locator('tr', { hasText: itemName });
  await expect(itemRow).toBeVisible();
  
  // Click edit button
  await itemRow.locator('[data-testid="edit-button"]').click();
  
  // Wait for edit form
  await expect(page.locator('[data-testid="edit-form"]')).toBeVisible();
}

/**
 * Helper to filter list items
 */
export async function filterItems(
  page: any,
  filterValue: string
): Promise<void> {
  await page.fill('[data-testid="filter-input"]', filterValue);
  await page.waitForTimeout(500); // Wait for filtering
}

/**
 * Helper to sort list items
 */
export async function sortItems(
  page: any,
  column: string,
  direction: 'asc' | 'desc' = 'asc'
): Promise<void> {
  await page.click(`[data-testid="sort-${column}"]`);
  
  if (direction === 'desc') {
    await page.click(`[data-testid="sort-${column}"]`);
  }
}

/**
 * Helper to search for items
 */
export async function searchItems(
  page: any,
  searchTerm: string
): Promise<void> {
  await page.fill('[data-testid="search-input"]', searchTerm);
  await page.waitForTimeout(500); // Wait for search
}

/**
 * Helper to switch tabs
 */
export async function switchTab(
  page: any,
  tabName: string
): Promise<void> {
  await page.click(`[data-testid="tab-${tabName}"]`);
}

/**
 * Helper to open dropdown menu
 */
export async function openDropdown(
  page: any,
  triggerSelector: string
): Promise<void> {
  await page.click(triggerSelector);
  await expect(page.locator('[data-testid="dropdown-menu"]')).toBeVisible();
}

/**
 * Helper to select dropdown option
 */
export async function selectDropdownOption(
  page: any,
  optionText: string
): Promise<void> {
  await page.click(`[data-testid="dropdown-option"]:has-text("${optionText}")`);
}
