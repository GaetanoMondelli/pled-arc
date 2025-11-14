"use client";

import React, { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  Position,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Code } from "lucide-react";
import type { AnyNode, NodeStateMachineState, StateMachineInfo } from "@/lib/simulation/types";
// FSLGenerator removed - using simulation store state machine directly

// Simple Dagre-like layout for directed graphs
const layoutNodes = (nodes: string[], edges: Array<{from: string, to: string}>) => {
  const nodeMap = new Map<string, {level: number, index: number}>();
  const levels: string[][] = [];

  // Build adjacency and in-degree
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  nodes.forEach(n => {
    adj.set(n, new Set());
    inDegree.set(n, 0);
  });

  edges.forEach(e => {
    if (e.from !== e.to) { // Ignore self-loops
      adj.get(e.from)?.add(e.to);
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    }
  });

  // Topological sort with Kahn's algorithm
  const queue: string[] = [];
  nodes.forEach(n => {
    if (inDegree.get(n) === 0) queue.push(n);
  });

  if (queue.length === 0 && nodes.length > 0) {
    // Cyclic graph - start from first node
    queue.push(nodes[0]);
  }

  const visited = new Set<string>();
  let currentLevel = 0;

  while (queue.length > 0 || visited.size < nodes.length) {
    const levelNodes: string[] = [];
    const levelSize = queue.length;

    if (levelSize === 0) {
      // Handle remaining nodes in cycles
      const unvisited = nodes.find(n => !visited.has(n));
      if (unvisited) queue.push(unvisited);
      else break;
    }

    for (let i = 0; i < Math.max(1, levelSize); i++) {
      const node = queue.shift();
      if (!node || visited.has(node)) continue;

      visited.add(node);
      levelNodes.push(node);

      // Add children to next level
      adj.get(node)?.forEach(child => {
        if (!visited.has(child)) {
          const deg = inDegree.get(child)! - 1;
          inDegree.set(child, deg);
          if (deg === 0) queue.push(child);
        }
      });
    }

    if (levelNodes.length > 0) {
      levels.push(levelNodes);
      levelNodes.forEach((n, idx) => {
        nodeMap.set(n, {level: currentLevel, index: idx});
      });
      currentLevel++;
    }
  }

  // Calculate positions
  const positions = new Map<string, {x: number, y: number}>();
  const horizontalSpacing = 250;
  const verticalSpacing = 100;
  const maxNodesInLevel = Math.max(...levels.map(l => l.length), 1);

  levels.forEach((level, levelIdx) => {
    const x = 150 + (levelIdx * horizontalSpacing);
    const levelHeight = (level.length - 1) * verticalSpacing;
    const startY = 100 + (maxNodesInLevel * verticalSpacing / 2) - (levelHeight / 2);

    level.forEach((node, nodeIdx) => {
      const y = startY + (nodeIdx * verticalSpacing);
      positions.set(node, {x, y: Math.max(100, y)});
    });
  });

  return positions;
};

interface StateNodeData {
  label: string;
  isActive: boolean;
  isSelected: boolean;
  stateType: "initial" | "intermediate" | "final" | "error";
  variables?: {
    buffer_size?: number;
    output_buffer_size?: number;
    time_anchor?: number;
    // ProcessNode specific variables
    inputs_ready?: string[];  // List of input names that have tokens
    inputs_missing?: string[]; // List of input names that need tokens
    outputs_generated?: string[]; // List of output names that have been computed
    current_formula?: string; // Current formula being evaluated
    input_values?: Record<string, any>; // Current input values for formula
  };
}

interface NodeStateMachineDiagramProps {
  nodeConfig: AnyNode;
  stateMachineInfo?: StateMachineInfo;
  width?: number;
  height?: number;
  overrideActiveState?: NodeStateMachineState;
  showVariables?: boolean;
  activityLogs?: any[];
  selectedLogEntry?: any;
}

