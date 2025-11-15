"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Token } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";
import { Clock, Hash, Activity } from "lucide-react";

interface SimpleTokenInspectorProps {
  engine?: any; // SimulationEngine instance
}

const SimpleTokenInspector: React.FC<SimpleTokenInspectorProps> = ({ engine }) => {
  const selectedToken = useSimulationStore(state => state.selectedToken);
  const setSelectedToken = useSimulationStore(state => state.setSelectedToken);

  const isOpen = !!selectedToken;

  // Get token information from core engine instead of legacy tracer
  const tokenInfo = useMemo(() => {
    if (!selectedToken || !engine) return null;

    try {
      // Use core engine's getTokenInfo API
      const coreTokenInfo = engine.getTokenInfo(selectedToken.id);

      if (coreTokenInfo) {
        // Convert core token info to display format
        const tokenEvents = coreTokenInfo.journey || [];
        const activities = coreTokenInfo.activities || [];

        return {
          token: selectedToken,
          events: tokenEvents.map((event: any) => ({
            id: event.id || `event_${event.tick}`,
            timestamp: event.tick,
            eventType: event.type,
            nodeId: event.sourceNodeId,
            nodeType: event.metadata?.nodeType || 'Unknown',
            action: event.type,
            value: event.data?.value || event.value,
            details: `${event.type} at ${event.sourceNodeId}`,
            correlationIds: event.correlationIds || []
          })),
          correlationIds: coreTokenInfo.correlationIds || [selectedToken.id],
          totalEvents: tokenEvents.length,
          nodesVisited: [...new Set(tokenEvents.map((e: any) => e.sourceNodeId))],
          journey: coreTokenInfo.journey
        };
      }
    } catch (error) {
      console.warn('Failed to get token info from core engine:', error);
    }

    // Fallback to basic token info
    return {
      token: selectedToken,
      events: [],
      correlationIds: [selectedToken.id],
      totalEvents: 0,
      nodesVisited: [],
      journey: []
    };
  }, [selectedToken, engine]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedToken(null);
    }
  };

  const handleTokenClick = (tokenId: string) => {
    if (!engine) return;

    try {
      // Use core engine to find the token
      const foundTokens = engine.findTokens({ correlationId: tokenId });
      if (foundTokens.length > 0) {
        const foundToken = foundTokens[0];
        const reconstructedToken: Token = {
          id: tokenId,
          value: foundToken.value || 0,
          createdAt: foundToken.createdAtTick || 0,
          originNodeId: foundToken.originNodeId || 'unknown',
          history: []
        };
        setSelectedToken(reconstructedToken);
      }
    } catch (error) {
      console.warn('Failed to find token with core engine:', error);
    }
  };

  if (!selectedToken || !tokenInfo) {
    return null;
  }

  const getActionColor = (action: string): string => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes("created")) return "text-green-700 bg-green-50";
    if (lowerAction.includes("emitted")) return "text-green-600 bg-green-50";
    if (lowerAction.includes("received")) return "text-blue-600 bg-blue-50";
    if (lowerAction.includes("processing") || lowerAction.includes("firing")) return "text-purple-600 bg-purple-50";
    if (lowerAction.includes("consumed") || lowerAction.includes("consuming")) return "text-orange-600 bg-orange-50";
    if (lowerAction.includes("dropped")) return "text-red-600 bg-red-50";
    if (lowerAction.includes("input")) return "text-indigo-600 bg-indigo-50";
    return "text-gray-600 bg-gray-50";
  };

  // Group events by timestamp for visualization (since core engine doesn't have depth)
  const eventsByTimestamp = tokenInfo.events.sort((a, b) => a.timestamp - b.timestamp);
  const eventsGrouped = eventsByTimestamp.reduce((acc, event, index) => {
    // Group events by node to show flow
    const nodeId = event.nodeId || 'unknown';
    if (!acc[nodeId]) {
      acc[nodeId] = [];
    }
    acc[nodeId].push({ ...event, depth: index }); // Fake depth based on order
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Token Inspector: {selectedToken.id}
          </DialogTitle>
          <DialogDescription>
            Tracing token history through the simulation
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Token Summary</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono font-medium">{selectedToken.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Value:</span>
                  <span className="font-semibold">{selectedToken.value}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{selectedToken.createdAt}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Origin:</span>
                  <span>{selectedToken.originNodeId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Events:</span>
                  <span>{tokenInfo.totalEvents}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Nodes Visited:</span>
                  <span>{tokenInfo.nodesVisited.length}</span>
                </div>
              </div>

              {tokenInfo.correlationIds.length > 1 && (
                <div className="pt-1 mt-1 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Correlation IDs:</span>
                    <div className="flex flex-wrap gap-1">
                      {tokenInfo.correlationIds.map(corrId => (
                        <button
                          key={corrId}
                          onClick={() => handleTokenClick(corrId)}
                          className="px-1.5 py-0.5 text-xs font-mono bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        >
                          {corrId}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token History */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Token History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {/* Show events chronologically */}
                  {eventsByTimestamp.map((event, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === eventsByTimestamp.length - 1;

                    return (
                      <div key={event.id} className={`${isFirst ? 'border-l-4 border-green-500 pl-3' : isLast ? 'border-l-4 border-blue-500 pl-3' : 'border-l-2 border-gray-200 pl-3'} ${idx < eventsByTimestamp.length - 1 ? 'pb-2' : ''}`}>
                        {(isFirst || isLast) && (
                          <div className="flex items-center gap-2 mb-1">
                            {isFirst && (
                              <Badge variant="outline" className="text-xs bg-green-50 h-5">Origin</Badge>
                            )}
                            {isLast && (
                              <Badge variant="default" className="text-xs h-5">Latest</Badge>
                            )}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className={`rounded p-2 border text-xs ${getActionColor(event.action)}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] bg-black/10 px-1 rounded">
                                  {event.nodeType || 'Node'}
                                </span>
                                <span className="font-medium">{event.nodeId}</span>
                                <span className="text-xs">•</span>
                                <span className="capitalize">{event.action}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>t:{event.timestamp}</span>
                              </div>
                            </div>

                            {event.value !== undefined && (
                              <div className="mt-1 text-[10px] bg-black/5 rounded px-1 py-0.5">
                                <span className="text-muted-foreground">Value: </span>
                                <span className="font-mono">{JSON.stringify(event.value)}</span>
                              </div>
                            )}

                            {event.correlationIds && event.correlationIds.length > 0 && (
                              <div className="mt-1 text-[10px] bg-black/5 rounded px-1 py-0.5">
                                <span className="text-muted-foreground">Correlation IDs: </span>
                                <span className="font-mono">{event.correlationIds.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

        </div>

        <div className="pt-4 mt-auto border-t flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleTokenInspector;
