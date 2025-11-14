"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Token } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";
import { SimpleTokenTracer, type TokenEvent } from "@/lib/simulation/simpleTokenTracer";
import { ArrowRight, Hash, Calculator, Package, GitMerge } from "lucide-react";

const ClearTokenInspector: React.FC = () => {
  const selectedToken = useSimulationStore(state => state.selectedToken);
  const setSelectedToken = useSimulationStore(state => state.setSelectedToken);
  const globalActivityLog = useSimulationStore(state => state.globalActivityLog);
  const nodesConfig = useSimulationStore(state => state.nodesConfig);

  const isOpen = !!selectedToken;

  // Trace token history using BFS
  const tokenTrace = useMemo(() => {
    if (!selectedToken || !globalActivityLog) return null;

    const tracer = new SimpleTokenTracer(globalActivityLog, nodesConfig);
    return tracer.traceToken(selectedToken.id);
  }, [selectedToken, globalActivityLog, nodesConfig]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedToken(null);
    }
  };

  const handleTokenClick = (tokenId: string) => {
    // Find token in activity log and open it
    const tokenEvent = globalActivityLog.find(log =>
      log.details?.includes(`Token ${tokenId}`)
    );

    if (tokenEvent) {
      const reconstructedToken: Token = {
        id: tokenId,
        value: tokenEvent.value || 0,
        createdAt: tokenEvent.timestamp,
        originNodeId: tokenEvent.nodeId,
        history: []
      };
      setSelectedToken(reconstructedToken);
    }
  };

  if (!selectedToken || !tokenTrace) {
    return null;
  }

  // Group events by token for clearer visualization
  const eventsByToken = new Map<string, TokenEvent[]>();
  const tokenCreationOrder: string[] = [];

  // First pass: group events and track creation order
  for (const event of tokenTrace.events) {
    // Extract token ID from details
    const tokenMatch = event.details?.match(/Token ([A-Za-z0-9]{8})/);
    const eventTokenId = tokenMatch ? tokenMatch[1] : selectedToken.id;

    if (!eventsByToken.has(eventTokenId)) {
      eventsByToken.set(eventTokenId, []);
      if (event.eventType === 'creation' || event.action === 'CREATED') {
        tokenCreationOrder.push(eventTokenId);
      }
    }
    eventsByToken.get(eventTokenId)!.push(event);
  }

  // Reverse to show sources first
  tokenCreationOrder.reverse();

  // Helper to extract formula and values from event details
  const parseTransformation = (details?: string): { formula?: string; inputs?: string; result?: string } => {
    // Match patterns like "sum([4, 160, 10]) = 174"
    const aggregationMatch = details?.match(/(\w+)\(\[([^\]]+)\]\)\s*=\s*(.+)/);
    if (aggregationMatch) {
      return {
        formula: aggregationMatch[1],
        inputs: aggregationMatch[2],
        result: aggregationMatch[3]
      };
    }

    // Match patterns like "created via formula → destination"
    const formulaMatch = details?.match(/created via (.+?) → /);
    if (formulaMatch) {
      return { formula: formulaMatch[1] };
    }

    return {};
  };

  const renderTokenSection = (tokenId: string, events: TokenEvent[], isTarget: boolean) => {
    const creationEvent = events.find(e => e.eventType === 'creation' || e.action === 'CREATED');
    const inputEvents = events.filter(e => e.action?.startsWith('INPUT_'));
    const consumptionEvent = events.find(e => e.eventType === 'consumption');

    if (!creationEvent) return null;

    // Find what transformation created this token
    const transformation = parseTransformation(creationEvent.details);

    // Find parent tokens
    const parentTokens = creationEvent.sourceTokenIds || [];

    return (
      <Card key={tokenId} className={isTarget ? "border-primary border-2" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="font-mono">{tokenId}</span>
              {isTarget && <Badge variant="default">Target</Badge>}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{creationEvent.timestamp}s</span>
              <Badge variant="outline">{creationEvent.value}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Where it was created */}
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 mt-0.5 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium">Created by {creationEvent.nodeName}</div>

              {/* Show transformation */}
              {transformation.formula && (
                <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono">
                  {transformation.formula}
                  {transformation.inputs && (
                    <>
                      <span className="text-muted-foreground">([</span>
                      <span className="text-blue-600">{transformation.inputs}</span>
                      <span className="text-muted-foreground">])</span>
                    </>
                  )}
                  {transformation.result && (
                    <>
                      <span className="text-muted-foreground"> = </span>
                      <span className="text-green-600">{transformation.result}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Parent tokens */}
          {parentTokens.length > 0 && (
            <div className="flex items-start gap-2">
              <GitMerge className="w-4 h-4 mt-0.5 text-purple-600 rotate-180" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground mb-1">Input tokens:</div>
                <div className="flex flex-wrap gap-1">
                  {parentTokens.map(parentId => (
                    <button
                      key={parentId}
                      onClick={() => handleTokenClick(parentId)}
                      className="px-2 py-0.5 text-xs font-mono bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                    >
                      {parentId}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show how inputs were collected (for aggregation) */}
          {inputEvents.length > 0 && inputEvents[0].action === 'INPUT_accumulating' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="font-medium">Collection process:</div>
              {inputEvents.map((event, idx) => {
                // Extract token being collected
                const collectedMatch = event.details?.match(/Token ([A-Za-z0-9]{8})/);
                const collectedId = collectedMatch ? collectedMatch[1] : null;

                return (
                  <div key={idx} className="flex items-center gap-2 ml-2">
                    <span className="text-muted-foreground">{event.timestamp}s:</span>
                    {collectedId ? (
                      <span>
                        Collected{' '}
                        <button
                          onClick={() => handleTokenClick(collectedId)}
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {collectedId}
                        </button>
                      </span>
                    ) : (
                      <span>Buffer size: {event.value}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Where it was consumed */}
          {consumptionEvent && (
            <div className="flex items-start gap-2 pt-2 border-t">
              <ArrowRight className="w-4 h-4 mt-0.5 text-orange-600" />
              <div className="text-sm">
                <span className="text-muted-foreground">Consumed by</span>{' '}
                <span className="font-medium">{consumptionEvent.nodeName}</span>{' '}
                <span className="text-xs text-muted-foreground">at {consumptionEvent.timestamp}s</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline flex items-center gap-2">
            Token History: {selectedToken.id}
          </DialogTitle>
          <DialogDescription>
            Complete transformation chain from sources to target
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pb-4">
            {/* Show source tokens first, then intermediates, then target */}
            {tokenCreationOrder.map(tokenId => {
              const events = eventsByToken.get(tokenId);
              if (!events) return null;

              const isTarget = tokenId === selectedToken.id;
              return renderTokenSection(tokenId, events, isTarget);
            })}

            {/* If target token wasn't in creation order, show it */}
            {!tokenCreationOrder.includes(selectedToken.id) && eventsByToken.has(selectedToken.id) && (
              renderTokenSection(selectedToken.id, eventsByToken.get(selectedToken.id)!, true)
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 mt-auto border-t flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClearTokenInspector;