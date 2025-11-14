"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useSimulationStore } from "@/stores/simulationStore";
import { Activity, Clock, GitBranch, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface StateInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const StateInspectorPanel: React.FC<StateInspectorPanelProps> = ({ isOpen, onClose }) => {
  const scenario = useSimulationStore(state => state.scenario);
  const nodeStates = useSimulationStore(state => state.nodeStates);
  const currentTime = useSimulationStore(state => state.currentTime);
  const setSelectedNodeId = useSimulationStore(state => state.setSelectedNodeId);

  if (!isOpen || !scenario) return null;

  const getStateColor = (state: string): string => {
    if (state.includes('idle')) return "bg-gray-100 text-gray-700";
    if (state.includes('accumulating') || state.includes('collecting')) return "bg-blue-100 text-blue-700";
    if (state.includes('processing') || state.includes('calculating') || state.includes('generating')) return "bg-yellow-100 text-yellow-700";
    if (state.includes('emitting') || state.includes('route')) return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const getStateDisplayName = (state: string): string => {
    const parts = state.split('_');
    return parts.length > 1 ? parts.slice(1).join(' ') : state;
  };

  return (
    <Card className="fixed top-20 right-4 w-80 max-h-[70vh] z-20 shadow-lg border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            State Machine Inspector
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Current states of all nodes at time {currentTime}s
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {scenario.nodes.map(node => {
              const nodeState = nodeStates[node.nodeId];
              const currentState = nodeState?.stateMachine?.currentState || "unknown";
              const transitionCount = nodeState?.stateMachine?.transitionHistory?.length || 0;
              const lastTransition = nodeState?.stateMachine?.transitionHistory?.slice(-1)[0];

              return (
                <div key={node.nodeId} className="p-2 border rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">{node.displayName}</div>
                      <div className="text-xs text-muted-foreground">{node.type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs font-mono", getStateColor(currentState))}>
                        {getStateDisplayName(currentState)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setSelectedNodeId(node.nodeId)}
                        title="View detailed state machine"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <span>{transitionCount} transitions</span>
                    </div>
                    {lastTransition && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Changed at {lastTransition.timestamp}s</span>
                      </div>
                    )}
                  </div>

                  {/* Show recent transitions */}
                  {nodeState?.stateMachine?.transitionHistory && nodeState.stateMachine.transitionHistory.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-xs text-muted-foreground mb-1">Recent transitions:</div>
                      <div className="space-y-1">
                        {nodeState.stateMachine.transitionHistory.slice(-2).map((transition, index) => (
                          <div key={index} className="text-xs font-mono bg-gray-50 p-1 rounded">
                            {getStateDisplayName(transition.from)} → {getStateDisplayName(transition.to)}
                            {transition.trigger && <span className="text-muted-foreground ml-1">({transition.trigger})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default StateInspectorPanel;