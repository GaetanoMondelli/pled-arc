/**
 * Create member wallets for DAO shareholders
 *
 * Creates 3 wallets:
 * - Michael Burry (Arc Testnet)
 * - Cathie Wood (Arc Testnet)
 * - Ray Dalio (Ethereum Sepolia)
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const MEMBERS = [
  {
    name: 'Michael Burry',
    network: 'arc-testnet',
    role: 'CFO'
  },
  {
    name: 'Cathie Wood',
    network: 'arc-testnet',
    role: 'CTO'
  },
  {
    name: 'Ray Dalio',
    network: 'ethereum-sepolia',
    role: 'CEO'
  }
];

async function createMemberWallets() {
  console.log('🏦 Creating member wallets for DAO shareholders...\n');

  const wallets = [];

  for (const member of MEMBERS) {
    console.log(`Creating wallet for ${member.name} on ${member.network}...`);

    try {
      const response = await fetch(`${BASE_URL}/api/gateway/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: member.network,
          metadata: {
            owner: member.name,
            role: member.role,
            type: 'member',
            daoMember: true
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Created wallet for ${member.name}`);
        console.log(`   Address: ${result.address}`);
        console.log(`   Network: ${member.network}`);

        wallets.push({
          ...member,
          address: result.address,
          walletId: result.walletId
        });
      } else {
        console.error(`❌ Failed to create wallet for ${member.name}:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error creating wallet for ${member.name}:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Member wallets created:\n');
  console.log(JSON.stringify(wallets, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('./member-wallets.json', JSON.stringify(wallets, null, 2));
  console.log('\n💾 Saved to: member-wallets.json');

  return wallets;
}

createMemberWallets();
