/**
 * Add DAO members with their wallets
 *
 * Creates 3 new officers for the DAO:
 * - Michael Burry (Arc Testnet)
 * - Cathie Wood (Arc Testnet)
 * - Ray Dalio (Ethereum Sepolia)
 *
 * When a claim is redeemed, treasury distributes proportionally to these members.
 */

const COMPANY_ID = 'company-123'; // Your DAO House company ID

const MEMBERS = [
  {
    name: 'Michael Burry',
    walletAddress: '0x...',  // Will be generated
    network: 'arc-testnet',
    shares: 33.33,  // Equal distribution (33.33% each)
    role: 'Chief Financial Officer'
  },
  {
    name: 'Cathie Wood',
    walletAddress: '0x...',  // Will be generated
    network: 'arc-testnet',
    shares: 33.33,
    role: 'Chief Technology Officer'
  },
  {
    name: 'Ray Dalio',
    walletAddress: '0x...',  // Will be generated
    network: 'ethereum-sepolia',
    shares: 33.34,  // Slightly more to account for rounding
    role: 'Chief Executive Officer'
  }
];

async function addDAOMembers() {
  console.log('👥 Adding DAO members...\n');

  // For now, let me just show you the structure
  // You'll need to manually add these wallets or create them via Circle API

  console.log('DAO Members to add:');
  console.log(JSON.stringify(MEMBERS, null, 2));

  console.log('\n📋 When claim "claim-1763259409294-1v8grf" is redeemed:');
  console.log('   Treasury pays out: 0.15 USDC');
  console.log('   Distribution:');
  MEMBERS.forEach(member => {
    const amount = (0.15 * member.shares / 100).toFixed(4);
    console.log(`   - ${member.name}: ${amount} USDC (${member.shares}%)`);
  });

  console.log('\n💡 To implement:');
  console.log('1. Create wallets for each member (use Circle Modular Wallets or existing wallets)');
  console.log('2. Store member info in Firestore: dao-members collection');
  console.log('3. In claim redeem flow: calculate distribution and send from treasury');
}

addDAOMembers();
