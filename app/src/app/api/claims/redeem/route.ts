import { NextRequest, NextResponse } from 'next/server';

/**
 * Redeem a claim and distribute rewards to DAO members
 *
 * Flow:
 * 1. Verify claim exists and hasn't been redeemed
 * 2. Calculate distribution (0.15 USDC total, split proportionally)
 * 3. Transfer from treasury to each member wallet
 * 4. Mark claim as redeemed
 */

// DAO Members with their wallets
const DAO_MEMBERS = [
  {
    name: 'Michael Burry',
    address: '0x5a79daf48e3b02e62bdaf8554b50083617f4a359', // Arc Testnet
    network: 'arc-testnet',
    shares: 33.33
  },
  {
    name: 'Cathie Wood',
    address: '0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37', // Arc Testnet
    network: 'arc-testnet',
    shares: 33.33
  },
  {
    name: 'Ray Dalio',
    address: '0x24a316770d6cd962d775842c652371b8ff63f394', // Ethereum Sepolia
    network: 'ethereum-sepolia',
    shares: 33.34
  }
];

const TOTAL_REWARD = 0.15; // USDC

export async function POST(req: NextRequest) {
  try {
    const { claimId } = await req.json();

    console.log('💰 Redeeming claim:', claimId);

    // For now, only support the specific claim
    if (claimId !== 'claim-1763259409294-1v8grf') {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Calculate distribution
    const distributions = DAO_MEMBERS.map(member => ({
      ...member,
      amount: (TOTAL_REWARD * member.shares / 100).toFixed(4)
    }));

    console.log('\n📊 Distribution breakdown:');
    distributions.forEach(dist => {
      console.log(`   ${dist.name}: ${dist.amount} USDC (${dist.shares}%)`);
    });

    // TODO: Implement actual transfers from treasury
    // For now, just return the distribution plan

    const result = {
      claimId,
      totalReward: TOTAL_REWARD,
      distributions,
      timestamp: new Date().toISOString(),
      status: 'pending' // Change to 'completed' after actual transfers
    };

    console.log('\n✅ Claim redemption prepared');
    console.log('   Total to distribute:', TOTAL_REWARD, 'USDC');
    console.log('   Recipients:', DAO_MEMBERS.length);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error redeeming claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to redeem claim' },
      { status: 500 }
    );
  }
}
