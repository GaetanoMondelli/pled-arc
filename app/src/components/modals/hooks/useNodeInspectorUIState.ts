/**
 * useNodeInspectorUIState Hook
 * 
 * Manages local UI state for NodeInspectorModal:
 * - JSON view toggles
 * - Selected event/log entry state
 * - State machine visibility toggle
 * - Derived values (isOpen, nodeConfig, nodeState, logs)
 */

import { useState, useEffect } from "react";
import type { NodeStateMachineState } from "@/lib/simulation/types";

interface UseNodeInspectorUIStateParams {
  selectedNodeId: string | null;
  nodesConfig: Record<string, any>;
  nodeStates: Record<string, any>;
  nodeActivityLogs: Record<string, any[]>;
}

export const useNodeInspectorUIState = ({
  selectedNodeId,
  nodesConfig,
  nodeStates,
  nodeActivityLogs,
}: UseNodeInspectorUIStateParams) => {
  const [showStateJson, setShowStateJson] = useState(false);
  const [selectedEventState, setSelectedEventState] = useState<NodeStateMachineState | null>(null);
  const [selectedLogEntry, setSelectedLogEntry] = useState<any | null>(null);
  const [showStateMachine, setShowStateMachine] = useState(false);

  // Derived values
  const isOpen = !!selectedNodeId;
  const nodeConfig = selectedNodeId ? nodesConfig[selectedNodeId] : null;
  const nodeState = selectedNodeId ? nodeStates[selectedNodeId] : null;
  const logs = selectedNodeId ? nodeActivityLogs[selectedNodeId] || [] : [];

  // Only reset selected event state when node changes if the event doesn't belong to the new node
  useEffect(() => {
    if (selectedLogEntry && selectedLogEntry.nodeId !== selectedNodeId) {
      setSelectedEventState(null);
      setSelectedLogEntry(null);
    }
  }, [selectedNodeId, selectedLogEntry]);

  return {
    showStateJson,
    setShowStateJson,
    selectedEventState,
    setSelectedEventState,
    selectedLogEntry,
    setSelectedLogEntry,
    showStateMachine,
    setShowStateMachine,
    isOpen,
    nodeConfig,
    nodeState,
    logs,
  };
};
