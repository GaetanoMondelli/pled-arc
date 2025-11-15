import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/circle/transaction-status/[id]
 * Poll for Circle transaction status to get txHash
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    console.log(`🔍 [Circle SDK] Fetching transaction status: ${transactionId}`);

    // Get transaction details from Circle
    const transaction = await client.getTransaction({ id: transactionId });

    console.log('📦 [Circle Response]:', JSON.stringify(transaction.data, null, 2));

    // Extract transaction details
    const txData = transaction.data;
    const state = txData?.state; // INITIATED, PENDING_RISK_SCREENING, QUEUED, SENT, CONFIRMED, COMPLETE, FAILED, CANCELLED
    const txHash = txData?.txHash;
    const blockchain = txData?.blockchain;
    const blockHash = txData?.blockHash;
    const blockHeight = txData?.blockHeight;

    console.log(`📋 Transaction ${transactionId}:`);
    console.log('  State:', state);
    console.log('  TxHash:', txHash || 'Not available yet');
    console.log('  Blockchain:', blockchain);

    return NextResponse.json({
      success: true,
      data: {
        id: transactionId,
        state,
        txHash,
        blockchain,
        blockHash,
        blockHeight,
        isComplete: state === 'COMPLETE',
        isPending: ['INITIATED', 'PENDING_RISK_SCREENING', 'QUEUED', 'SENT'].includes(state || ''),
        isFailed: state === 'FAILED' || state === 'CANCELLED',
      }
    });

  } catch (error: any) {
    console.error('Error fetching transaction status:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch transaction status',
        details: error?.response?.data
      },
      { status: error?.response?.status || 500 }
    );
  }
}
