/**
 * Test Circle wallet balance API
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testBalance() {
  console.log('\n🔍 Testing Circle Wallet Balance API\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
    process.exit(1);
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // First get the list of wallets
  console.log('1️⃣  Fetching wallets...\n');
  const walletsResponse = await client.listWallets({});
  const wallets = walletsResponse.data?.wallets || [];

  console.log(`Found ${wallets.length} wallet(s)\n`);

  if (wallets.length === 0) {
    console.log('⚠️  No wallets found. Create a wallet first.');
    return;
  }

  // Test balance for each wallet
  for (const wallet of wallets) {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Wallet: ${wallet.address}`);
    console.log(`ID: ${wallet.id}`);
    console.log(`Blockchain: ${wallet.blockchain}`);
    console.log('═══════════════════════════════════════════════════════\n');

    try {
      console.log('📡 Calling getWalletTokenBalance()...\n');

      const balanceResponse = await client.getWalletTokenBalance({
        id: wallet.id,
      });

      console.log('RAW RESPONSE:');
      console.log(JSON.stringify(balanceResponse, null, 2));
      console.log('\n');

      const tokenBalances = balanceResponse.data?.tokenBalances;

      if (tokenBalances && tokenBalances.length > 0) {
        console.log(`✅ Found ${tokenBalances.length} token balance(s):\n`);
        tokenBalances.forEach((balance) => {
          const amount = parseFloat(balance.amount) / Math.pow(10, balance.token.decimals);
          console.log(`   ${amount.toFixed(4)} ${balance.token.symbol} (${balance.token.name})`);
        });
      } else {
        console.log('⚠️  No token balances found for this wallet');
        console.log('   This could mean:');
        console.log('   - The wallet has no tokens yet');
        console.log('   - Tokens from faucet are still pending');
        console.log('   - Need to use a different API method');
      }
      console.log('\n');
    } catch (error) {
      console.error('❌ Error fetching balance:', error.message);
      console.error('Full error:', error);
      console.log('\n');
    }
  }
}

testBalance().catch(console.error);
