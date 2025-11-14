import { useEffect } from "react";
import type { Node } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";

export const useNodeDataUpdates = (
  nodes: Node[],
  scenario: Scenario | null,
  nodesWithActivity: Set<string>,
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
) => {
  // Update node data when scenario or activity changes
  useEffect(() => {
    if (!scenario) return;
    
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        const scenarioNode = scenario.nodes.find(n => n.nodeId === node.id);
        
        if (!scenarioNode) return node;
        
        // Update node data with latest config and activity status
        return {
          ...node,
          data: {
            ...node.data,
            config: scenarioNode,
            isActive: nodesWithActivity.has(node.id),
          },
        };
      });
    });
  }, [scenario, nodesWithActivity, setNodes]);
};
