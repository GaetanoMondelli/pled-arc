import { NextRequest, NextResponse } from 'next/server';

/**
 * Circle Webhook Handler
 *
 * Receives transaction notifications from Circle when:
 * - Transaction state changes (INITIATED → QUEUED → SENT → CONFIRMED → COMPLETE)
 * - txHash becomes available (usually at CONFIRMED state)
 *
 * Webhook payload structure:
 * {
 *   subscriptionId: string,
 *   notificationId: string,
 *   notificationType: string, // e.g., "transactions.outbound"
 *   version: number,
 *   transaction: {
 *     id: string,
 *     state: string,
 *     txHash?: string,  // Available when state is CONFIRMED or later
 *     blockchain: string,
 *     operation: string,
 *     ...
 *   }
 * }
 */

// POST - Receive webhook notifications from Circle
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log('🔔 [Circle Webhook] Received notification');
    console.log('  Type:', payload.notificationType);
    console.log('  Transaction ID:', payload.transaction?.id);
    console.log('  State:', payload.transaction?.state);
    console.log('  TxHash:', payload.transaction?.txHash || 'Not yet available');
    console.log('  Full payload:', JSON.stringify(payload, null, 2));

    const { transaction } = payload;

    // If this is a contract execution transaction with a txHash
    if (transaction?.operation === 'CONTRACT_EXECUTION' && transaction?.txHash) {
      console.log('✅ [Circle Webhook] Contract execution transaction confirmed!');
      console.log('  Transaction Hash:', transaction.txHash);
      console.log('  Contract Address:', transaction.contractAddress);
      console.log('  Blockchain:', transaction.blockchain);

      // TODO: Update your database/storage with the txHash
      // For claim tokenization, you would:
      // 1. Look up the claim by Circle transaction ID
      // 2. Update the claim record with the blockchain txHash
      // 3. Optionally notify the user that their claim is now on-chain

      // Example:
      // await updateClaimWithTxHash(transaction.id, transaction.txHash);
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ [Circle Webhook] Error processing webhook:', error.message);

    // Still return 200 to prevent Circle from retrying
    return NextResponse.json({
      received: true,
      error: error.message
    });
  }
}

// HEAD - Circle will ping this endpoint to verify it's reachable
export async function HEAD(request: NextRequest) {
  console.log('🏓 [Circle Webhook] Health check received');
  return new NextResponse(null, { status: 200 });
}
