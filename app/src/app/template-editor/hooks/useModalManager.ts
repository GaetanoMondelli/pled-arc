import { useState } from "react";

/**
 * Hook for managing all modal states in the template editor
 */
export function useModalManager() {
  const [isScenarioEditorOpen, setIsScenarioEditorOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isExecutionManagerOpen, setIsExecutionManagerOpen] = useState(false);
  const [isScenarioManagerOpen, setIsScenarioManagerOpen] = useState(false);
  const [isModelUpgradeOpen, setIsModelUpgradeOpen] = useState(false);
  const [isJsonViewOpen, setIsJsonViewOpen] = useState(false);
  const [isStateInspectorOpen, setIsStateInspectorOpen] = useState(false);

  return {
    // Scenario editor modal
    isScenarioEditorOpen,
    setIsScenarioEditorOpen,
    openScenarioEditor: () => setIsScenarioEditorOpen(true),
    closeScenarioEditor: () => setIsScenarioEditorOpen(false),

    // Template manager modal
    isTemplateManagerOpen,
    setIsTemplateManagerOpen,
    openTemplateManager: () => setIsTemplateManagerOpen(true),
    closeTemplateManager: () => setIsTemplateManagerOpen(false),

    // Execution manager modal
    isExecutionManagerOpen,
    setIsExecutionManagerOpen,
    openExecutionManager: () => setIsExecutionManagerOpen(true),
    closeExecutionManager: () => setIsExecutionManagerOpen(false),

    // Scenario manager modal
    isScenarioManagerOpen,
    setIsScenarioManagerOpen,
    openScenarioManager: () => setIsScenarioManagerOpen(true),
    closeScenarioManager: () => setIsScenarioManagerOpen(false),

    // Model upgrade modal
    isModelUpgradeOpen,
    setIsModelUpgradeOpen,
    openModelUpgrade: () => setIsModelUpgradeOpen(true),
    closeModelUpgrade: () => setIsModelUpgradeOpen(false),

    // JSON view modal
    isJsonViewOpen,
    setIsJsonViewOpen,
    openJsonView: () => setIsJsonViewOpen(true),
    closeJsonView: () => setIsJsonViewOpen(false),

    // State inspector panel
    isStateInspectorOpen,
    setIsStateInspectorOpen,
    toggleStateInspector: () => setIsStateInspectorOpen(prev => !prev),
  };
}
