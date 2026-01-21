import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 20 },   // Sustained load with 20 users
    { duration: '1m', target: 30 },   // Spike to 30 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // AI responses are slower
    'http_req_failed': ['rate<0.05'],                  // Less than 5% errors
    'errors': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3002';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const RESTAURANT_ID = __ENV.RESTAURANT_ID;

// Sample queries
const queries = [
  "What are today's orders?",
  "Show me pending tasks",
  "What items are low in stock?",
  "How many orders do we have?",
  "What's our best selling item?",
  "Show me today's revenue",
  "Are there any urgent tasks?",
  "What menu items are 86'd?",
  "How many staff are clocked in?",
  "What's the status of order #123?"
];

export function setup() {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN environment variable is required');
  }
  
  console.log(`Assistant load test starting against: ${BASE_URL}`);
  
  return { baseUrl: BASE_URL, token: AUTH_TOKEN };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Random query
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const payload = JSON.stringify({
    message: query,
    restaurantId: RESTAURANT_ID
  });

  const res = http.post(
    `${data.baseUrl}/api/assistant/query`,
    payload,
    { 
      headers,
      timeout: '10s',
      tags: { name: 'AssistantQuery' }
    }
  );

  const success = check(res, {
    'query successful': (r) => r.status === 200,
    'has response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.response && body.response.length > 0;
      } catch (e) {
        return false;
      }
    },
    'response time acceptable': (r) => r.timings.duration < 5000,
  });

  if (!success) {
    errorRate.add(1);
    console.error(`Assistant query failed: ${res.status}`);
  }

  sleep(Math.random() * 3 + 2); // 2-5 seconds between queries
}

export function teardown(data) {
  console.log('Assistant load test completed');
}
