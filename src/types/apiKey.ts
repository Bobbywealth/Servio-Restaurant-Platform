// API Key Types for Servio Platform

export type ApiKeyScope = 
  // Orders
  | 'read:orders'
  | 'write:orders'
  // Menu
  | 'read:menu'
  | 'write:menu'
  // Customers
  | 'read:customers'
  | 'write:customers'
  // Inventory
  | 'read:inventory'
  | 'write:inventory'
  // Staff
  | 'read:staff'
  | 'write:staff'
  // Analytics
  | 'read:analytics'
  // Admin
  | 'admin:full'
  // Webhooks
  | 'webhooks'
  // Reservations
  | 'read:reservations'
  | 'write:reservations'
  // Payments
  | 'read:payments'
  | 'write:payments';

export interface ApiKey {
  id: string;
  companyId?: string;
  restaurantId?: string;
  name: string;
  description?: string;
  keyPrefix: string;
  keyHash: string;
  scopes: ApiKeyScope[];
  rateLimit: number;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface ApiKeyDailyStats {
  id: string;
  apiKeyId: string;
  date: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs?: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  uniqueIps: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyWebhook {
  id: string;
  apiKeyId: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.completed'
  | 'order.cancelled'
  | 'menu.updated'
  | 'inventory.low_stock'
  | 'customer.created'
  | 'payment.received'
  | 'reservation.created'
  | 'reservation.updated';

export interface ApiKeyWebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  responseStatus?: number;
  responseBody?: string;
  attemptCount: number;
  deliveredAt?: Date;
  nextRetryAt?: Date;
  createdAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  companyId?: string;
  restaurantId?: string;
  scopes: ApiKeyScope[];
  rateLimit?: number;
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string; // Only returned once during creation
  keyPrefix: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
  createdAt: Date;
}

export interface UpdateApiKeyRequest {
  name?: string;
  description?: string;
  scopes?: ApiKeyScope[];
  rateLimit?: number;
  isActive?: boolean;
  expiresAt?: Date;
}

export interface ApiKeyUsageQuery {
  apiKeyId: string;
  startDate?: Date;
  endDate?: Date;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  limit?: number;
  offset?: number;
}

export interface ApiKeyStatsResponse {
  apiKeyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTimeMs: number;
  requestsByEndpoint: Record<string, number>;
  requestsByMethod: Record<string, number>;
  recentUsage: ApiKeyUsage[];
  dailyStats: ApiKeyDailyStats[];
}

// Scope groupings for UI
export const SCOPE_GROUPS = {
  orders: {
    label: 'Orders',
    scopes: ['read:orders', 'write:orders'] as ApiKeyScope[],
    description: 'Access to order management',
  },
  menu: {
    label: 'Menu',
    scopes: ['read:menu', 'write:menu'] as ApiKeyScope[],
    description: 'Access to menu items and categories',
  },
  customers: {
    label: 'Customers',
    scopes: ['read:customers', 'write:customers'] as ApiKeyScope[],
    description: 'Access to customer data',
  },
  inventory: {
    label: 'Inventory',
    scopes: ['read:inventory', 'write:inventory'] as ApiKeyScope[],
    description: 'Access to inventory management',
  },
  staff: {
    label: 'Staff',
    scopes: ['read:staff', 'write:staff'] as ApiKeyScope[],
    description: 'Access to staff information',
  },
  analytics: {
    label: 'Analytics',
    scopes: ['read:analytics'] as ApiKeyScope[],
    description: 'Access to analytics and reports',
  },
  reservations: {
    label: 'Reservations',
    scopes: ['read:reservations', 'write:reservations'] as ApiKeyScope[],
    description: 'Access to reservation management',
  },
  payments: {
    label: 'Payments',
    scopes: ['read:payments', 'write:payments'] as ApiKeyScope[],
    description: 'Access to payment information',
  },
  webhooks: {
    label: 'Webhooks',
    scopes: ['webhooks'] as ApiKeyScope[],
    description: 'Manage and receive webhooks',
  },
  admin: {
    label: 'Full Admin',
    scopes: ['admin:full'] as ApiKeyScope[],
    description: 'Full administrative access (use with caution)',
  },
} as const;

export type ScopeGroup = keyof typeof SCOPE_GROUPS;
