// Simple Node test harness for Vapi webhook tools
// Usage:
//   WEBHOOK_URL=https://servio-backend-zexb.onrender.com/api/vapi/webhook node scripts/vapi-tool-test.js
//
// Adjust payloads below as needed.

const fetch = global.fetch || require('node-fetch');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3002/api/vapi/webhook';
const RESTAURANT_ID = process.env.VAPI_RESTAURANT_ID || process.env.RESTAURANT_ID || 'sasheys-kitchen-union';

async function callTool(toolName, parameters) {
  const payload = {
    message: {
      type: 'function-call',
      call: { id: `test_call_${Date.now()}`, customer: { number: '+15555555555' } },
      functionCall: {
        name: toolName,
        parameters
      }
    }
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log(`\n== ${toolName} status ${res.status} ==`);
  console.log(text);
}

async function run() {
  await callTool('searchMenu', { q: 'available', restaurantId: RESTAURANT_ID });
  await callTool('getStoreStatus', { restaurantId: RESTAURANT_ID });
  await callTool('getMenuItem', { id: 'jerk-chicken', restaurantId: RESTAURANT_ID });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
