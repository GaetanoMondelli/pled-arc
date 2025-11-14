import { useCallback } from "react";
import type { OnEdgesChange } from "reactflow";
import { applyEdgeChanges } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

export const useEdgeChanges = (
  scenario: Scenario | null,
  loadScenario: (scenario: any) => Promise<void>,
  saveSnapshot: (description: string) => void,
  setRfEdges: React.Dispatch<React.SetStateAction<any[]>>
) => {
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    // Handle edge deletions by updating the scenario
    const edgeDeleteChanges = changes.filter(change => change.type === 'remove');
    if (edgeDeleteChanges.length > 0 && scenario) {
      // Save snapshot before deletion
      saveSnapshot('Delete edges');
      
      const deletedEdgeIds = edgeDeleteChanges.map(change => change.id);
      console.log('🗑️ [DELETE EDGES] Deleting edges:', deletedEdgeIds);
      
      // Parse edge IDs to get connection info: e-{sourceId}-{outputName}-{targetId}
      const deletedConnections = deletedEdgeIds.map(edgeId => {
        const parts = edgeId.split('-');
        if (parts.length >= 4) {
          return {
            sourceId: parts[1],
            outputName: parts[2],
            targetId: parts.slice(3).join('-') // Handle IDs with dashes
          };
        }
        return null;
      }).filter(Boolean);
      
      const updatedNodes = scenario.nodes.map(node => {
        let updatedNode = { ...node };
        
        // Update source nodes: clear destinationNodeId in outputs
        if (node.outputs) {
          const updatedOutputs = node.outputs.map((output) => {
            const expectedEdgeId = `e-${node.nodeId}-${output.name}-${output.destinationNodeId}`;
            if (deletedEdgeIds.includes(expectedEdgeId)) {
              console.log(`🗑️ Clearing output ${output.name} on node ${node.nodeId}`);
              return { ...output, destinationNodeId: '' };
            }
            return output;
          });
          updatedNode = { ...updatedNode, outputs: updatedOutputs };
        }
        
        // Update target nodes: remove inputs that reference deleted connections
        if (node.inputs && node.inputs.length > 0) {
          const updatedInputs = node.inputs.filter(input => {
            // Check if this input is part of a deleted connection
            const isDeleted = deletedConnections.some(conn => 
              conn && 
              conn.sourceId === input.nodeId && 
              conn.targetId === node.nodeId &&
              conn.outputName === input.sourceOutputName
            );
            
            if (isDeleted) {
              console.log(`🗑️ Removing input ${input.name} from node ${node.nodeId} (was from ${input.nodeId})`);
            }
            
            return !isDeleted;
          });
          updatedNode = { ...updatedNode, inputs: updatedInputs };
        }
        
        return updatedNode;
      });
      
      const updatedScenario = { ...scenario, nodes: updatedNodes };
      console.log('🗑️ [DELETE EDGES] Updated scenario');
      loadScenario(updatedScenario);

      // Mark as having unsaved changes after deleting edges
      useSimulationStore.getState().markAsUnsavedChanges();
    } else {
      // Only apply direct visual changes if we didn't update the scenario
      setRfEdges(eds => applyEdgeChanges(changes, eds));
    }
  }, [scenario, loadScenario, saveSnapshot, setRfEdges]);

  return { onEdgesChange };
};
