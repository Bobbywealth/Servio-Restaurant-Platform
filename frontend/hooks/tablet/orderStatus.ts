import type { AxiosInstance } from 'axios';

export const ORDER_STATUS = {
  RECEIVED: 'received',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const TABLET_STATUS_ACTION = {
  PICKED_UP: 'picked_up',
  DECLINED: 'declined'
} as const;

export type TabletStatusAction = (typeof TABLET_STATUS_ACTION)[keyof typeof TABLET_STATUS_ACTION];

const TABLET_STATUS_TO_ORDER_STATUS: Record<TabletStatusAction, OrderStatus> = {
  [TABLET_STATUS_ACTION.PICKED_UP]: ORDER_STATUS.COMPLETED,
  [TABLET_STATUS_ACTION.DECLINED]: ORDER_STATUS.CANCELLED
};

export function mapTabletStatusActionToOrderStatus(action: TabletStatusAction): OrderStatus {
  return TABLET_STATUS_TO_ORDER_STATUS[action];
}

export function buildOrderStatusPayload(status: OrderStatus): { status: OrderStatus } {
  return { status };
}

export function getOrderStatusEndpoint(orderId: string): string {
  return `/api/orders/${encodeURIComponent(orderId)}/status`;
}

export async function postOrderStatus(
  apiClient: Pick<AxiosInstance, 'post'>,
  orderId: string,
  status: OrderStatus
): Promise<unknown> {
  return apiClient.post(getOrderStatusEndpoint(orderId), buildOrderStatusPayload(status));
}
