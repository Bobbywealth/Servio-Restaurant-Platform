import { test, expect } from '@playwright/test'

const mockSuccessfulPlatformStats = {
  stats: {
    total_restaurants: 2
  },
  recentActivity: []
}

const mockSuccessfulRestaurants = {
  restaurants: [
    {
      id: 'rest-1',
      name: 'Alpha Kitchen',
      is_active: true,
      orders_today: 4,
      user_count: 3
    }
  ]
}

test('keeps platform stats and restaurants visible when analytics fails', async ({ page }) => {
  await page.route('**/api/admin/platform-stats', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockSuccessfulPlatformStats) })
  })

  await page.route('**/api/admin/restaurants?limit=12', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockSuccessfulRestaurants) })
  })

  await page.route('**/api/admin/recent-activity?limit=20', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify({ activities: [] }) })
  })

  await page.route('**/api/admin/analytics?days=30', async route => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Analytics service unavailable' })
    })
  })

  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: 'Restaurants' })).toBeVisible()
  await expect(page.getByText('Alpha Kitchen')).toBeVisible()
  await expect(page.getByText('Analytics service unavailable')).toBeVisible()
  await expect(page.getByText('Analytics unavailable').first()).toBeVisible()
})

test('parses { error } API shape for widget-level errors', async ({ page }) => {
  await page.route('**/api/admin/platform-stats', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockSuccessfulPlatformStats) })
  })

  await page.route('**/api/admin/restaurants?limit=12', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Restaurants service offline' })
    })
  })

  await page.route('**/api/admin/recent-activity?limit=20', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify({ activities: [] }) })
  })

  await page.route('**/api/admin/analytics?days=30', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        revenueByRestaurant: [{ name: 'Alpha Kitchen', revenue: 1200 }],
        ordersByChannel: [{ channel: 'web', count: 10 }],
        hourlyDistribution: [{ hour: 12, orders: 3 }]
      })
    })
  })

  await page.goto('/admin')

  await expect(page.getByText('Restaurants service offline')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cross-Restaurant Analytics' })).toBeVisible()
  await expect(page.getByText('Revenue by Restaurant')).toBeVisible()
})
