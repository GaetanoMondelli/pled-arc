import { NextRequest, NextResponse } from 'next/server';

// DELETE - Delete a wallet
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = params.id;

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    // Note: Circle API doesn't have a delete wallet endpoint
    // Wallets are permanent once created for security reasons
    // You can only update their state or archive them

    return NextResponse.json({
      success: false,
      error: 'Circle wallets cannot be deleted for security reasons. They remain in your account permanently.',
    }, { status: 400 });

  } catch (error: any) {
    console.error('Circle wallet deletion error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to delete wallet',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
      },
      { status: error?.response?.status || 500 }
    );
  }
}
