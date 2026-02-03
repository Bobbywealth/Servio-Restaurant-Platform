/**
 * Settings E2E Tests
 * 
 * Tests for settings page:
 * - Restaurant settings form
 * - Integration configurations
 * - Notification preferences
 * - Staff schedule settings
 */

import { test, expect } from '../fixtures/test-fixtures';
import { waitForToast } from '../helpers/test-helpers';

test.describe('Settings Navigation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    await expect(authenticatedPage.locator('[data-testid="settings-page"]')).toBeVisible();
  });

  test('should display settings title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/settings/i);
  });

  test('should display settings tabs', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="tab-notifications"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="tab-integrations"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="tab-staff"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="tab-billing"]')).toBeVisible();
  });
});

test.describe('General Settings', () => {
  test('should display restaurant info form', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="restaurant-form"]')).toBeVisible();
  });

  test('should display restaurant name', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('input[name="name"]')).toHaveValue(expect.any(String));
  });

  test('should update restaurant name', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'Updated Restaurant Name');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });

  test('should update restaurant timezone', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="timezone"]', 'America/Los_Angeles');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });

  test('should update currency', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="currency"]', 'EUR');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });

  test('should display restaurant address', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('textarea[name="address"]')).toBeVisible();
  });

  test('should update restaurant address', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('textarea[name="address"]', '123 New Street, City, State 12345');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });
});

test.describe('Business Hours', () => {
  test('should display business hours section', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="business-hours"]')).toBeVisible();
  });

  test('should update opening time', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="openingTime"]', '08:00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });

  test('should update closing time', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="closingTime"]', '22:00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });

  test('should update day-specific hours', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="saturday-settings"]');
    await authenticatedPage.fill('input[name="saturdayOpening"]', '10:00');
    await authenticatedPage.fill('input[name="saturdayClosing"]', '20:00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Settings saved successfully', 'success');
  });
});

test.describe('Notification Settings', () => {
  test('should display notification preferences', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-notifications"]');
    
    await expect(authenticatedPage.locator('[data-testid="notification-preferences"]')).toBeVisible();
  });

  test('should toggle order notifications', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-notifications"]');
    
    const toggle = authenticatedPage.locator('input[name="orderNotifications"]');
    await toggle.setChecked(true);
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Notification preferences saved', 'success');
  });

  test('should toggle low stock notifications', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-notifications"]');
    
    const toggle = authenticatedPage.locator('input[name="lowStockNotifications"]');
    await toggle.setChecked(true);
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Notification preferences saved', 'success');
  });

  test('should toggle staff clock notifications', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-notifications"]');
    
    const toggle = authenticatedPage.locator('input[name="staffClockNotifications"]');
    await toggle.setChecked(true);
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Notification preferences saved', 'success');
  });

  test('should update notification email', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-notifications"]');
    
    await authenticatedPage.fill('input[name="notificationEmail"]', 'manager@restaurant.com');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Notification preferences saved', 'success');
  });
});

test.describe('Integration Settings', () => {
  test('should display integrations tab', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    await expect(authenticatedPage.locator('[data-testid="integrations-page"]')).toBeVisible();
  });

  test('should display delivery platforms section', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    await expect(authenticatedPage.locator('[data-testid="delivery-platforms"]')).toBeVisible();
  });

  test('should toggle DoorDash integration', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    const toggle = authenticatedPage.locator('input[name="doordashEnabled"]');
    if (await toggle.isVisible()) {
      await toggle.setChecked(true);
      await authenticatedPage.click('button:has-text("Save")');
      
      await waitForToast(authenticatedPage, 'Integration settings saved', 'success');
    }
  });

  test('should configure DoorDash credentials', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    await authenticatedPage.click('[data-testid="doordash-configure"]');
    
    await expect(authenticatedPage.locator('[data-testid="doordash-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="clientId"]', 'test-client-id');
    await authenticatedPage.fill('input[name="clientSecret"]', 'test-client-secret');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'DoorDash credentials saved', 'success');
  });

  test('should toggle Uber Eats integration', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    const toggle = authenticatedPage.locator('input[name="ubereatsEnabled"]');
    if (await toggle.isVisible()) {
      await toggle.setChecked(true);
      await authenticatedPage.click('button:has-text("Save")');
      
      await waitForToast(authenticatedPage, 'Integration settings saved', 'success');
    }
  });

  test('should toggle Grubhub integration', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    const toggle = authenticatedPage.locator('input[name="grubhubEnabled"]');
    if (await toggle.isVisible()) {
      await toggle.setChecked(true);
      await authenticatedPage.click('button:has-text("Save")');
      
      await waitForToast(authenticatedPage, 'Integration settings saved', 'success');
    }
  });

  test('should display voice assistant section', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    
    await expect(authenticatedPage.locator('[data-testid="voice-assistant"]')).toBeVisible();
  });

  test('should configure Vapi settings', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-integrations"]');
    await authenticatedPage.click('[data-testid="vapi-configure"]');
    
    await expect(authenticatedPage.locator('[data-testid="vapi-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="apiKey"]', 'test-vapi-key');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Vapi settings saved', 'success');
  });
});

