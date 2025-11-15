/**
 * Check ETH balance of wallets
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function checkEthBalances() {
  console.log('\n💰 Checking ETH Balances\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  // Get all wallets
  const wallets = await client.listWallets({});

  console.log('Wallets and their ETH balances:\n');

  for (const wallet of wallets.data?.wallets || []) {
    console.log(`\n${wallet.blockchain} Wallet:`);
    console.log(`  Address: ${wallet.address}`);

    try {
      // Get token balances
      const balanceResponse = await client.getWalletTokenBalance({
        id: wallet.id
      });

      const tokenBalances = balanceResponse.data?.tokenBalances || [];

      // Find native token (ETH for ETH-SEPOLIA)
      const nativeBalance = tokenBalances.find(b =>
        b.token.symbol === 'ETH' || b.token.name === 'Ethereum'
      );

      if (nativeBalance) {
        console.log(`  ETH Balance: ${parseFloat(nativeBalance.amount).toFixed(6)} ETH`);
      } else {
        console.log(`  ETH Balance: 0 ETH (or not found)`);
      }

      // Also show other tokens
      const otherTokens = tokenBalances.filter(b =>
        b.token.symbol !== 'ETH' && b.token.name !== 'Ethereum'
      );

      if (otherTokens.length > 0) {
        console.log('  Other tokens:');
        otherTokens.forEach(t => {
          console.log(`    - ${parseFloat(t.amount).toFixed(4)} ${t.token.symbol}`);
        });
      }
    } catch (err) {
      console.log(`  Error fetching balance: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n💡 To deploy contracts on Sepolia, you need ETH for gas fees.');
  console.log('Get testnet ETH from: https://sepoliafaucet.com/ or https://www.alchemy.com/faucets/ethereum-sepolia\n');
}

checkEthBalances().catch(console.error);
