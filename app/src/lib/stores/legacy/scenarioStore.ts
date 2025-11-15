/**
 * scenarioStore.ts
 * 
 * Manages scenario data: nodes, edges, configuration
 * Extracted from simulationStore.ts as part of Phase 6 refactoring
 */

import { create } from 'zustand';
import type { Scenario, AnyNode } from '@/lib/simulation/types';

// Helper to get clean scenario ready for saving (removes virtual group nodes)
function getSaveReadyScenario(scenario: Scenario): Scenario {
  if (!scenario?.nodes) return scenario;

  // Filter out virtual group nodes (created by grouping visualization)
  const groupNodes = scenario.nodes.filter(n => n.type === 'Group');
  console.log("getSaveReadyScenario - Found group nodes:", groupNodes.map(g => ({ 
    id: g.nodeId, 
    containedNodes: 'containedNodes' in g ? g.containedNodes : 'NO_CONTAINED_NODES' 
  })));

  if (!scenario?.groups?.visualMode || scenario.groups.visualMode === "all") {
    console.log("getSaveReadyScenario - visualMode is 'all', removing any Group nodes");
    const cleanedNodes = scenario.nodes
      .filter(n => n.type !== 'Group' && !n.nodeId.startsWith('group_'))
      .map(node => {
        // Remove internal grouping flags
        const { _isGrouped, ...cleanNode } = node as any;
        return cleanNode;
      });

    return {
      ...scenario,
      nodes: cleanedNodes,
      groups: {
        ...scenario.groups,
        visualMode: "all" as const,
      },
    };
  }

  // Keep scenario as-is if in grouped mode
  const savedActiveFilters = scenario.groups?.activeFilters || [];
  console.log("getSaveReadyScenario - visualMode is NOT 'all', keeping groups. Active filters:", savedActiveFilters);

  return scenario;
}

interface ScenarioState {
  // State
  scenario: Scenario | null;
  
  // Actions
  loadScenario: (scenarioData: any) => Promise<void>;
  updateNodeConfigInStore: (nodeId: string, newConfigData: any) => boolean;
  getSaveReadyScenario: () => Scenario | null;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  // Initial state
  scenario: null,

  // Load a scenario into the store
  loadScenario: async (scenarioData: any) => {
    console.log("📋 [scenarioStore] Loading scenario:", scenarioData?.name || "Unnamed");
    
    if (!scenarioData) {
      console.error("Cannot load null/undefined scenario");
      return;
    }

    // Ensure we have the basic structure
    const loadedScenario: Scenario = {
      ...scenarioData,
      nodes: scenarioData.nodes || [],
      version: scenarioData.version || "3.0",
      groups: scenarioData.groups || {},
    };

    set({ scenario: loadedScenario });
    console.log("✅ [scenarioStore] Scenario loaded with", loadedScenario.nodes.length, "nodes");
  },

  // Update a node's configuration
  updateNodeConfigInStore: (nodeId: string, newConfigData: any): boolean => {
    const scenario = get().scenario;
    if (!scenario) {
      console.error("[scenarioStore] Cannot update node - no scenario loaded");
      return false;
    }

    const nodeIndex = scenario.nodes.findIndex(n => n.nodeId === nodeId);
    if (nodeIndex === -1) {
      console.error(`[scenarioStore] Node ${nodeId} not found in scenario`);
      return false;
    }

    const updatedNodes = [...scenario.nodes];
    updatedNodes[nodeIndex] = {
      ...updatedNodes[nodeIndex],
      ...newConfigData,
    };

    set({
      scenario: {
        ...scenario,
        nodes: updatedNodes,
      },
    });

    console.log(`✅ [scenarioStore] Updated node ${nodeId} config`);
    return true;
  },

  // Get scenario ready for saving (strips virtual group nodes)
  getSaveReadyScenario: (): Scenario | null => {
    const scenario = get().scenario;
    if (!scenario) return null;
    
    return getSaveReadyScenario(scenario);
  },
}));
