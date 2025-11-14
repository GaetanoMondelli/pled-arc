import { useMemo } from "react";
import type { Node } from "reactflow";
import { Position } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";

/**
 * Hook to convert scenario nodes to ReactFlow nodes
 * Includes all necessary data for node display components
 */
export const useReactFlowNodes = (
  filteredNodes: any[],
  scenario: Scenario | null,
  nodesWithActivity: Set<string>
) => {
  const reactFlowNodes = useMemo(() => {
    if (!scenario) return [];

    return filteredNodes.map((node): Node => {
      const isActive = nodesWithActivity.has(node.nodeId);

      const baseData = {
        label: node.displayName,
        type: node.type,
        config: node,
        isActive,
        details: "",
      };

      // Add specific data for Group nodes
      if (node.type === "Group") {
        baseData.details = `Nodes: ${node.containedNodes?.length || 0}`;
      }

      return {
        id: node.nodeId,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        deletable: true,
        draggable: true,
        data: baseData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  }, [filteredNodes, scenario, nodesWithActivity]);

  return reactFlowNodes;
};
