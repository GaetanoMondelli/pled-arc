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
import { Database, Clock, Hash, Play, CheckCircle2, Circle, ChevronDown, ChevronRight } from "lucide-react";

// Component for expandable JSON values
function ExpandableValue({ value, maxLength = 30 }: { value: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (value.length <= maxLength) {
    return <span className="ml-2 text-xs text-gray-800 font-mono">{value}</span>;
  }

  const shortValue = value.slice(0, maxLength) + '...';

  return (
    <div className="ml-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1 text-xs text-gray-800 font-mono hover:text-gray-600"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
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

interface EventQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine?: any; // SimulationEngine instance from useTemplateEditor
}

export function EventQueueModal({ isOpen, onClose, engine }: EventQueueModalProps) {
  console.log('🔍 EventQueueModal: isOpen?', isOpen, 'engine?', !!engine);

  // Get events and stats from core engine instead of event stores
  const { allEvents, processedCount, pendingCount, totalCount, edgeMap } = React.useMemo(() => {
    if (!engine) {
      return {
        allEvents: [],
        processedCount: 0,
        pendingCount: 0,
        totalCount: 0,
        edgeMap: new Map()
      };
    }

    // Get all events from core engine's queue
    const queue = engine.getQueue();
    console.log('🔍 EventQueueModal: Core engine queue:', queue);
    console.log('🔍 EventQueueModal: Queue size():', queue.size?.());
    console.log('🔍 EventQueueModal: Queue getEventHistory():', queue.getEventHistory?.());
    console.log('🔍 EventQueueModal: Queue getProcessedCount():', queue.getProcessedCount?.());

    const allEventsFromEngine = queue.getEventHistory?.() || [];
    const processedCountFromEngine = queue.getProcessedCount?.() || 0;
    const pendingCountFromEngine = queue.size?.() || 0;
    const totalCountFromEngine = processedCountFromEngine + pendingCountFromEngine;

    // Build edge map from engine's scenario
    const scenario = engine.scenario;
    const edgeMapFromEngine = new Map<string, string[]>();

    if (scenario) {
      const scenarioInfo = scenario.getScenarioInfo();
      if (scenarioInfo && Array.isArray(scenarioInfo.edges)) {
        scenarioInfo.edges.forEach((edge: any) => {
          const src = edge.source || edge.sourceNodeId || edge.sourceId;
          const tgt = edge.target || edge.targetNodeId || edge.targetId;
          if (!src || !tgt) return;
          if (!edgeMapFromEngine.has(src)) edgeMapFromEngine.set(src, []);
          edgeMapFromEngine.get(src)!.push(tgt);
        });
      } else if (scenarioInfo && Array.isArray(scenarioInfo.nodes)) {
        scenarioInfo.nodes.forEach((node: any) => {
          const outputs = node.outputs || node.connections || [];
          if (!outputs || outputs.length === 0) return;
          outputs.forEach((o: any) => {
            const tgt = o.destinationNodeId || o.targetNodeId || o.target;
            if (!tgt) return;
            if (!edgeMapFromEngine.has(node.nodeId)) edgeMapFromEngine.set(node.nodeId, []);
            edgeMapFromEngine.get(node.nodeId)!.push(tgt);
          });
        });
      }
    }

    return {
      allEvents: allEventsFromEngine,
      processedCount: processedCountFromEngine,
      pendingCount: pendingCountFromEngine,
      totalCount: totalCountFromEngine,
      edgeMap: edgeMapFromEngine
    };
  }, [engine, isOpen]);

  // Sort events and get unique node count
  const displayEvents = React.useMemo(() => {
    return allEvents.sort((a, b) => a.tick - b.tick);
  }, [allEvents]);

  const uniqueNodeCount = React.useMemo(() => {
    const s = new Set<string>();
    allEvents.forEach(e => s.add(e.sourceNodeId));
    return s.size;
  }, [allEvents]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-headline flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            Engine Task Queue
          </DialogTitle>
          <DialogDescription>
            Tasks currently in the simulation engine queue ready to be processed
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-gray-600 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            <span className="font-mono font-medium">{totalCount}</span> total
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{processedCount}</span> processed
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{pendingCount}</span> pending
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="font-mono font-medium">{uniqueNodeCount}</span> nodes
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {displayEvents.length > 0 ? (
            <div className="space-y-2">
              {displayEvents.slice(0, 200).map((event, idx) => {
                // Event is processed if its index is less than totalProcessed
                const isProcessed = idx < processedCount;
                const isDynamic = !!event.causedBy;

                // Extract and stringify a compact value to display with user-friendly formatting
                const payload = (event.data as any)?.payload ?? event.data;
                let emittedValue: string | undefined;

                // Special handling for different event types
                if (event.type === 'SourceEmit') {
                  emittedValue = 'emitting';
                } else if (event.type === 'DataEmit' && payload && typeof payload === 'object') {
                  // For DataEmit, show the token value and correlation ID
                  const token = payload.token;
                  const cId = payload.cId;

                  let valueStr = '';
                  if (token && typeof token.value === 'number') {
                    valueStr = `value: ${token.value.toFixed(2)}`;
                  } else if (token && token.value !== undefined) {
                    valueStr = `value: ${typeof token.value === 'object' ? JSON.stringify(token.value) : token.value}`;
                  } else {
                    valueStr = 'data';
                  }

                  // Add correlation ID if available
                  if (cId) {
                    emittedValue = `${valueStr} | cID: ${cId}`;
                  } else {
                    emittedValue = valueStr;
                  }
                } else if (payload === undefined || payload === null) {
                  emittedValue = undefined;
                } else if (typeof payload === 'object') {
                  // prefer payload.value if present
                  const v = (payload as any).value ?? payload;
                  try {
                    emittedValue = typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v);
                  } catch (e) {
                    emittedValue = String(v);
                  }
                } else {
                  emittedValue = String(payload);
                }

                // Determine targets (edgeMap or event metadata)
                const targets = (event.data as any)?.targetNodeIds || edgeMap.get(event.sourceNodeId) || [];

                return (
                  <div
                    key={event.id}
                    className={`flex flex-col text-xs px-2 py-1 border border-gray-200 bg-white`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate flex-1">
                      {/* neutral compact check */}
                      {isProcessed ? (
                        <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      )}
                      {/* small NEW marker without heavy color */}
                      {isDynamic && !isProcessed && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">NEW</span>
                      )}
                      <span className="font-mono text-gray-500">{event.id.slice(0, 8)}</span>
                      <span className="font-medium text-slate-700">{event.type}</span>
                      <span className="text-xs text-gray-600 font-mono">{event.sourceNodeId}</span>
                      {emittedValue !== undefined && (
                        <ExpandableValue value={emittedValue} maxLength={40} />
                      )}
                      {targets && targets.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500">→ {targets.join(', ')}</span>
                      )}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 justify-end">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">t:{event.tick}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displayEvents.length > 200 && (
                <div className="text-xs text-gray-500 text-center italic py-1">+{displayEvents.length - 200} more tasks...</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 p-4 text-center border rounded-md">
              No tasks in engine queue. Add external events to see them here.
            </p>
          )}
        </div>

        <DialogFooter className="pt-4 border-t mt-auto flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
