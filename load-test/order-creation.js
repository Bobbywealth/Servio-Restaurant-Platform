import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Sustained load with 100 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '3m', target: 100 },  // Back to 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    'http_req_failed': ['rate<0.01'],                  // Less than 1% errors
    'errors': ['rate<0.01'],                           // Less than 1% application errors
  },
};

// Environment variables
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3002';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const RESTAURANT_ID = __ENV.RESTAURANT_ID;
const MENU_ITEM_ID = __ENV.MENU_ITEM_ID;

// Sample data
const orderTypes = ['dine-in', 'takeout', 'delivery'];
const orderChannels = ['online', 'phone', 'in-person', 'voice'];

// Test setup
export function setup() {
  // Verify authentication
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN environment variable is required');
  }
  
  console.log(`Load test starting against: ${BASE_URL}`);
  console.log(`Restaurant ID: ${RESTAURANT_ID}`);
  
  return { baseUrl: BASE_URL, token: AUTH_TOKEN };
}

// Main test function
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Create order
  const orderPayload = JSON.stringify({
    restaurantId: RESTAURANT_ID,
    channel: orderChannels[Math.floor(Math.random() * orderChannels.length)],
    type: orderTypes[Math.floor(Math.random() * orderTypes.length)],
    items: [
      {
        menuItemId: MENU_ITEM_ID || 'test-item-id',
        quantity: Math.floor(Math.random() * 3) + 1,
        price: 12.99,
        modifiers: []
      }
    ],
    customerInfo: {
      name: `Load Test Customer ${__VU}-${__ITER}`,
      phone: `555-${String(__VU).padStart(4, '0')}`,
      email: `loadtest${__VU}@example.com`
    },
    subtotal: 12.99,
    tax: 1.30,
    total: 14.29
  });

  // POST /api/orders
  const createRes = http.post(
    `${data.baseUrl}/api/orders`,
    orderPayload,
    { headers, tags: { name: 'CreateOrder' } }
  );

  const createSuccess = check(createRes, {
    'order created': (r) => r.status === 201,
    'has order id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.order && body.order.id;
      } catch (e) {
        return false;
      }
    },
    'response time OK': (r) => r.timings.duration < 500,
  });

  if (!createSuccess) {
    errorRate.add(1);
    console.error(`Failed to create order: ${createRes.status} ${createRes.body}`);
  } else {
    const order = JSON.parse(createRes.body).order;
    
    // GET /api/orders/:id
    const getRes = http.get(
      `${data.baseUrl}/api/orders/${order.id}`,
      { headers, tags: { name: 'GetOrder' } }
    );

    check(getRes, {
      'order retrieved': (r) => r.status === 200,
      'correct order id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.order.id === order.id;
        } catch (e) {
          return false;
        }
      },
    });

    // Update order status
    const updatePayload = JSON.stringify({
      status: 'confirmed'
    });

    const updateRes = http.patch(
      `${data.baseUrl}/api/orders/${order.id}`,
      updatePayload,
      { headers, tags: { name: 'UpdateOrder' } }
    );

    check(updateRes, {
      'order updated': (r) => r.status === 200,
    });
  }

  // List orders for restaurant
  const listRes = http.get(
    `${data.baseUrl}/api/orders?restaurantId=${RESTAURANT_ID}&limit=10`,
    { headers, tags: { name: 'ListOrders' } }
  );

  check(listRes, {
    'orders listed': (r) => r.status === 200,
    'has orders array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.orders);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1); // Think time between iterations
}

// Teardown
export function teardown(data) {
  console.log('Load test completed');
}
