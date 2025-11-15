/**
 * Setup monitored tokens so Circle tracks USDC balances
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function setupMonitoredTokens() {
  console.log('\n🔧 Setting up monitored tokens\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  try {
    // Check current monitoring scope
    console.log('1️⃣  Checking current monitored tokens...\n');

    try {
      const currentTokens = await client.listMonitoredTokens();
      console.log('Current monitored tokens:', JSON.stringify(currentTokens.data, null, 2));
    } catch (error) {
      console.log('No monitored tokens yet or error:', error.message);
    }

    // Update to monitor ALL tokens
    console.log('\n2️⃣  Setting monitoring scope to MONITOR_ALL...\n');

    const updateResult = await client.updateMonitoredTokensScope({
      scope: 'MONITOR_ALL'
    });

    console.log('✅ Monitoring scope updated!');
    console.log('Result:', JSON.stringify(updateResult.data, null, 2));

    console.log('\n3️⃣  Waiting a few seconds for Circle to index balances...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Now check balances again
    console.log('4️⃣  Checking wallet balances after monitoring setup...\n');

    const balances = await client.getWalletsWithBalances({
      blockchain: 'ETH-SEPOLIA'
    });

    if (balances.data?.wallets) {
      balances.data.wallets.forEach(wallet => {
        console.log(`Wallet: ${wallet.address}`);
        if (wallet.tokenBalances) {
          wallet.tokenBalances.forEach(balance => {
            const amount = parseFloat(balance.amount) / Math.pow(10, balance.token.decimals);
            console.log(`  ${amount} ${balance.token.symbol}`);
          });
        }
        console.log('');
      });
    }

    console.log('\n✅ Done! Refresh your app to see USDC balances.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.statusText);
      console.error('Data:', error.response.data);
    }
  }
}

setupMonitoredTokens().catch(console.error);
