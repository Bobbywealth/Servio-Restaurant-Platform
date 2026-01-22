import { test, expect } from '@playwright/test';

test.describe('Assistant Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Make E2E deterministic: don't require backend, DB, or OpenAI.
    // We seed auth state via localStorage and mock the API surface the frontend uses.

    // Disable socket.io noise in tests (avoids flakey reconnect timing).
    await page.route('**/socket.io/**', (route) => route.abort());

    // Seed auth state before app code runs
    await page.addInitScript(() => {
      const user = {
        id: 'e2e-user-1',
        restaurantId: 'demo-restaurant-1',
        name: 'E2E User',
        email: 'e2e@servio.test',
        role: 'admin',
        permissions: ['*'],
      };
      window.localStorage.setItem('servio_access_token', 'e2e_access_token');
      window.localStorage.setItem('servio_refresh_token', 'e2e_refresh_token');
      window.localStorage.setItem('servio_user', JSON.stringify(user));
    });

    // Mock auth endpoints used by UserContext bootstrap
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'e2e-user-1',
              restaurantId: 'demo-restaurant-1',
              name: 'E2E User',
              email: 'e2e@servio.test',
              role: 'admin',
              permissions: ['*'],
            },
          },
        }),
      });
    });

    await page.route('**/api/auth/available-accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accounts: { admin: [{ id: 'e2e-user-1', email: 'e2e@servio.test', name: 'E2E User', role: 'admin' }] }, totalCount: 1 },
        }),
      });
    });

    // Mock assistant status so the page doesn't depend on OPENAI_API_KEY
    await page.route('**/api/assistant/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            service: 'online',
            configured: false,
            message: 'E2E mocked status',
            features: { speechToText: 'unavailable', textToSpeech: 'unavailable', llm: 'unavailable' },
            capabilities: [],
            version: '1.0.0',
          },
        }),
      });
    });

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
