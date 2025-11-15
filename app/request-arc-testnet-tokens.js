/**
 * Request Arc testnet tokens using Circle SDK Faucet API
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function requestArcTokens() {
  console.log('\n💧 Requesting Arc Testnet Tokens via Circle Faucet API\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing CIRCLE_API_KEY');
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
  });

  // Get Arc testnet wallet
  const wallets = await client.listWallets({});
  const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

  if (!arcWallet) {
    throw new Error('No Arc testnet wallet found!');
  }

  console.log(`Found Arc testnet wallet: ${arcWallet.address}\n`);

  // Request tokens via faucet API
  console.log('Requesting tokens from Circle faucet...\n');

  try {
    const response = await axios.post(
      'https://api.circle.com/v1/w3s/faucet/drips',
      {
        address: arcWallet.address,
        blockchain: 'ARC-TESTNET',
        native: true,
        usdc: true,
        eurc: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Faucet request successful!\n');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Faucet request failed:\n');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

requestArcTokens().catch(console.error);
