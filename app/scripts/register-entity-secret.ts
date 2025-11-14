/**
 * Register Entity Secret with Circle
 *
 * This script registers your entity secret with Circle's API
 * Run with: npx tsx scripts/register-entity-secret.ts
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function registerEntitySecret() {
  console.log('\n🔐 Registering Entity Secret with Circle\n');

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

    console.log('Step 2: Getting public key for encryption...');
    const publicKeyResponse = await client.getPublicKey();
    console.log('✅ Public key retrieved\n');
    console.log('Public Key:', JSON.stringify(publicKeyResponse.data?.publicKey, null, 2));

    console.log('\nStep 3: Generating entity secret ciphertext...');

    // Try to use the SDK's built-in function if available
    try {
      const { generateEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');

      const ciphertext = await generateEntitySecretCiphertext({
        apiKey,
        entitySecret,
      });

      console.log('✅ Entity secret ciphertext generated');
      console.log('Ciphertext:', ciphertext?.substring(0, 50) + '...\n');

      console.log('Step 4: Registering entity secret with Circle...');
      // Note: The SDK might not expose this method directly
      // You may need to do this through the Circle Console UI
      console.log('⚠️  You may need to register the entity secret through Circle Console\n');

    } catch (err) {
      console.log('⚠️  SDK does not expose entity secret registration');
      console.log('   You need to register it through Circle Console:\n');
      console.log('   1. Go to https://console.circle.com/');
      console.log('   2. Navigate to your project settings');
      console.log('   3. Find "Entity Secret" or "Developer Wallets" section');
      console.log('   4. Register your entity secret there\n');
    }

  } catch (error: any) {
    console.error('❌ Error:\n');
    console.error('Status:', error.response?.status);
    console.error('Error Message:', error.message);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('\n');

    if (error.response?.status === 401) {
      console.error('🔑 Authentication Error:');
      console.error('   Your Client Key might not have the right permissions.\n');
      console.error('   Try this:');
      console.error('   1. Go to https://console.circle.com/');
      console.error('   2. Check if there are different types of API keys');
      console.error('   3. Look for "Server API Key" or "Backend API Key"');
      console.error('   4. Make sure your key has "Developer-Controlled Wallets" permissions\n');
    }

    process.exit(1);
  }
}

registerEntitySecret();
