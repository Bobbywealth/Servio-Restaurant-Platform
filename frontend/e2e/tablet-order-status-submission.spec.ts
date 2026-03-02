import { expect, test } from '@playwright/test'
import {
  ORDER_STATUS,
  TABLET_STATUS_ACTION,
  mapTabletStatusActionToOrderStatus,
  postOrderStatus
} from '../hooks/tablet/orderStatus'

test.describe('tablet order status submission', () => {
  test('maps tablet-only actions to backend-supported statuses before posting', async () => {
    const calls: Array<{ url: string; payload: { status: string } }> = []

    const apiClient = {
      post: async (url: string, payload: { status: string }) => {
        calls.push({ url, payload })
        return { data: { success: true } }
      }
    }

    await postOrderStatus(apiClient as any, 'order-1', mapTabletStatusActionToOrderStatus(TABLET_STATUS_ACTION.PICKED_UP))
    await postOrderStatus(apiClient as any, 'order-2', mapTabletStatusActionToOrderStatus(TABLET_STATUS_ACTION.DECLINED))

    expect(calls).toEqual([
      { url: '/api/orders/order-1/status', payload: { status: ORDER_STATUS.COMPLETED } },
      { url: '/api/orders/order-2/status', payload: { status: ORDER_STATUS.CANCELLED } }
    ])

    const postedStatuses = calls.map((entry) => entry.payload.status)
    expect(postedStatuses).not.toContain(TABLET_STATUS_ACTION.PICKED_UP)
    expect(postedStatuses).not.toContain(TABLET_STATUS_ACTION.DECLINED)
  })
})
