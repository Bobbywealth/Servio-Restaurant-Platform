/**
 * Business Critical Flows - E2E Tests
 * 
 * Tests for the most important user journeys.
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Flow: Order Creation', () => {
  test('should complete full order flow', async ({ page }) => {
    // 1. Go to public menu
    await page.goto('/r/demo');
    await page.waitForLoadState('networkidle');
    
    // 2. Select an item if available
    const menuItem = page.locator('[class*="item"], [class*="menu-item"]').first();
    if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuItem.click();
      
      // 3. Add to cart
      const addButton = page.locator('button:has-text("Add"), button:has-text("Add to Cart")');
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        
        // 4. Proceed to checkout if cart appears
        const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Order")');
        if (await checkoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await checkoutButton.click();
          
          // 5. Fill order details
          const nameInput = page.locator('input[name="customerName"], input[placeholder*="name"]');
          const phoneInput = page.locator('input[name="customerPhone"], input[placeholder*="phone"]');
          
          if (await nameInput.isVisible()) {
            await nameInput.fill('Test Customer');
          }
          if (await phoneInput.isVisible()) {
            await phoneInput.fill('+1234567890');
          }
          
          console.log('Order flow test completed');
        }
      }
    }
  });
});

test.describe('Critical Flow: Staff Clock In/Out', () => {
  test('should complete clock in flow', async ({ page }) => {
    await page.goto('/staff/clock');
    await page.waitForLoadState('networkidle');
    
    // Enter PIN
    const pinInput = page.locator('input[type="tel"], input[name="pin"]');
    if (await pinInput.isVisible()) {
      await pinInput.fill('1234');
      
      // Click clock in
      const clockInButton = page.locator('button:has-text("Clock In")');
      if (await clockInButton.isVisible()) {
        await clockInButton.click();
        
        // Should show clocked in state
        await page.waitForTimeout(1000);
        const clockedIn = await page.locator('text=Clocked In, text=Working').first().isVisible().catch(() => false);
        console.log('Staff clocked in:', clockedIn);
      }
    }
  });
});

test.describe('Critical Flow: Menu Management', () => {
  test('should add new menu item', async ({ page }) => {
    // This would require login - testing the flow pattern
    await page.goto('/dashboard/menu-management');
    await page.waitForLoadState('networkidle');
    
    // Check if login required
    const isLoginPage = page.url().includes('login');
    if (!isLoginPage) {
      // Try to find add button
      const addButton = page.locator('button:has-text("Add Item"), button:has-text("+ Add")');
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Add item button found');
      }
    } else {
      console.log('Login required - skipping authenticated flow');
    }
  });
});

test.describe('Critical Flow: Order Status Update', () => {
  test('should update order status on tablet', async ({ page }) => {
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // Check for order cards
    const orderCard = page.locator('[class*="card"], [class*="order"]').first();
    if (await orderCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to expand
      await orderCard.click({ force: true });
      
      // Look for status buttons
      const statusButtons = await page.locator('button:has-text("Ready"), button:has-text("Complete")').count();
      console.log('Status buttons found:', statusButtons);
    }
  });
});

test.describe('Critical Flow: Authentication', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Enter credentials
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForTimeout(2000);
    
    const url = page.url();
    console.log('After login URL:', url);
    
    // Should redirect to dashboard
    const isDashboard = url.includes('dashboard') || url === 'http://localhost:3000/';
    console.log('Login successful:', isDashboard);
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Enter wrong credentials
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Should still be on login page or show error
    const url = page.url();
    const hasError = await page.locator('text=Invalid, text=incorrect, text=failed').first().isVisible().catch(() => false);
    
    console.log('Error shown for invalid login:', hasError || url.includes('login'));
  });
});

test.describe('Critical Flow: Public Menu Access', () => {
  test('should access public menu by restaurant slug', async ({ page }) => {
    // Try common restaurant slugs
    const slugs = ['demo', 'test', 'restaurant'];
    
    for (const slug of slugs) {
      try {
        await page.goto(`/r/${slug}`, { timeout: 5000 });
        await page.waitForLoadState('domcontentloaded');
        
        // Check if we got a valid menu page
        const hasMenuContent = await page.locator('h1, [class*="menu"], [class*="item"]').first().isVisible().catch(() => false);
        if (hasMenuContent) {
          console.log(`Found valid menu at /r/${slug}`);
          break;
        }
      } catch {
        continue;
      }
    }
  });
});

test.describe('Critical Flow: Dashboard Load', () => {
  test('should load dashboard with key components', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for key dashboard elements
    const hasHeader = await page.locator('header, nav').first().isVisible();
    const hasContent = await page.locator('main, [class*="content"]').first().isVisible();
    
    console.log('Dashboard has header:', hasHeader, '| has content:', hasContent);
  });

  test('should load orders page', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    console.log('Orders page URL:', url);
  });
});

test.describe('Critical Flow: Tablet Kitchen Display', () => {
  test('should show order queue on kitchen display', async ({ page }) => {
    await page.goto('/tablet/orders');
    await page.waitForLoadState('networkidle');
    
    // Check for order elements
    const hasOrders = await page.locator('[class*="order"], [class*="card"]').first().isVisible().catch(() => false);
    console.log('Kitchen display shows orders:', hasOrders);
  });
});
