import { NextRequest, NextResponse } from 'next/server';

/**
 * Get Circle transaction status and txHash
 *
 * Simple polling endpoint - no webhooks needed!
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Missing transaction id' },
        { status: 400 }
      );
    }

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    console.log('🔍 [Circle SDK] Getting transaction status...');
    console.log('  Transaction ID:', transactionId);

    const response = await client.getTransaction({
      id: transactionId,
    });

    const transaction = response.data?.transaction;

    console.log('📋 [Circle SDK] Transaction status:');
    console.log('  State:', transaction?.state);
    console.log('  TxHash:', transaction?.txHash || 'Not yet available');

    return NextResponse.json({
      success: true,
      data: {
        id: transaction?.id,
        state: transaction?.state,
        txHash: transaction?.txHash,
        blockchain: transaction?.blockchain,
        createDate: transaction?.createDate,
        updateDate: transaction?.updateDate,
        operation: transaction?.operation,
        contractAddress: transaction?.contractAddress,
      }
    });

  } catch (error: any) {
    console.error('Circle get transaction error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to get transaction status',
        details: error?.response?.data
      },
      { status: error?.response?.status || 500 }
    );
  }
}
