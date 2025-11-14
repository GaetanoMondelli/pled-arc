import { useCallback } from "react";
import type { Node } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

export const useNodeInteractions = (
  scenario: Scenario | null,
  currentTime: number,
  setSelectedNodeId: (id: string) => void,
  navigationManager: any,
  loadScenario: (scenario: any) => Promise<void>
) => {
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      console.log(`🎯 [NODE CLICK] Clicking node: ${node.id}, current time: ${currentTime}`);

      // Skip node inspector for MarkdownComment nodes (pure text annotations)
      if (node.data?.config?.type !== "MarkdownComment") {
        setSelectedNodeId(node.id);
      }
      // Note: Group navigation now handled only in onNodeDoubleClick to avoid duplicate breadcrumbs
    },
    [setSelectedNodeId, currentTime],
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Handle group navigation on double-click
      if (node.data.config.type === "Group" && scenario) {
        const groupNode = scenario.nodes.find(n => n.nodeId === node.id && n.type === "Group");
        if (groupNode && groupNode.groupName) {
          // Navigate into the group - show only nodes with that tag
          const groupNodes = scenario.nodes.filter(n => n.tags?.includes(groupNode.groupName!));
          navigationManager.navigateToGroup(groupNode.groupName, groupNodes);

          // Update URL to reflect navigation state
          const url = new URL(window.location.href);
          url.searchParams.set('group', groupNode.groupName);
          window.history.pushState({}, '', url.toString());
        }
      }
    },
    [scenario, navigationManager],
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!scenario) return;

      // Handle all nodes including groups - update position in scenario.nodes
      const updatedNodes = scenario.nodes.map(scenarioNode => {
        if (scenarioNode.nodeId === node.id) {
          return {
            ...scenarioNode,
            position: {
              x: node.position.x,
              y: node.position.y,
            },
          };
        }
        return scenarioNode;
      });

      const updatedScenario = { ...scenario, nodes: updatedNodes };
      loadScenario(updatedScenario);

      // Mark as having unsaved changes after moving nodes
      useSimulationStore.getState().markAsUnsavedChanges();
    },
    [scenario, loadScenario],
  );

  return { onNodeClick, onNodeDoubleClick, onNodeDragStop };
};
