/**
 * useNodeInspectorStore Hook
 * 
 * Centralized access to all Zustand store selectors needed by NodeInspectorModal.
 * Provides all store values and actions in a single hook.
 */

import { create } from "zustand";
import type { Node } from "reactflow";
import type { NodeConfig, NodeState, DataSourceNodeConfig, ProcessNodeConfig, QueueNodeConfig, FSMNodeConfig, SinkNodeConfig, MultiplexerNodeConfig, GroupNodeConfig } from "@/lib/simulation/types";
import type { UseNodeInspectorStoreReturn } from "./useNodeInspectorTypes";
import { useSimulationStore } from "@/stores/simulationStore";

export const useNodeInspectorStore = () => {
  const selectedNodeId = useSimulationStore(state => state.selectedNodeId);
  const nodesConfig = useSimulationStore(state => state.nodesConfig);
  const nodeStates = useSimulationStore(state => state.nodeStates);
  const nodeActivityLogs = useSimulationStore(state => state.nodeActivityLogs);
  const setSelectedNodeId = useSimulationStore(state => state.setSelectedNodeId);
  const scenario = useSimulationStore(state => state.scenario);
  const loadScenario = useSimulationStore(state => state.loadScenario);
  const updateNodeConfigInStore = useSimulationStore(state => state.updateNodeConfigInStore);
  const saveSnapshot = useSimulationStore(state => state.saveSnapshot);

  return {
    selectedNodeId,
    nodesConfig,
    nodeStates,
    nodeActivityLogs,
    setSelectedNodeId,
    scenario,
    loadScenario,
    updateNodeConfigInStore,
    saveSnapshot,
  };
};