test.describe('Staff Settings', () => {
  test('should display staff settings tab', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-staff"]');
    
    await expect(authenticatedPage.locator('[data-testid="staff-settings"]')).toBeVisible();
  });

  test('should update default clock-in time', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-staff"]');
    
    await authenticatedPage.fill('input[name="defaultClockIn"]', '09:00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff settings saved', 'success');
  });

  test('should update default clock-out time', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-staff"]');
    
    await authenticatedPage.fill('input[name="defaultClockOut"]', '17:00');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff settings saved', 'success');
  });

  test('should toggle break reminders', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-staff"]');
    
    const toggle = authenticatedPage.locator('input[name="breakReminders"]');
    await toggle.setChecked(true);
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff settings saved', 'success');
  });

  test('should update overtime threshold', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-staff"]');
    
    await authenticatedPage.fill('input[name="overtimeThreshold"]', '40');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff settings saved', 'success');
  });
});

test.describe('Billing Settings', () => {
  test('should display billing tab', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-billing"]');
    
    await expect(authenticatedPage.locator('[data-testid="billing-page"]')).toBeVisible();
  });

  test('should display current plan', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-billing"]');
    
    await expect(authenticatedPage.locator('[data-testid="current-plan"]')).toBeVisible();
  });

  test('should display billing history', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-billing"]');
    
    await expect(authenticatedPage.locator('[data-testid="billing-history"]')).toBeVisible();
  });

  test('should update payment method', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-billing"]');
    await authenticatedPage.click('[data-testid="update-payment"]');
    
    await expect(authenticatedPage.locator('[data-testid="payment-modal"]')).toBeVisible();
    
    // This would typically open a Stripe modal
    await authenticatedPage.keyboard.press('Escape');
  });
});

test.describe('Account Settings', () => {
  test('should display profile section', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-account"]');
    
    await expect(authenticatedPage.locator('[data-testid="profile-section"]')).toBeVisible();
  });

  test('should update profile name', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-account"]');
    
    await authenticatedPage.fill('input[name="name"]', 'Updated Name');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Profile updated successfully', 'success');
  });

  test('should update profile email', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-account"]');
    
    await authenticatedPage.fill('input[name="email"]', 'newemail@test.com');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Profile updated successfully', 'success');
  });

  test('should change password', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-account"]');
    await authenticatedPage.click('[data-testid="change-password"]');
    
    await expect(authenticatedPage.locator('[data-testid="password-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="currentPassword"]', 'oldpassword');
    await authenticatedPage.fill('input[name="newPassword"]', 'newpassword123');
    await authenticatedPage.fill('input[name="confirmPassword"]', 'newpassword123');
    
    await authenticatedPage.click('button:has-text("Change Password")');
    
    await waitForToast(authenticatedPage, 'Password changed successfully', 'success');
  });

  test('should delete account', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="tab-account"]');
    await authenticatedPage.click('[data-testid="delete-account"]');
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).toBeVisible();
    
    await authenticatedPage.fill('input[name="confirmText"]', 'DELETE');
    await authenticatedPage.click('button:has-text("Delete Account")');
    
    // Should redirect to login
    await expect(authenticatedPage).toHaveURL(/\/login/);
  });
});

test.describe('Danger Zone', () => {
  test('should display danger zone', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="danger-zone"]')).toBeVisible();
  });

  test('should show delete restaurant option', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="delete-restaurant"]')).toBeVisible();
  });

  test('should export all data', async ({ authenticatedPage }) => {
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="export-data"]');
    await downloadPromise;
    
    await waitForToast(authenticatedPage, 'Data export started', 'success');
  });
});
