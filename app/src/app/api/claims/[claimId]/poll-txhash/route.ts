import { NextRequest, NextResponse } from 'next/server';

/**
 * Poll for claim's blockchain transaction hash
 *
 * Frontend calls this endpoint every 15 seconds to check if txHash is available
 *
 * Usage: GET /api/claims/{claimId}/poll-txhash?circleTransactionId=xxx
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const { claimId } = params;
    const searchParams = request.nextUrl.searchParams;
    const circleTransactionId = searchParams.get('circleTransactionId');

    if (!circleTransactionId) {
      return NextResponse.json(
        { success: false, error: 'Missing circleTransactionId' },
        { status: 400 }
      );
    }

    console.log('🔍 [Poll TxHash] Checking status...');
    console.log('  Claim ID:', claimId);
    console.log('  Circle Transaction ID:', circleTransactionId);

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    // Get transaction status from Circle
    const response = await client.getTransaction({
      id: circleTransactionId,
    });

    const transaction = response.data?.transaction;
    const txHash = transaction?.txHash;
    const state = transaction?.state;

    console.log('  State:', state);
    console.log('  TxHash:', txHash || 'Still pending...');

    // If txHash is available, update the claim in storage
    if (txHash) {
      console.log('✅ [Poll TxHash] Transaction confirmed! Updating claim...');

      // TODO: Update your claim storage with the txHash
      // const { updateClaimWithTxHash } = await import('@/lib/services/updateClaimTxHash');
      // await updateClaimWithTxHash(claimId, circleTransactionId, txHash);

      return NextResponse.json({
        success: true,
        status: 'confirmed',
        txHash,
        state,
        explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`
      });
    }

    // Still pending
    return NextResponse.json({
      success: true,
      status: 'pending',
      state,
      message: 'Transaction is still being processed by Circle'
    });

  } catch (error: any) {
    console.error('[Poll TxHash] Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to poll transaction status'
      },
      { status: 500 }
    );
  }
}
