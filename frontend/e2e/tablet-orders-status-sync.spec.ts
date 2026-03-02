import { test, expect } from '@playwright/test'

const orderId = 'order-sync-failure-1'

const ordersResponse = {
  success: true,
  data: {
    orders: [
      {
        id: orderId,
        status: 'preparing',
        customer_name: 'Alex Failure Case',
        total_amount: 18.5,
        created_at: new Date().toISOString(),
        items: [{ id: 'item-1', name: 'Fries', quantity: 1 }],
        channel: 'in_store',
        order_type: 'pickup',
        prep_minutes: 20
      }
    ]
  }
}

test('does not persist optimistic status when /status returns 400', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('servio_access_token', 'test-access-token')
    window.localStorage.setItem('servio_user', JSON.stringify({
      id: 'staff-1',
      name: 'Tablet Staff',
      role: 'staff',
      permissions: ['orders.read', 'orders.update']
    }))
  })

  await page.route('**/api/orders?limit=50&offset=0', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ordersResponse) })
  })

  await page.route(`**/api/orders/${orderId}/status`, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Cannot move order to ready from preparing' } })
    })
  })

  await page.route('**/api/restaurants/profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  })

  await page.route('**/api/settings/print', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  })

  await page.goto('/tablet/orders')

  const orderCard = page.locator('[role="button"]').filter({ hasText: 'Alex Failure Case' }).first()
  await expect(orderCard).toBeVisible()

  await orderCard.getByRole('button', { name: 'Mark Ready' }).click()

  await expect(orderCard.getByRole('button', { name: 'Mark Ready' })).toBeVisible()
  await expect(orderCard.getByText('Sync failed')).toBeVisible()
  await expect(orderCard.getByText('Cannot move order to ready from preparing')).toBeVisible()
})
