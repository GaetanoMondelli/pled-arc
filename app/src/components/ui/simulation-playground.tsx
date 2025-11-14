"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CircuitBoard, Clock, Pause, Play, RotateCcw, Square, Zap } from "lucide-react";
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

// Import the node components from tokenization demo pattern
interface SimulationToken {
  id: string;
  value: any;
  createdAt: number;
  history: Array<{
    timestamp: number;
    nodeId: string;
    action: string;
    value?: any;
  }>;
  originNodeId: string;
}

interface SimulationNodeData {
  label: string;
  type: "DataSource" | "Queue" | "ProcessNode" | "Sink";
  config: any;
  isActive?: boolean;
  error?: string;
  details?: string;
}

interface SimulationEdgeData {
  animated?: boolean;
}

// Simulation Node Components
const DataSourceNodeDisplay: React.FC<{ data: SimulationNodeData }> = ({ data }) => {
  const config = data.config;
  return (
    <Card className={`w-52 shadow-lg ${data.isActive ? "animate-pulse border-cyan-500" : ""}`}>
      <CardHeader className="p-3 bg-cyan-100 rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Activity className="h-4 w-4 mr-2 text-cyan-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <p>Interval: {config.interval || 1}s</p>
        <p>
          Range: [{config.valueMin || 1}-{config.valueMax || 100}]
        </p>
        {data.details && <p className="mt-1 text-gray-600">{data.details}</p>}
        {data.error && <p className="mt-1 text-red-600">{data.error}</p>}
      </CardContent>
      {/* Output Handle */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-cyan-600" />
    </Card>
  );
};

const QueueNodeDisplay: React.FC<{ data: SimulationNodeData }> = ({ data }) => {
  const config = data.config;
  return (
    <Card className={`w-52 shadow-lg ${data.isActive ? "animate-pulse border-teal-500" : ""}`}>
      <CardHeader className="p-3 bg-teal-100 rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Clock className="h-4 w-4 mr-2 text-teal-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <p>Window: {config.timeWindow || 5}s</p>
        <p>Method: {config.aggregationMethod || "sum"}</p>
        <p>Capacity: {config.capacity || 100}</p>
        {data.details && <p className="mt-1 text-gray-600">{data.details}</p>}
        {data.error && <p className="mt-1 text-red-600">{data.error}</p>}
      </CardContent>
      {/* Input and Output Handles */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-gray-600" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-teal-600" />
    </Card>
  );
};

const ProcessNodeDisplay: React.FC<{ data: SimulationNodeData }> = ({ data }) => {
  const config = data.config;
  const numInputs = config.inputPorts?.length || 2;
  const numOutputs = config.outputPorts?.length || 1;

  return (
    <Card className={`w-60 shadow-lg ${data.isActive ? "animate-pulse border-violet-500" : ""}`}>
      <CardHeader className="p-3 bg-violet-100 rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Zap className="h-4 w-4 mr-2 text-violet-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <p>Inputs: {numInputs}</p>
        <p>Outputs: {numOutputs}</p>
        <p>
          Formula: {(config.formulas?.[0] || "input1.value").substring(0, 20)}
          {(config.formulas?.[0]?.length || 0) > 20 ? "..." : ""}
        </p>
        {data.details && <p className="mt-1 text-gray-600">{data.details}</p>}
        {data.error && <p className="mt-1 text-red-600">{data.error}</p>}
      </CardContent>
      {/* Input Handles - positioned vertically */}
      {Array.from({ length: numInputs }, (_, index) => (
        <Handle
          key={`input-${index}`}
          type="target"
          position={Position.Left}
          id={`input-${index}`}
          style={{ top: `${(index + 1) * (100 / (numInputs + 1))}%` }}
          className="w-3 h-3 !bg-gray-600"
        />
      ))}
      {/* Output Handles - positioned vertically */}
      {Array.from({ length: numOutputs }, (_, index) => (
        <Handle
          key={`output-${index}`}
          type="source"
          position={Position.Right}
          id={`output-${index}`}
          style={{ top: `${(index + 1) * (100 / (numOutputs + 1))}%` }}
          className="w-3 h-3 !bg-violet-600"
        />
      ))}
    </Card>
  );
};

const SinkNodeDisplay: React.FC<{ data: SimulationNodeData }> = ({ data }) => {
  const config = data.config;
  return (
    <Card className={`w-52 shadow-lg ${data.isActive ? "animate-pulse border-rose-500" : ""}`}>
      <CardHeader className="p-3 bg-rose-100 rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center">
          <Activity className="h-4 w-4 mr-2 text-rose-600" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs">
        <p>Log: {config.logLevel || "info"}</p>
        <p>Max: {config.maxTokens || 1000}</p>
        {data.details && <p className="mt-1 text-gray-600">{data.details}</p>}
        {data.error && <p className="mt-1 text-red-600">{data.error}</p>}
      </CardContent>
      {/* Input Handle only - sinks don't output */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-gray-600" />
    </Card>
  );
};

const nodeTypes = {
  DataSource: DataSourceNodeDisplay,
  Queue: QueueNodeDisplay,
  ProcessNode: ProcessNodeDisplay,
  Sink: SinkNodeDisplay,
};

interface SimulationPlaygroundProps {
  components: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    config: {
      simulationType?: "DataSource" | "Queue" | "ProcessNode" | "Sink";
      simulationConfig?: any;
    };
  }>;
  onSimulationUpdate?: (time: number, activeTokens: number) => void;
}

export const SimulationPlayground: React.FC<SimulationPlaygroundProps> = ({ components, onSimulationUpdate }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tokens, setTokens] = useState<SimulationToken[]>([]);

  // Default scenario nodes from tokenization demo
  const [scenarioNodes, setScenarioNodes] = useState<Node<SimulationNodeData>[]>([]);
  const [scenarioEdges, setScenarioEdges] = useState<Edge<SimulationEdgeData>[]>([]);

  // Initialize with a default scenario like the tokenization demo
  useEffect(() => {
    // Create nodes from the demo scenario
    const defaultNodes: Node<SimulationNodeData>[] = [
      {
        id: "DataSource_A",
        type: "DataSource",
        position: { x: 50, y: 100 },
        data: {
          label: "Source A",
          type: "DataSource",
          config: {
            interval: 3,
            valueMin: 1,
            valueMax: 10,
          },
          isActive: false,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: "Queue_B",
        type: "Queue",
        position: { x: 300, y: 100 },
        data: {
          label: "Queue B",
          type: "Queue",
          config: {
            timeWindow: 10,
            aggregationMethod: "sum",
            capacity: 10,
          },
          isActive: false,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      {
        id: "Sink_E",
        type: "Sink",
        position: { x: 550, y: 100 },
        data: {
          label: "Sink E",
          type: "Sink",
          config: {
            logLevel: "info",
            maxTokens: 1000,
          },
          isActive: false,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
    ];

    const defaultEdges: Edge<SimulationEdgeData>[] = [
      {
        id: "e-DataSource_A-Queue_B",
        source: "DataSource_A",
        target: "Queue_B",
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: "e-Queue_B-Sink_E",
        source: "Queue_B",
        target: "Sink_E",
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];

    setScenarioNodes(defaultNodes);
    setScenarioEdges(defaultEdges);
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    changes => setScenarioNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    changes => setScenarioEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setScenarioEdges(eds => addEdge({ ...params, type: "smoothstep" }, eds)),
    [],
  );

  // Simple simulation engine
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;

        // Generate tokens from DataSource nodes
        scenarioNodes.forEach(node => {
          if (node.data.type === "DataSource" && newTime % (node.data.config.interval || 3) === 0) {
            const value =
              Math.floor(Math.random() * ((node.data.config.valueMax || 10) - (node.data.config.valueMin || 1) + 1)) +
              (node.data.config.valueMin || 1);
            const newToken: SimulationToken = {
              id: `token_${newTime}_${node.id}`,
              value,
              createdAt: newTime,
              history: [
                {
                  timestamp: newTime,
                  nodeId: node.id,
                  action: "CREATED",
                  value,
                },
              ],
              originNodeId: node.id,
            };

            setTokens(prev => [...prev, newToken]);

            // Update node activity
            setScenarioNodes(prev =>
              prev.map(n =>
                n.id === node.id ? { ...n, data: { ...n.data, isActive: true, details: `Generated: ${value}` } } : n,
              ),
            );

            // Animate connected edges
            setScenarioEdges(prev =>
              prev.map(edge =>
                edge.source === node.id
                  ? { ...edge, animated: true, style: { stroke: "#3b82f6", strokeWidth: 2 } }
                  : edge,
              ),
            );

            // Reset animation after a delay
            setTimeout(() => {
              setScenarioNodes(prev =>
                prev.map(n => (n.id === node.id ? { ...n, data: { ...n.data, isActive: false, details: "" } } : n)),
              );
              setScenarioEdges(prev =>
                prev.map(edge =>
                  edge.source === node.id
                    ? { ...edge, animated: false, style: { stroke: "#64748b", strokeWidth: 1 } }
                    : edge,
                ),
              );
            }, 1000);
          }
        });

        onSimulationUpdate?.(newTime, tokens.length);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, scenarioNodes, tokens.length, onSimulationUpdate]);

  const startSimulation = () => setIsRunning(true);
  const pauseSimulation = () => setIsRunning(false);
  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentTime(0);
    setTokens([]);
  };

  return (
    <div className="space-y-4">
      {/* Simulation Controls */}
      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
        <Button
          onClick={isRunning ? pauseSimulation : startSimulation}
          variant={isRunning ? "destructive" : "default"}
          size="sm"
        >
          {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          {isRunning ? "Pause" : "Start"}
        </Button>

        <Button onClick={resetSimulation} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Time: {currentTime}s
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Tokens: {tokens.length}
          </span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500" : "bg-gray-400"}`} />
            {isRunning ? "Running" : "Stopped"}
          </div>
        </div>
      </div>

      {/* ReactFlow Simulation Canvas */}
      <div className="h-96 border rounded-lg bg-white">
        <ReactFlow
          nodes={scenarioNodes}
          edges={scenarioEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
          }}
        >
          <Controls />
          <Background color="#e5e7eb" gap={16} />
        </ReactFlow>
      </div>

      <div className="text-sm text-gray-500">
        <p>
          🎯 <strong>Working Simulation:</strong> Data Source generates tokens every 3 seconds → Queue aggregates them →
          Sink consumes them
        </p>
        <p>
          💡 <strong>How to extend:</strong> You can drag nodes around, connect them differently, and they'll work like
          the tokenization demo
        </p>
      </div>
    </div>
  );
};

export default SimulationPlayground;
