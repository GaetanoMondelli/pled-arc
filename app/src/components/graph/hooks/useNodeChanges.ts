import { useCallback } from "react";
import type { OnNodesChange } from "reactflow";
import { applyNodeChanges } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

export const useNodeChanges = (
  scenario: Scenario | null,
  currentTime: number,
  loadScenario: (scenario: any) => Promise<void>,
  saveSnapshot: (description: string) => void,
  setRfNodes: React.Dispatch<React.SetStateAction<any[]>>
) => {
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    console.log(`🔄 [NODES CHANGE] Changes:`, changes, `current time: ${currentTime}`);
    // ALWAYS apply changes to ReactFlow state first for smooth interaction
    setRfNodes(nds => applyNodeChanges(changes, nds));

    // Handle position changes - only save dragging=false (drag end) to prevent infinite loops
    const positionChanges = changes.filter(change =>
      change.type === 'position' && change.dragging === false
    );
    if (positionChanges.length > 0 && scenario) {
      const updatedNodes = scenario.nodes.map(node => {
        const positionChange = positionChanges.find(change => change.id === node.nodeId);
        if (positionChange && positionChange.position) {
          return {
            ...node,
            position: {
              x: positionChange.position.x,
              y: positionChange.position.y,
            },
          };
        }
        return node;
      });

      const updatedScenario = { ...scenario, nodes: updatedNodes };
      console.log(`📍 [POSITION UPDATE] Updated positions for ${positionChanges.length} nodes (drag end)`);
      loadScenario(updatedScenario);

      // Mark as having unsaved changes after moving nodes
      useSimulationStore.getState().markAsUnsavedChanges();
    }

    // Handle node deletions by updating the scenario
    const nodeDeleteChanges = changes.filter(change => change.type === 'remove');
    if (nodeDeleteChanges.length > 0 && scenario) {
      // Save snapshot before deletion
      saveSnapshot('Delete nodes');

      const deletedNodeIds = nodeDeleteChanges.map(change => change.id);

      // Remove nodes from scenario and clean up references
      const updatedNodes = scenario.nodes.filter(node => !deletedNodeIds.includes(node.nodeId));

      // Clean up references in remaining nodes
      const cleanedNodes = updatedNodes.map(node => {
        let cleanedNode = { ...node };
        
        if (node.outputs) {
          // Clean up outputs that reference deleted nodes
          const cleanedOutputs = node.outputs.map(output => {
            if (deletedNodeIds.includes(output.destinationNodeId)) {
              console.log(`🧹 [CLEANUP] Clearing output from ${node.nodeId} (${node.displayName}) that referenced deleted node ${output.destinationNodeId}`);
              return { ...output, destinationNodeId: '', destinationInputName: '' };
            }
            return output;
          });
          cleanedNode = { ...cleanedNode, outputs: cleanedOutputs };
        }
        
        if (node.inputs) {
          // Clean up inputs that reference deleted nodes
          const cleanedInputs = node.inputs.filter(input => {
            const shouldKeep = !input.nodeId || !deletedNodeIds.includes(input.nodeId);
            if (!shouldKeep) {
              console.log(`🧹 [CLEANUP] Removing input from ${node.nodeId} (${node.displayName}) that referenced deleted node ${input.nodeId}`);
            }
            return shouldKeep;
          });
          cleanedNode = { ...cleanedNode, inputs: cleanedInputs };
        }
        
        return cleanedNode;
      });

      // Clean up edges that reference deleted nodes
      const cleanedEdges = scenario.edges?.filter(edge => {
        const sourceDeleted = deletedNodeIds.includes(edge.sourceNodeId || edge.from);
        const targetDeleted = deletedNodeIds.includes(edge.targetNodeId || edge.to || edge.destinationNodeId);

        if (sourceDeleted || targetDeleted) {
          console.log(`🧹 [EDGE CLEANUP] Removing edge ${edge.id} that referenced deleted node(s)`);
          return false;
        }
        return true;
      }) || [];

      console.log(`💥 [NODE DELETION] Deleted nodes:`, deletedNodeIds);
      console.log(`🔧 [NODE DELETION] Cleaned scenario has ${cleanedNodes.length} nodes and ${cleanedEdges.length} edges`);

      const updatedScenario = { ...scenario, nodes: cleanedNodes, edges: cleanedEdges };
      console.log(`💥 [LOAD SCENARIO] From onNodesChange - node deletion, current time: ${currentTime}`);
      loadScenario(updatedScenario);

      // Mark as having unsaved changes after deleting nodes
      useSimulationStore.getState().markAsUnsavedChanges();
    }
  }, [scenario, loadScenario, saveSnapshot, currentTime, setRfNodes]);

  return { onNodesChange };
};
