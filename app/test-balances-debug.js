/**
 * Debug Circle wallet balances to see actual SDK response
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugBalances() {
  console.log('\n🔍 DEBUGGING CIRCLE SDK BALANCES\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const blockchains = ['ETH-SEPOLIA', 'ARC-TESTNET'];

  for (const blockchain of blockchains) {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`BLOCKCHAIN: ${blockchain}`);
    console.log('═══════════════════════════════════════════════════════\n');

    try {
      console.log(`📡 Calling getWalletsWithBalances({ blockchain: "${blockchain}" })...\n`);

      const response = await client.getWalletsWithBalances({
        blockchain: blockchain
      });

      console.log('RAW RESPONSE DATA (not stringified - avoiding circular refs):');
      console.log('response.data exists?', !!response.data);
      console.log('response.data.wallets exists?', !!response.data?.wallets);
      console.log('response.data.wallets length:', response.data?.wallets?.length || 0);
      console.log('\n');

      const wallets = response.data?.wallets;

      if (wallets && wallets.length > 0) {
        console.log(`✅ Found ${wallets.length} wallet(s) on ${blockchain}\n`);

        wallets.forEach((wallet, idx) => {
          console.log(`  Wallet ${idx + 1}:`);
          console.log(`    Address: ${wallet.address}`);
          console.log(`    ID: ${wallet.id}`);
          console.log(`    Blockchain: ${wallet.blockchain}`);

          console.log('    Raw wallet object keys:', Object.keys(wallet).join(', '));

          if (wallet.tokenBalances) {
            console.log(`    Token Balances (${wallet.tokenBalances.length}):`);
            wallet.tokenBalances.forEach(balance => {
              console.log('      Balance object:', JSON.stringify(balance, null, 8));
              const amount = parseFloat(balance.amount) / Math.pow(10, balance.token.decimals);
              console.log(`      - ${amount.toFixed(6)} ${balance.token.symbol} (${balance.token.name})`);
              console.log(`        Raw amount: ${balance.amount}`);
              console.log(`        Decimals: ${balance.token.decimals}`);
            });
          } else {
            console.log(`    Token Balances: NOT PRESENT IN RESPONSE`);
            console.log(`    Has 'balance' property?`, 'balance' in wallet);
            console.log(`    Has 'balances' property?`, 'balances' in wallet);
          }
          console.log('');
        });
      } else {
        console.log(`⚠️  No wallets found on ${blockchain}`);
        console.log('   This might mean:');
        console.log('   - No wallets created on this blockchain yet');
        console.log('   - Wallets exist but getWalletsWithBalances filters them out');
      }
      console.log('\n');

    } catch (error) {
      console.error(`❌ Error fetching ${blockchain}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      console.log('\n');
    }
  }

  // Also try listWallets to see all wallets regardless of blockchain
  console.log('═══════════════════════════════════════════════════════');
  console.log('TESTING listWallets() (no blockchain filter)');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const allWallets = await client.listWallets({});
    console.log('RAW RESPONSE:');
    console.log(JSON.stringify(allWallets.data, null, 2));
    console.log('\n');

    if (allWallets.data?.wallets) {
      console.log(`Total wallets: ${allWallets.data.wallets.length}`);
      allWallets.data.wallets.forEach(w => {
        console.log(`  - ${w.address} (${w.blockchain})`);
      });
    }
  } catch (error) {
    console.error('Error listing all wallets:', error.message);
  }
}

debugBalances().catch(console.error);
