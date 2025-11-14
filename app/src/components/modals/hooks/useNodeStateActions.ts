/**
 * useNodeStateActions Hook
 * 
 * Manages FSM state actions editing:
 * - Updates state onEntry actions
 * - Clones and modifies FSM config
 * - Handles both string and object state formats
 */

import type { ToastActionElement } from "@/components/ui/toast";

interface UseNodeStateActionsParams {
  selectedNodeId: string | null;
  scenario: any;
  nodeConfig: any;
  nodesConfig: Record<string, any>;
  updateNodeConfigInStore: (nodeId: string, config: any) => boolean;
  toast: (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    action?: ToastActionElement;
  }) => void;
}

export const useNodeStateActions = ({
  selectedNodeId,
  scenario,
  nodeConfig,
  nodesConfig,
  updateNodeConfigInStore,
  toast,
}: UseNodeStateActionsParams) => {
  const handleStateActionsUpdate = async (stateIndex: number, newActions: any[]) => {
    if (!selectedNodeId || !scenario || !nodeConfig) return;

    try {
      // Clone the FSM config
      const updatedFsm = JSON.parse(JSON.stringify(nodeConfig.fsm));

      // Update the state's onEntry actions
      if (updatedFsm.states && updatedFsm.states[stateIndex]) {
        if (typeof updatedFsm.states[stateIndex] === 'string') {
          // Convert string state to object format
          updatedFsm.states[stateIndex] = {
            name: updatedFsm.states[stateIndex],
            onEntry: newActions
          };
        } else {
          // Update existing object format
          updatedFsm.states[stateIndex].onEntry = newActions;
        }
      }

      // Apply the changes using updateNodeConfigInStore (preserves simulation state)
      const currentNode = nodesConfig[selectedNodeId];
      if (!currentNode) return;

      const success = updateNodeConfigInStore(selectedNodeId, { ...currentNode, fsm: updatedFsm });
      if (!success) {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update FSM state actions."
        });
        return;
      }

      toast({
        title: "State Actions Updated",
        description: `Actions for state have been updated successfully.`
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update state actions."
      });
    }
  };

  return {
    handleStateActionsUpdate,
  };
};
