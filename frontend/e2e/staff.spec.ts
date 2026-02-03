/**
 * Staff Management E2E Tests
 * 
 * Tests for staff management page:
 * - Staff list display
 * - Add/edit/delete staff
 * - Role assignment
 * - Staff scheduling
 * - Time clock functionality
 */

import { test, expect } from '../fixtures/test-fixtures';
import { waitForToast } from '../helpers/test-helpers';

test.describe('Staff List', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff');
    await expect(authenticatedPage.locator('[data-testid="staff-page"]')).toBeVisible();
  });

  test('should display staff page title', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('h1')).toContainText(/staff/i);
  });

  test('should display staff table', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="staff-table"]')).toBeVisible();
  });

  test('should display add staff button', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="add-staff-button"]')).toBeVisible();
  });

  test('should display staff count', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="staff-count"]')).not.toBeEmpty();
  });
});

test.describe('Add Staff', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="add-staff-button"]');
    await expect(authenticatedPage.locator('[data-testid="staff-modal"]')).toBeVisible();
  });

  test('should show error for missing name', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="email"]', 'staff@test.com');
    await authenticatedPage.selectOption('select[name="role"]', 'staff');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/name is required/i);
  });

  test('should show error for missing email', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'John Doe');
    await authenticatedPage.selectOption('select[name="role"]', 'staff');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/email is required/i);
  });

  test('should show error for invalid email', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'John Doe');
    await authenticatedPage.fill('input[name="email"]', 'invalid-email');
    await authenticatedPage.selectOption('select[name="role"]', 'staff');
    await authenticatedPage.click('button:has-text("Save")');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/invalid email/i);
  });

  test('should create staff member', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'John Doe');
    await authenticatedPage.fill('input[name="email"]', 'john.doe@test.com');
    await authenticatedPage.selectOption('select[name="role"]', 'staff');
    await authenticatedPage.fill('input[name="pin"]', '1234');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff member created successfully', 'success');
  });

  test('should generate PIN when not provided for staff', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('input[name="name"]', 'Jane Doe');
    await authenticatedPage.fill('input[name="email"]', 'jane.doe@test.com');
    await authenticatedPage.selectOption('select[name="role"]', 'staff');
    // Leave PIN empty
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff member created successfully', 'success');
    
    // PIN should be auto-generated
    await authenticatedPage.locator('[data-testid="staff-row"]:has-text("Jane Doe")')
      .locator('[data-testid="pin-display"]')
      .should('be.visible');
  });
});

test.describe('Edit Staff', () => {
  test('should open edit modal', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="edit-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="staff-modal"]')).toBeVisible();
  });

  test('should update staff name', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="edit-button"]').click();
    
    await authenticatedPage.fill('input[name="name"]', 'Updated Name');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff member updated', 'success');
  });

  test('should update staff role', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="edit-button"]').click();
    
    await authenticatedPage.selectOption('select[name="role"]', 'manager');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff member updated', 'success');
  });

  test('should update staff PIN', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="edit-button"]').click();
    
    await authenticatedPage.fill('input[name="pin"]', '5678');
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Staff member updated', 'success');
  });
});

test.describe('Delete Staff', () => {
  test('should show confirmation dialog', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="delete-button"]').click();
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).toBeVisible();
  });

  test('should cancel delete', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]').first();
    await staffRow.hover();
    await staffRow.locator('[data-testid="delete-button"]').click();
    
    await authenticatedPage.click('button:has-text("Cancel")');
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).not.toBeVisible();
  });

  test('should delete staff member', async ({ authenticatedPage }) => {
    const staffRow = authenticatedPage.locator('[data-testid="staff-row"]:has-text("Test Staff")').first();
    if (await staffRow.isVisible()) {
      await staffRow.hover();
      await staffRow.locator('[data-testid="delete-button"]').click();
      
      await authenticatedPage.click('button:has-text("Delete")');
      
      await waitForToast(authenticatedPage, 'Staff member deleted', 'warning');
    }
  });
});

test.describe('Staff Role Badge', () => {
  test('should display owner badge', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="role-owner"]').first()).toBeVisible();
  });

  test('should display manager badge', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="role-manager"]').first()).toBeVisible();
  });

  test('should display staff badge', async ({ authenticatedPage }) => {
    await expect(authenticatedPage.locator('[data-testid="role-staff"]').first()).toBeVisible();
  });
});

