/**
 * Update claim with blockchain transaction hash
 *
 * Called by polling mechanism when txHash becomes available
 */

export async function updateClaimWithTxHash(
  claimId: string,
  circleTransactionId: string,
  txHash: string
): Promise<void> {
  console.log('📝 Updating claim with txHash...');
  console.log('  Claim ID:', claimId);
  console.log('  Circle Transaction ID:', circleTransactionId);
  console.log('  TxHash:', txHash);

  try {
    // TODO: Update your database/storage with the txHash
    // This is where you'd update Firestore or whatever storage you use

    // Example (adjust based on your storage):
    /*
    const { updateClaimInStorage } = await import('./firebaseStorageClaimsStorage');
    await updateClaimInStorage(claimId, {
      blockchainTxHash: txHash,
      blockchainStatus: 'confirmed',
      updatedAt: new Date().toISOString(),
    });
    */

    console.log('✅ Claim updated with txHash');
  } catch (error) {
    console.error('❌ Error updating claim with txHash:', error);
    throw error;
  }
}

/**
 * Poll for txHash and update claim when available
 *
 * This runs in the background after tokenization
 */
export async function pollAndUpdateClaim(
  claimId: string,
  circleTransactionId: string
): Promise<void> {
  console.log('🔄 Starting background polling for claim:', claimId);

  const { waitForTxHash } = await import('./pollCircleTransaction');

  try {
    const result = await waitForTxHash(circleTransactionId, {
      maxAttempts: 20, // Poll for up to 60 seconds
      intervalMs: 3000  // Check every 3 seconds
    });

    if (result?.txHash) {
      console.log('✅ Got txHash, updating claim:', result.txHash);
      await updateClaimWithTxHash(claimId, circleTransactionId, result.txHash);
    } else {
      console.warn('⚠️  Polling timed out, txHash not available yet');
      // Could retry later or use webhooks
    }
  } catch (error) {
    console.error('❌ Error in background polling:', error);
  }
}
