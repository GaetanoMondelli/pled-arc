/**
 * Generate NEW wallets for DAO members (using simple crypto)
 */

const crypto = require('crypto');

function generateWallet() {
  const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
  // Simple address generation (for demo - in production use proper derivation)
  const address = '0x' + crypto.randomBytes(20).toString('hex');
  return { privateKey, address };
}

const MEMBERS = [
  { name: 'Michael Burry', role: 'CFO', network: 'arc-testnet', shares: 33.33 },
  { name: 'Cathie Wood', role: 'CTO', network: 'arc-testnet', shares: 33.33 },
  { name: 'Ray Dalio', role: 'CEO', network: 'ethereum-sepolia', shares: 33.34 }
];

console.log('🏦 Generating NEW Gateway wallets for DAO members...\n');

const wallets = MEMBERS.map(member => {
  const wallet = generateWallet();
  console.log(`✅ ${member.name} (${member.role})`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Network: ${member.network}`);
  console.log(`   Shares: ${member.shares}%`);
  console.log('');

  return {
    ...member,
    ...wallet,
    type: 'member',
    isGateway: true,
    excludeFromTreasury: true
  };
});

// Save
const fs = require('fs');
fs.writeFileSync('./dao-member-wallets.json', JSON.stringify(wallets, null, 2));

console.log('💾 Saved to: dao-member-wallets.json');
console.log('\n📊 When redeeming claim "claim-1763259409294-1v8grf" (0.15 USDC):');
wallets.forEach(w => {
  const amount = (0.15 * w.shares / 100).toFixed(4);
  console.log(`   ${w.name}: ${amount} USDC (${w.shares}%)`);
});

console.log('\n✅ These wallets are:');
console.log('   - NOT in treasury overview');
console.log('   - Using Gateway (unified balance)');
console.log('   - Separate from officer wallets');
