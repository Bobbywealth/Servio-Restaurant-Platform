/**
 * Authentication E2E Tests
 * 
 * Tests for authentication flows:
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Session persistence
 * - Logout functionality
 * - Restaurant selection
 * - Unauthorized access redirect
 */

import { test, expect } from '../fixtures/test-fixtures';
import { login, logout } from '../helpers/test-helpers';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText(/login/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for empty email', async ({ page }) => {
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toContainText(/email is required/i);
  });

  test('should show error for empty password', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toContainText(/password is required/i);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toContainText(/invalid credentials/i);
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should show restaurant selection after login', async ({ page }) => {
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    // Should show restaurant selection modal or redirect to restaurant-specific dashboard
    await expect(page.locator('[data-testid="restaurant-selector"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Session Persistence', () => {
  test('should persist session after page reload', async ({ page }) => {
    // Login first
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    // Reload the page
    await page.reload();
    
    // Should still be on dashboard, not redirected to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to login on unauthorized access', async ({ page }) => {
    // Try to access protected page without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Logout', () => {
  test('should logout and redirect to login', async ({ page }) => {
    // Login first
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    // Click logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
    
    // Session should be cleared
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('token'));
    expect(authCookie).toBeUndefined();
  });

  test('should show login form after logout', async ({ page }) => {
    await login(page, 'owner@testrestaurant.com', 'password123');
    await logout(page);
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe('Restaurant Selection', () => {
  test('should show all accessible restaurants', async ({ page }) => {
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    // Open restaurant selector
    await page.click('[data-testid="restaurant-selector"]');
    
    // Should show list of restaurants
    await expect(page.locator('[data-testid="restaurant-card"]')).toHaveCountGreaterThan(0);
  });

  test('should switch to different restaurant', async ({ page }) => {
    await login(page, 'owner@testrestaurant.com', 'password123');
    
    // Get current restaurant name
    const currentRestaurant = await page.locator('[data-testid="current-restaurant"]').textContent();
    
    // Open restaurant selector and select different restaurant
    await page.click('[data-testid="restaurant-selector"]');
    await page.locator('[data-testid="restaurant-card"]').nth(1).click();
    
    // Restaurant should change
    await expect(page.locator('[data-testid="current-restaurant"]')).not.toHaveText(currentRestaurant!);
  });
});

test.describe('Password Reset', () => {
  test('should show password reset link', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('a:has-text("Forgot password")')).toBeVisible();
  });

  test('should navigate to password reset page', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('a:has-text("Forgot password")');
    
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('h1')).toContainText(/reset password/i);
  });
});
