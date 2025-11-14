import React, { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSimulationStore } from "@/stores/simulationStore";
import { useTemplateEditor } from "@/app/template-editor/hooks/useTemplateEditor";

// Type definitions
interface NodeStateMachineState {
  currentState: string;
  previousState?: string;
  transitionReason?: string;
  stateChangedAt?: number;
}

interface StateMachineInfo {
  currentState?: string;
  previousState?: string;
  transitionReason?: string;
}

interface ActivityLogEnhancedProps {
  nodeId: string;
  stateMachineInfo?: StateMachineInfo;
  onEventClick?: (event: any, stateAtTime?: NodeStateMachineState) => void;
  engine?: any; // Optional engine override
  templateId?: string; // For server-side API calls
  executionId?: string; // For server-side API calls
  currentStep?: number; // Current simulation step
}

export const ActivityLogEnhanced: React.FC<ActivityLogEnhancedProps> = ({
  nodeId,
  stateMachineInfo,
  onEventClick,
  engine,
  templateId,
  executionId,
  currentStep
}) => {
  const editor = useTemplateEditor();
  // Use passed engine or fall back to editor engine
  const activeEngine = engine || editor.engine;
  const nodeActivityLogs = useSimulationStore(state => state.nodeActivityLogs);
  const nodesConfig = useSimulationStore(state => state.nodesConfig);
  const logs = nodeActivityLogs[nodeId] || [];
  const nodeConfig = nodesConfig[nodeId];
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Server-side activity loading
  const [serverActivities, setServerActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Load node activity from server API when modal opens
  React.useEffect(() => {
    if (templateId && executionId && nodeId && currentStep !== undefined) {
      setIsLoadingActivities(true);

      (async () => {
        try {
          console.log(`🔍 Loading node activity from server: ${templateId}/${executionId}/${nodeId} at step ${currentStep}`);

          const { engineAPIService } = await import('@/lib/services/engine-api-service');
          const result = await engineAPIService.getNodeActivity(
            templateId,
            executionId,
            nodeId,
            currentStep
          );

          console.log(`✅ Loaded ${result.activities.length} activities for node ${nodeId}`);
          setServerActivities(result.activities);
        } catch (error) {
          console.error('❌ Failed to load node activity:', error);
          setServerActivities([]);
        } finally {
          setIsLoadingActivities(false);
        }
      })();
    }
  }, [templateId, executionId, nodeId, currentStep]);

  // Enhanced data from core engine
  const coreNodeInfo = useMemo(() => {
    if (!activeEngine || !nodeId) return null;

    try {
      const nodeInfo = activeEngine.getNodeInfo(nodeId);
      return nodeInfo;
    } catch (error) {
      console.warn('Failed to get core node info:', error);
      return null;
    }
  }, [activeEngine, nodeId]);

  // Get activities from server API or core engine
  const coreActivities = useMemo(() => {
    // Prefer server activities if available
    if (serverActivities.length > 0) {
      console.log(`🔍 [NODE ACTIVITY] Using ${serverActivities.length} activities from server`);
      return serverActivities;
    }

    // Fall back to client-side engine - filter ledger by nodeId
    if (!activeEngine || !nodeId) {
      console.log(`🔍 [NODE ACTIVITY] Missing engine (${!!activeEngine}) or nodeId (${nodeId})`);
      return [];
    }

    try {
      const ledger = activeEngine.getLedger();
      const allActivities = ledger.getActivities();
      console.log(`🔍 [NODE ACTIVITY] Engine has ${allActivities.length} total activities`);

      // Filter activities by nodeId
      const nodeActivities = allActivities.filter((activity: any) => {
        return (
          activity.nodeId === nodeId ||
          activity.node === nodeId ||
          activity.sourceNodeId === nodeId ||
          activity.targetNodeId === nodeId ||
          (activity.data && activity.data.nodeId === nodeId)
        );
      });

      console.log(`🔍 [NODE ACTIVITY] Node ${nodeId}: Found ${nodeActivities.length} activities after filtering`);
      if (nodeActivities.length > 0) {
        console.log('   Sample activity:', nodeActivities[0]);
      }

      return nodeActivities;
    } catch (error) {
      console.warn('Failed to get core activities:', error);
      return [];
    }
  }, [serverActivities, activeEngine, nodeId, editor.tick]); // Re-compute when server activities or tick changes

  // Current FSM state from core engine (for FSM nodes)
  const currentFSMState = useMemo(() => {
    if (!coreNodeInfo || !nodeConfig) return null;

    // Check if this is an FSM node
    if (nodeConfig.type === 'FSM' || nodeConfig.type === 'FSMProcessNode') {
      const currentState = coreNodeInfo.currentState;
      const fsmInfo = coreNodeInfo.fsmInfo;

      return {
        currentState: fsmInfo?.currentState || currentState?.fsmState || 'pending',
        totalTransitions: fsmInfo?.totalTransitions || 0,
        processedTokens: fsmInfo?.processedTokens || 0,
        emittedTokens: fsmInfo?.emittedTokens || 0,
      };
    }

    return null;
  }, [coreNodeInfo, nodeConfig]);

  // Combine legacy logs with core activities for display
  const combinedActivities = useMemo(() => {
    const combined = [...coreActivities];

    // Add legacy logs that might not be in core activities
    logs.forEach(log => {
      const exists = combined.find(activity =>
        activity.action === log.action &&
        activity.tick === log.timestamp
      );
      if (!exists) {
        combined.push({
          seq: log.sequence,
          tick: log.timestamp,
          nodeId: nodeId,
          action: log.action,
          value: log.value,
          correlationIds: [],
          timestamp: Date.now()
        });
      }
    });

    return combined.sort((a, b) => b.tick - a.tick).slice(0, 30); // Latest 30 activities
  }, [coreActivities, logs, nodeId]);

  // Show loading state
  if (isLoadingActivities) {
    return (
      <div className="border rounded-md p-6">
        <div className="text-center space-y-3">
          <div className="text-muted-foreground">
            <div className="text-2xl mb-2 animate-pulse">⏳</div>
            <h4 className="font-medium">Loading Activity...</h4>
            <p className="text-sm">Fetching node activity from server</p>
          </div>
        </div>
      </div>
    );
  }

  if (combinedActivities.length === 0 && logs.length === 0) {
    return (
      <div className="border rounded-md p-6">
        <div className="text-center space-y-3">
          <div className="text-muted-foreground">
            <div className="text-2xl mb-2">📊</div>
            <h4 className="font-medium">No Activity Yet</h4>
            <p className="text-sm">This node hasn't processed any events yet.</p>
          </div>

          {!editor.scenario && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              💡 Load a scenario to start seeing node activity
            </div>
          )}

          {editor.scenario && !editor.isRunning && coreActivities.length === 0 && (
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              ▶️ Run the simulation to generate activity
            </div>
          )}

          {currentFSMState && (
            <div className="mt-3 p-2 bg-blue-50 border rounded">
              <h4 className="font-medium text-sm mb-2">Current FSM State</h4>
              <div className="flex items-center gap-2">
                <Badge variant="default">{currentFSMState.currentState}</Badge>
                <span className="text-xs text-muted-foreground">
                  Transitions: {currentFSMState.totalTransitions} |
                  Processed: {currentFSMState.processedTokens} |
                  Emitted: {currentFSMState.emittedTokens}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State comes directly from log entries - simulation store is authoritative
  const getStateAtTime = (timestamp: number): NodeStateMachineState | undefined => {
    const logEntry = logs.find(log => log.timestamp === timestamp);
    if (!logEntry?.state) return undefined;
    if (typeof logEntry.state === 'string') {
      return { currentState: logEntry.state } as NodeStateMachineState;
    }
    return logEntry.state as NodeStateMachineState;
  };

  const handleEventClick = (activity: any) => {
    const eventId = `${activity.seq}-${activity.tick}`;
    setSelectedEventId(selectedEventId === eventId ? null : eventId);
    const stateAtEventTime = getStateAtTime(activity.tick);
    onEventClick?.(activity, stateAtEventTime);
  };

  // Check if this is a StateMultiplexer
  const isMultiplexer = nodeConfig?.type === 'StateMultiplexer';

  return (
    <div className="space-y-3">
      {/* Current FSM State Display (for FSM nodes) */}
      {currentFSMState && (
        <div className="p-3 bg-blue-50 border rounded-md">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            🔄 Current FSM State
          </h4>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="font-mono">
                {currentFSMState.currentState}
              </Badge>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Transitions: {currentFSMState.totalTransitions}</span>
              <span>Processed: {currentFSMState.processedTokens}</span>
              <span>Emitted: {currentFSMState.emittedTokens}</span>
            </div>
          </div>
        </div>
      )}


      {/* Activity Log Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm text-muted-foreground">Activity Log</h4>
        <span className="text-xs text-muted-foreground">Click rows for details</span>
      </div>

      {/* Core Engine Activity Table */}
      <div className="border rounded-md">
        <div className="bg-muted/50 px-2 py-1 text-xs font-medium border-b">
          <div className="flex gap-1">
            <div className="w-12 flex-shrink-0 border-r border-gray-300 pr-1">Time</div>
            <div className="w-28 flex-shrink-0 border-r border-gray-300 pr-1">Event</div>
            <div className="w-20 flex-shrink-0 border-r border-gray-300 pr-1">Value</div>
            {isMultiplexer ? (
              <>
                <div className="w-24 flex-shrink-0 border-r border-gray-300 pr-1">Output</div>
                <div className="w-24 flex-shrink-0 border-r border-gray-300 pr-1">Condition</div>
              </>
            ) : (
              <>
                <div className="w-24 flex-shrink-0 border-r border-gray-300 pr-1">State</div>
                <div className="w-16 flex-shrink-0 border-r border-gray-300 pr-1">Buf/Out</div>
              </>
            )}
            <div className="flex-1 min-w-0 pl-1">Details</div>
            <div className="w-4 flex-shrink-0"></div>
          </div>
        </div>
      <ScrollArea className="h-64 w-full">
        <div className="divide-y min-h-0">
          {coreActivities
            .slice(-30)
            .reverse()
            .map((activity, index) => {
              const eventId = `${activity.seq}-${activity.tick}`;
              const isSelected = selectedEventId === eventId;
              const stateAtEventTime = getStateAtTime(activity.tick);

              // State comes directly from simulation store

              return (
                <div
                  key={eventId}
                  className={`px-2 py-1 text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => handleEventClick(activity)}
                  title="Click to see details and update state machine"
                >
                  {/* Compact main row */}
                  <div className="flex gap-1 items-center">
                    <div className="w-12 flex-shrink-0 font-mono text-muted-foreground text-xs border-r border-gray-200 pr-1">t{activity.tick}</div>
                    <div className="w-28 flex-shrink-0 border-r border-gray-200 pr-1">
                      <span
                        className={`px-1 py-0.5 rounded text-xs font-medium ${getActionColor(activity.action)} block truncate`}
                        title={activity.action}
                      >
                        {activity.action}
                      </span>
                    </div>
                    <div className="w-20 flex-shrink-0 font-mono text-right text-xs break-all border-r border-gray-200 pr-1">
                      {activity.value !== undefined ?
                        (typeof activity.value === 'object' ?
                          JSON.stringify(activity.value).slice(0, 30) + (JSON.stringify(activity.value).length > 30 ? '...' : '') :
                          String(activity.value)
                        ) : "-"}
                    </div>
                    {isMultiplexer ? (
                      <>
                        <div className="w-24 flex-shrink-0 border-r border-gray-200 pr-1">
                          <span className="px-1 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 block truncate" title={`Output: ${(activity as any).multiplexerOutput || 'N/A'}`}>
                            {(activity as any).multiplexerOutput || "-"}
                          </span>
                        </div>
                        <div className="w-24 flex-shrink-0 border-r border-gray-200 pr-1">
                          <span className="px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 block truncate" title={`Condition: ${(activity as any).multiplexerCondition || 'N/A'}`}>
                            {(activity as any).multiplexerCondition === 'default' ? '🔀 default' : (activity as any).multiplexerCondition || "-"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-24 flex-shrink-0 border-r border-gray-200 pr-1">
                          <span className="px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 block truncate" title={`State: ${(activity as any).state || 'N/A'}`}>
                            {(activity as any).state?.split('_')[1] || (activity as any).state || '-'}
                          </span>
                        </div>
                        <div className="w-16 flex-shrink-0 text-xs text-gray-600 font-mono border-r border-gray-200 pr-1">
                          {(activity as any).bufferSize || 0}/{(activity as any).outputBufferSize || 0}
                        </div>
                      </>
                    )}
                    <div className="flex-1 min-w-0 text-muted-foreground text-xs truncate pl-1">
                      {(activity as any).details || activity.action || "-"}
                    </div>
                    <div className="w-4 flex-shrink-0 text-muted-foreground">
                      {isSelected ? "−" : "+"}
                    </div>
                  </div>

                  {/* Expandable details */}
                  {isSelected && (
                    <div className="mt-1 p-2 bg-blue-50 rounded text-xs border-l-2 border-blue-300">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><strong>Event:</strong> {activity.action}</div>
                        <div><strong>State:</strong> {(activity as any).state || '-'}</div>
                        <div><strong>Sequence:</strong> {activity.seq}</div>
                        <div><strong>Timestamp:</strong> {activity.tick}</div>
                        <div><strong>Buffer Size:</strong> {(activity as any).bufferSize || 0}</div>
                        <div><strong>Output Buffer:</strong> {(activity as any).outputBufferSize || 0}</div>
                      </div>
                      {activity.value && (
                        <div className="mt-2">
                          <strong>Value:</strong>
                          <pre className="mt-1 p-1 bg-gray-100 text-xs rounded whitespace-pre-wrap break-all">
                            {typeof activity.value === 'object' ? JSON.stringify(activity.value, null, 2) : String(activity.value)}
                          </pre>
                        </div>
                      )}
                      {activity.correlationIds && activity.correlationIds.length > 0 && (
                        <div className="mt-2">
                          <strong>Correlation IDs:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {activity.correlationIds.map((cid: string, index: number) => (
                              <span key={index} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                                {cid}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
};

const getActionColor = (action: string): string => {
  // Simplified state-based event colors
  if (action === "accumulating") return "bg-orange-100 text-orange-800";
  if (action === "processing") return "bg-blue-100 text-blue-800";
  if (action === "emitting") return "bg-green-100 text-green-800";
  if (action === "token_received") return "bg-cyan-100 text-cyan-800";
  if (action === "firing") return "bg-purple-100 text-purple-800";
  if (action === "consuming") return "bg-pink-100 text-pink-800";
  if (action === "idle") return "bg-gray-100 text-gray-600";
  if (action === "error") return "bg-red-100 text-red-800";
  if (action === "token_dropped") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-700";
};

// Re-export types for use in main component
export type { NodeStateMachineState, StateMachineInfo };
