import { useMemo } from "react";
import type { AnyNode, Scenario } from "@/lib/simulation/types";

interface NavigationState {
  currentView: 'template' | 'group';
  currentContext: string | null;
  breadcrumbs: Array<{ label: string; context: string | null }>;
}

export const useNodeFiltering = (
  scenario: Scenario | null,
  navigationState: NavigationState
) => {
  const filteredNodes = useMemo(() => {
    if (!scenario) return [];

    // Handle navigation-based filtering
    if (navigationState.currentView === 'group' && navigationState.currentContext) {
      // Get nodes in the current group
      const groupedNodes = scenario.nodes.filter(node =>
        node.tags?.includes(navigationState.currentContext!)
      );
      
      // Also collect nodes that are OUTPUT targets of grouped nodes (external outputs)
      const externalTargetIds = new Set<string>();
      groupedNodes.forEach(node => {
        if (node.outputs) {
          node.outputs.forEach(output => {
            if (output.destinationNodeId) {
              externalTargetIds.add(output.destinationNodeId);
            }
          });
        }
      });
      
      // Show grouped nodes + their output targets (even if targets don't have the tag)
      return scenario.nodes.filter(node =>
        node.tags?.includes(navigationState.currentContext!) ||
        externalTargetIds.has(node.nodeId)
      );
    }

    const visualMode = scenario.groups?.visualMode || "all";
    const activeFilters = scenario.groups?.activeFilters || [];

    if (visualMode === "filtered" && activeFilters.length > 0) {
      // Show only nodes that have at least one of the active tags
      return scenario.nodes.filter(node => {
        if (node.type === "Group") return true; // Always show groups
        if (!node.tags || node.tags.length === 0) return false;
        return node.tags.some(tag => activeFilters.includes(tag));
      });
    }

    if (visualMode === "grouped") {
      // In grouped mode, show existing GroupNodes + ungrouped nodes
      const existingGroupNodes = scenario.nodes.filter(node => node.type === "Group");

      // Get all node IDs that are already in groups
      const groupedNodeIds = new Set<string>();
      existingGroupNodes.forEach(groupNode => {
        groupNode.containedNodes?.forEach(nodeId => groupedNodeIds.add(nodeId));
      });

      // Show ungrouped nodes + group nodes
      const ungroupedNodes = scenario.nodes.filter(node =>
        node.type !== "Group" && !groupedNodeIds.has(node.nodeId)
      );

      return [...ungroupedNodes, ...existingGroupNodes];
    }

    // Default: show all nodes (excluding Group nodes when not in grouped mode)
    return scenario.nodes.filter(node => node.type !== "Group");
  }, [
    scenario?.nodes,
    scenario?.groups?.visualMode,
    scenario?.groups?.activeFilters,
    navigationState
  ]);

  return filteredNodes;
};
