import { NextRequest, NextResponse } from 'next/server';
import {
  initializeShares,
  updateShares,
  distributeProfits,
  paySalary,
  payBonus,
  usdcToWei,
} from '@/lib/services/treasury-contract-service';

/**
 * POST /api/treasury/execute
 * Execute treasury contract functions
 *
 * Body:
 * {
 *   action: 'initializeShares' | 'updateShares' | 'distributeProfits' | 'paySalary' | 'payBonus',
 *   contractAddress?: string,
 *   // For initializeShares:
 *   officers?: string[],
 *   shares?: number[],
 *   // For updateShares:
 *   address?: string,
 *   newShares?: number,
 *   // For distributeProfits:
 *   amount?: number, // USDC amount (will be converted to wei)
 *   documentHash?: string,
 *   // For paySalary:
 *   // address, amount, documentHash
 *   // For payBonus:
 *   // address, amount, reason, documentHash
 *   reason?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      contractAddress,
      officers,
      shares,
      address,
      newShares,
      amount,
      documentHash,
      reason,
    } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      );
    }

    let transactionId: string;

    switch (action) {
      case 'initializeShares': {
        if (!officers || !shares) {
          return NextResponse.json(
            { success: false, error: 'officers and shares arrays required' },
            { status: 400 }
          );
        }

        if (officers.length !== shares.length) {
          return NextResponse.json(
            { success: false, error: 'officers and shares arrays must have same length' },
            { status: 400 }
          );
        }

        transactionId = await initializeShares(officers, shares, contractAddress);

        return NextResponse.json({
          success: true,
          message: 'Shares initialization transaction submitted',
          data: {
            transactionId,
            officers,
            shares,
            totalShares: shares.reduce((sum, s) => sum + s, 0),
          },
        });
      }

      case 'updateShares': {
        if (!address || newShares === undefined) {
          return NextResponse.json(
            { success: false, error: 'address and newShares required' },
            { status: 400 }
          );
        }

        transactionId = await updateShares(address, newShares, contractAddress);

        return NextResponse.json({
          success: true,
          message: 'Shares update transaction submitted',
          data: {
            transactionId,
            officer: address,
            newShares,
          },
        });
      }

      case 'distributeProfits': {
        if (!amount || !documentHash) {
          return NextResponse.json(
            { success: false, error: 'amount and documentHash required' },
            { status: 400 }
          );
        }

        const amountWei = usdcToWei(amount);
        transactionId = await distributeProfits(amountWei, documentHash, contractAddress);

        return NextResponse.json({
          success: true,
          message: 'Profit distribution transaction submitted',
          data: {
            transactionId,
            amountUsdc: amount,
            amountWei,
            documentHash,
          },
        });
      }

      case 'paySalary': {
        if (!address || !amount || !documentHash) {
          return NextResponse.json(
            { success: false, error: 'address, amount, and documentHash required' },
            { status: 400 }
          );
        }

        const amountWei = usdcToWei(amount);
        transactionId = await paySalary(address, amountWei, documentHash, contractAddress);

        return NextResponse.json({
          success: true,
          message: 'Salary payment transaction submitted',
          data: {
            transactionId,
            officer: address,
            amountUsdc: amount,
            amountWei,
            documentHash,
          },
        });
      }

      case 'payBonus': {
        if (!address || !amount || !reason || !documentHash) {
          return NextResponse.json(
            { success: false, error: 'address, amount, reason, and documentHash required' },
            { status: 400 }
          );
        }

        const amountWei = usdcToWei(amount);
        transactionId = await payBonus(address, amountWei, reason, documentHash, contractAddress);

        return NextResponse.json({
          success: true,
          message: 'Bonus payment transaction submitted',
          data: {
            transactionId,
            officer: address,
            amountUsdc: amount,
            amountWei,
            reason,
            documentHash,
          },
        });
      }

      default: {
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
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
