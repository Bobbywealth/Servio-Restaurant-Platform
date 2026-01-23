#!/usr/bin/env node

/**
 * Update Vapi Assistant Metadata
 * Adds restaurantId to assistant metadata for proper menu scoping
 */

const https = require('https');

const ASSISTANT_ID = 'c70c1a5d-0972-452a-b999-c9c6274744f8';
const API_KEY = 'd83d2720-ecb7-4976-8c9c-2084203fdb07';
const RESTAURANT_ID = 'sasheys-kitchen-union';

const data = JSON.stringify({
  metadata: {
    restaurantId: RESTAURANT_ID
  }
});

const options = {
  hostname: 'api.vapi.ai',
  port: 443,
  path: `/assistant/${ASSISTANT_ID}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🔄 Updating Vapi assistant metadata...');
console.log(`   Assistant ID: ${ASSISTANT_ID}`);
console.log(`   Restaurant ID: ${RESTAURANT_ID}`);
console.log('');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`📡 Response Status: ${res.statusCode}`);
    console.log('');

    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ SUCCESS! Assistant metadata updated.');
      console.log('');
      try {
        const parsed = JSON.parse(responseData);
        console.log('📋 Updated Assistant:');
        console.log(`   Name: ${parsed.name || 'N/A'}`);
        console.log(`   Metadata: ${JSON.stringify(parsed.metadata || {}, null, 2)}`);
      } catch (e) {
        console.log('Response:', responseData);
      }
    } else {
      console.log('❌ ERROR: Failed to update metadata');
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(data);
req.end();
