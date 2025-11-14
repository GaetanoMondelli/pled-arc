/**
 * Create ARC-TESTNET wallet
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function createArcWallet() {
  console.log('\n🚀 Creating ARC-TESTNET Wallet\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  try {
    // Create wallet set
    console.log('1️⃣  Creating wallet set...');
    const walletSet = await client.createWalletSet({
      name: `ARC Testnet Wallets ${Date.now()}`,
    });

    console.log('✅ Wallet set created:', walletSet.data?.walletSet?.id);

    // Create ARC-TESTNET wallet
    console.log('\n2️⃣  Creating ARC-TESTNET wallet...');
    const wallets = await client.createWallets({
      accountType: 'SCA',
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId: walletSet.data?.walletSet?.id,
    });

    console.log('\n✅ ARC-TESTNET wallet created!\n');
    const wallet = wallets.data?.wallets?.[0];

    if (wallet) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('Wallet Details:');
      console.log('═══════════════════════════════════════════════════════');
      console.log('Address:', wallet.address);
      console.log('ID:', wallet.id);
      console.log('Blockchain:', wallet.blockchain);
      console.log('State:', wallet.state);
      console.log('\n🎉 Now use this address in the ARC testnet faucet!');
      console.log('═══════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.statusText);
    }
  }
}

createArcWallet().catch(console.error);
