/**
 * useNodeTagsEditor Hook
 * 
 * Manages node tags editing:
 * - Updates node tags through store
 * - Handles success/error notifications
 */

import type { ToastActionElement } from "@/components/ui/toast";

interface UseNodeTagsEditorParams {
  selectedNodeId: string | null;
  nodesConfig: Record<string, any>;
  updateNodeConfigInStore: (nodeId: string, config: any) => boolean;
  toast: (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    action?: ToastActionElement;
  }) => void;
}

export const useNodeTagsEditor = ({
  selectedNodeId,
  nodesConfig,
  updateNodeConfigInStore,
  toast,
}: UseNodeTagsEditorParams) => {
  const handleTagsUpdate = async (newTags: string[]) => {
    if (!selectedNodeId) return;

    try {
      // Simply update the node tags using updateNodeConfigInStore (preserves simulation state)
      const currentNode = nodesConfig[selectedNodeId];
      if (!currentNode) return;

      const success = updateNodeConfigInStore(selectedNodeId, { ...currentNode, tags: newTags });
      if (!success) {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update node tags."
        });
        return;
      }

      toast({
        title: "Tags Updated",
        description: `Node tags have been updated successfully.`
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update tags."
      });
    }
  };

  return {
    handleTagsUpdate,
  };
};
