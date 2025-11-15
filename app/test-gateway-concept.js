/**
 * Gateway Concept Demo
 * Shows how Gateway would work with your Circle wallets
 */

const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
require('dotenv').config({ path: '.env.local' });

async function demoGateway() {
  console.log('\n🌉 Circle Gateway Concept Demo\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  // Get your wallets
  const wallets = await client.listWallets({});
  const allWallets = wallets.data?.wallets || [];

  console.log('📊 Current Wallet Balances (WITHOUT Gateway):\n');

  let totalUSDC = 0;
  const balancesByChain = {};

  for (const wallet of allWallets) {
    try {
      const balanceResponse = await client.getWalletTokenBalance({ id: wallet.id });
      const balances = balanceResponse.data?.tokenBalances || [];

      const usdcBalance = balances.find(b =>
        b.token.symbol.includes('USDC') || b.token.name.includes('USDC')
      );

      if (usdcBalance) {
        const amount = parseFloat(usdcBalance.amount);
        totalUSDC += amount;

        if (!balancesByChain[wallet.blockchain]) {
          balancesByChain[wallet.blockchain] = 0;
        }
        balancesByChain[wallet.blockchain] += amount;

        console.log(`   ${wallet.blockchain}: ${amount.toFixed(2)} USDC`);
        console.log(`   Address: ${wallet.address}\n`);
      }
    } catch (error) {
      // Skip wallets with errors
    }
  }

  console.log('─────────────────────────────────────────────────────\n');
  console.log(`   Total USDC across all chains: ${totalUSDC.toFixed(2)} USDC\n`);
  console.log('═══════════════════════════════════════════════════════\n\n');

  console.log('🌉 WITH Circle Gateway:\n');
  console.log(`   Unified Balance: ${totalUSDC.toFixed(2)} USDC\n`);
  console.log('   ✅ Can spend on ANY chain instantly!\n');
  console.log('   Example scenarios:\n');

  const scenarios = [
    {
      action: 'Pay 5 USDC on Arc',
      available: totalUSDC >= 5,
      speed: '< 500ms',
      method: 'Gateway withdrawal'
    },
    {
      action: 'Pay 10 USDC on Ethereum',
      available: totalUSDC >= 10,
      speed: '< 500ms',
      method: 'Gateway withdrawal'
    },
    {
      action: 'Pay 3 USDC on Base',
      available: totalUSDC >= 3,
      speed: '< 500ms',
      method: 'Gateway withdrawal'
    }
  ];

  scenarios.forEach((scenario, i) => {
    const status = scenario.available ? '✅' : '❌';
    console.log(`   ${i + 1}. ${status} ${scenario.action}`);
    console.log(`      Speed: ${scenario.speed}`);
    console.log(`      Method: ${scenario.method}\n`);
  });

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('💡 How Gateway Would Work:\n');
  console.log('   1. DEPOSIT: Send USDC from each wallet → Gateway Wallet contracts');
  console.log(`      Total deposited: ${totalUSDC.toFixed(2)} USDC\n`);

  console.log('   2. UNIFIED BALANCE: Gateway pools all USDC together');
  console.log(`      Available everywhere: ${totalUSDC.toFixed(2)} USDC\n`);

  console.log('   3. WITHDRAW: Request on any chain instantly');
  console.log('      - Get attestation from Gateway API (<100ms)');
  console.log('      - Call Gateway Minter contract (<400ms)');
  console.log('      - Receive USDC on destination chain\n');

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('🎯 For Your Hackathon (Track 3 - Treasury Management):\n');
  console.log('   ✅ Consolidate treasury across chains');
  console.log('   ✅ Make instant cross-chain payments');
  console.log('   ✅ Automate treasury operations with smart contracts');
  console.log('   ✅ Build unified treasury dashboard\n');

  console.log('📚 Next Steps:\n');
  console.log('   1. Read: GATEWAY-GUIDE.md');
  console.log('   2. Get contract addresses from Circle docs');
  console.log('   3. Implement deposit/withdrawal functions');
  console.log('   4. Build demo treasury management system\n');

  console.log('═══════════════════════════════════════════════════════\n');
}

demoGateway().catch(console.error);
