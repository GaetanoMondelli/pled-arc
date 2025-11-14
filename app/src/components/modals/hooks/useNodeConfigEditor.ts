/**
 * useNodeConfigEditor Hook
 * 
 * Manages configuration editing for a node, including:
 * - JSON config text editing
 * - Save/reset functionality
 * - Validation and error handling
 * - JSON view toggle
 */

import { useState, useEffect } from "react";
import type { ToastActionElement } from "@/components/ui/toast";

interface UseNodeConfigEditorParams {
  nodeConfig: any;
  selectedNodeId: string | null;
  scenario: any;
  updateNodeConfigInStore: (nodeId: string, config: any) => boolean;
  toast: (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    action?: ToastActionElement;
  }) => void;
}

export const useNodeConfigEditor = ({
  nodeConfig,
  selectedNodeId,
  scenario,
  updateNodeConfigInStore,
  toast,
}: UseNodeConfigEditorParams) => {
  const [editedConfigText, setEditedConfigText] = useState<string>("");
  const [showConfigJson, setShowConfigJson] = useState(false);
  const [originalConfigText, setOriginalConfigText] = useState<string>("");

  // Sync config text with node config changes
  useEffect(() => {
    if (nodeConfig) {
      const configText = JSON.stringify(nodeConfig, null, 2);
      setEditedConfigText(configText);
      setOriginalConfigText(configText);
    } else {
      setEditedConfigText("");
      setOriginalConfigText("");
    }
  }, [nodeConfig]);

  const hasUnsavedChanges = editedConfigText !== originalConfigText;

  const handleSaveConfig = async () => {
    if (!selectedNodeId || !scenario) return;

    try {
      const parsedConfig = JSON.parse(editedConfigText);
      
      // Validate that essential properties are maintained
      if (parsedConfig.nodeId !== selectedNodeId) {
        toast({
          variant: "destructive",
          title: "Invalid Configuration",
          description: "Node ID cannot be changed through this editor."
        });
        return;
      }

      // Apply the changes using updateNodeConfigInStore (preserves simulation state)
      const success = updateNodeConfigInStore(selectedNodeId, parsedConfig);
      if (!success) {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Failed to update node configuration."
        });
        return;
      }
      setOriginalConfigText(editedConfigText);
      
      toast({
        title: "Configuration Updated",
        description: `Node ${parsedConfig.displayName} has been updated successfully.`
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: error instanceof Error ? error.message : "Please check your JSON syntax."
      });
    }
  };

  const handleResetConfig = () => {
    setEditedConfigText(originalConfigText);
  };

  return {
    editedConfigText,
    setEditedConfigText,
    showConfigJson,
    setShowConfigJson,
    hasUnsavedChanges,
    handleSaveConfig,
    handleResetConfig,
  };
};
