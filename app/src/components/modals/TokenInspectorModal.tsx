"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { HistoryEntry, Token } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";
import D3TokenTree from "@/components/workflow-builder/lineage/D3TokenTree";
import { TokenGenealogyEngine } from "@/lib/simulation/tokenGenealogyEngine";
import TokenLineageViewer from "./TokenLineageViewer";

const TokenInspectorModal: React.FC = () => {
  const selectedToken = useSimulationStore(state => state.selectedToken);
  const setSelectedToken = useSimulationStore(state => state.setSelectedToken);
  const globalActivityLog = useSimulationStore(state => state.globalActivityLog);
  const nodesConfig = useSimulationStore(state => state.nodesConfig);

  const isOpen = !!selectedToken;

  // Build token lineage using the proper genealogy engine
  const tokenLineage = useMemo(() => {
    if (!selectedToken || !globalActivityLog) return null;
    
    const genealogyEngine = new TokenGenealogyEngine(globalActivityLog);
    try {
      return genealogyEngine.buildCompleteLineage(selectedToken.id);
    } catch (error) {
      console.error("Failed to build token lineage:", error);
      return null;
    }
  }, [selectedToken, globalActivityLog]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedToken(null);
    }
  };

  const handleTokenClick = (tokenId: string) => {
    console.log(`🔍 [TOKEN INSPECTOR] Navigating to token: ${tokenId}`);

    // Find the token in the global activity log and reconstruct it
    const tokenEvents = globalActivityLog.filter(
      log =>
        log.sourceTokenIds?.includes(tokenId) ||
        log.details?.includes(`Token ${tokenId}`) ||
        log.details?.includes(tokenId)
    );

    if (tokenEvents.length > 0) {
      // Look for token creation events (token_emitted, processing, firing)
      const createEvent = tokenEvents.find(e =>
        (e.action === "token_emitted" ||
         e.action === "processing" ||
         e.action === "firing") &&
        e.details?.includes(tokenId)
      );

      const sourceEvent = createEvent || tokenEvents[0];

      if (sourceEvent) {
        const reconstructedToken: Token = {
          id: tokenId,
          value: sourceEvent.value !== undefined ? sourceEvent.value : 0,
          createdAt: sourceEvent.timestamp,
          originNodeId: sourceEvent.nodeId,
          history: tokenEvents,
        };
        setSelectedToken(reconstructedToken);
      }
    } else {
      console.warn(`🔍 [TOKEN INSPECTOR] No events found for token ${tokenId}`);
    }
  };

  if (!selectedToken) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline">Token Inspector: {selectedToken.id}</DialogTitle>
          <DialogDescription>
            Value: {selectedToken.value} | Created: {selectedToken.createdAt}s | Origin:{" "}
            {nodesConfig[selectedToken.originNodeId]?.displayName || selectedToken.originNodeId}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-6">
          {/* Token Basic Info */}
          <div>
            <h3 className="font-semibold text-primary mb-3">Token Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Token ID</div>
                <div className="font-mono text-sm">{selectedToken.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Value</div>
                <div className="font-mono text-sm font-semibold">{selectedToken.value}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created At</div>
                <div className="font-mono text-sm">{selectedToken.createdAt}s</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Origin Node</div>
                <div className="text-sm">
                  {nodesConfig[selectedToken.originNodeId]?.displayName || selectedToken.originNodeId}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Token Lineage Viewer */}
          <div>
            <h3 className="font-semibold text-primary mb-3">Complete Token Genealogy</h3>
            <TokenLineageViewer
              token={selectedToken}
              onTokenClick={handleTokenClick}
            />
          </div>

          <Separator />

          {/* Token History */}
          <div>
            <h3 className="font-semibold text-primary mb-3">Token History</h3>
            <TokenHistoryTable history={selectedToken.history} nodesConfig={nodesConfig} />
          </div>
        </div>

        <div className="pt-4 mt-auto border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// The old TokenLineageTree component has been removed and replaced with ExpandableTokenTree

// Token History Table Component
const TokenHistoryTable: React.FC<{
  history: HistoryEntry[];
  nodesConfig: any;
}> = ({ history, nodesConfig }) => {
  const getActionColor = (action: string): string => {
    if (action.includes("CREATED")) return "bg-green-100 text-green-800";
    if (action.includes("CONSUMED") || action.includes("AGGREGATION")) return "bg-blue-100 text-blue-800";
    if (action.includes("ARRIVED") || action.includes("ADDED")) return "bg-orange-100 text-orange-800";
    if (action.includes("ERROR")) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="border rounded-md">
      <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b">
        <div className="flex gap-4">
          <div className="w-16 flex-shrink-0">Time</div>
          <div className="w-32 flex-shrink-0">Node</div>
          <div className="w-40 flex-shrink-0">Action</div>
          <div className="w-16 flex-shrink-0">Value</div>
          <div className="flex-1 min-w-0">Details</div>
        </div>
      </div>
      <ScrollArea className="max-h-64">
        <div className="divide-y">
          {history.map((log, index) => (
            <div key={`${log.sequence}-${index}`} className="px-3 py-2 text-xs hover:bg-muted/30">
              <div className="flex gap-4 items-start">
                <div className="w-16 flex-shrink-0 font-mono text-muted-foreground">{log.timestamp}s</div>
                <div
                  className="w-32 flex-shrink-0 font-medium truncate"
                  title={nodesConfig[log.nodeId]?.displayName || log.nodeId}
                >
                  {nodesConfig[log.nodeId]?.displayName || log.nodeId}
                </div>
                <div className="w-40 flex-shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)} block truncate`}
                    title={log.action}
                  >
                    {log.action}
                  </span>
                </div>
                <div className="w-16 flex-shrink-0 font-mono text-right">
                  {log.value !== undefined ? String(log.value) : "-"}
                </div>
                <div className="flex-1 min-w-0 text-muted-foreground break-words">{log.details || "-"}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TokenInspectorModal;
