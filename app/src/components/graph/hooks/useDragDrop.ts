import { useCallback, useState } from "react";
import type { Scenario } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

export const useDragDrop = (
  scenario: Scenario | null,
  navigationState: any,
  loadScenario: (scenario: any) => Promise<void>,
  saveSnapshot: (description: string) => void
) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const templateData = event.dataTransfer.getData('application/node-template');
      
      if (!templateData || !scenario) return;
      
      try {
        const template = JSON.parse(templateData);
        
        // Save snapshot before adding node
        saveSnapshot(`Add ${template.displayName}`);
        
        // Calculate position relative to ReactFlow canvas
        const position = {
          x: event.clientX - reactFlowBounds.left - 100,
          y: event.clientY - reactFlowBounds.top - 50,
        };
        
        // Generate unique ID
        const timestamp = Date.now();
        const nodeId = `${template.type}_${timestamp}`;
        
        // Create new node with clean template defaults
        const newNode = {
          ...template.defaultConfig,
          nodeId,
          displayName: `${template.displayName} ${scenario.nodes.length + 1}`,
          position,
        };

        // If inside a group, automatically assign the group tag
        if (navigationState.currentView === 'group' && navigationState.currentContext) {
          newNode.tags = [...(newNode.tags || []), navigationState.currentContext];
        }

        // Add to scenario
        const updatedScenario = {
          ...scenario,
          version: '3.0',
          nodes: [...scenario.nodes, newNode],
        };

        loadScenario(updatedScenario);

        // Mark as having unsaved changes after adding node
        useSimulationStore.getState().markAsUnsavedChanges();
      } catch (error) {
        console.error('Failed to drop node:', error);
      }
    },
    [scenario, loadScenario, saveSnapshot, navigationState],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    const current = event.currentTarget as Element;
    const related = event.relatedTarget as Element | null;
    if (!related || !current.contains(related)) {
      setIsDragOver(false);
    }
  }, []);

  return { isDragOver, onDrop, onDragOver, onDragLeave };
};
