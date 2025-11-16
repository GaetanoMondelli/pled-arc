/**
 * Create Gateway wallets for DAO members
 *
 * These are NEW wallets (not the existing officer wallets)
 * Using Gateway for unified USDC balance across chains
 */

const { ethers } = require('ethers');

const MEMBERS = [
  { name: 'Michael Burry', role: 'CFO', network: 'arc-testnet' },
  { name: 'Cathie Wood', role: 'CTO', network: 'arc-testnet' },
  { name: 'Ray Dalio', role: 'CEO', network: 'ethereum-sepolia' }
];

async function createMemberWallets() {
  console.log('🏦 Creating NEW Gateway wallets for DAO members...\n');

  const wallets = [];

  for (const member of MEMBERS) {
    // Create new random wallet
    const wallet = ethers.Wallet.createRandom();

    console.log(`✅ Created wallet for ${member.name}`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Network: ${member.network}`);
    console.log(`   Role: ${member.role}`);
    console.log(`   Private Key: ${wallet.privateKey}`);
    console.log('');

    wallets.push({
      name: member.name,
      role: member.role,
      address: wallet.address,
      privateKey: wallet.privateKey,
      network: member.network,
      shares: member.name === 'Ray Dalio' ? 33.34 : 33.33, // Equal split with rounding
      type: 'member',
      isGateway: true,
      excludeFromTreasury: true
    });
  }

  // Save to file
  const fs = require('fs');
  const outputPath = './dao-member-wallets.json';
  fs.writeFileSync(outputPath, JSON.stringify(wallets, null, 2));

  console.log('💾 Saved member wallets to:', outputPath);
  console.log('\n📊 Distribution when redeeming claim (0.15 USDC total):');
  wallets.forEach(w => {
    const amount = (0.15 * w.shares / 100).toFixed(4);
    console.log(`   ${w.name}: ${amount} USDC (${w.shares}%)`);
  });

  console.log('\n⚠️  IMPORTANT: Save these private keys securely!');
  console.log('   These wallets are NOT in the treasury view.');
  console.log('   They use Gateway for unified USDC balance.');

  return wallets;
}

createMemberWallets();
