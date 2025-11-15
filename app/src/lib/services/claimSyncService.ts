/**
 * Claim Sync Service
 *
 * Computes the sync status between local execution data and on-chain tokenized claims
 */

import { Claim } from '@/core/types/claims';

export interface ClaimSyncStatus {
  isTokenized: boolean;                  // Has this claim been minted on-chain?
  isSynced: boolean;                     // Is on-chain data up-to-date with local execution?
  ledgerEventsBehind: number;            // How many ledger events are not on-chain yet
  sinkEventsBehind: number;              // How many sink events are not on-chain yet
  canUpdate: boolean;                    // Can we call appendEvents()?
  blockExplorerUrl?: string;             // Link to view on block explorer
  statusText: string;                    // Human-readable status
  statusVariant: 'success' | 'warning' | 'default'; // UI color variant
}

/**
 * Computes sync status for a claim
 */
export function computeClaimSyncStatus(
  claim: Claim,
  localLedgerEventCount: number,
  localSinkEventCount: number
): ClaimSyncStatus {
  // Not tokenized yet
  if (!claim.tokenization?.onChain) {
    return {
      isTokenized: false,
      isSynced: false,
      ledgerEventsBehind: localLedgerEventCount,
      sinkEventsBehind: localSinkEventCount,
      canUpdate: false,
      statusText: 'Not Tokenized',
      statusVariant: 'default',
    };
  }

  const onChain = claim.tokenization.onChain;
  const ledgerBehind = localLedgerEventCount - onChain.onChainLedgerEventCount;
  const sinkBehind = localSinkEventCount - onChain.onChainSinkEventCount;

  const isSynced = ledgerBehind === 0 && sinkBehind === 0;
  const canUpdate = ledgerBehind > 0 || sinkBehind > 0;

  let statusText = '';
  let statusVariant: 'success' | 'warning' | 'default' = 'default';

  if (isSynced) {
    statusText = `✅ Synced (${localLedgerEventCount} events)`;
    statusVariant = 'success';
  } else {
    const totalBehind = ledgerBehind;
    statusText = `⚠️ ${totalBehind} event${totalBehind !== 1 ? 's' : ''} behind`;
    statusVariant = 'warning';
  }

  return {
    isTokenized: true,
    isSynced,
    ledgerEventsBehind: Math.max(0, ledgerBehind),
    sinkEventsBehind: Math.max(0, sinkBehind),
    canUpdate,
    blockExplorerUrl: onChain.blockExplorerUrl,
    statusText,
    statusVariant,
  };
}

/**
 * Generates block explorer URL for Arc Testnet
 */
export function getArcTestnetExplorerUrl(contractAddress: string, tokenId: string): string {
  return `https://testnet.arcscan.app/address/${contractAddress}`;
}

/**
 * Formats token info for display
 */
export function formatTokenInfo(claim: Claim): string | null {
  if (!claim.tokenization?.onChain) {
    return null;
  }

  const { blockchain, tokenId } = claim.tokenization.onChain;
  return `${blockchain.toUpperCase()} #${tokenId}`;
}
