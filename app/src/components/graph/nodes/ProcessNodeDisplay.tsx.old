"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProcessNode, RFNodeData } from "@/lib/simulation/types";
import { cn } from "@/lib/utils";
import { Cpu, Circle, Trash2 } from "lucide-react";
import type { NodeProps } from "reactflow";
import { Handle, Position, useReactFlow } from "reactflow";

// Helper function to get state machine display info
const getStateMachineDisplay = (currentState?: string) => {
  if (!currentState) return null;
  
  const stateInfo: Record<string, { color: string; displayName: string }> = {
    process_idle: { color: "text-gray-500", displayName: "idle" },
    process_collecting: { color: "text-blue-500", displayName: "collecting" },
    process_calculating: { color: "text-yellow-500", displayName: "calculating" },
    process_emitting: { color: "text-green-500", displayName: "emitting" },
  };
  
  return stateInfo[currentState] || { color: "text-gray-400", displayName: "unknown" };
};

const ProcessNodeDisplay: React.FC<NodeProps<RFNodeData>> = ({ data, selected, id }) => {
  const config = data.config as ProcessNode;
  const numInputs = config.inputs.length;
  const numOutputs = config.outputs.length;
  const stateMachineInfo = getStateMachineDisplay(data.stateMachine?.currentState);
  const { deleteElements } = useReactFlow();

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
      
    <Card
      className={cn(
        "w-36 shadow-md transition-all duration-300",
        selected && "ring-2 ring-primary",
        data.isActive && "animate-pulse border-purple-400 shadow-purple-400/50 shadow-lg scale-105",
        data.error && "border-destructive shadow-destructive/50",
      )}
    >
      <CardHeader
        className={cn(
          "p-2 rounded-t-lg transition-colors duration-300 bg-indigo-600 text-white",
        )}
      >
        <CardTitle className="text-xs font-semibold flex items-center text-white">
          <Cpu className="h-3 w-3 mr-1" />
          {data.label}
          {/* State Machine Indicator */}
          {stateMachineInfo && (
            <div 
              className="ml-1" 
              title={`State: ${stateMachineInfo.displayName}`}
            >
              <Circle className="h-2 w-2 fill-current text-white/80" />
            </div>
          )}
          {data.isActive && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 text-[10px] space-y-0.5">
        {/* Config Section */}
        <div className="space-y-0.5">
          <p className="font-medium text-muted-foreground">CONFIG:</p>
          <p>Inputs: {numInputs}</p>
          <p>Outputs: {numOutputs}</p>
          {config.outputs.map((out, i) => (
            <p key={i} className="truncate font-mono text-[9px]" title={out.transformation?.formula || 'No formula'}>
              {out.transformation?.formula || 'No formula'}
            </p>
          ))}
        </div>
        
        {/* Separator */}
        <div className="border-t border-muted-foreground/20 my-1"></div>
        
        {/* Runtime Section */}
        <div className="space-y-0.5">
          <p className="font-medium text-muted-foreground">RUNTIME:</p>
          {stateMachineInfo && (
            <p className="font-mono" style={{ color: stateMachineInfo.color.replace('text-', '') }}>
              {stateMachineInfo.displayName}
            </p>
          )}
          {data.details && <p className="text-muted-foreground leading-tight">{data.details}</p>}
        </div>
        
        {data.error && <p className="mt-1 text-destructive text-xs">{data.error}</p>}
      </CardContent>
      {/* Input Handles */}
      {/* Show existing named inputs */}
      {config.inputs.map((input, index) => (
        <Handle
          key={`input-${input.name}-${index}`}
          type="target"
          position={Position.Left}
          id={input.name}
          style={{ top: `${(index + 1) * (100 / (numInputs + 2))}%` }}
          className="w-4 h-4 !bg-secondary hover:!bg-secondary/80 transition-all"
          title={`Input: ${input.alias || input.name} (from ${input.nodeId})`}
        />
      ))}
      {/* ALWAYS show a default "input" handle for adding NEW connections */}
      <Handle
        key="input-default"
        type="target"
        position={Position.Left}
        id="input"
        style={{ top: `${(numInputs + 1) * (100 / (numInputs + 2))}%` }}
        className="w-4 h-4 !bg-green-500 hover:!bg-green-600 transition-all border-2 border-white"
        title="➕ Connect here to add a new input"
      />
      {/* Output Handles */}
      {config.outputs.map((output, index) => (
        <Handle
          key={`output-${output.name}-${index}`}
          type="source"
          position={Position.Right}
          id={`output-${output.name}`}
          style={{ top: `${(index + 1) * (100 / (numOutputs + 1))}%` }}
          className="w-4 h-4 !bg-primary hover:!bg-primary/80 transition-all"
          title={`Output ${output.name} → ${output.destinationNodeId || 'not connected'}`}
        />
      ))}
    </Card>
    </div>
  );
};

export default React.memo(ProcessNodeDisplay);
