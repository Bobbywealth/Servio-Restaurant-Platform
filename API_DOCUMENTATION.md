# Servio Platform API Documentation

## Base URL
```
Production: https://api.servio.app
Staging: https://api-staging.servio.app
Development: http://localhost:3002
```

## Authentication

All API requests (except auth endpoints) require a JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Get Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager",
    "restaurantId": "restaurant-uuid"
  }
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Authentication | 5 req / 15 min |
| API Endpoints | 60 req / min |
| Heavy Operations (Assistant, Voice) | 20 req / min |
| Webhooks | 100 req / min |

**Response Headers**:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

**Rate Limit Exceeded**:
```json
{
  "success": false,
  "error": {
    "message": "Too many requests, please try again later",
    "type": "RateLimitExceeded",
    "retryAfter": 900
  }
}
```

---

## Common Parameters

### Pagination
```
?page=1&limit=20
```
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### Filtering
```
?status=pending&channel=online
```

### Sorting
```
?sort=created_at&order=desc
```
- `sort`: Field to sort by
- `order`: `asc` or `desc` (default: `desc`)

---

## Orders API

### List Orders

```http
GET /api/orders?restaurantId=<uuid>&status=<status>&page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters**:
- `restaurantId` (required): Restaurant UUID
- `status` (optional): `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`
- `channel` (optional): `online`, `phone`, `in-person`, `voice`
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `page`, `limit`: Pagination

**Response**:
```json
{
  "success": true,
  "orders": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-1234",
      "restaurantId": "restaurant-uuid",
      "status": "pending",
      "channel": "online",
      "type": "takeout",
      "customerInfo": {
        "name": "John Doe",
        "phone": "555-1234",
        "email": "john@example.com"
      },
      "items": [
        {
          "id": "item-uuid",
          "menuItemId": "menu-item-uuid",
          "name": "Cheeseburger",
          "quantity": 2,
          "price": 12.99,
          "modifiers": []
        }
      ],
      "subtotal": 25.98,
      "tax": 2.60,
      "tip": 5.00,
      "total": 33.58,
      "createdAt": "2026-01-20T10:30:00Z",
      "updatedAt": "2026-01-20T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "totalPages": 8
  }
}
```

### Create Order

```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "channel": "online",
  "type": "takeout",
  "items": [
    {
      "menuItemId": "menu-item-uuid",
      "quantity": 2,
      "price": 12.99,
      "modifiers": []
    }
  ],
  "customerInfo": {
    "name": "John Doe",
    "phone": "555-1234",
    "email": "john@example.com"
  },
  "subtotal": 25.98,
  "tax": 2.60,
  "tip": 5.00,
  "total": 33.58
}
```

**Validation**:
- All fields validated with express-validator
- XSS prevention with DOMPurify
- SQL injection prevention

**Response** (201 Created):
```json
{
  "success": true,
  "order": { /* order object */ }
}
```

### Update Order Status

```http
PATCH /api/orders/:orderId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed"
}
```

**Allowed Status Transitions**:
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `preparing`, `cancelled`
- `preparing` → `ready`, `cancelled`
- `ready` → `completed`

---

## Menu Items API

### List Menu Items

```http
GET /api/menu?restaurantId=<uuid>&isAvailable=true&category=<category>
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "menuItems": [
    {
      "id": "menu-item-uuid",
      "restaurantId": "restaurant-uuid",
      "name": "Cheeseburger",
      "description": "Juicy beef patty with cheese",
      "price": 12.99,
      "category": "burgers",
      "isAvailable": true,
      "imageUrl": "https://cdn.servio.app/menu/cheeseburger.jpg",
      "modifiers": [
        {
          "id": "modifier-uuid",
          "name": "Extra Cheese",
          "price": 1.50
        }
      ],
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-20T10:00:00Z"
    }
  ],
  "cache": {
    "hit": true,
    "ttl": 300
  }
}
```

### Create Menu Item

```http
POST /api/menu
Authorization: Bearer <token>
Content-Type: application/json

