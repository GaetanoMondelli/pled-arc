/**
 * Test Circle SDK with API KEY after entity secret registration
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function test() {
  console.log('\n🧪 Testing Circle SDK with API Key (after registration)\n');

  const apiKey = process.env.CIRCLE_API_KEY; // Use API Key, not Client Key!
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  console.log('API Key:', apiKey?.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret?.substring(0, 20) + '...\n');

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }

  try {
    console.log('Step 1: Initializing client with API KEY...');
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log('✅ Client initialized\n');

    console.log('Step 2: Listing wallets...');
    const wallets = await client.listWallets({});
    console.log('✅ SUCCESS! Wallets listed:', JSON.stringify(wallets.data, null, 2));
    console.log('');

    console.log('Step 3: Creating a wallet set...');
    const walletSet = await client.createWalletSet({
      name: 'My First Wallet Set',
    });
    console.log('✅ Wallet Set created:', walletSet.data?.walletSet);
    console.log('');

    console.log('Step 4: Creating wallets...');
    const newWallets = await client.createWallets({
      blockchains: ['ETH-SEPOLIA'],
      count: 1,
      walletSetId: walletSet.data?.walletSet?.id || '',
    });
    console.log('✅ Wallets created:', newWallets.data?.wallets);
    console.log('');

    console.log('🎉 ALL TESTS PASSED! Your Circle integration works!\n');
    console.log('Wallet Address:', newWallets.data?.wallets?.[0]?.address);
    console.log('\n💰 Get testnet funds at: https://sepoliafaucet.com/\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    process.exit(1);
  }
}

test();
