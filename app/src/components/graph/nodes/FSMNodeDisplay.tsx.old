"use client";

import React, { useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Settings, Activity, Variable, Trash2, ChevronDown, ChevronUp, Edit3 } from "lucide-react";
import type { RFNodeData } from "@/lib/simulation/types";
import FSMConfigModal from "./FSMConfigModal";
import { useSimulationStore } from "@/stores/simulationStore";

interface FSMNodeDisplayProps {
  data: RFNodeData;
  selected?: boolean;
  id: string;
}

const FSMNodeDisplay: React.FC<FSMNodeDisplayProps> = ({ data, selected, id }) => {
  const { deleteElements } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // CRITICAL: Subscribe directly to store for reactive updates!
  const fsmStateFromStore = useSimulationStore(state => state.nodeStates[id]);
  const activityLog = useSimulationStore(state => state.globalActivityLog);
  
  // Get FRESH config from store (not stale data.config prop)
  const configFromStore = useSimulationStore(state => state.nodesConfig[id]);
  const config = configFromStore || data.config;
  
  // Log config changes
  useEffect(() => {
    console.log(`⚙️ [FSM DISPLAY ${id}] Config updated:`, {
      hasConfigFromStore: !!configFromStore,
      outputsCount: config.outputs?.length || 0,
      outputs: config.outputs?.map((o: any) => o.name),
      fsl: config.fsl?.substring(0, 50)
    });
  }, [configFromStore, config, id]);
  
  // Use store state if available, fall back to prop
  const fsmState = fsmStateFromStore || ((data as any).nodeState);

  // Get FSM definition first
  const fsmDefinition = config.fsm;

  // Get current FSM state and variables - REACTIVE to nodeState changes
  const currentState = fsmState?.currentFSMState || fsmDefinition?.initialState || 'idle';
  const fsmVariables = fsmState?.fsmVariables || {};
  const inputBuffers = fsmState?.inputBuffers || {};

  // Count total messages (tokens) in input buffers
  const totalMessages = Object.values(inputBuffers).reduce<number>((sum, buffer) => {
    if (Array.isArray(buffer)) return sum + buffer.length;
    return sum;
  }, 0);

  // Count state changes from activity log (fsm_transition events for this node)
  const stateChangeCount = activityLog?.filter(
    log => log.nodeId === id && log.action === 'fsm_transition'
  ).length || 0;

  // DEBUG: Log current state for debugging
  useEffect(() => {
    console.log(`🎨 [FSM DISPLAY ${id}] State update:`, {
      currentState,
      totalMessages,
      stateChangeCount,
      fsmStateExists: !!fsmState,
      dataNodeState: (data as any).nodeState?.currentFSMState,
      fsmStateValue: fsmState?.currentFSMState
    });
  }, [fsmState?.currentFSMState, currentState, totalMessages, stateChangeCount, id, fsmState, data]);
  // Extract state names - handle both string array and object array formats
  const totalStates = fsmDefinition?.states?.length || 0;
  const stateNames = fsmDefinition?.states ?
    fsmDefinition.states.map((state: any) => {
      if (typeof state === 'string') return state;
      if (typeof state === 'object' && state.name) return state.name;
      console.warn(`⚠️ [FSM DISPLAY ${id}] Invalid state format:`, state);
      return String(state); // Fallback
    }).filter(Boolean) : [];
  const totalTransitions = fsmDefinition?.transitions?.length || 0;

  // Get state color based on current state
  const getStateColor = (stateName: string) => {
    if (stateName === fsmDefinition?.initialState) return 'text-green-700 bg-green-50 border-green-200';
    return 'text-orange-700 bg-orange-50 border-orange-200';
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div className="relative group">
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 hover:bg-gray-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center shadow-sm"
        title="Delete node"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>

      <div
        className={cn(
          "bg-white border-2 rounded-lg shadow-sm min-w-[240px] transition-all duration-200",
          data.isActive
            ? "border-blue-500 shadow-lg shadow-blue-100"
            : "border-blue-200 hover:border-blue-300",
          selected && "ring-2 ring-blue-500 ring-offset-2",
          data.error && "border-red-400 bg-red-50"
        )}
      >

      {/* Header */}
      <div className="px-3 py-2 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded">
            <Settings className="h-3 w-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-blue-900 truncate">
              {data.label}
            </div>
            <div className="text-xs flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                "font-semibold px-2 py-0.5 rounded",
                currentState === fsmDefinition?.initialState
                  ? "text-green-700 bg-green-100"
                  : "text-orange-700 bg-orange-100"
              )}>
                {currentState === fsmDefinition?.initialState && "⚡ "}{currentState}
              </span>
              {totalMessages > 0 && (
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {totalMessages} msg
                </span>
              )}
              {stateChangeCount > 0 && (
                <span className="text-gray-500 text-[10px]">
                  {stateChangeCount} trans
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {data.isActive && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsConfigModalOpen(true);
              }}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded transition-colors"
              title="Configure FSM"
            >
              <Edit3 className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>



      {/* FSM States - Only show when expanded */}
      {isExpanded && (
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3 w-3 text-slate-500" />
            <span className="text-xs text-slate-600 font-medium">
              All States ({totalStates})
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {stateNames.map((state: string) => (
              <Badge
                key={state}
                variant="outline"
                className={cn(
                  "text-xs font-mono px-2 py-1 transition-all",
                  state === currentState
                    ? "bg-orange-100 text-orange-800 border-orange-300 ring-1 ring-orange-400"
                    : state === fsmDefinition?.initialState
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                {state === currentState && "● "}
                {state}
                {state === fsmDefinition?.initialState && " (initial)"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Variables (when expanded) */}
      {isExpanded && Object.keys(fsmVariables).length > 0 && (
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Variable className="h-3 w-3 text-slate-500" />
            <span className="text-xs text-slate-600 font-medium">Variables:</span>
          </div>
          <div className="space-y-1">
            {Object.entries(fsmVariables).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-slate-500 font-mono">{key}:</span>
                <span className="text-slate-700 font-mono">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
            {Object.keys(fsmVariables).length > 3 && (
              <div className="text-xs text-slate-400">
                +{Object.keys(fsmVariables).length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Info */}
      <div className="px-3 py-2 bg-slate-50">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">States:</span>
            <span className="font-mono text-slate-700">{totalStates}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Transitions:</span>
            <span className="font-mono text-slate-700">{totalTransitions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Msg Received:</span>
            <span className="font-mono text-slate-700">{totalMessages}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">State Changes:</span>
            <span className="font-mono text-slate-700">{stateChangeCount}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {data.error && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-200">
          <div className="text-xs text-red-700">{data.error}</div>
        </div>
      )}

      {/* Connection Handles */}
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="event"
        className="!bg-blue-500 !border-blue-600 !w-3 !h-3 !border-2"
        title="Event input"
      />
      
      {/* Output Handles - Dynamic from config.outputs */}
      {(() => {
        // CRITICAL: Use fsm.outputs as the source of truth if it exists
        // Then filter config.outputs to only show those that exist in fsm.outputs
        const fsmOutputNames = config.fsm?.outputs || [];
        let effectiveOutputs = config.outputs || [];
        
        // If fsm.outputs exists, only show outputs that are in that list
        if (fsmOutputNames.length > 0) {
          effectiveOutputs = effectiveOutputs.filter((out: any) => 
            fsmOutputNames.includes(out.name)
          );
        }
        
        console.log(`🎯 [FSM DISPLAY ${id}] Rendering handles:`, {
          fsmOutputs: fsmOutputNames,
          topLevelOutputs: config.outputs?.map((o: any) => o.name),
          effectiveOutputs: effectiveOutputs.map((o: any) => o.name),
          willRenderCount: effectiveOutputs.length
        });
        
        if (effectiveOutputs.length > 0) {
          return effectiveOutputs.map((output: any, index: number) => (
            <Handle
              key={output.name}
              type="source"
              position={Position.Right}
              id={output.name}
              style={{ top: `${(index + 1) * (100 / (config.outputs.length + 1))}%` }}
              className="!bg-blue-500 !border-blue-600 !w-3 !h-3 !border-2"
              title={`Output: ${output.name}`}
            />
          ));
        } else {
          console.warn(`⚠️ [FSM DISPLAY ${id}] No effective outputs! Using fallback handle "state".`);
          return (
            <Handle
              type="source"
              position={Position.Right}
              id="state"
              className="!bg-blue-500 !border-blue-600 !w-3 !h-3 !border-2"
              title="State output (fallback)"
            />
          );
        }
      })()}
      </div>

      {/* FSM Configuration Modal */}
      <FSMConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        nodeId={id}
        currentConfig={config}
      />
    </div>
  );
};

export default FSMNodeDisplay;