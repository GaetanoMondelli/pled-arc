"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Claim } from "@/core/types/claims";
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, Coins } from "lucide-react";
import { engineAPIService } from "@/lib/engine-api-service";
import { mintClaimOnChain, getArcExplorerTxUrl, getArcExplorerTokenUrl, checkTokenExists } from "@/lib/services/claimContractService";

interface TokenizeClaimModalProps {
  claim: Claim | null;
  isOpen: boolean;
  onClose: () => void;
  onTokenized: (claim: Claim) => void;
}

interface TokenizationPreview {
  claimId: string;
  workflowId: string;
  executionId: string;
  ledgerEventCount: number;
  sinkEventCount: number;
  aggregateValue: any;
  sinkIds: string[];
  ready: boolean;
  errors: string[];
}

export function TokenizeClaimModal({
  claim,
  isOpen,
  onClose,
  onTokenized,
}: TokenizeClaimModalProps) {
  const [preview, setPreview] = useState<TokenizationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [circleTransactionId, setCircleTransactionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen && claim) {
      loadTokenizationPreview();
    }
  }, [isOpen, claim]);

  // Poll for txHash when transaction is pending
  useEffect(() => {
    if (!circleTransactionId || txHash !== 'pending' || !isPolling) {
      return;
    }

    let pollInterval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 5 minutes (20 * 15 seconds)

    const pollForTxHash = async () => {
      attempts++;
      console.log(`🔍 Polling for txHash... (attempt ${attempts}/${maxAttempts})`);

      try {
        const response = await fetch(`/api/circle/get-transaction-status?id=${circleTransactionId}`);
        const result = await response.json();

        if (result.success && result.data) {
          const { txHash: newTxHash, state } = result.data;

          console.log(`  State: ${state}`);
          console.log(`  TxHash: ${newTxHash || 'Not yet available'}`);

          if (newTxHash && newTxHash !== 'pending') {
            // Got the real txHash!
            console.log('✅ Got real txHash:', newTxHash);
            setTxHash(newTxHash);
            setIsPolling(false);
            clearInterval(pollInterval);

            // Update claim with real txHash
            if (claim) {
              const blockExplorerUrl = getArcExplorerTxUrl(newTxHash);
              const updatedClaim: Claim = {
                ...claim,
                tokenization: {
                  ...claim.tokenization!,
                  onChain: {
                    ...claim.tokenization!.onChain!,
                    txHash: newTxHash,
                    blockExplorerUrl,
                  },
                },
              };
              onTokenized(updatedClaim);

              // Show success for 3 seconds then close
              setTimeout(() => {
                onClose();
                setTxHash(null);
                setCircleTransactionId(null);
              }, 3000);
            }
          } else if (state === 'FAILED' || state === 'DENIED' || state === 'CANCELLED') {
            console.error('❌ Transaction failed with state:', state);
            setError(`Transaction ${state.toLowerCase()}`);
            setIsPolling(false);
            clearInterval(pollInterval);
          }
        }

        // Stop polling after max attempts
        if (attempts >= maxAttempts) {
          console.warn('⚠️  Max polling attempts reached');
          setIsPolling(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling transaction status:', err);
      }
    };

    // Start polling every 15 seconds
    pollInterval = setInterval(pollForTxHash, 15000);

    // Also poll immediately
    pollForTxHash();

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [circleTransactionId, txHash, isPolling, claim, onTokenized]);

  const loadTokenizationPreview = async () => {
    if (!claim) return;

    setIsLoading(true);
    setError(null);

    try {
      const errors: string[] = [];

      // Validate required fields
      if (!claim.templateId) {
        errors.push("No workflow template attached to this claim");
      }
      if (!claim.executionId) {
        errors.push("No execution attached to this claim");
      }
      if (!claim.formula?.sinks || claim.formula.sinks.length === 0) {
        errors.push("No sink nodes defined for this claim");
      }

      let ledgerEventCount = 0;
      let sinkEventCount = 0;
      let computedAggregate: any = null;

      // Get sink aggregation data (includes events AND computed value)
      if (claim.templateId && claim.executionId && claim.formula?.sinks?.[0]) {
        try {
          const primarySink = claim.formula.sinks[0];
          const formulaType = claim.aggregationFormula?.type || 'latest';

          const aggregationData = await engineAPIService.getSinkAggregation(
            claim.templateId,
            claim.executionId,
            primarySink,
            formulaType,
            claim.aggregationFormula?.customExpression
          );

          // Get event counts from aggregation data
          ledgerEventCount = aggregationData.totalEvents || 0;
          sinkEventCount = aggregationData.events?.length || 0;
          computedAggregate = aggregationData.aggregatedValue;

          if (sinkEventCount === 0) {
            errors.push("Sink has no events yet - run the workflow first");
          }
        } catch (err) {
          errors.push("Failed to load sink aggregation data");
          console.error("Error loading aggregation:", err);
        }
      }

      setPreview({
        claimId: claim.id,
        workflowId: claim.templateId || "",
        executionId: claim.executionId || "",
        ledgerEventCount,
        sinkEventCount,
        aggregateValue: computedAggregate || claim.aggregatedValue,
        sinkIds: claim.formula?.sinks || [],
        ready: errors.length === 0 && sinkEventCount > 0,
        errors,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load tokenization preview");
    } finally {
      setIsLoading(false);
    }
  };

  const pollBlockchainForToken = async (
    transactionId: string,
    contractAddress: `0x${string}`,
    tokenId: bigint,
    ownerAddress: `0x${string}`
  ) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    let attempts = 0;

    const poll = async () => {
      attempts++;
      console.log(`🔍 Checking blockchain for token ${tokenId}... (attempt ${attempts}/${maxAttempts})`);

      try {
        // Check if token exists on-chain by calling the smart contract
        const { exists, owner } = await checkTokenExists(tokenId);

        if (exists && owner) {
          // Token found on blockchain!
          console.log('✅ Token minted on blockchain!');
          console.log(`  Token ID: ${tokenId}`);
          console.log(`  Owner: ${owner}`);
          console.log(`  Contract: ${contractAddress}`);

          setIsPolling(false);

          // Use the contract address as the "transaction link" since we don't have txHash
          const blockExplorerUrl = `https://testnet.arcscan.app/address/${contractAddress}`;
          const txHashPlaceholder = `0x${tokenId.toString(16).padStart(64, '0')}` as `0x${string}`;

          setTxHash(txHashPlaceholder);

          // Update claim with on-chain data
          if (claim) {
            const updatedClaim: Claim = {
              ...claim,
              tokenization: {
                ...claim.tokenization!,
                onChain: {
                  contractAddress,
                  tokenId: tokenId.toString(),
                  blockchain: "arc-testnet",
                  txHash: txHashPlaceholder,
                  mintedAt: new Date(),
                  ownerAddress: owner,
                  standard: "custom",
                  merkleRootOnChain: "0x...",
                  onChainLedgerEventCount: preview?.ledgerEventCount || 0,
                  onChainSinkEventCount: preview?.sinkEventCount || 0,
                  blockExplorerUrl,
                },
              },
            };

            onTokenized(updatedClaim);

            // Show success for 3 seconds then close
            setTimeout(() => {
              onClose();
              setTxHash(null);
              setCircleTransactionId(null);
              setIsPolling(false);
            }, 3000);
          }
        } else if (attempts < maxAttempts) {
          // Token not on blockchain yet, keep polling
          console.log(`  Token not found yet, waiting...`);
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setError('Polling timed out - token not found on blockchain');
          setIsPolling(false);
        }
      } catch (err: any) {
        console.error('Error checking blockchain:', err);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setError('Failed to verify token on blockchain');
          setIsPolling(false);
        }
      }
    };

    // Start polling
    poll();
  };

  const handleMintClaim = async () => {
    if (!claim || !preview || !preview.ready) return;

    setIsMinting(true);
    setError(null);

    try {
      // Get all ledger events and sink events from aggregation data
      const primarySink = claim.formula?.sinks?.[0];
      if (!primarySink || !claim.templateId || !claim.executionId) {
        throw new Error("Missing required claim data");
      }

      const formulaType = claim.aggregationFormula?.type || 'latest';

      // Get sink aggregation data which includes events
      const aggregationData = await engineAPIService.getSinkAggregation(
        claim.templateId,
        claim.executionId,
        primarySink,
        formulaType,
        claim.aggregationFormula?.customExpression
      );

      // Extract events from aggregation data
      const sinkEvents = aggregationData.events || [];

      // For ledger events, we need to fetch the full execution
      // For now, we'll use the sink events count from aggregation
      // TODO: Get full ledger events from execution
      const ledgerEvents = aggregationData.events || []; // Placeholder

      // Get Circle wallets to use for minting
      const walletsResponse = await fetch('/api/circle/wallet');
      const walletsResult = await walletsResponse.json();

      if (!walletsResult.success || !walletsResult.data?.wallets?.length) {
        throw new Error("No Circle wallets available. Please create a wallet first.");
      }

      // Use the first wallet for minting
      const wallet = walletsResult.data.wallets[0];
      const walletId = wallet.id;
      const ownerAddress = wallet.address as `0x${string}`;

      // Prepare metadata URI (placeholder - would upload to IPFS)
      const metadataUri = `ipfs://claim-${claim.id}`;

      console.log("🚀 Minting claim on Arc Testnet via Circle SDK...");
      console.log(`  Wallet ID: ${walletId}`);
      console.log(`  Owner Address: ${ownerAddress}`);
      console.log(`  Ledger events: ${ledgerEvents.length}`);
      console.log(`  Sink events: ${sinkEvents.length}`);
      console.log(`  Aggregate value:`, preview.aggregateValue);

      // Mint claim on-chain using Circle SDK
      const { txHash, tokenId, contractAddress, transactionId } = await mintClaimOnChain({
        walletId,
        ownerAddress,
        claimId: claim.id,
        workflowId: claim.templateId,
        executionId: claim.executionId,
        ledgerEvents,
        sinkEvents,
        aggregateValue: preview.aggregateValue,
        metadataUri,
        claimTitle: claim.title, // Use claim title for deterministic tokenId
      });

      setCircleTransactionId(transactionId);

      // Circle SDK doesn't return txHash immediately, we need to poll for it
      if (!txHash || txHash === '') {
        console.log('⏳ Transaction created, starting polling for txHash...');
        console.log('   Transaction ID:', transactionId);
        setIsPolling(true);
        setIsMinting(false);

        // Start polling blockchain directly for the token
        pollBlockchainForToken(transactionId, contractAddress, tokenId, ownerAddress);
        return;
      }

      // If we somehow got txHash immediately, proceed normally
      setTxHash(txHash);

      const blockExplorerUrl = getArcExplorerTxUrl(txHash);

      // Update claim with on-chain data
      const updatedClaim: Claim = {
        ...claim,
        tokenization: {
          ...claim.tokenization!,
          onChain: {
            contractAddress,
            tokenId: tokenId.toString(),
            blockchain: "arc-testnet",
            txHash,
            mintedAt: new Date(),
            ownerAddress,
            standard: "custom",
            merkleRootOnChain: "0x...", // Would come from contract state
            onChainLedgerEventCount: preview.ledgerEventCount,
            onChainSinkEventCount: preview.sinkEventCount,
            blockExplorerUrl,
          },
        },
      };

      onTokenized(updatedClaim);

      // Show success for 3 seconds then close
      setTimeout(() => {
        onClose();
        setTxHash(null);
      }, 3000);
    } catch (err: any) {
      console.error("❌ Error minting claim:", err);
      setError(err.message || "Failed to mint claim on-chain");
      setIsMinting(false);
    }
  };

  if (!claim) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Tokenize Claim On-Chain
          </DialogTitle>
          <DialogDescription>
            Mint this claim as a verifiable NFT on Arc Testnet using Incremental Merkle Trees
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-muted-foreground">Loading claim data...</span>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* Claim Info */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">📋 Claim Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 text-xs">Claim ID:</span>
                  <p className="font-mono font-semibold text-black">{preview.claimId}</p>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Title:</span>
                  <p className="font-semibold text-black">{claim.title}</p>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Workflow:</span>
                  <p className="font-mono text-xs text-black">{preview.workflowId}</p>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Execution:</span>
                  <p className="font-mono text-xs text-black">{preview.executionId}</p>
                </div>
              </div>
            </div>

            {/* Event Counts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-gray-400 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Ledger Events</div>
                <div className="text-3xl font-bold text-black">
                  {preview.ledgerEventCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  All execution events
                </div>
              </div>

              <div className="bg-white border-2 border-gray-400 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Sink Events</div>
                <div className="text-3xl font-bold text-black">
                  {preview.sinkEventCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Events from {preview.sinkIds.length} sink(s)
                </div>
              </div>
            </div>

            {/* Sink IDs */}
            <div>
              <div className="text-sm font-semibold mb-2">Sink Nodes:</div>
              <div className="flex flex-wrap gap-2">
                {preview.sinkIds.map((sinkId, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs border-gray-400">
                    {sinkId}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Aggregated Value */}
            <div>
              <div className="text-sm font-semibold mb-2">Aggregated Value:</div>
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 font-mono text-sm text-black">
                {typeof preview.aggregateValue === "object"
                  ? JSON.stringify(preview.aggregateValue, null, 2)
                  : String(preview.aggregateValue || "N/A")}
              </div>
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Cannot tokenize claim:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {preview.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Contract Info */}
            <div className="bg-black rounded-lg p-4 text-white border-2 border-gray-700">
              <div className="text-sm font-semibold mb-3">🔗 On-Chain Details</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Network:</span>
                  <Badge variant="outline" className="bg-white text-black border-gray-300">Arc Testnet</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Contract:</span>
                  <a
                    href={`https://testnet.arcscan.app/address/${process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-white hover:text-gray-300 underline flex items-center gap-1"
                  >
                    {process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS?.slice(0, 10) ||
                      "Not deployed"}
                    ...
                    <ExternalLink className="inline w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Standard:</span>
                  <span className="font-mono text-xs text-white">IMT NFT</span>
                </div>
              </div>
            </div>

            {/* Success State */}
            {txHash && (
              <Alert className={txHash === 'pending' ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}>
                {txHash === 'pending' ? (
                  <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription>
                  {txHash === 'pending' ? (
                    <>
                      <div className="font-semibold mb-1">⏳ Transaction pending...</div>
                      <div className="text-sm space-y-1">
                        <div>
                          Circle Transaction ID:{" "}
                          <span className="font-mono text-xs">{circleTransactionId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Waiting for Circle to broadcast to Arc Testnet. This usually takes 10-30 seconds.
                        </div>
                        {isPolling && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Polling for transaction hash...
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold mb-1">✅ Claim minted successfully!</div>
                      <div className="text-sm space-y-1">
                        <div>
                          Transaction:{" "}
                          <a
                            href={getArcExplorerTxUrl(txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-black hover:underline font-mono"
                          >
                            {txHash.slice(0, 20)}...
                            <ExternalLink className="inline w-3 h-3 ml-1" />
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isMinting || isPolling}>
            {txHash && txHash !== 'pending' ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleMintClaim}
            disabled={!preview?.ready || isMinting || !!txHash || isPolling}
          >
            {isMinting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Minting On-Chain...
              </>
            ) : isPolling || txHash === 'pending' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Waiting for Broadcast...
              </>
            ) : txHash ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Minted!
              </>
            ) : (
              <>
                <Coins className="w-4 h-4 mr-2" />
                Mint Claim on Arc Testnet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
