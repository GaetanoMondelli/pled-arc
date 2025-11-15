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

    console.log('🔐 [Circle SDK] Executing contract...');
    console.log('  Wallet ID:', walletId);
    console.log('  Contract:', contractAddress);
    console.log('  Function:', abiFunctionSignature);
    console.log('  Parameters:', JSON.stringify(abiParameters));

    // Execute contract transaction with proper fee structure
    const transaction = await client.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters: abiParameters || [],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      },
      idempotencyKey: crypto.randomUUID()
    });

    console.log('✅ [Circle SDK] Transaction created:', transaction.data?.id);
    console.log('  State:', transaction.data?.state);
    console.log('  TxHash:', transaction.data?.txHash || 'Pending...');
    console.log('  Full response:', JSON.stringify(transaction.data, null, 2));

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
