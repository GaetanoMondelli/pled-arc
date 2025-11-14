/**
 * Test Circle SDK with CLIENT KEY after entity secret registration
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function test() {
  console.log('\n🧪 Testing Circle SDK with Client Key\n');

  const clientKey = process.env.CIRCLE_SDK_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  console.log('Client Key:', clientKey?.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret?.substring(0, 20) + '...\n');

  try {
    console.log('Step 1: Initializing client with CLIENT KEY...');
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: clientKey!,
      entitySecret: entitySecret!,
    });
    console.log('✅ Client initialized\n');

    console.log('Step 2: Listing wallets...');
    const wallets = await client.listWallets({});
    console.log('✅ SUCCESS! Wallets:', JSON.stringify(wallets.data, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
  }
}

test();
