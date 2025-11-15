import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOfficersFromChain,
  getOfficerInfo,
  getTotalShares,
  getTreasuryBalance,
  getPaymentCount,
  formatPercentage,
  weiToUsdc,
  distributeProfits,
} from '@/lib/services/treasury-contract-service';
import { createHash } from 'crypto';

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

/**
 * POST /api/treasury
 * Execute treasury actions (distribute profits, pay salaries, etc.)
 *
 * Body:
 * - action: 'distribute' | 'salary'
 * - amount: amount in USDC (string)
 * - claimId: claim ID for tracking
 * - claimTitle: claim title for document hash
 * - contractAddress: optional contract address
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, amount, claimId, claimTitle, contractAddress } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action parameter required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'distribute': {
        if (!amount) {
          return NextResponse.json(
            { success: false, error: 'amount parameter required' },
            { status: 400 }
          );
        }

        // Convert USDC amount to wei (18 decimals)
        const amountInUsdc = parseFloat(amount);
        if (isNaN(amountInUsdc) || amountInUsdc <= 0) {
          return NextResponse.json(
            { success: false, error: 'Invalid amount' },
            { status: 400 }
          );
        }

        // Convert to wei (multiply by 10^18)
        const amountInWei = (BigInt(Math.floor(amountInUsdc * 1e6)) * BigInt(10 ** 12)).toString();

        // Create document hash from claim info
        const documentData = `claim:${claimId || 'unknown'}:${claimTitle || 'profit-distribution'}:${Date.now()}`;
        const documentHash = '0x' + createHash('sha256').update(documentData).digest('hex');

        console.log(`🏦 Distributing profits: ${amountInUsdc} USDC (${amountInWei} wei)`);
        console.log(`📝 Document hash: ${documentHash}`);

        // Execute distribution
        const transactionId = await distributeProfits(
          amountInWei,
          documentHash,
          contractAddress || undefined
        );

        console.log(`✅ Distribution initiated. Transaction ID: ${transactionId}`);

        return NextResponse.json({
          success: true,
          data: {
            txHash: transactionId,
            amount: amountInUsdc,
            amountWei: amountInWei,
            documentHash,
            claimId,
          },
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
    console.error('Error executing treasury action:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute treasury action',
      },
      { status: 500 }
    );
  }
}
