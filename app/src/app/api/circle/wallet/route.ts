import { NextRequest, NextResponse } from 'next/server';
import { getCirclePublicKey, listWallets, createWallet } from '@/lib/circle-wallet';

// GET - List all wallets or get public key
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    if (action === 'publicKey') {
      const publicKey = await client.getPublicKey();
      return NextResponse.json({ success: true, data: publicKey.data });
    }

    // Default: list all wallets and get their token balances individually
    const walletsList = await client.listWallets({});
    const wallets = walletsList.data?.wallets || [];

    // Fetch token balances for each wallet individually
    const walletsWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        try {
          const balanceResponse = await client.getWalletTokenBalance({
            id: wallet.id
          });

          return {
            ...wallet,
            tokenBalances: balanceResponse.data?.tokenBalances || []
          };
        } catch (err) {
          console.error(`Error fetching balance for wallet ${wallet.id}:`, err.message);
          return {
            ...wallet,
            tokenBalances: []
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: { wallets: walletsWithBalances }
    });
  } catch (error: any) {
    console.error('Circle wallet API error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch wallet data',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
      },
      { status: error?.response?.status || 500 }
    );
  }
}

// POST - Create a new wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blockchains, count } = body;

    // Use the SDK's createWallets method which handles entity secret automatically
    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    // First create a wallet set
    const walletSet = await client.createWalletSet({
      name: `Wallet Set ${Date.now()}`,
    });

    if (!walletSet.data?.walletSet?.id) {
      throw new Error('Failed to create wallet set');
    }

    // Then create wallets in that set
    const wallets = await client.createWallets({
      blockchains: blockchains || ['ETH-SEPOLIA'],
      count: count || 1,
      walletSetId: walletSet.data.walletSet.id,
    });

    return NextResponse.json({ success: true, data: wallets });
  } catch (error: any) {
    console.error('Circle wallet creation error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to create wallet',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data
      },
      { status: error?.response?.status || 500 }
    );
  }
}
