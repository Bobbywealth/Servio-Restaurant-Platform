export const ORDER_STATUS = {
  RECEIVED: 'received',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = Object.values(ORDER_STATUS);

const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [ORDER_STATUS.RECEIVED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: []
};

const REOPENABLE_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  ...ORDER_TRANSITIONS,
  [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.RECEIVED]
};

export const ORDER_ACTIVE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY
];

export const ORDER_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY
]);

export const ORDER_REOPEN_TARGET_STATUS: OrderStatus = ORDER_STATUS.RECEIVED;

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && ORDER_STATUS_VALUES.includes(value as OrderStatus);

export const canTransitionOrderStatus = (
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  options?: { allowReopen?: boolean }
): boolean => {
  const transitions = options?.allowReopen ? REOPENABLE_TRANSITIONS : ORDER_TRANSITIONS;
  return transitions[currentStatus].includes(nextStatus);
};

export const getAllowedNextOrderStatuses = (
  currentStatus: OrderStatus,
  options?: { allowReopen?: boolean }
): readonly OrderStatus[] => {
  const transitions = options?.allowReopen ? REOPENABLE_TRANSITIONS : ORDER_TRANSITIONS;
  return transitions[currentStatus];
};
