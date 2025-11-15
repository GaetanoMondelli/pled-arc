/**
 * Transfer USDC from Circle wallet to deployment wallet for gas fees
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function transferUsdcForGas() {
  console.log('\n💸 Transferring USDC for Gas Fees\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  const DEPLOYMENT_WALLET = '0x431a68dB42869B7f79EC290dcE505E879bE9794A';
  const AMOUNT = '5'; // 5 USDC for gas (enough for deployment)

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  // Find Arc wallet with enough USDC
  console.log('1️⃣  Finding Arc wallet with enough USDC...\n');
  const wallets = await client.listWallets({});
  
  let bestWallet = null;
  let maxBalance = 0;
  
  for (const wallet of wallets.data?.wallets || []) {
    if (wallet.blockchain === 'ARC-TESTNET') {
      const balanceResponse = await client.getWalletTokenBalance({ id: wallet.id });
      const usdcBalance = balanceResponse.data?.tokenBalances?.find(b => 
        b.token.symbol === 'USDC-TESTNET' || b.token.symbol === 'USDC'
      );
      
      if (usdcBalance) {
        const balance = parseFloat(usdcBalance.amount);
        console.log(`   Wallet ${wallet.address}: ${balance} USDC`);
        if (balance > maxBalance) {
          maxBalance = balance;
          bestWallet = wallet;
        }
      }
    }
  }
  
  if (!bestWallet || maxBalance < parseFloat(AMOUNT)) {
    throw new Error(`Need at least ${AMOUNT} USDC but found ${maxBalance} USDC`);
  }
  
  console.log(`\n✅ Using wallet with ${maxBalance} USDC`);
  console.log(`   Address: ${bestWallet.address}\n`);
  
  // Generate ciphertext
  console.log('2️⃣  Generating entity secret ciphertext...\n');
  const ciphertext = await client.generateEntitySecretCiphertext();
  
  // Transfer USDC using tokenAddress for Arc
  console.log(`3️⃣  Transferring ${AMOUNT} USDC to deployment wallet...\n`);
  
  const transaction = await client.createTransaction({
    amounts: [AMOUNT],
    destinationAddress: DEPLOYMENT_WALLET,
    blockchain: 'ARC-TESTNET',
    tokenAddress: '0x3600000000000000000000000000000000000000', // USDC on Arc
    walletId: bestWallet.id,
    fee: {
      type: 'level',
      config: {
        feeLevel: 'MEDIUM'
      }
    },
    idempotencyKey: crypto.randomUUID(),
    entitySecretCiphertext: ciphertext
  });
  
  console.log('✅ Transfer initiated!\n');
  console.log('Transaction ID:', transaction.data?.id);
  console.log('Status:', transaction.data?.state);
  console.log('\n💡 Wait 30-60 seconds for confirmation, then run:');
  console.log('   node deploy-counter-hardhat-arc.js\n');
  
  return transaction.data;
}

transferUsdcForGas().catch(console.error);
