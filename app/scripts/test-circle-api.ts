/**
 * Test Circle API Connection
 *
 * This script tests your Circle API credentials
 * Run with: npx tsx scripts/test-circle-api.ts
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testCircleAPI() {
  console.log('\n🧪 Testing Circle API Connection\n');

  const apiKey = process.env.CIRCLE_SDK_API_KEY || process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  console.log('API Key:', apiKey?.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret?.substring(0, 20) + '...\n');

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
  }

  try {
    console.log('Step 1: Initializing Circle client...');
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log('✅ Client initialized\n');

    console.log('Step 2: Getting public key...');
    const publicKeyResponse = await client.getPublicKey();
    console.log('✅ Public key retrieved:', JSON.stringify(publicKeyResponse, null, 2));
    console.log('');

    console.log('Step 3: Listing wallets...');
    const walletsResponse = await client.listWallets({});
    console.log('✅ Wallets listed:', JSON.stringify(walletsResponse, null, 2));
    console.log('');

    console.log('✅ All tests passed! Your Circle API is configured correctly.\n');
  } catch (error: any) {
    console.error('❌ Error testing Circle API:\n');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Error Message:', error.message);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('\n');

    if (error.response?.status === 401) {
      console.error('🔑 Authentication Error (401):');
      console.error('   Your API key or entity secret is invalid or not authorized.');
      console.error('');
      console.error('   To fix this:');
      console.error('   1. Go to https://console.circle.com/');
      console.error('   2. Log in or create an account');
      console.error('   3. Navigate to "API Keys" or "Developer Settings"');
      console.error('   4. Generate a new API key for developer-controlled wallets');
      console.error('   5. Update CIRCLE_SDK_API_KEY in .env.local with the new key');
      console.error('');
      console.error('   Note: TEST_CLIENT_KEY is likely a placeholder, not a real key.\n');
    }

    process.exit(1);
  }
}

testCircleAPI();
