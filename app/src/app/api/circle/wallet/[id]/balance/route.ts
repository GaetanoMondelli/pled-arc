import { NextRequest, NextResponse } from 'next/server';

// GET - Get wallet balances
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: walletId } = await params;

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    const balances = await client.getWalletTokenBalance({
      id: walletId,
    });

    return NextResponse.json({ success: true, data: balances.data });
  } catch (error: any) {
    console.error('Circle wallet balance error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to get wallet balance',
      },
      { status: error?.response?.status || 500 }
    );
  }
}
