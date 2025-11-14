import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// POST - Execute smart contract function
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, contractAddress, abiFunctionSignature, abiParameters } = body;

    if (!walletId || !contractAddress || !abiFunctionSignature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    // Generate entity secret ciphertext for signing
    const ciphertext = await client.generateEntitySecretCiphertext();

    // Execute contract transaction
    const transaction = await client.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters: abiParameters || [],
      feeLevel: 'MEDIUM',
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext
    });

    return NextResponse.json({
      success: true,
      data: transaction.data
    });

  } catch (error: any) {
    console.error('Circle contract execution error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to execute contract',
        details: error?.response?.data
      },
      { status: error?.response?.status || 500 }
    );
  }
}
