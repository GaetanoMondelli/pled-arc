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

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen && claim) {
      loadTokenizationPreview();
    }
  }, [isOpen, claim]);

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

      // Get execution data if available
      if (claim.executionId) {
        try {
          const execution = await engineAPIService.getExecution(claim.executionId);

          ledgerEventCount = execution.globalActivityLog?.length || 0;

          // Count sink events
          if (claim.formula?.sinks && execution.globalActivityLog) {
            const sinkIds = new Set(claim.formula.sinks);
            sinkEventCount = execution.globalActivityLog.filter((event: any) =>
              sinkIds.has(event.nodeId)
            ).length;
          }

          if (ledgerEventCount === 0) {
            errors.push("Execution has no events in global activity log");
          }
        } catch (err) {
          errors.push("Failed to load execution data");
          console.error("Error loading execution:", err);
        }
      }

      setPreview({
        claimId: claim.id,
        workflowId: claim.templateId || "",
        executionId: claim.executionId || "",
        ledgerEventCount,
        sinkEventCount,
        aggregateValue: claim.aggregatedValue,
        sinkIds: claim.formula?.sinks || [],
        ready: errors.length === 0 && ledgerEventCount > 0,
        errors,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load tokenization preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMintClaim = async () => {
    if (!claim || !preview || !preview.ready) return;

    setIsMinting(true);
    setError(null);

    try {
      // TODO: Implement actual minting logic
      // 1. Hash all ledger events
      // 2. Hash all sink events
      // 3. Call contract.mintClaim()
      // 4. Wait for transaction
      // 5. Update claim in Firestore with on-chain data

      // Placeholder for now
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock transaction hash
      const mockTxHash = "0x" + Math.random().toString(16).substring(2, 66);
      setTxHash(mockTxHash);

      // Update claim with mock on-chain data
      const updatedClaim: Claim = {
        ...claim,
        tokenization: {
          ...claim.tokenization!,
          onChain: {
            contractAddress: process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS || "0x...",
            tokenId: "1", // This would come from the contract
            blockchain: "arc-testnet",
            txHash: mockTxHash,
            mintedAt: new Date(),
            ownerAddress: "0x...", // User's wallet address
            standard: "custom",
            merkleRootOnChain: "0x...", // From contract
            onChainLedgerEventCount: preview.ledgerEventCount,
            onChainSinkEventCount: preview.sinkEventCount,
            blockExplorerUrl: `https://explorer.arc.xyz/tx/${mockTxHash}`,
          },
        },
      };

      onTokenized(updatedClaim);

      // Show success for 2 seconds then close
      setTimeout(() => {
        onClose();
        setTxHash(null);
      }, 3000);
    } catch (err: any) {
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
            <div className="bg-gradient-to-r from-slate-50 to-gray-100 border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                📋 Claim Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600 text-xs">Claim ID:</span>
                  <p className="font-mono font-semibold">{preview.claimId}</p>
                </div>
                <div>
                  <span className="text-slate-600 text-xs">Title:</span>
                  <p className="font-semibold text-slate-800">{claim.title}</p>
                </div>
                <div>
                  <span className="text-slate-600 text-xs">Workflow:</span>
                  <p className="font-mono text-xs text-blue-600">{preview.workflowId}</p>
                </div>
                <div>
                  <span className="text-slate-600 text-xs">Execution:</span>
                  <p className="font-mono text-xs text-green-600">{preview.executionId}</p>
                </div>
              </div>
            </div>

            {/* Event Counts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-lg">
                <div className="text-sm opacity-90 mb-1">Ledger Events</div>
                <div className="text-3xl font-bold">
                  {preview.ledgerEventCount}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  All execution events
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white shadow-lg">
                <div className="text-sm opacity-90 mb-1">Sink Events</div>
                <div className="text-3xl font-bold">
                  {preview.sinkEventCount}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  Events from {preview.sinkIds.length} sink(s)
                </div>
              </div>
            </div>

            {/* Sink IDs */}
            <div>
              <div className="text-sm font-semibold mb-2">Sink Nodes:</div>
              <div className="flex flex-wrap gap-2">
                {preview.sinkIds.map((sinkId, idx) => (
                  <Badge key={idx} className="font-mono text-xs bg-purple-100 text-purple-700 hover:bg-purple-200">
                    {sinkId}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Aggregated Value */}
            <div>
              <div className="text-sm font-semibold mb-2">Aggregated Value:</div>
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 font-mono text-sm">
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
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-4 text-white shadow-lg">
              <div className="text-sm font-semibold mb-3 opacity-90">🔗 On-Chain Details</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="opacity-75">Network:</span>
                  <Badge className="bg-white text-indigo-600">Arc Testnet</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-75">Contract:</span>
                  <span className="font-mono text-xs">
                    {process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS?.slice(0, 10) ||
                      "Not deployed"}
                    ...
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-75">Standard:</span>
                  <span className="font-mono text-xs">IMT NFT</span>
                </div>
              </div>
            </div>

            {/* Success State */}
            {txHash && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="font-semibold mb-1">✅ Claim minted successfully!</div>
                  <div className="text-sm space-y-1">
                    <div>
                      Transaction:{" "}
                      <a
                        href={`https://explorer.arc.xyz/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono"
                      >
                        {txHash.slice(0, 20)}...
                        <ExternalLink className="inline w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
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
          <Button variant="outline" onClick={onClose} disabled={isMinting}>
            Cancel
          </Button>
          <Button
            onClick={handleMintClaim}
            disabled={!preview?.ready || isMinting || !!txHash}
          >
            {isMinting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Minting On-Chain...
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
