import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOfficersFromChain,
  getOfficerInfo,
  getTotalShares,
  getTreasuryBalance,
  getPaymentCount,
  formatPercentage,
  weiToUsdc,
} from '@/lib/services/treasury-contract-service';

/**
 * GET /api/treasury
 * Get treasury state from blockchain
 *
 * Query params:
 * - action: 'officers' | 'officer' | 'balance' | 'totalShares' | 'paymentCount'
 * - address: officer address (required if action=officer)
 * - contractAddress: treasury contract address (optional, uses env var by default)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'officers';
    const address = searchParams.get('address');
    const contractAddress = searchParams.get('contractAddress');

    switch (action) {
      case 'officers': {
        const officers = await getAllOfficersFromChain(contractAddress || undefined);

        // Format response with human-readable percentages
        const formatted = officers.map(o => ({
          address: o.address,
          shares: o.shares,
          percentage: o.percentage, // Basis points
          percentageFormatted: formatPercentage(o.percentage),
        }));

        return NextResponse.json({
          success: true,
          data: {
            officers: formatted,
            count: formatted.length,
          },
        });
      }

      case 'officer': {
        if (!address) {
          return NextResponse.json(
            { success: false, error: 'address parameter required' },
            { status: 400 }
          );
        }

        const info = await getOfficerInfo(address, contractAddress || undefined);

        return NextResponse.json({
          success: true,
          data: {
            address,
            shares: info.shares,
            percentage: info.percentage,
            percentageFormatted: formatPercentage(info.percentage),
          },
        });
      }

      case 'totalShares': {
        const totalShares = await getTotalShares(contractAddress || undefined);

        return NextResponse.json({
          success: true,
          data: { totalShares },
        });
      }

      case 'balance': {
        const balanceWei = await getTreasuryBalance(contractAddress || undefined);
        const balanceUsdc = weiToUsdc(balanceWei);

        return NextResponse.json({
          success: true,
          data: {
            balanceWei,
            balanceUsdc,
            formatted: `${balanceUsdc.toLocaleString()} USDC`,
          },
        });
      }

      case 'paymentCount': {
        const count = await getPaymentCount(contractAddress || undefined);

        return NextResponse.json({
          success: true,
          data: { paymentCount: count },
        });
      }

      default: {
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Error reading treasury state:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read treasury state',
      },
      { status: 500 }
    );
  }
}