test.describe('Staff Search and Filter', () => {
  test('should search staff by name', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('[data-testid="search-input"]', 'John');
    
    await expect(authenticatedPage.locator('[data-testid="staff-row"]').first()).toContainText(/john/i);
  });

  test('should search staff by email', async ({ authenticatedPage }) => {
    await authenticatedPage.fill('[data-testid="search-input"]', 'test.com');
    
    await expect(authenticatedPage.locator('[data-testid="staff-row"]').first()).toContainText(/test\.com/i);
  });

  test('should filter by role', async ({ authenticatedPage }) => {
    await authenticatedPage.selectOption('select[name="roleFilter"]', 'manager');
    
    await expect(authenticatedPage.locator('[data-testid="staff-row"]').first()).toBeVisible();
  });
});

test.describe('Bulk Actions', () => {
  test('should select staff members', async ({ authenticatedPage }) => {
    await authenticatedPage.locator('[data-testid="select-all"]').check();
    
    await expect(authenticatedPage.locator('[data-testid="staff-row"] [type="checkbox"]')).toBeChecked();
  });

  test('should show bulk actions menu', async ({ authenticatedPage }) => {
    await authenticatedPage.locator('[data-testid="staff-row"] [type="checkbox"]').first().check();
    
    await expect(authenticatedPage.locator('[data-testid="bulk-actions-menu"]')).toBeVisible();
  });

  test('should bulk deactivate staff', async ({ authenticatedPage }) => {
    await authenticatedPage.locator('[data-testid="staff-row"] [type="checkbox"]').first().check();
    await authenticatedPage.click('[data-testid="bulk-deactivate"]');
    
    await expect(authenticatedPage.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await authenticatedPage.click('button:has-text("Deactivate")');
    
    await waitForToast(authenticatedPage, 'Staff deactivated', 'warning');
  });
});

test.describe('Staff Scheduling', () => {
  test('should navigate to scheduling', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="scheduling-tab"]');
    
    await expect(authenticatedPage).toHaveURL(/\/staff\/scheduling/);
  });

  test('should display schedule grid', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/scheduling');
    
    await expect(authenticatedPage.locator('[data-testid="schedule-grid"]')).toBeVisible();
  });

  test('should add shift', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/scheduling');
    
    await authenticatedPage.click('[data-testid="add-shift-button"]');
    await authenticatedPage.selectOption('select[name="staffId"]', { index: 0 });
    await authenticatedPage.fill('input[name="date"]', '2024-01-20');
    await authenticatedPage.fill('input[name="startTime"]', '09:00');
    await authenticatedPage.fill('input[name="endTime"]', '17:00');
    
    await authenticatedPage.click('button:has-text("Save")');
    
    await waitForToast(authenticatedPage, 'Shift added successfully', 'success');
  });
});

test.describe('Time Clock', () => {
  test('should navigate to time clock', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="timeclock-tab"]');
    
    await expect(authenticatedPage).toHaveURL(/\/staff\/timeclock/);
  });

  test('should display time clock interface', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await expect(authenticatedPage.locator('[data-testid="timeclock-page"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="clock-in-button"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="clock-out-button"]')).toBeVisible();
  });

  test('should clock in with PIN', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await authenticatedPage.fill('input[name="pin"]', '1234');
    await authenticatedPage.click('[data-testid="clock-in-button"]');
    
    await waitForToast(authenticatedPage, 'Clocked in successfully', 'success');
    await expect(authenticatedPage.locator('[data-testid="clock-out-button"]')).toBeVisible();
  });

  test('should clock out with PIN', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await authenticatedPage.fill('input[name="pin"]', '1234');
    await authenticatedPage.click('[data-testid="clock-out-button"]');
    
    await waitForToast(authenticatedPage, 'Clocked out successfully', 'success');
  });

  test('should show error for invalid PIN', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await authenticatedPage.fill('input[name="pin"]', '0000');
    await authenticatedPage.click('[data-testid="clock-in-button"]');
    
    await expect(authenticatedPage.locator('.error-message')).toContainText(/invalid pin/i);
  });

  test('should display today\'s hours', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await expect(authenticatedPage.locator('[data-testid="todays-hours"]')).toBeVisible();
  });

  test('should display weekly hours', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/staff/timeclock');
    
    await expect(authenticatedPage.locator('[data-testid="weekly-hours"]')).toBeVisible();
  });
});