// Node component for state machine states WITH VARIABLES
const StateNode: React.FC<{ data: StateNodeData; selected?: boolean }> = ({ data, selected }) => {
  const getStateColor = () => {
    if (data.isSelected) return "border-blue-600 bg-blue-50 text-blue-900";
    if (data.isActive) return "border-green-600 bg-green-50 text-green-900";
    if (data.stateType === "initial") return "border-teal-500 bg-teal-50 text-teal-900";
    if (data.stateType === "final") return "border-indigo-500 bg-indigo-50 text-indigo-900";
    if (data.stateType === "error") return "border-red-500 bg-red-50 text-red-900";
    return "border-slate-300 bg-white text-slate-700";
  };

  // Simplify state label - remove prefix for cleaner display
  const simplifiedLabel = data.label.includes('_')
    ? data.label.split('_').slice(1).join(' ')
    : data.label;

  return (
    <div className="relative">
      {/* Target (incoming) */}
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2.5 !h-2.5" />
      <div
        className={cn(
          "px-2.5 py-1 rounded-md border-2 text-xs font-medium transition-all min-w-[120px] max-w-[160px] shadow-sm",
          getStateColor(),
          selected && "ring-2 ring-primary ring-offset-1"
        )}
      >
        <div className="font-semibold text-xs truncate">{simplifiedLabel}</div>
        {data.variables && data.isActive && (
          <div className="mt-0.5 text-[9px] opacity-75 space-y-0.5">
            {/* Standard buffer info for Queue/DataSource nodes */}
            {(data.variables.buffer_size !== undefined || data.variables.output_buffer_size !== undefined) && (
              <div className="flex gap-2">
                <span>buf: {data.variables.buffer_size || 0}</span>
                <span>out: {data.variables.output_buffer_size || 0}</span>
              </div>
            )}

            {/* ProcessNode specific info */}
            {data.variables.inputs_ready && (
              <div className="text-green-700 truncate">✓ {data.variables.inputs_ready.join(', ')}</div>
            )}
            {data.variables.inputs_missing && data.variables.inputs_missing.length > 0 && (
              <div className="text-red-700 truncate">✗ {data.variables.inputs_missing.join(', ')}</div>
            )}
            {data.variables.outputs_generated && data.variables.outputs_generated.length > 0 && (
              <div className="text-blue-700 truncate">→ {data.variables.outputs_generated.join(', ')}</div>
            )}
            {data.variables.current_formula && (
              <div className="text-purple-700 font-mono text-[8px] truncate" title={data.variables.current_formula}>
                {data.variables.current_formula}
              </div>
            )}
          </div>
        )}
        {data.isActive && !data.isSelected && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
        {data.isSelected && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </div>
      {/* Source (outgoing) */}
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2.5 !h-2.5" />
    </div>
  );
};

const nodeTypes = {
  stateNode: StateNode,
};

export const NodeStateMachineDiagram: React.FC<NodeStateMachineDiagramProps> = ({
  nodeConfig,
  stateMachineInfo,
  width = 400,
  height = 300,
  overrideActiveState,
  showVariables = false,
  activityLogs = [],
  selectedLogEntry,
}) => {
  // showFSL removed - no FSLGenerator
  const [showVars, setShowVars] = useState(showVariables);

  const { nodes, edges, runtimeVariables } = useMemo(() => {
    // Priority: selectedLogEntry.state > overrideActiveState > stateMachineInfo.currentState
    const currentState = selectedLogEntry?.state || overrideActiveState || stateMachineInfo?.currentState;

    // Get runtime variables from activity logs if available
    let variables = null;
    if (activityLogs.length > 0) {
      let targetLog = null;

      // If we have a specific selected log entry, use that
      if (selectedLogEntry) {
        targetLog = selectedLogEntry;
      }
      // Otherwise, if we have an overrideActiveState, find the log entry for that state
      else if (overrideActiveState) {
        targetLog = activityLogs.find(log => log.state === overrideActiveState);
      }
      // Fall back to latest log if no override or no matching log found
      if (!targetLog) {
        targetLog = activityLogs[activityLogs.length - 1];
      }

      variables = {
        currentState: targetLog.state || 'unknown',
        buffer_size: targetLog.bufferSize || 0,
        output_buffer_size: targetLog.outputBufferSize || 0,
        time_anchor: targetLog.timestamp
      };
    }

    // Define canonical states based on node type
    const getStatesForNodeType = (nodeType: string) => {
      switch (nodeType) {
        case 'DataSource':
          return ['source_idle', 'source_generating', 'source_emitting', 'source_waiting'];
        case 'Queue':
          return ['queue_idle', 'queue_accumulating', 'queue_processing', 'queue_emitting'];
        case 'ProcessNode':
          return ['process_idle', 'process_collecting', 'process_ready', 'process_evaluating', 'process_outputting'];
        case 'FSMProcessNode':
          // For FSM nodes, get states from the FSM definition
          const fsmNode = nodeConfig as any;
          const rawStates = fsmNode.fsm?.states || ['idle'];
          // Handle mixed format: strings or objects with 'name' property
          return rawStates.map((state: any) => {
            if (typeof state === 'string') return state;
            if (typeof state === 'object' && state.name) return String(state.name);
            return String(state); // Fallback
          }).filter(Boolean);
        case 'Sink':
          return ['sink_idle', 'sink_processing'];
        default:
          return ['idle'];
      }
    };

    // Define basic transitions based on node type (MUST be before states calculation)
    const getTransitionsForNodeType = (nodeType: string) => {
      switch (nodeType) {
        case 'DataSource':
          return [
            { from: 'source_idle', to: 'source_generating', label: 'timer_tick' },
            { from: 'source_generating', to: 'source_emitting', label: 'data_generated' },
            { from: 'source_emitting', to: 'source_waiting', label: 'token_emitted' },
            { from: 'source_waiting', to: 'source_idle', label: 'ready' }
          ];
        case 'Queue':
          return [
            { from: 'queue_idle', to: 'queue_accumulating', label: 'token_received' },
            { from: 'queue_accumulating', to: 'queue_processing', label: 'trigger_met' },
            { from: 'queue_processing', to: 'queue_emitting', label: 'aggregated' },
            { from: 'queue_emitting', to: 'queue_idle', label: 'token_forwarded' }
          ];
        case 'ProcessNode':
          return [
            { from: 'process_idle', to: 'process_collecting', label: 'token_received' },
            { from: 'process_collecting', to: 'process_ready', label: 'all_inputs_available' },
            { from: 'process_ready', to: 'process_evaluating', label: 'formula_evaluation' },
            { from: 'process_evaluating', to: 'process_outputting', label: 'outputs_generated' },
            { from: 'process_outputting', to: 'process_idle', label: 'outputs_sent' }
          ];
        case 'FSMProcessNode':
          // For FSM nodes, get transitions from the FSM definition
          const fsmNode = nodeConfig as any;
          return fsmNode.fsm?.transitions?.map((t: any, idx: number) => ({
            from: String(t.from || ''), // Ensure string
            to: String(t.to || ''), // Ensure string
            label: String(t.trigger || '') + (t.condition ? ` [${t.condition}]` : ''),
            _index: idx // Add index for unique keys
          })) || [];
        case 'Sink':
          return [
            { from: 'sink_idle', to: 'sink_processing', label: 'token_received' },
            { from: 'sink_processing', to: 'sink_idle', label: 'token_consumed' }
          ];
        default:
          return [];
      }
    };

    const stateNames = getStatesForNodeType(nodeConfig.type);
    const transitions = getTransitionsForNodeType(nodeConfig.type);

    // Use the layoutNodes function defined at the top
    const positions = layoutNodes(stateNames, transitions);

    const states = stateNames.map((state, index) => ({
      id: state,
      label: state,
      type: index === 0 ? "initial" as const : "intermediate" as const,
      position: positions.get(state) || { x: 80, y: 40 + (index * 80) }
    }));

    // Create React Flow nodes for each state with variables
    const rfNodes: Node<StateNodeData>[] = states.map((state) => ({
      id: state.id,
      type: "stateNode",
      position: state.position,
      data: {
        label: state.label,
        isActive: currentState === state.id,
        isSelected: overrideActiveState === state.id,
        stateType: state.type,
        variables: variables && currentState === state.id ? {
          buffer_size: variables.buffer_size,
          output_buffer_size: variables.output_buffer_size,
          time_anchor: variables.time_anchor
        } : undefined,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    // Create React Flow edges ONLY for actual transitions (no ghost edges!)
    const rfEdges: Edge[] = transitions.map((transition, index) => {
      const fromState = String(transition.from || '');
      const toState = String(transition.to || '');
      const isActive = currentState === fromState;
      const isSelectedTransition = overrideActiveState === fromState;
      const isSelfLoop = fromState === toState;

      return {
        id: `edge-${fromState}-${toState}-${index}`,
        source: fromState,
        target: toState,
        label: transition.label,
        type: isSelfLoop ? 'default' : 'smoothstep', // Use smoothstep for better curves
        animated: isActive,
        labelStyle: {
          fill: isActive ? '#10b981' : '#64748b',
          fontWeight: isActive ? 600 : 400,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.85,
        },
        labelBgPadding: [4, 4] as [number, number],
        labelBgBorderRadius: 3,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: isActive ? "#10b981" : isSelectedTransition ? "#3b82f6" : "#64748b",
        },
        style: {
          stroke: isActive ? "#10b981" : isSelectedTransition ? "#3b82f6" : "#64748b",
          strokeWidth: isActive || isSelectedTransition ? 2.5 : 1.8,
        },
        ...(isSelfLoop && {
          // Self-loop styling
          sourceHandle: 'source',
          targetHandle: 'target',
        }),
      };
    });

    return { nodes: rfNodes, edges: rfEdges, runtimeVariables: variables };
  }, [nodeConfig.type, stateMachineInfo?.currentState, overrideActiveState, activityLogs, selectedLogEntry]);

  return (
    <div style={{ width, height }} className="border rounded-lg bg-slate-50">
      <div className="flex items-center justify-between p-2 bg-white border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{nodeConfig.displayName} State Machine</h3>
          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
            {nodeConfig.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {(stateMachineInfo || overrideActiveState) && (
            <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
              {overrideActiveState ? 'Selected: ' : 'Current: '}
              {(overrideActiveState || stateMachineInfo?.currentState)?.split('_').slice(1).join(' ')}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            {runtimeVariables && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-600 hover:text-slate-800"
                onClick={() => setShowVars(!showVars)}
              >
                🔢 Variables
              </Button>
            )}
            {/* FSL button removed - no FSLGenerator */}
          </div>
        </div>
      </div>
      
      {showVars && runtimeVariables && (
        <div className="p-2 bg-blue-50 border-b">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs">
              <span className="font-medium text-blue-800">State:</span>
              <span className="font-mono ml-1 text-blue-700">{runtimeVariables.currentState}</span>
            </div>
            <div className="text-xs">
              <span className="font-medium text-green-800">Buffer:</span>
              <span className="font-mono ml-1 text-green-700">{runtimeVariables.buffer_size}</span>
            </div>
            <div className="text-xs">
              <span className="font-medium text-yellow-800">Output:</span>
              <span className="font-mono ml-1 text-yellow-700">{runtimeVariables.output_buffer_size}</span>
            </div>
            <div className="text-xs">
              <span className="font-medium text-purple-800">Time Anchor:</span>
              <span className="font-mono ml-1 text-purple-700">{runtimeVariables.time_anchor || 'none'}</span>
            </div>
          </div>
        </div>
      )}

      {/* FSL display removed - no FSLGenerator */}

      <div style={{ width: "100%", height: height - ((showVars ? 60 : 0) + 40) }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.25,
            minZoom: 0.4,
            maxZoom: 1.5,
            duration: 400
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          preventScrolling={false}
          className="bg-transparent"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
          }}
          minZoom={0.3}
          maxZoom={3}
        >
          <Background color="#e2e8f0" gap={16} size={0.5} />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            className="!bg-white !border !border-slate-200 !shadow-sm"
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export default NodeStateMachineDiagram;