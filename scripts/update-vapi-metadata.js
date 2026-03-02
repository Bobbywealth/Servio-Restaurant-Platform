#!/usr/bin/env node

/**
 * Update Vapi Assistant Metadata
 * Adds restaurantId to assistant metadata for proper menu scoping
 * 
 * Usage: VAPI_API_KEY=your_key node scripts/update-vapi-metadata.js [ASSISTANT_ID]
 */

const https = require('https');

const ASSISTANT_ID = process.argv[2] || process.env.VAPI_ASSISTANT_ID || '5bcdc172-aa46-44c7-a512-c82dbc7325ce';
const API_KEY = process.env.VAPI_API_KEY;
const RESTAURANT_ID = process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';

if (!API_KEY) {
  console.error('❌ ERROR: VAPI_API_KEY environment variable is required');
  console.error('   Usage: VAPI_API_KEY=your_key node scripts/update-vapi-metadata.js');
  process.exit(1);
}

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
