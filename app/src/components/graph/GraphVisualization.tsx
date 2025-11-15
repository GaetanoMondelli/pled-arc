"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataSourceNodeDisplay from "./nodes/DataSourceNodeDisplay";
import ProcessNodeDisplay from "./nodes/ProcessNodeDisplay";
import QueueNodeDisplay from "./nodes/QueueNodeDisplay";
import SinkNodeDisplay from "./nodes/SinkNodeDisplay";
import FSMNodeDisplay from "./nodes/FSMNodeDisplay";
import MultiplexerDisplay from "./nodes/MultiplexerDisplay";
import GroupNodeDisplay from "./nodes/GroupNodeDisplay";
import MarkdownCommentDisplay from "./nodes/MarkdownCommentDisplay";
import { useSimulationStore } from "@/stores/simulationStore";
import { useReplayEngine } from "@/stores/replayEngine";
import { useEventProcessor } from "@/lib/executionEngines/EventProcessor";
import { useActivityLogger } from "@/stores/activityLogger";
import { cn } from "@/lib/utils";
import { Trash2, Hand, MousePointer } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import DeletableEdge from "./edges/DeletableEdge";
import BreadcrumbNavigation from "./BreadcrumbNavigation";
import { GroupNavigationManager } from "@/lib/utils/advancedGroupingUtils";
import { nodeNavigationService } from "@/lib/services/claims/nodeNavigationService";
import {
  useNodeFiltering,
  useGraphNavigation,
  useNodeChanges,
  useEdgeChanges,
  useEdgeGeneration,
  useNodeInteractions,
  useDragDrop,
  useKeyboardShortcuts,
  useActivityTracking,
  useEdgeAnimations,
  useEdgeGenerationFromScenario,
  useReactFlowNodes,
} from "./hooks";

const nodeTypes = {
  DataSource: DataSourceNodeDisplay,
  Queue: QueueNodeDisplay,
  ProcessNode: ProcessNodeDisplay,
  FSMProcessNode: FSMNodeDisplay,
  Multiplexer: MultiplexerDisplay,
  Sink: SinkNodeDisplay,
  Group: GroupNodeDisplay,
  MarkdownComment: MarkdownCommentDisplay,
};

const edgeTypes = {
  default: DeletableEdge,
  smoothstep: DeletableEdge,
};

interface GraphVisualizationProps {
  isPanMode?: boolean;
  onPanModeToggle?: () => void;
  activeNodeIds?: string[];
}

/**
 * GraphVisualization Component
 *
 * Main orchestrator for the graph visualization system.
 * This component has been refactored to use focused custom hooks,
 * reducing complexity from 1,148 lines to ~200 lines.
 *
 * Custom hooks handle:
 * - Node filtering (useNodeFiltering)
 * - Navigation & breadcrumbs (useGraphNavigation)
 * - Node CRUD operations (useNodeChanges)
 * - Edge CRUD operations (useEdgeChanges)
 * - Connection logic (useEdgeGeneration)
 * - Node interactions (useNodeInteractions)
 * - Drag & drop from palette (useDragDrop)
 * - Keyboard shortcuts (useKeyboardShortcuts)
 * - Activity tracking (useActivityTracking)
 * - Edge animations (useEdgeAnimations)
 * - Edge animations (useEdgeAnimations)
 * - Node data sync (useNodeDataUpdates)
 * - Edge generation from scenario (useEdgeGenerationFromScenario)
 * - ReactFlow node conversion (useReactFlowNodes)
 */
