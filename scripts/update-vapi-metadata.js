#!/usr/bin/env node

/**
 * Update Vapi Assistant Metadata
 * Adds restaurant/prompt provenance metadata so dashboard state matches backend config.
 *
 * Usage: VAPI_API_KEY=your_key node scripts/update-vapi-metadata.js [ASSISTANT_ID]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ASSISTANT_ID = process.argv[2] || process.env.VAPI_ASSISTANT_ID || '5bcdc172-aa46-44c7-a512-c82dbc7325ce';
const API_KEY = process.env.VAPI_API_KEY;
const RESTAURANT_ID = process.env.VAPI_RESTAURANT_ID || 'sasheys-kitchen-union';
const PROMPT_VERSION = process.env.VAPI_PHONE_PROMPT_VERSION || 'sasheys-v1';
const PROMPT_SOURCE = 'src/prompts/vapi_system_prompt_sasheys.txt';
const PROMPT_PATH = path.resolve(process.cwd(), PROMPT_SOURCE);
const promptText = fs.readFileSync(PROMPT_PATH, 'utf-8').trim();
const PROMPT_HASH = crypto.createHash('sha256').update(promptText).digest('hex').slice(0, 12);

if (!API_KEY) {
  console.error('❌ ERROR: VAPI_API_KEY environment variable is required');
  console.error('   Usage: VAPI_API_KEY=your_key node scripts/update-vapi-metadata.js');
  process.exit(1);
}

const data = JSON.stringify({
  metadata: {
    assistantId: ASSISTANT_ID,
    restaurantId: RESTAURANT_ID,
    promptVersion: PROMPT_VERSION,
    promptHash: PROMPT_HASH,
    promptSource: PROMPT_SOURCE
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
console.log(`   Prompt Version: ${PROMPT_VERSION}`);
console.log(`   Prompt Hash: ${PROMPT_HASH}`);
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
