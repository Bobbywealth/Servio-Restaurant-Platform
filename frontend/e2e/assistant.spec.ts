import { test, expect } from '@playwright/test';

test.describe('Assistant Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager/owner
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@servio.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/dashboard/assistant');
  });

  test('should load page correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('AI Assistant');
    await expect(page.getByTestId('assistant-avatar')).toBeVisible();
    await expect(page.getByTestId('chat-input-wrapper')).toBeVisible();
  });

  test('should send text command and receive response', async ({ page }) => {
    // Mock API response to be deterministic
    await page.route('**/api/assistant/process-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            response: 'I found 2 active orders.',
            actions: [{ type: 'get_orders', status: 'success', description: 'Found 2 orders' }],
            processingTime: 150
          }
        })
      });
    });

    const input = page.getByPlaceholder('Type a command...');
    await input.fill('check orders');
    await input.press('Enter');

    // Verify user message
    await expect(page.getByTestId('transcript-feed')).toContainText('check orders');
    
    // Verify assistant response
    await expect(page.getByTestId('transcript-feed')).toContainText('I found 2 active orders.');
    await expect(page.getByTestId('transcript-feed')).toContainText('Found 2 orders');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('**/api/assistant/process-text', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Internal Server Error' }
        })
      });
    });

    const input = page.getByPlaceholder('Type a command...');
    await input.fill('fail me');
    await input.press('Enter');

    await expect(page.getByTestId('transcript-feed')).toContainText('❌ Error: Request failed with status code 500');
  });

  test('should have quick commands working', async ({ page }) => {
    await page.route('**/api/assistant/process-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { response: 'Checking orders...', actions: [], processingTime: 100 }
        })
      });
    });

    await page.getByTestId('quick-command-check-orders').click();
    await expect(page.getByTestId('transcript-feed')).toContainText('check current orders');
  });

  test('should disable inputs during processing', async ({ page }) => {
    // Slow response
    await page.route('**/api/assistant/process-text', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { response: 'Done', actions: [], processingTime: 100 } })
      });
    });

    await page.getByPlaceholder('Type a command...').fill('slow command');
    await page.keyboard.press('Enter');

    await expect(page.getByPlaceholder('Type a command...')).toBeDisabled();
    await expect(page.getByTestId('quick-command-check-orders')).toBeDisabled();
  });
});
