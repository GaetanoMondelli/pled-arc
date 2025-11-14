"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import type { NodeProps } from "reactflow";
import type { RFNodeData } from "@/lib/simulation/types";
import BaseNodeDisplay from "./BaseNodeDisplay";
import FSMConfigModal from "./FSMConfigModal";
import { useSimulationStore } from "@/stores/simulationStore";

const FSMNodeDisplay: React.FC<NodeProps<RFNodeData>> = (props) => {
  const { data, id } = props;
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Subscribe to store for reactive updates
  const fsmStateFromStore = useSimulationStore(state => state.nodeStates[id]);
  const activityLog = useSimulationStore(state => state.globalActivityLog);
  const configFromStore = useSimulationStore(state => state.nodesConfig[id]);
  const config = configFromStore || data.config;
  
  const fsmState = fsmStateFromStore || ((data as any).nodeState);
  const fsmDefinition = config.fsm;

  // Get current state and counts
  const currentState = fsmState?.currentFSMState || fsmDefinition?.initialState || 'idle';
  const fsmVariables = fsmState?.fsmVariables || {};
  const inputBuffers = fsmState?.inputBuffers || {};

  const totalMessages = Object.values(inputBuffers).reduce<number>((sum, buffer) => {
    if (Array.isArray(buffer)) return sum + buffer.length;
    return sum;
  }, 0);

  const stateChangeCount = activityLog?.filter(
    log => log.nodeId === id && log.action === 'fsm_transition'
  ).length || 0;

  const totalStates = fsmDefinition?.states?.length || 0;
  const totalTransitions = fsmDefinition?.transitions?.length || 0;

  return (
    <>
      <BaseNodeDisplay
        {...props}
        icon={Settings}
        nodeType="FSM Process"
        headerColor="bg-blue-600"
        activeBorderColor="border-blue-400"
        activeShadowColor="shadow-blue-400/50"
        showInputHandle={true}
        showOutputHandle={true}
        inputHandleId="event"
        outputHandleId="state"
        showEditButton={true}
        onEditClick={() => setIsConfigModalOpen(true)}
        expandable={true}
        defaultExpanded={false}
        configSection={
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">States:</span>
              <span className="font-mono font-semibold">{totalStates}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transitions:</span>
              <span className="font-mono font-semibold">{totalTransitions}</span>
            </div>
          </div>
        }
        runtimeSection={
          <div className="space-y-1 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">State:</span>
              <Badge 
                variant="outline"
                className={cn(
                  "text-[9px] px-1.5 py-0",
                  currentState === fsmDefinition?.initialState
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-orange-100 text-orange-700 border-orange-300"
                )}
              >
                {currentState}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Msg Received:</span>
              <span className="font-mono font-semibold">{totalMessages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">State Changes:</span>
              <span className="font-mono font-semibold">{stateChangeCount}</span>
            </div>
            {Object.keys(fsmVariables).length > 0 && (
              <div className="pt-0.5 space-y-0.5 border-t border-muted-foreground/10">
                <span className="text-muted-foreground text-[9px]">Variables:</span>
                {Object.entries(fsmVariables).slice(0, 2).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-[9px]">
                    <span className="text-muted-foreground font-mono">{key}:</span>
                    <span className="font-mono truncate max-w-[80px]" title={String(value)}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
                {Object.keys(fsmVariables).length > 2 && (
                  <div className="text-[9px] text-muted-foreground">
                    +{Object.keys(fsmVariables).length - 2} more...
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />
      <FSMConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        nodeId={id}
        currentConfig={config}
      />
    </>
  );
};

export default React.memo(FSMNodeDisplay);