{
  "restaurantId": "restaurant-uuid",
  "name": "Cheeseburger",
  "description": "Juicy beef patty with cheese",
  "price": 12.99,
  "category": "burgers",
  "isAvailable": true,
  "imageUrl": "https://cdn.servio.app/menu/cheeseburger.jpg"
}
```

### Update Menu Item (86 an item)

```http
PATCH /api/menu/:menuItemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "isAvailable": false
}
```

**Note**: Cache is automatically invalidated on create/update.

---

## Inventory API

### List Inventory Items

```http
GET /api/inventory?restaurantId=<uuid>&lowStock=true
Authorization: Bearer <token>
```

**Query Parameters**:
- `restaurantId` (required)
- `lowStock` (optional): `true` returns only items below reorder point

**Response**:
```json
{
  "success": true,
  "inventoryItems": [
    {
      "id": "inventory-uuid",
      "restaurantId": "restaurant-uuid",
      "name": "Ground Beef",
      "sku": "BEEF-001",
      "currentQuantity": 5.5,
      "reorderPoint": 10.0,
      "unit": "lbs",
      "lastRestocked": "2026-01-18T10:00:00Z",
      "createdAt": "2026-01-01T10:00:00Z"
    }
  ]
}
```

### Update Inventory

```http
PATCH /api/inventory/:inventoryItemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentQuantity": 25.0
}
```

---

## Assistant API

### Query Assistant

```http
POST /api/assistant/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What are today's orders?",
  "restaurantId": "restaurant-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "response": "You have 12 orders today. 3 are pending, 5 are being prepared, and 4 are ready for pickup.",
  "confidence": 0.95,
  "context": {
    "orders": [/* order objects */],
    "timestamp": "2026-01-20T10:30:00Z"
  },
  "performance": {
    "queryTime": 287,
    "aiResponseTime": 1432
  }
}
```

**Note**: This endpoint has stricter rate limiting (20 req/min).

---

## Health & Monitoring

### Health Check

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-20T10:30:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Detailed Health

```http
GET /health/detailed
```

**Response**:
```json
{
  "healthy": true,
  "timestamp": "2026-01-20T10:30:00Z",
  "services": {
    "database": {
      "healthy": true,
      "latency": 12,
      "stats": {
        "totalCount": 8,
        "idleCount": 5,
        "waitingCount": 0
      }
    },
    "cache": {
      "healthy": true,
      "latency": 3,
      "stats": {
        "keys": 1247,
        "memory": "12.5MB",
        "hitRate": 78.5,
        "uptime": 86400
      }
    },
    "memory": {
      "healthy": true,
      "usage": {
        "rss": "156MB",
        "heapUsed": "89MB",
        "heapTotal": "128MB",
        "usagePercent": 69
      }
    }
  },
  "responseTime": 45
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "type": "NotFoundError",
    "details": {
      "resource": "order",
      "id": "order-uuid"
    }
  }
}
```

### Common Error Types

| Status | Type | Description |
|--------|------|-------------|
| 400 | ValidationError | Invalid input data |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | InsufficientPermissions | User lacks required permissions |
| 404 | NotFoundError | Resource not found |
| 409 | ConflictError | Resource conflict |
| 413 | PayloadTooLarge | Request entity too large |
| 429 | RateLimitExceeded | Too many requests |
| 500 | InternalServerError | Server error |
| 503 | ServiceUnavailable | Service temporarily unavailable |

---

## Webhooks

### Vapi Voice Call Webhook

```http
POST /api/vapi/webhook
Content-Type: application/json
X-Vapi-Secret: <webhook-secret>

{
  "type": "call_completed",
  "call": {
    "id": "call-uuid",
    "status": "completed",
    "duration": 45,
    "transcript": "I'd like to order a cheeseburger...",
    "metadata": {
      "restaurantId": "restaurant-uuid"
    }
  }
}
```

**Webhook Verification**:
- Requires `X-Vapi-Secret` header
- Secret must match configured webhook secret

---

## WebSocket Events

### Connect to WebSocket

```javascript
const socket = io('wss://api.servio.app', {
  auth: {
    token: '<your-jwt-token>'
  }
});
```

### Join Restaurant Channel

```javascript
socket.emit('join:restaurant', {
  restaurantId: 'restaurant-uuid'
});
```

### Listen for Events

```javascript
// New order created
socket.on('order:created', (order) => {
  console.log('New order:', order);
});

// Order status updated
socket.on('order:updated', (order) => {
  console.log('Order updated:', order);
});

// Inventory low stock alert
socket.on('inventory:lowStock', (item) => {
  console.log('Low stock:', item);
});

// New task assigned
socket.on('task:assigned', (task) => {
  console.log('New task:', task);
});
```

---

## SDKs & Libraries

### JavaScript/TypeScript
```bash
npm install @servio/sdk
```

```typescript
import { ServioClient } from '@servio/sdk';

const client = new ServioClient({
  apiKey: 'your-api-key',
  environment: 'production'
});

const orders = await client.orders.list({
  restaurantId: 'restaurant-uuid',
  status: 'pending'
});
```

### Python
```bash
pip install servio-sdk
```

```python
from servio import ServioClient

client = ServioClient(api_key='your-api-key')

orders = client.orders.list(
    restaurant_id='restaurant-uuid',
    status='pending'
)
```

---

## Best Practices

### Pagination
Always use pagination for list endpoints to avoid performance issues.

### Caching
Menu items and restaurant settings are cached. Cache TTL is indicated in response.

### Error Handling
Always check the `success` field in responses. Handle rate limits gracefully with exponential backoff.

### Webhooks
Verify webhook signatures before processing. Respond with 200 OK quickly (process asynchronously).

### Security
- Never expose your API keys
- Use HTTPS only
- Validate all inputs
- Handle rate limits

---

## Support

- **Documentation**: https://docs.servio.app
- **API Status**: https://status.servio.app
- **Support Email**: support@servio.app
- **Slack Community**: https://servio.app/slack
