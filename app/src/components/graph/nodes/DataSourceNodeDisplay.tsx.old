"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataSourceNode, RFNodeData } from "@/lib/simulation/types";
import { cn } from "@/lib/utils";
import { DatabaseZap, Circle, Trash2 } from "lucide-react";
import type { NodeProps } from "reactflow";
import { Handle, Position, useReactFlow } from "reactflow";

// Helper function to get state machine display info
const getStateMachineDisplay = (currentState?: string) => {
  if (!currentState) return null;
  
  const stateInfo: Record<string, { color: string; displayName: string }> = {
    source_idle: { color: "text-gray-500", displayName: "idle" },
    source_generating: { color: "text-blue-500", displayName: "generating" },
    source_emitting: { color: "text-green-500", displayName: "emitting" },
    source_waiting: { color: "text-yellow-500", displayName: "waiting" },
  };
  
  return stateInfo[currentState] || { color: "text-gray-400", displayName: "unknown" };
};

const DataSourceNodeDisplay: React.FC<NodeProps<RFNodeData>> = ({ data, selected, id }) => {
  const config = data.config as DataSourceNode | undefined;
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
          data.isActive && "animate-pulse border-green-400 shadow-green-400/50 shadow-lg scale-105",
          data.error && "border-destructive shadow-destructive/50",
        )}
      >
      <CardHeader
        className={cn(
          "p-2 rounded-t-lg transition-colors duration-300 bg-teal-600 text-white",
        )}
      >
        <CardTitle className="text-xs font-semibold flex items-center text-white">
          <DatabaseZap className="h-3 w-3 mr-1" />
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
          <p>Int: {config?.interval ? `${config.interval}s` : '—'}</p>
          <p>
            Range: [
            {config?.generation?.valueMin ?? '—'}-
            {config?.generation?.valueMax ?? '—'}]
          </p>
          <p>To: {config?.outputs?.[0]?.destinationNodeId || 'None'}</p>
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
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-4 h-4 !bg-primary hover:!bg-primary/80 transition-all" 
        title="Output"
      />
    </Card>
    </div>
  );
};

export default React.memo(DataSourceNodeDisplay);
