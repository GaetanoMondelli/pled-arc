"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HistoryEntry, Token } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";
import { ActivityColors } from "@/lib/simulation/activityMessages";
import { ChevronDown, ChevronRight } from "lucide-react";

// Component for expandable activity items in lineage
function ExpandableActivityItem({ activity, nodesConfig }: { activity: any; nodesConfig: any }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasComplexValue = typeof activity.value === 'object' && activity.value !== null;

  return (
    <div className="border rounded bg-white">
      <div className="p-3 cursor-pointer hover:bg-gray-50" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="grid grid-cols-[130px_150px_1fr_80px_40px] gap-3 items-start text-sm">
          <div className="font-mono text-muted-foreground text-xs break-all">
            t{activity.tick}
          </div>
          <div className="font-mono text-xs truncate" title={nodesConfig[activity.nodeId]?.displayName || activity.nodeId}>
            {nodesConfig[activity.nodeId]?.displayName || activity.nodeId}
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                {activity.action}
              </span>
              <span className="text-xs text-muted-foreground break-words min-w-0 flex-1">
                {hasComplexValue
                  ? `${JSON.stringify(activity.value).slice(0, 40)}...`
                  : String(activity.value)}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {activity.correlationIds && activity.correlationIds.length > 0 && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded whitespace-nowrap">
                CID: {activity.correlationIds.length}
              </span>
            )}
          </div>
          <div className="flex justify-center flex-shrink-0">
            {hasComplexValue && (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && hasComplexValue && (
        <div className="border-t bg-gray-50 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Full Value:</div>
          <pre className="text-xs bg-white p-2 rounded border font-mono overflow-x-auto">
            {JSON.stringify(activity.value, null, 2)}
          </pre>
          {activity.correlationIds && activity.correlationIds.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Correlation IDs:</div>
              <div className="flex flex-wrap gap-1">
                {activity.correlationIds.map((cid: string, cidIndex: number) => (
                  <span key={cidIndex} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
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
}

// Component for expandable JSON values
function ExpandableValue({ value, maxLength = 20 }: { value: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (value.length <= maxLength) {
    return <span className="font-mono">{value}</span>;
  }

  const shortValue = value.slice(0, maxLength) + '...';

  return (
    <div className="w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1 font-mono hover:text-gray-600 w-full justify-start"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
        {isExpanded ? 'Hide' : shortValue}
      </button>
      {isExpanded && (
        <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap max-w-md overflow-x-auto">
          {value}
        </div>
      )}
    </div>
  );
}

// Component for expandable activity records
function ExpandableActivityRecord({ log, originalIndex, getNodeDisplayName, getActionColor, renderTokenLinks, handleTokenClick, onShowLineage }: any) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Format sequence - use original position from full array or actual sequence
  const sequenceDisplay = log.sequence !== undefined ? log.sequence : originalIndex;

  // Extract correlation ID if available - check multiple possible fields
  const correlationId =
    log.cId ||
    log.correlationId ||
    (log.correlationIds && log.correlationIds.length > 0 ? log.correlationIds[0] : null) ||
    (log.value && typeof log.value === 'object' && log.value.cId) ||
    (log.value && typeof log.value === 'object' && log.value.correlationId) ||
    (log.metadata && log.metadata.correlationId) ||
    null;

  // Format timestamp - handle different timestamp formats
  const formatTimestamp = (timestamp: any) => {
    // Try tick field first (from new processors), then timestamp field (legacy)
    const timeValue = log.tick !== undefined ? log.tick : timestamp;
    if (timeValue === undefined || timeValue === null) return 'N/A';
    if (typeof timeValue === 'number') {
      // If it's a large timestamp (like epoch), show it as tick
      if (timeValue > 1000000000) {
        return `t:${timeValue}`;
      }
      // If it's a smaller number, show as seconds
      return `${timeValue}s`;
    }
    // Try to parse if it's a string timestamp
    if (typeof timeValue === 'string') {
      const parsed = parseFloat(timeValue);
      if (!isNaN(parsed)) {
        return parsed > 1000000000 ? `t:${parsed}` : `${parsed}s`;
      }
    }
    return String(timeValue);
  };

  // Handle CID click to show token lineage
  const handleCidClick = (cId: string) => {
    if (cId && cId !== '-') {
      console.log('🔍 [CID CLICK] Showing token lineage for:', cId);
      // Use core token lineage component
      if (onShowLineage) {
        onShowLineage(cId);
      }
    }
  };

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <div className="px-3 py-2 text-xs hover:bg-muted/30">
        <div className="flex gap-3 items-start">
          <div className="w-12 flex-shrink-0 font-mono text-muted-foreground text-xs truncate" title={`Sequence: ${sequenceDisplay}`}>
            {sequenceDisplay}
          </div>
          <div className="w-48 flex-shrink-0 font-medium truncate text-xs" title={getNodeDisplayName(log.nodeId)}>
            {getNodeDisplayName(log.nodeId)}
          </div>
          <div className="w-32 flex-shrink-0 text-xs truncate">
            {correlationId && correlationId !== '-' ? (
              <button
                className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded text-xs transition-colors"
                title={`Correlation ID: ${correlationId} (click for lineage)`}
                onClick={() => handleCidClick(correlationId)}
              >
                {correlationId}
              </button>
            ) : (
              <span className="font-mono text-muted-foreground">-</span>
            )}
          </div>
          <div className="w-24 flex-shrink-0 text-right truncate">
            {log.value !== undefined && log.value !== null ? (
              typeof log.value === 'object' ?
                <ExpandableValue value={JSON.stringify(log.value, null, 2)} maxLength={12} /> :
                <span className="font-mono text-xs">{String(log.value)}</span>
            ) : <span className="font-mono text-muted-foreground text-xs">-</span>}
          </div>
          <div className="flex-1 min-w-0 text-muted-foreground text-xs">
            <ExpandableValue value={log.details || "-"} maxLength={50} />
          </div>
          <div className="w-8 flex-shrink-0 flex justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
              title={isExpanded ? "Collapse record" : "Expand record"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded view with full details */}
        {isExpanded && (
          <div className="mt-3 p-3 bg-gray-50 rounded border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Record Details</h4>
                <div className="space-y-1">
                  <div><span className="font-medium">Sequence:</span> <span className="font-mono">{sequenceDisplay}</span></div>
                  <div><span className="font-medium">Timestamp:</span> <span className="font-mono">{formatTimestamp(log.timestamp || log.tick)}</span></div>
                  {correlationId && (
                    <div><span className="font-medium">Correlation ID:</span> <span className="font-mono">{correlationId}</span></div>
                  )}
                  <div><span className="font-medium">Node ID:</span> <span className="font-mono">{log.nodeId}</span></div>
                  <div><span className="font-medium">Node Name:</span> {getNodeDisplayName(log.nodeId)}</div>
                  <div><span className="font-medium">Action:</span> <span className="font-mono">{log.action}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Value & Data</h4>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Value:</span>
                    <div className="mt-1 p-2 bg-white rounded border font-mono text-xs overflow-x-auto">
                      {log.value !== undefined ? (
                        typeof log.value === 'object' ?
                          <pre>{JSON.stringify(log.value, null, 2)}</pre> :
                          String(log.value)
                      ) : '-'}
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">Details:</span>
                    <div className="mt-1 p-2 bg-white rounded border text-xs">
                      {renderTokenLinks(log.details || "-")}
                    </div>
                  </div>

                  {log.sourceTokenIds && log.sourceTokenIds.length > 0 && (
                    <div>
                      <span className="font-medium">Source Tokens:</span>
                      <div className="mt-1 space-x-2">
                        {log.sourceTokenIds.map((tokenId: string, idx: number) => (
                          <button
                            key={tokenId}
                            onClick={() => handleTokenClick(tokenId)}
                            className="text-primary hover:text-primary/80 underline font-mono text-xs bg-white px-2 py-1 rounded border"
                            title={`Click to inspect token ${tokenId}`}
                          >
                            {tokenId}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact source tokens for non-expanded view */}
        {!isExpanded && log.sourceTokenIds && log.sourceTokenIds.length > 0 && (
          <div className="mt-1 ml-16 text-xs text-muted-foreground/70">
            Source:{" "}
            {log.sourceTokenIds.map((tokenId: string, idx: number) => (
              <span key={tokenId}>
                {idx > 0 && ", "}
                <button
                  onClick={() => handleTokenClick(tokenId)}
                  className="text-primary hover:text-primary/80 underline font-mono"
                  title={`Click to inspect token ${tokenId}`}
                >
                  {tokenId}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Accept both legacy and event-driven history entries (they have slightly different types)
const GlobalActivityTable: React.FC<{
  logs: any[];
  engine?: any;
  templateId?: string;
  executionId?: string;
  currentStep?: number;
}> = ({ logs, engine, templateId, executionId, currentStep }) => {
  const nodesConfig = useSimulationStore(state => state.nodesConfig);
  const setSelectedToken = useSimulationStore(state => state.setSelectedToken);
  const globalActivityLog = useSimulationStore(state => state.globalActivityLog);

  // State for token lineage modal
  const [lineageModalOpen, setLineageModalOpen] = React.useState(false);
  const [selectedTokenForLineage, setSelectedTokenForLineage] = React.useState<Token | null>(null);
  const [lineageData, setLineageData] = React.useState<any>(null);

  const handleShowLineage = async (correlationId: string) => {
    console.log('🔍 [LINEAGE] Showing lineage for correlation ID:', correlationId);

    try {
      let activities: any[] = [];
      let journey: any = null;

      // Try server API first if we have templateId, executionId, and currentStep
      if (templateId && executionId && currentStep !== undefined) {
        console.log('🔍 [LINEAGE] Loading lineage from server API');

        const { engineAPIService } = await import('@/lib/services/engine-api-service');
        const result = await engineAPIService.getTokenLineage(
          templateId,
          executionId,
          correlationId,
          currentStep
        );

        activities = result.activities;
        journey = result.journey;
        console.log(`✅ [LINEAGE] Loaded ${activities.length} activities from server`);
      }
      // Fallback to client-side engine
      else if (engine) {
        console.log('🔍 [LINEAGE] Using client-side engine (no server params available)');
        const ledger = engine.getLedger();
        const allActivities = ledger.getActivities();

        // Filter activities by correlation ID
        activities = allActivities.filter((activity: any) => {
          if (activity.cId === correlationId) return true;
          if (activity.correlationId === correlationId) return true;
          if (Array.isArray(activity.correlationIds) && activity.correlationIds.includes(correlationId)) return true;
          if (activity.data?.cId === correlationId) return true;
          if (activity.value?.cId === correlationId) return true;
          if (activity.metadata?.correlationId === correlationId) return true;
          return false;
        });

        // Build simple journey
        journey = {
          correlationId,
          activities: activities.sort((a, b) => (a.tick || a.timestamp || 0) - (b.tick || b.timestamp || 0)),
          nodes: [...new Set(activities.map(a => a.nodeId))],
          startTime: activities.length > 0 ? (activities[0].tick || activities[0].timestamp || 0) : 0,
          endTime: activities.length > 0 ? (activities[activities.length - 1].tick || activities[activities.length - 1].timestamp || 0) : 0,
        };

        console.log(`✅ [LINEAGE] Found ${activities.length} activities from client engine`);
      } else {
        console.warn('🔍 [LINEAGE] No server params or engine available for lineage tracking');
        return;
      }

      // Create a token object for the lineage viewer
      const token: Token = {
        id: correlationId,
        value: activities.length > 0 ? activities[0].value : null,
        createdAt: Date.now(),
        originNodeId: activities.length > 0 ? activities[0].nodeId : 'unknown',
        history: activities
      };

      setSelectedTokenForLineage(token);
      setLineageData({
        journey,
        activities,
        correlationId
      });
      setLineageModalOpen(true);
    } catch (error) {
      console.error('🔍 [LINEAGE] Error getting lineage data:', error);
    }
  };

  const handleTokenClick = (tokenId: string) => {
    console.log(`🔍 [TOKEN CLICK] Inspecting token: ${tokenId}`);

    // Find the token in the global activity log and reconstruct it
    const tokenEvents = logs.filter(
      log =>
        log.sourceTokenIds?.includes(tokenId) ||
        log.details?.includes(`Token ${tokenId}`) ||
        log.details?.includes(tokenId)
    );

    console.log(`🔍 [TOKEN CLICK] Found ${tokenEvents.length} events for token ${tokenId}`);

    if (tokenEvents.length > 0) {
      // Look for token creation events (token_emitted, processing, firing)
      const createEvent = tokenEvents.find(e =>
        (e.action === "token_emitted" ||
         e.action === "processing" ||
         e.action === "firing") &&
        e.details?.includes(tokenId)
      );

      if (createEvent) {
        console.log(`🔍 [TOKEN CLICK] Found creation event:`, createEvent);

        const reconstructedToken: Token = {
          id: tokenId,
          value: createEvent.value !== undefined ? createEvent.value : 0,
          createdAt: createEvent.timestamp,
          originNodeId: createEvent.nodeId,
          history: tokenEvents as any, // Compatible but has extended operationType
        };

        console.log(`🔍 [TOKEN CLICK] Setting selected token:`, reconstructedToken);
        setSelectedToken(reconstructedToken);
      } else {
        // If no creation event found, try to reconstruct from any event
        const firstEvent = tokenEvents[0];
        if (firstEvent) {
          console.log(`🔍 [TOKEN CLICK] Using first event as fallback:`, firstEvent);

          const reconstructedToken: Token = {
            id: tokenId,
            value: firstEvent.value !== undefined ? firstEvent.value : 0,
            createdAt: firstEvent.timestamp,
            originNodeId: firstEvent.nodeId,
            history: tokenEvents as any, // Compatible but has extended operationType
          };

          setSelectedToken(reconstructedToken);
        } else {
          console.warn(`🔍 [TOKEN CLICK] Could not reconstruct token ${tokenId}`);
        }
      }
    } else {
      console.warn(`🔍 [TOKEN CLICK] No events found for token ${tokenId}`);
    }
  };

  const renderTokenLinks = (text: string) => {
    if (!text) return text;

    // Match token IDs in the format "Token ABC123XY" - more restrictive to avoid false matches
    const tokenRegex = /Token ([A-Za-z0-9]{8})/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      const tokenId = match[1];

      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add clickable token link
      parts.push(
        <button
          key={`${tokenId}-${match.index}`}
          onClick={() => handleTokenClick(tokenId)}
          className="text-primary hover:text-primary/80 underline font-mono text-xs"
          title={`Click to inspect token ${tokenId}`}
        >
          {match[0]}
        </button>,
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 1 ? parts : text;
  };

  const getNodeDisplayName = (nodeId: string) => {
    return nodesConfig[nodeId]?.displayName || nodeId;
  };

  const getActionColor = (action: string): string => {
    return ActivityColors.getActionColor(action);
  };

  return (
    <div className="border rounded-md">
      <div className="bg-muted/50 px-3 py-2 text-xs font-medium border-b">
        <div className="flex gap-3">
          <div className="w-12 flex-shrink-0">Seq</div>
          <div className="w-48 flex-shrink-0">Node</div>
          <div className="w-32 flex-shrink-0">Lineage</div>
          <div className="w-24 flex-shrink-0">Value</div>
          <div className="flex-1 min-w-0">Details</div>
          <div className="w-8 flex-shrink-0"></div>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {logs
          .slice(-100)
          .reverse()
          .map((log, index) => {
            // Calculate original sequence position (most recent first)
            const totalLogs = Math.min(logs.length, 100);
            const originalIndex = totalLogs - index;

            return (
              <ExpandableActivityRecord
                key={`${log.sequence || originalIndex}-${index}`}
                log={log}
                originalIndex={originalIndex}
                getNodeDisplayName={getNodeDisplayName}
                getActionColor={getActionColor}
                renderTokenLinks={renderTokenLinks}
                handleTokenClick={handleTokenClick}
                onShowLineage={handleShowLineage}
              />
            );
          })}
      </div>

      {/* Token Lineage Modal */}
      {selectedTokenForLineage && lineageData && (
        <Dialog open={lineageModalOpen} onOpenChange={setLineageModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Token Lineage</DialogTitle>
              <DialogDescription>
                Complete lineage and journey for correlation ID: {selectedTokenForLineage.id}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Journey Summary */}
              {lineageData.journey && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="font-semibold text-sm mb-3">Journey Summary</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Steps:</span>
                      <div className="font-mono">{lineageData.journey.summary?.totalSteps || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nodes Visited:</span>
                      <div className="font-mono">{lineageData.journey.summary?.nodesVisited?.length || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transformations:</span>
                      <div className="font-mono">{lineageData.journey.summary?.transformations?.length || 0}</div>
                    </div>
                  </div>
                  {lineageData.journey.summary?.nodesVisited && (
                    <div className="mt-3">
                      <span className="text-muted-foreground text-sm">Path: </span>
                      <span className="font-mono text-sm">
                        {lineageData.journey.summary.nodesVisited.join(' → ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Activities List */}
              <div className="border rounded-lg">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-sm">Activities ({lineageData.activities.length})</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {lineageData.activities.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {lineageData.activities.map((activity: any, index: number) => (
                        <ExpandableActivityItem
                          key={index}
                          activity={activity}
                          nodesConfig={nodesConfig}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      No activities found for this correlation ID
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLineageModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

interface GlobalLedgerModalProps {
  engine?: any; // SimulationEngine instance
  templateId?: string; // For server-side API calls
  executionId?: string; // For server-side API calls
  currentStep?: number; // Current simulation step
}

const GlobalLedgerModal: React.FC<GlobalLedgerModalProps> = ({
  engine,
  templateId,
  executionId,
  currentStep
}) => {
  const isGlobalLedgerOpen = useSimulationStore(state => state.isGlobalLedgerOpen);
  const toggleGlobalLedger = useSimulationStore(state => state.toggleGlobalLedger);

  // Get activity log from core engine or fallback to legacy
  const globalActivityLog = React.useMemo(() => {
    if (engine) {
      // Use core engine's ActivityLedger
      const ledger = engine.getLedger();
      const activities = ledger.getActivities();

      // Convert core ActivityEntry format to display format
      return activities.map((activity: any) => ({
        tick: activity.tick,
        action: activity.action,
        nodeId: activity.nodeId,
        nodeType: activity.nodeType,
        value: activity.value,
        details: `${activity.action} - ${activity.nodeId}`,
        correlationIds: activity.correlationIds || [],
        metadata: activity.metadata || {},
        seq: activity.seq
      }));
    } else {
      // Fallback to legacy activity log
      return useSimulationStore.getState().globalActivityLog || [];
    }
  }, [engine, isGlobalLedgerOpen]); // Re-compute when modal opens to get fresh data

  // Debug logging
  React.useEffect(() => {
    if (isGlobalLedgerOpen) {
      console.log(`📊 [GLOBAL LEDGER] Using ${engine ? 'CORE ENGINE' : 'LEGACY'} ActivityLedger`);
      console.log(`   Activity Log: ${globalActivityLog.length} entries`);
      if (globalActivityLog.length > 0) {
        console.log(`   First entry: ${globalActivityLog[0].action} at tick ${globalActivityLog[0].tick}`);
        console.log(`   Last entry: ${globalActivityLog[globalActivityLog.length - 1].action} at tick ${globalActivityLog[globalActivityLog.length - 1].tick}`);
      }
    }
  }, [isGlobalLedgerOpen, globalActivityLog.length, engine]);

  const handleOpenChange = (open: boolean) => {
    if (!open && isGlobalLedgerOpen) {
      toggleGlobalLedger();
    } else if (open && !isGlobalLedgerOpen) {
      toggleGlobalLedger();
    }
  };

  return (
    <Dialog open={isGlobalLedgerOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline">Global Event Ledger</DialogTitle>
          <DialogDescription>
            A chronological log of all significant events across all nodes in the simulation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 pr-2">
          {globalActivityLog && globalActivityLog.length > 0 ? (
            <GlobalActivityTable
              logs={globalActivityLog}
              engine={engine}
              templateId={templateId}
              executionId={executionId}
              currentStep={currentStep}
            />
          ) : (
            <p className="text-sm text-muted-foreground p-3 border rounded-md">
              No global activity logged yet. Start the simulation or load a scenario.
            </p>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border mt-auto flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalLedgerModal;
