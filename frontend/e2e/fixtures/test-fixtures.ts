/**
 * E2E Test Fixtures
 * 
 * Playwright fixtures for E2E tests:
 * - Authenticated page
 * - Multiple restaurant contexts
 * - Order creation flow
 * - Staff clock-in flow
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { login, selectRestaurant } from './test-helpers';

/**
 * Custom test fixtures
 */
export const test = base.extend<{
  // Authenticated page with default user
  authenticatedPage: Page;
  
  // Page with owner role
  ownerPage: Page;
  
  // Page with manager role
  managerPage: Page;
  
  // Page with staff role
  staffPage: Page;
  
  // Restaurant context for multi-restaurant testing
  restaurantContext: {
    restaurantId: string;
    restaurantName: string;
  };
  
  // Order creation context
  orderContext: {
    customerName: string;
    customerPhone: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  };
  
  // Staff clock-in context
  clockInContext: {
    staffId: string;
    pin: string;
    expectedStatus: 'clocked-in' | 'clocked-out';
  };
}>({
  /**
   * Authenticated page with default owner credentials
   */
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Login as owner
    await login(page, 'owner@testrestaurant.com', 'password123');
    await selectRestaurant(page);
    
    await use(page);
    
    await context.close();
  },
  
  /**
   * Page authenticated as restaurant owner
   */
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await login(page, 'owner@testrestaurant.com', 'password123');
    await selectRestaurant(page);
    
    await use(page);
    
    await context.close();
  },
  
  /**
   * Page authenticated as manager
   */
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await login(page, 'manager@testrestaurant.com', 'password123');
    await selectRestaurant(page);
    
    await use(page);
    
    await context.close();
  },
  
  /**
   * Page authenticated as staff
   */
  staffPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await login(page, 'staff@testrestaurant.com', 'password123');
    await selectRestaurant(page);
    
    await use(page);
    
    await context.close();
  },
  
  /**
   * Restaurant context for testing
   */
  restaurantContext: async ({}, use) => {
    const context = {
      restaurantId: 'test-restaurant-123',
      restaurantName: 'Test Restaurant',
    };
    
    await use(context);
  },
  
  /**
   * Order context for testing order creation
   */
  orderContext: async ({}, use) => {
    const context = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      items: [
        { name: 'Burger', quantity: 2, price: 9.99 },
        { name: 'Fries', quantity: 1, price: 4.99 },
        { name: 'Soda', quantity: 2, price: 2.99 },
      ],
    };
    
    await use(context);
  },
  
  /**
   * Clock-in context for testing staff clock-in
   */
  clockInContext: async ({}, use) => {
    const context = {
      staffId: 'staff-123',
      pin: '1234',
      expectedStatus: 'clocked-in' as const,
    };
    
    await use(context);
  },
});

/**
 * API fixtures for making backend requests
 */
export const api = {
  /**
   * Make authenticated API request
   */
  async request(
    page: Page,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ) {
    const response = await page.request.fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return {
      status: response.status(),
      data: await response.json(),
    };
  },
  
  /**
   * Get orders list
   */
  async getOrders(page: Page, restaurantId: string) {
    return api.request(page, 'GET', `/api/orders?restaurantId=${restaurantId}`);
  },
  
  /**
   * Create new order
   */
  async createOrder(
    page: Page,
    orderData: {
      customerName: string;
      customerPhone: string;
      items: Array<{ menuItemId: string; quantity: number; price: number }>;
      restaurantId: string;
    }
  ) {
    return api.request(page, 'POST', '/api/orders', orderData);
  },
  
  /**
   * Update order status
   */
  async updateOrderStatus(
    page: Page,
    orderId: string,
    status: string
  ) {
    return api.request(page, 'PATCH', `/api/orders/${orderId}/status`, { status });
  },
  
  /**
   * Get menu items
   */
  async getMenu(page: Page, restaurantId: string) {
    return api.request(page, 'GET', `/api/menu?restaurantId=${restaurantId}`);
  },
  
  /**
   * Get staff list
   */
  async getStaff(page: Page, restaurantId: string) {
    return api.request(page, 'GET', `/api/staff?restaurantId=${restaurantId}`);
  },
  
  /**
   * Clock in staff
   */
  async clockIn(
    page: Page,
    data: { staffId: string; pin: string; restaurantId: string }
  ) {
    return api.request(page, 'POST', '/api/staff/clock/in', data);
  },
  
  /**
   * Clock out staff
   */
  async clockOut(
    page: Page,
    data: { staffId: string; pin: string; restaurantId: string }
  ) {
    return api.request(page, 'POST', '/api/staff/clock/out', data);
  },
};
