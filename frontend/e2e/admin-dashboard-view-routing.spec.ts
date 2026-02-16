import { test, expect } from '@playwright/test'

test('clicking View routes to /admin/restaurants/:id', async ({ page }) => {
  await page.route('**/api/admin/platform-stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          total_restaurants: 1
        },
        recentActivity: []
      })
    })
  })

  await page.route('**/api/admin/restaurants?limit=12', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        restaurants: [
          {
            id: 'rest_123',
            name: 'Test Kitchen',
            is_active: true,
            orders_today: 7,
            user_count: 4
          }
        ]
      })
    })
  })

  await page.route('**/api/admin/analytics?days=30', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        revenueByRestaurant: [],
        ordersByChannel: [],
        hourlyDistribution: []
      })
    })
  })

  await page.route('**/api/admin/recent-activity?limit=20', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activities: []
      })
    })
  })

  await page.goto('/admin')

  await expect(page.getByText('Test Kitchen')).toBeVisible()
  await page.getByTestId('view-restaurant-rest_123').click()

  await expect(page).toHaveURL(/\/admin\/restaurants\/rest_123$/)
})
