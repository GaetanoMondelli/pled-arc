"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, ExternalLink, RefreshCw, AlertCircle, Upload } from "lucide-react";
import { Claim } from "@/core/types/claims";
import { getClaimMetadata, getClaimState, appendEventsOnChain } from "@/lib/services/claimContractService";
import { engineAPIService } from "@/lib/engine-api-service";

interface TokenizationStatusModalProps {
  claim: Claim | null;
  isOpen: boolean;
  onClose: () => void;
  localAggregatedValue?: any;
  onSyncComplete?: () => void;
}

interface OnChainMetadata {
  claimId: string;
  workflowId: string;
  executionId: string;
  aggregateValue: string;
  metadataUri: string;
  createdAt: bigint;
  lastUpdatedAt: bigint;
  owner: string;
}

interface OnChainState {
  ledgerRoot: string;
  ledgerEventCount: bigint;
  sinkRoot: string;
  sinkEventCount: bigint;
  aggregateValue: string;
}

export function TokenizationStatusModal({
  claim,
  isOpen,
  onClose,
  localAggregatedValue,
  onSyncComplete
}: TokenizationStatusModalProps) {
  const [metadata, setMetadata] = useState<OnChainMetadata | null>(null);
  const [state, setState] = useState<OnChainState | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenId = claim?.tokenization?.onChain?.tokenId;

  useEffect(() => {
    if (isOpen && tokenId) {
      loadOnChainData();
    }
  }, [isOpen, tokenId]);

  const loadOnChainData = async () => {
    if (!tokenId) return;

    setLoading(true);
    setError(null);

    try {
      const [metadataResult, stateResult] = await Promise.all([
        getClaimMetadata(BigInt(tokenId)),
        getClaimState(BigInt(tokenId))
      ]);

      setMetadata(metadataResult);
      setState(stateResult);
    } catch (err) {
      console.error('Error loading on-chain data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load on-chain data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToChain = async () => {
    if (!claim || !tokenId || !state) return;

    setSyncing(true);
    setError(null);

    try {
      console.log('🔄 Syncing claim to blockchain...');

      // Get wallet ID - either from claim or fetch from Circle
      let walletId = claim.tokenization?.onChain?.walletId;

      if (!walletId) {
        console.log('No walletId saved in claim, fetching Arc Testnet wallet...');

        // Fetch wallets from Circle API (same as TokenizeClaimModal)
        const walletsResponse = await fetch('/api/circle/wallet');
        const walletsResult = await walletsResponse.json();

        if (!walletsResult.success || !walletsResult.data?.wallets) {
          throw new Error('No Circle wallets available');
        }

        // Filter for Arc Testnet wallets
        const arcWallets = walletsResult.data.wallets.filter((w: any) => w.blockchain === 'ARC-TESTNET');

        if (!arcWallets || arcWallets.length === 0) {
          throw new Error('No Arc Testnet wallets available. Please create an Arc Testnet wallet first.');
        }

        // Use the first Arc Testnet wallet
        walletId = arcWallets[0].id;
        console.log(`Using Arc Testnet wallet: ${walletId}`);
      }

      // Get current aggregation data from execution engine
      const primarySink = claim.formula?.sinks?.[0];
      if (!primarySink || !claim.templateId || !claim.executionId) {
        throw new Error('Missing required claim data for sync');
      }

      const formulaType = claim.aggregationFormula?.type || 'latest';
      const aggregationData = await engineAPIService.getSinkAggregation(
        claim.templateId,
        claim.executionId,
        primarySink,
        formulaType,
        claim.aggregationFormula?.customExpression
      );

      // Calculate how many new events we have
      const onChainSinkCount = Number(state.sinkEventCount);
      const allEvents = aggregationData.events || [];
      const newSinkEvents = allEvents.slice(onChainSinkCount);

      if (newSinkEvents.length === 0) {
        console.log('ℹ️ No new events to append');
        setError('No new events to sync');
        return;
      }

      console.log(`📤 Appending ${newSinkEvents.length} new events to token ${tokenId}`);

      // For now, use same events for ledger and sink (simplified)
      const newLedgerEvents = newSinkEvents;

      // Append events on-chain
      const { txHash, transactionId } = await appendEventsOnChain({
        walletId,
        tokenId: BigInt(tokenId),
        newLedgerEvents,
        newSinkEvents,
        newAggregateValue: aggregationData.aggregatedValue,
      });

      console.log(`✅ Sync transaction submitted!`);
      console.log(`  Transaction ID: ${transactionId}`);
      console.log(`  Transaction Hash: ${txHash}`);

      // Update the claim in the database with the new on-chain aggregate value
      const newAggregateValueString = typeof aggregationData.aggregatedValue === 'string'
        ? aggregationData.aggregatedValue
        : JSON.stringify(aggregationData.aggregatedValue);

      // First fetch the current claim to get all fields
      const getResponse = await fetch(`/api/claims/${claim.id}`);
      const currentClaim = await getResponse.json();

      // Update only the tokenization.onChain fields
      const updatedClaim = {
        ...currentClaim,
        tokenization: {
          ...currentClaim.tokenization,
          onChain: {
            ...currentClaim.tokenization.onChain,
            onChainAggregateValue: newAggregateValueString,
            onChainSinkEventCount: Number(state.sinkEventCount) + newSinkEvents.length,
            lastOnChainUpdate: new Date().toISOString(),
          }
        }
      };

      const updateResponse = await fetch(`/api/claims/${claim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClaim),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Failed to update claim in database:', errorData);
      } else {
        console.log('✅ Claim updated in database with new on-chain value:', newAggregateValueString);
      }

      // Reload on-chain data to show updated state
      await loadOnChainData();

      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete();
      }

      console.log('✅ Claim synced successfully!');
    } catch (err) {
      console.error('❌ Error syncing claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync claim to blockchain');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!claim || !claim.tokenization?.onChain) {
    return null;
  }

  const onChain = claim.tokenization.onChain;
  const { blockchain, contractAddress, blockExplorerUrl } = onChain;

  // Compare local vs on-chain state
  const onChainEventCount = state ? Number(state.sinkEventCount) : null;
  const onChainAggValue = state?.aggregateValue;
  const localAggValue = localAggregatedValue !== undefined ? String(localAggregatedValue) : null;

  // Check if synced by comparing aggregate values
  const isSynced = onChainEventCount !== null && localAggValue !== null &&
                   onChainAggValue === localAggValue;

  // If values don't match, we're out of sync - show sync button
  const isOutOfSync = !isSynced && onChainAggValue !== null && localAggValue !== null;

  // Debug logging
  console.log('🔍 Sync Status Debug:', {
    onChainEventCount,
    onChainAggValue,
    localAggValue,
    localAggregatedValue,
    isSynced,
    isOutOfSync,
    hasWalletId: !!claim?.tokenization?.onChain?.walletId,
    walletId: claim?.tokenization?.onChain?.walletId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>On-Chain Tokenization Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error State */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Sync Status */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Sync Status</h3>

              <div className="flex items-center justify-between mb-4">
                <div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : isSynced ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      ✅ Fully Synced
                    </Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant="default" className="bg-yellow-100 text-yellow-800 w-fit">
                        ⚠️ Out of Sync
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Values don't match - sync needed
                      </p>
                    </div>
                  )}
                </div>
                {localAggValue !== null && onChainAggValue !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Local Value</p>
                    <p className="font-mono text-lg font-bold text-blue-600">{localAggValue}</p>
                    <p className="text-xs text-muted-foreground mt-2">On-Chain Value</p>
                    <p className="font-mono text-lg font-bold text-green-600">{onChainAggValue}</p>
                  </div>
                )}
              </div>

              {/* Sync Button - only show if out of sync */}
              {isOutOfSync && (
                <div className="space-y-2">
                  <Button
                    onClick={handleSyncToChain}
                    disabled={syncing || loading}
                    className="w-full"
                    size="lg"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing to Blockchain...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Sync to Blockchain
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    This will update the on-chain state to match local ({localAggValue})
                  </p>
                </div>
              )}

              {/* Refresh button at bottom */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadOnChainData();
                    if (onSyncComplete) {
                      onSyncComplete(); // Also refresh parent data
                    }
                  }}
                  disabled={loading || syncing}
                  className="w-full"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh On-Chain Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token Information */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold mb-2">Token Information</h3>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Token ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 p-2 rounded text-xs break-all">
                    {tokenId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => tokenId && copyToClipboard(tokenId)}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Blockchain</p>
                  <Badge variant="outline">{blockchain.toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contract</p>
                  <div className="flex items-center gap-1">
                    <code className="text-xs">{formatAddress(contractAddress)}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(contractAddress)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {blockExplorerUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(blockExplorerUrl, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Explorer
                </Button>
              )}
            </CardContent>
          </Card>

          {/* On-Chain Metadata */}
          {metadata && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold mb-2">On-Chain Metadata</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Claim ID</p>
                    <p className="font-mono text-xs">{metadata.claimId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-xs">{formatAddress(metadata.owner)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(metadata.owner)}
                        className="h-4 w-4 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Workflow ID</p>
                    <p className="font-mono text-xs">{metadata.workflowId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Execution ID</p>
                    <p className="font-mono text-xs">{metadata.executionId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created At</p>
                    <p className="text-xs">{formatTimestamp(metadata.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-xs">{formatTimestamp(metadata.lastUpdatedAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Metadata URI</p>
                    <p className="font-mono text-xs break-all">{metadata.metadataUri}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* On-Chain State */}
          {state && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold mb-2">On-Chain State</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ledger Event Count</p>
                    <p className="font-mono text-lg font-bold">{state.ledgerEventCount.toString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sink Event Count</p>
                    <p className="font-mono text-lg font-bold">{state.sinkEventCount.toString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Aggregate Value</p>
                    <p className="font-mono text-2xl font-bold text-green-600">{state.aggregateValue}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Ledger Root</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-xs break-all">
                        {state.ledgerRoot}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(state.ledgerRoot)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Sink Root</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-xs break-all">
                        {state.sinkRoot}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(state.sinkRoot)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