export default function GraphVisualization({
  isPanMode: externalPanMode,
  onPanModeToggle: externalPanModeToggle,
  activeNodeIds = []
}: GraphVisualizationProps = {}) {
  // ===== STORE SELECTORS =====
  const scenario = useSimulationStore(state => state.scenario);
  const nodeStates = useSimulationStore(state => state.nodeStates);
  const nodesConfig = useSimulationStore(state => state.nodesConfig);
  const setSelectedNodeId = useSimulationStore(state => state.setSelectedNodeId);
  const loadScenario = useSimulationStore(state => state.loadScenario);
  const saveSnapshot = useSimulationStore(state => state.saveSnapshot);
  const undo = useSimulationStore(state => state.undo);
  const redo = useSimulationStore(state => state.redo);
  const canUndo = useSimulationStore(state => state.canUndo);
  const canRedo = useSimulationStore(state => state.canRedo);

  // ===== EVENT-DRIVEN STORE SELECTORS =====
  const eventDrivenCurrentTime = useReplayEngine(state => state.getCurrentState()?.timestamp ?? 0);
  const eventDrivenIsRunning = useEventProcessor(state => state.isRunning);
  const eventDrivenActivityLogs = useActivityLogger(state => state.nodeActivityLogs);

  // Always use event-driven values
  const currentTime = eventDrivenCurrentTime;
  const isRunning = eventDrivenIsRunning;
  const nodeActivityLogs = eventDrivenActivityLogs;

  // ===== NAVIGATION STATE =====
  const {
    navigationState,
    navigationManager,
    handleNavigateBack: navBack,
    handleNavigateTo: navTo,
    handleToggleGroupMode: toggleGroup
  } = useGraphNavigation(scenario);

  // ===== CUSTOM HOOKS =====
  // Filter nodes based on navigation and grouping configuration
  const filteredNodes = useNodeFiltering(scenario, navigationState as any);

  // Track node activity for animations
  const { nodesWithActivity } = useActivityTracking(
    filteredNodes,
    currentTime,
    nodeActivityLogs,
    isRunning
  );

  // Convert scenario nodes to ReactFlow nodes
  // Merge server-side activeNodeIds with client-side nodesWithActivity
  const mergedActiveNodes = useMemo(() => {
    const merged = new Set(nodesWithActivity);
    activeNodeIds.forEach(id => merged.add(id));
    return merged;
  }, [nodesWithActivity, activeNodeIds]);

  const reactFlowNodes = useReactFlowNodes(
    filteredNodes,
    scenario,
    mergedActiveNodes
  );

  // Generate edges from scenario connections
  const baseEdges = useEdgeGenerationFromScenario(scenario, reactFlowNodes);

  // Add animations to edges based on activity
  const { animatedEdges } = useEdgeAnimations(baseEdges, nodesWithActivity, isRunning);

  // Internal state for ReactFlow
  const [rfNodes, setRfNodes] = useState<any[]>([]);
  const [rfEdges, setRfEdges] = useState<any[]>([]);

  // Multi-selection state
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  // Pan/Selection mode state - use external control if provided
  const [internalPanMode, setInternalPanMode] = useState(false);
  const isPanMode = externalPanMode !== undefined ? externalPanMode : internalPanMode;
  const setIsPanMode = externalPanModeToggle ? () => externalPanModeToggle() : setInternalPanMode;

  // Sync ReactFlow nodes with computed nodes AND update with runtime info
  useEffect(() => {
    const enrichedNodes = reactFlowNodes.map(node => {
      const nodeState = nodeStates?.[node.id];
      const recentLogs = nodeActivityLogs?.[node.id]?.filter(log => currentTime - log.timestamp <= 2) || [];
      const latestLog = recentLogs[recentLogs.length - 1];

      // Calculate runtime details based on node type
      let details = node.data.details || "";
      if (nodeState) {
        switch (node.data.config?.type) {
          case "DataSource":
            const dsState = nodeState as any;
            details = `Last: ${dsState.lastEmissionTime >= 0 ? dsState.lastEmissionTime + "s" : "Never"}`;
            break;
          case "Queue":
            const qState = nodeState as any;
            details = `Buffer: ${qState.inputBuffer?.length || 0} in, ${qState.outputBuffer?.length || 0} out`;
            break;
          case "ProcessNode":
            const pState = nodeState as any;
            const totalInputs = Object.values(pState.inputBuffers || {}).reduce(
              (sum: number, buffer: any) => sum + (buffer?.length || 0),
              0,
            );
            details = `Inputs: ${totalInputs}`;
            break;
          case "FSMProcessNode":
            const fsmState = nodeState as any;
            const fsmInputs = Object.values(fsmState.inputBuffers || {}).reduce(
              (sum: number, buffer: any) => sum + (buffer?.length || 0),
              0,
            );
            details = `State: ${fsmState.currentFSMState || 'unknown'}, Inputs: ${fsmInputs}`;
            break;
          case "Sink":
            const sState = nodeState as any;
            details = `Consumed: ${sState.consumedTokenCount || 0}`;
            break;
        }
      }

      return {
        ...node,
        data: {
          ...node.data,
          details,
          error: latestLog?.action === "FORMULA_ERROR" ? latestLog.details : undefined,
          nodeState: node.data.config?.type === "FSMProcessNode" ? nodeState : undefined,
        },
      };
    });

    setRfNodes(enrichedNodes);
  }, [reactFlowNodes, nodeStates, nodeActivityLogs, currentTime]);

  // Sync ReactFlow edges with our computed edges
  useEffect(() => {
    setRfEdges(animatedEdges);
  }, [animatedEdges]);

  // Node CRUD operations
  const { onNodesChange } = useNodeChanges(
    scenario,
    currentTime,
    loadScenario,
    saveSnapshot,
    setRfNodes
  );

  // Edge CRUD operations
  const { onEdgesChange } = useEdgeChanges(
    scenario,
    loadScenario,
    saveSnapshot,
    setRfEdges
  );

  // Connection logic (creating new edges)
  const { onConnect } = useEdgeGeneration(
    scenario,
    saveSnapshot,
    loadScenario
  );

  // Node interactions (click, double-click, drag)
  const { onNodeClick, onNodeDoubleClick, onNodeDragStop } = useNodeInteractions(
    scenario,
    currentTime,
    setSelectedNodeId,
    navigationManager,
    loadScenario
  );

  // Drag & drop from palette
  const { isDragOver, onDrop, onDragOver, onDragLeave } = useDragDrop(
    scenario,
    navigationState,
    loadScenario,
    saveSnapshot
  );

  // Keyboard shortcuts (undo/redo)
  useKeyboardShortcuts(undo, redo, canUndo, canRedo);

  // ===== MULTI-SELECTION HANDLERS =====
  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: any[], edges: any[] }) => {
    const nodeIds = nodes.map(node => node.id);

    // Only update if the selection actually changed
    setSelectedNodes(prev => {
      if (prev.length === nodeIds.length && prev.every(id => nodeIds.includes(id))) {
        return prev; // No change, return previous state
      }
      return nodeIds;
    });
  }, []);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;

    const updatedScenario = {
      ...scenario,
      nodes: scenario.nodes.filter(node => !selectedNodes.includes(node.nodeId))
    };

    loadScenario(updatedScenario);
    saveSnapshot('Delete selected nodes');
    setSelectedNodes([]);
  }, [selectedNodes, scenario, loadScenario, saveSnapshot]);

  // Group drag handler to maintain relative distances
  const onNodeDragStopEnhanced = useCallback((event: any, node: any, nodes: any[]) => {
    // For now, use the existing handler - ReactFlow handles multi-node dragging automatically
    // when nodes are selected. We just need to persist the changes.
    onNodeDragStop(event, node, nodes);
  }, [onNodeDragStop]);

  // Toggle pan mode
  const togglePanMode = useCallback(() => {
    if (externalPanModeToggle) {
      externalPanModeToggle();
    } else {
      setInternalPanMode(prev => !prev);
    }
    // Clear selection when switching to pan mode
    if (!isPanMode) {
      setSelectedNodes([]);
    }
  }, [isPanMode, externalPanModeToggle]);

  // ===== RENDER =====
  if (!scenario) {
    return (
      <div className="flex-grow flex items-center justify-center text-muted-foreground">
        Loading scenario data or scenario is invalid...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Custom Selection Box Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-selection-styles .react-flow__selection {
            background: rgba(128, 128, 128, 0.08) !important;
            border: 2px solid rgba(128, 128, 128, 0.3) !important;
            border-radius: 8px !important;
          }

          .custom-selection-styles .react-flow__node.selected {
            outline: 2px solid rgba(128, 128, 128, 0.5) !important;
            outline-offset: 8px !important;
          }

          .custom-selection-styles .react-flow__nodesselection-rect {
            background: rgba(128, 128, 128, 0.08) !important;
            border: 2px solid rgba(128, 128, 128, 0.3) !important;
            border-radius: 8px !important;
          }
        `
      }} />

      {/* Breadcrumb Navigation */}
      {navigationState.breadcrumbs.length > 1 && (
        <BreadcrumbNavigation
          navigationState={navigationState}
          onNavigateTo={navTo}
          onNavigateBack={navBack}
          onToggleGroupMode={toggleGroup}
          isGroupModeEnabled={navigationState.currentView !== 'template'}
        />
      )}

      {/* Main Graph Area */}
      <div
        className={cn(
          "flex-1 relative",
          isDragOver && "ring-2 ring-indigo-400 ring-offset-2 bg-indigo-50/50"
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStopEnhanced}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onInit={(reactFlowInstance) => {
            // Register ReactFlow instance for navigation
            nodeNavigationService.setReactFlowInstance(reactFlowInstance);
          }}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Ctrl"]}
          selectionOnDrag={!isPanMode}
          panOnDrag={isPanMode ? true : [1, 2]}
          selectionMode="partial"
          className="bg-background w-full h-full custom-selection-styles"
          defaultEdgeOptions={{
            type: "default",
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--foreground))" },
          }}
        >
          <Controls />
          <Background color="hsl(var(--border))" gap={16} />
        </ReactFlow>

        {/* Custom Hand Tool Button - positioned with ReactFlow controls */}
        <div className="absolute bottom-6 left-6 z-50 flex flex-col gap-2">
          {/* Hand tool button positioned above the default controls */}
          <button
            onClick={togglePanMode}
            title={isPanMode ? "Switch to Selection Mode (Currently: Pan Mode)" : "Switch to Pan Mode (Currently: Selection Mode)"}
            className={cn(
              "w-8 h-8 rounded border flex items-center justify-center transition-all duration-200",
              "bg-white border-gray-300 shadow-sm",
              isPanMode
                ? "!bg-blue-500 !text-white !border-blue-600 hover:!bg-blue-600"
                : "text-gray-700 hover:bg-gray-50 hover:border-gray-400"
            )}
            style={{
              marginBottom: '4px',
              fontSize: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)'
            }}
          >
            {isPanMode ? (
              <MousePointer className="w-4 h-4" />
            ) : (
              <Hand className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Drop zone indicator */}
        {isDragOver && (
          <div className="absolute inset-4 border-2 border-dashed border-indigo-400 rounded-lg flex items-center justify-center pointer-events-none bg-indigo-50/80">
            <div className="text-indigo-600 font-medium text-lg">Drop node here</div>
          </div>
        )}

        {/* Multi-selection delete button - positioned in top-right corner of graph */}
        {selectedNodes.length > 1 && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={deleteSelectedNodes}
              className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg transition-colors"
              title={`Delete ${selectedNodes.length} selected nodes`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete {selectedNodes.length} nodes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
