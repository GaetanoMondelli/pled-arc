/**
 * Poll Circle API for transaction status until txHash is available
 *
 * Much simpler than webhooks - just check every few seconds
 */

import { getCircleClient } from '../circle-wallet';

export async function waitForTxHash(
  circleTransactionId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
  }
): Promise<{ txHash: string; state: string } | null> {
  const maxAttempts = options?.maxAttempts || 20; // Max 20 attempts
  const intervalMs = options?.intervalMs || 3000; // Check every 3 seconds

  console.log('⏳ Waiting for transaction to be broadcast...');
  console.log('   Circle Transaction ID:', circleTransactionId);

  const client = getCircleClient();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   Attempt ${attempt}/${maxAttempts}...`);

    try {
      // Get transaction status from Circle
      const response = await client.getTransaction({
        id: circleTransactionId,
      });

      const transaction = response.data?.transaction;
      const txHash = transaction?.txHash;
      const state = transaction?.state;

      console.log(`   State: ${state}`);

      if (txHash) {
        console.log('✅ Transaction broadcast! TxHash:', txHash);
        return { txHash, state: state || 'UNKNOWN' };
      }

      // If transaction failed, stop polling
      if (state === 'FAILED' || state === 'DENIED' || state === 'CANCELLED') {
        console.error('❌ Transaction failed with state:', state);
        return null;
      }

      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

    } catch (error: any) {
      console.error('Error polling transaction:', error.message);
      // Continue polling even if there's an error
    }
  }

  console.warn('⚠️  Max attempts reached, txHash still not available');
  return null;
}
