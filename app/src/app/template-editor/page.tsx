"use client";

import React, { useState, useEffect, useCallback } from "react";
import GraphVisualization from "@/components/graph/GraphVisualization";
import GlobalLedgerModal from "@/components/modals/GlobalLedgerModal";
import NodeInspectorModal from "@/components/modals/NodeInspectorModal";
import SimpleTokenInspector from "@/components/modals/SimpleTokenInspector";
import TemplateManagerModal from "@/components/modals/TemplateManagerModal";
import ExecutionManagerModal from "@/components/modals/ExecutionManagerModal";
import ScenarioManagerModal from "@/components/modals/ScenarioManagerModal";
import ModelUpgradeModal from "@/components/modals/ModelUpgradeModal";
import JsonViewModal from "@/components/modals/JsonViewModal";
import { EventQueueModal } from "@/components/modals/EventQueueModal";
import { ExternalEventsModal } from "@/components/modals/ExternalEventsModal";
import StateInspectorPanel from "@/components/ui/state-inspector-panel";
import { useToast } from "@/hooks/use-toast";
import { useSimulationStore } from "@/stores/simulationStore";

// Import hooks
import {
  useTemplateEditor,
  useModalManager,
  useResizablePanel,
  useTemplateLoading,
  useTemplateEffects,
  useTemplateSave,
  useGroupNavigation,
  useEventDrivenSimulation,
} from './hooks';

// Import components
import {
  SimulationToolbar,
  EventDrivenControls,
  ErrorDisplay,
  SidePanelContainer,
  ScenarioEditorModal,
  ExternalEventCreator,
} from './components';

export default function TemplateEditorPage() {
  const { toast } = useToast();
  const [isEventQueueModalOpen, setIsEventQueueModalOpen] = useState(false);
  const [isExternalEventsModalOpen, setIsExternalEventsModalOpen] = useState(false);
  const [externalEventsRefresh, setExternalEventsRefresh] = useState(0);

  // Server-side step tracking
  const [currentStep, setCurrentStep] = useState(0);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [isStepLoading, setIsStepLoading] = useState(false);
  const [serverQueueSnapshot, setServerQueueSnapshot] = useState<any>(null);
  const [serverActivities, setServerActivities] = useState<any[]>([]);

  // Preserve previous counts during loading to avoid glitching to 0
  const [displayCounts, setDisplayCounts] = useState({
    processed: 0,
    total: 0,
    ledger: 0
  });

  // Track if we've loaded the initial step from URL
  const [hasLoadedURLStep, setHasLoadedURLStep] = useState(false);

  // Create a mock engine object for modals that provides server data
  const serverEngineAdapter = {
    getQueue: () => ({
      size: () => serverQueueSnapshot?.size || 0,
      getSnapshots: () => serverQueueSnapshot?.snapshots || [],
      getProcessedCount: () => serverQueueSnapshot?.processed || 0,
      getTotalCount: () => serverQueueSnapshot?.total || 0,
      // Get full event history from server API for EventQueueModal
      getEventHistory: () => {
        return serverQueueSnapshot?.eventHistory || [];
      },
    }),
    getLedger: () => ({
      getActivities: () => serverActivities,
    }),
    getActivities: () => serverActivities,
  };

  // Update URL when step changes
  useEffect(() => {
    if (currentStep > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('step', currentStep.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }, [currentStep]);

  // Pan mode state for hand tool
  const [isPanMode, setIsPanMode] = useState(false);
  const handlePanModeToggle = useCallback(() => {
    setIsPanMode(prev => !prev);
  }, []);


  // Use custom hooks for state management
  const editor = useTemplateEditor();
  const modals = useModalManager();
  const panel = useResizablePanel(320);
  const loading = useTemplateLoading();
  const { isSaving, handleSaveTemplate } = useTemplateSave({
    currentTemplate: editor.currentTemplate,
    updateCurrentTemplate: editor.updateCurrentTemplate,
  });
  const { handleNavigateToGroup, handleNavigateBackToTemplate } = useGroupNavigation();

  // Event-driven simulation (new system)
  const eventDriven = useEventDrivenSimulation();

  // Sync step with URL query param and load that step's state (after editor is defined)
  useEffect(() => {
    if (hasLoadedURLStep) return; // Only load once

    const loadStepFromURL = async () => {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      const executionParam = params.get('execution');

      if (stepParam && executionParam && editor.currentTemplate?.id) {
        const step = parseInt(stepParam, 10);
        if (!isNaN(step) && step > 0) {
          console.log(`📍 Loading step ${step} from URL...`);
          setHasLoadedURLStep(true);

          try {
            const { engineAPIService } = await import('@/lib/services/engine-api-service');
            const result = await engineAPIService.executeStep(
              editor.currentTemplate.id,
              executionParam,
              step - 1 // API uses 0-based, URL is 1-based
            );

            // Update all state from the loaded step
            setCurrentStep(result.step);
            setActiveNodeIds(result.activeNodeIds);
            setServerQueueSnapshot(result.queueSnapshot);
            const allActivities = (result as any).allActivities || result.activity || [];
            setServerActivities(allActivities);
            setDisplayCounts({
              processed: result.queueSnapshot?.processed || 0,
              total: result.queueSnapshot?.total || 0,
              ledger: allActivities.length
            });

            console.log(`✅ Loaded step ${step} from URL`);
          } catch (error) {
            console.error('❌ Failed to load step from URL:', error);
          }
        }
      }
    };

    loadStepFromURL();
  }, [editor.currentTemplate?.id, hasLoadedURLStep]);

  // Initialize event-driven system with scenario
  useEffect(() => {
    if (editor.scenario) {
      eventDriven.loadScenario(editor.scenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.scenario]);

  // Set up all effects
  useTemplateEffects({
    loadTemplates: editor.loadTemplates,
    setIsLoading: loading.setIsLoading,
    setIsTemplateManagerOpen: modals.setIsTemplateManagerOpen,
    currentTemplate: editor.currentTemplate,
    errorMessages: editor.errorMessages,
    lastErrorCountRef: loading.lastErrorCountRef,
  });

  // CRITICAL: Sync legacy store scenario with core engine
  const legacyScenario = useSimulationStore(state => state.scenario);
  useEffect(() => {
    if (legacyScenario && !editor.scenario) {
      console.log('🔄 [DISABLED] Core engine sync disabled for Apply debugging');
      console.log('🔄 Scenario has', legacyScenario.nodes?.length || 0, 'nodes');

      // TODO: Re-enable core engine sync after Apply functionality is fixed
      // The core engine sync was interfering with Apply functionality
    }
  }, [legacyScenario, editor.scenario, editor.loadScenario]);

  // Start button now seeks to the end of the simulation (run all steps)
  const handleCoreEngineStart = async () => {
    // TRANSPARENT AUTO-SAVE: Ensure we have template and execution
    let templateId = editor.currentTemplate?.id;
    let executionId = editor.currentExecution?.id;

    if (!editor.scenario) {
      toast({
        variant: 'destructive',
        title: 'Cannot Start',
        description: 'No scenario loaded. Please load a scenario first.'
      });
      return;
    }

    setIsStepLoading(true);

    try {
      // AUTO-SAVE TEMPLATE: Create or update template if needed
      if (!templateId) {
        console.log('📝 No template found - creating auto-save template...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const autoTemplateName = `Auto-Save ${editor.scenario.name || 'Scenario'} ${timestamp}`;

        const { templateService } = await import('@/lib/services/template-service');
        const template = await templateService.createTemplate({
          name: autoTemplateName,
          description: 'Automatically created template for simulation',
          scenario: editor.scenario,
        });

        templateId = template.id;

        // Update the current template in the store
        useSimulationStore.setState({ currentTemplate: template });

        console.log('✅ Auto-created template:', templateId);

        toast({
          title: 'Template Auto-Saved',
          description: `Created "${autoTemplateName}"`,
        });
      }

      // AUTO-CREATE EXECUTION: Create minimal execution if needed
      if (!executionId) {
        console.log('📝 No execution found - creating auto-execution...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const autoExecutionName = `Simulation Run ${timestamp}`;

        // Get external events from the external queue if available
        const externalEvents = editor.externalQueue?.getAllEvents() || [];

        const { templateService } = await import('@/lib/services/template-service');
        const execution = await templateService.saveExecution({
          templateId: templateId!,
          name: autoExecutionName,
          description: 'Automatically created execution for simulation',
          scenario: editor.scenario,
          externalEvents: externalEvents,
          totalExternalEvents: externalEvents.length,
          eventTypes: [...new Set(externalEvents.map((e: any) => e.type))],
          nodeStates: {},
          currentTime: 0,
          eventCounter: 0,
          globalActivityLog: [],
          nodeActivityLogs: {},
          isCompleted: false,
        });

        executionId = execution.id;

        // Update the current execution in the store
        useSimulationStore.setState({ currentExecution: execution });

        // Reset accumulated state for new execution
        setCurrentStep(0);
        setServerActivities([]);
        setServerQueueSnapshot(null);
        setActiveNodeIds([]);

        console.log('✅ Auto-created execution:', executionId);
        console.log('  - External events:', externalEvents.length);

        toast({
          title: 'Execution Created',
          description: `Running simulation...`,
        });
      }

      console.log('🎯 Starting simulation (seeking to end)...');

      const { engineAPIService } = await import('@/lib/services/engine-api-service');
      const result = await engineAPIService.executeStep(
        templateId,
        executionId,
        'end' // Special marker for seeking to end
      );

      console.log(`✅ Reached end at step ${result.step}`);

      // Update all state from the final step
      setCurrentStep(result.step);
      setActiveNodeIds(result.activeNodeIds);
      setServerQueueSnapshot(result.queueSnapshot);
      const allActivities = (result as any).allActivities || result.activity || [];
      setServerActivities(allActivities);
      setDisplayCounts({
        processed: result.queueSnapshot?.processed || 0,
        total: result.queueSnapshot?.total || 0,
        ledger: allActivities.length
      });

      // Update URL with final step
      const url = new URL(window.location.href);
      url.searchParams.set('step', result.step.toString());
      window.history.replaceState({}, '', url.toString());

      toast({
        title: 'Simulation Complete',
        description: `Reached end at step ${result.step}`
      });

    } catch (error) {
      console.error('❌ Start simulation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Start Failed',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsStepLoading(false);
    }
  };

  const handleCoreEngineStep = async () => {
    // TRANSPARENT AUTO-SAVE: If no template/execution, create them automatically
    let templateId = editor.currentTemplate?.id;
    let executionId = editor.currentExecution?.id;

    // Check if we have a scenario to work with
    if (!editor.scenario) {
      toast({
        variant: 'destructive',
        title: 'Cannot Step',
        description: 'No scenario loaded. Please load a scenario first.'
      });
      return;
    }

    setIsStepLoading(true);

    try {
      // AUTO-SAVE TEMPLATE: Create or update template if needed
      if (!templateId) {
        console.log('📝 No template found - creating auto-save template...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const autoTemplateName = `Auto-Save ${editor.scenario.name || 'Scenario'} ${timestamp}`;

        const { templateService } = await import('@/lib/services/template-service');
        const template = await templateService.createTemplate({
          name: autoTemplateName,
          description: 'Automatically created template for step execution',
          scenario: editor.scenario,
        });

        templateId = template.id;

        // Update the current template in the store
        useSimulationStore.setState({ currentTemplate: template });

        console.log('✅ Auto-created template:', templateId);

        toast({
          title: 'Template Auto-Saved',
          description: `Created "${autoTemplateName}"`,
        });
      }

      // AUTO-CREATE EXECUTION: Create minimal execution if needed
      if (!executionId) {
        console.log('📝 No execution found - creating auto-execution...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const autoExecutionName = `Step Execution ${timestamp}`;

        // Get external events from the external queue if available
        const externalEvents = editor.externalQueue?.getAllEvents() || [];

        const { templateService } = await import('@/lib/services/template-service');
        const execution = await templateService.saveExecution({
          templateId: templateId!,
          name: autoExecutionName,
          description: 'Automatically created execution for step-by-step simulation',
          scenario: editor.scenario,
          externalEvents: externalEvents,
          totalExternalEvents: externalEvents.length,
          eventTypes: [...new Set(externalEvents.map((e: any) => e.type))],
          nodeStates: {},
          currentTime: 0,
          eventCounter: 0,
          globalActivityLog: [],
          nodeActivityLogs: {},
          isCompleted: false,
        });

        executionId = execution.id;

        // Update the current execution in the store
        useSimulationStore.setState({ currentExecution: execution });

        // Reset accumulated state for new execution
        setCurrentStep(0);
        setServerActivities([]);
        setServerQueueSnapshot(null);
        setActiveNodeIds([]);

        console.log('✅ Auto-created execution:', executionId);
        console.log('  - External events:', externalEvents.length);

        toast({
          title: 'Execution Created',
          description: `Ready to step through simulation`,
        });
      }

      // Now execute the step using server API
      console.log('🎯 Using SERVER-ONLY API');

      const { engineAPIService } = await import('@/lib/services/engine-api-service');
      const result = await engineAPIService.executeStep(
        templateId!,
        executionId!,
        currentStep
      );

      console.log(`✅ Server step ${result.step}:`, {
        activeNodes: result.activeNodeIds,
        queueSize: result.queueSize,
        nodeStates: result.nodeStates,
        queueSnapshot: result.queueSnapshot
      });

      // Update UI with server state
      setCurrentStep(result.step);
      setActiveNodeIds(result.activeNodeIds);

      // Store server data for displays (task queue, ledger, etc.)
      setServerQueueSnapshot(result.queueSnapshot);
      // Use ALL activities from server (server already has accumulated all activities)
      const allActivities = (result as any).allActivities || result.activity || [];
      setServerActivities(allActivities);

      // Update display counts (prevents glitching to 0 during loading)
      setDisplayCounts({
        processed: result.queueSnapshot?.processed || 0,
        total: result.queueSnapshot?.total || 0,
        ledger: allActivities.length
      });

      // Server-side mode: ALL state comes from server API
      // We don't update client-side stores because we're using server-only processing
      // The node states are already returned by the server and logged above for debugging

      // Clear highlighting after 2 seconds
      setTimeout(() => {
        setActiveNodeIds([]);
      }, 2000);

      toast({
        title: 'Step Complete',
        description: result.message
      });
    } catch (error) {
      console.error('❌ Server step failed:', error);
      toast({
        variant: 'destructive',
        title: 'Step Failed',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsStepLoading(false);
    }
  };

  // Reset accumulated server state (not the engine itself, just the UI state)
  const handleCoreEngineReset = () => {
    // Reset accumulated state
    setCurrentStep(0);
    setServerActivities([]);
    setServerQueueSnapshot(null);
    setActiveNodeIds([]);
    setDisplayCounts({ processed: 0, total: 0, ledger: 0 });

    // Clear step from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('step');
    window.history.replaceState({}, '', url.toString());

    toast({
      title: 'State Reset',
      description: 'Cleared accumulated activities and queue snapshots'
    });

    // OLD CLIENT-SIDE CODE (DISABLED - kept for reference):
    // if (!editor.engine) {
    //   toast({ variant: 'destructive', title: 'No Engine', description: 'Core engine not available' });
    //   return;
    // }
    // console.log('🧹 RESETTING CORE ENGINE - clearing all old events...');
    // editor.engine.reset();
    // if (editor.externalQueue) {
    //   console.log('🧹 Clearing external events queue...');
    //   editor.externalQueue.clear();
    // }
    // console.log('🧹 Engine reset complete. Queue size:', editor.engine.getQueue().size());
    // toast({ title: "Engine Reset", description: "All events cleared including external events. Engine ready for fresh start." });
  };

  const handleSeekToEnd = async () => {
    // TRANSPARENT AUTO-SAVE: Ensure we have template and execution
    let templateId = editor.currentTemplate?.id;
    let executionId = editor.currentExecution?.id;

    if (!editor.scenario) {
      toast({
        variant: 'destructive',
        title: 'Cannot Seek',
        description: 'No scenario loaded. Please load a scenario first.'
      });
      return;
    }

    if (!templateId || !executionId) {
      toast({
        variant: 'destructive',
        title: 'Cannot Seek',
        description: 'Create template and execution first by stepping through simulation.'
      });
      return;
    }

    setIsStepLoading(true);

    try {
      console.log('🎯 Seeking to end of simulation...');

      const { engineAPIService } = await import('@/lib/services/engine-api-service');
      const result = await engineAPIService.executeStep(
        templateId,
        executionId,
        'end' // Special marker for seeking to end
      );

      console.log(`✅ Reached end at step ${result.step}`);

      // Update all state from the final step
      setCurrentStep(result.step);
      setActiveNodeIds(result.activeNodeIds);
      setServerQueueSnapshot(result.queueSnapshot);
      const allActivities = (result as any).allActivities || result.activity || [];
      setServerActivities(allActivities);
      setDisplayCounts({
        processed: result.queueSnapshot?.processed || 0,
        total: result.queueSnapshot?.total || 0,
        ledger: allActivities.length
      });

      // Update URL with final step
      const url = new URL(window.location.href);
      url.searchParams.set('step', result.step.toString());
      window.history.replaceState({}, '', url.toString());

      toast({
        title: 'Reached End',
        description: `Simulation complete at step ${result.step}`
      });

    } catch (error) {
      console.error('❌ Seek to end failed:', error);
      toast({
        variant: 'destructive',
        title: 'Seek Failed',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsStepLoading(false);
    }
  };

  // Debugging handlers
  const handleResetAllEvents = () => {
    if (confirm("Reset simulation? This will delete ALL events and restart from scratch.")) {
      handleCoreEngineReset();
    }
  };

  const handleReloadFromExternalEvents = () => {
    if (confirm("Reload from external events? This will delete execution events and replay from external events only.")) {
      const externalCount = editor.globalActivityLog.filter(e => e.eventType === 'external_event').length;
      toast({
        title: "Reloaded from External Events",
        description: `Kept ${externalCount} external events, deleted execution events. Ready to replay.`,
      });
    }
  };

  // Reference doc handlers
  const handleReferenceDocUpdate = async (newDoc: string) => {
    console.log('📝 handleReferenceDocUpdate called (LOCAL UPDATE ONLY) with doc length:', newDoc.length);

    if (editor.currentTemplate) {
      // Just update the local template state - don't save to backend yet
      const { useSimulationStore } = await import('@/stores/simulationStore');
      useSimulationStore.setState((state) => ({
        currentTemplate: {
          ...state.currentTemplate!,
          referenceDoc: newDoc
        },
        availableTemplates: state.availableTemplates.map(t =>
          t.id === state.currentTemplate!.id ? { ...t, referenceDoc: newDoc } : t
        )
      }));

      console.log('📝 Updated local template state with new reference doc');

      toast({
        title: "Reference Doc Updated",
        description: "Documentation updated locally. Use the main save button to persist all changes.",
      });
    } else {
      console.warn('⚠️ No current template available for updating reference doc');
    }
  };

  const handleGenerateReferenceDoc = async (): Promise<string> => {
    if (!editor.scenario) {
      throw new Error('No scenario available');
    }

    try {
      // Add timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/reference-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate',
          scenario: editor.scenario,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.documentation;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The AI service is taking too long to respond.');
      }
      console.error('Error generating reference doc:', error);
      throw error;
    }
  };

  const handleUpdateReferenceDoc = async (): Promise<string> => {
    // Get current scenario from simulation store (includes applied improvements)
    const currentScenario = useSimulationStore.getState().scenario;

    if (!currentScenario) {
      throw new Error('No current scenario available');
    }

    const currentDoc = editor.currentTemplate?.referenceDoc || '';

    try {
      // Extract node descriptions from current scenario
      const nodeDescriptions = currentScenario.nodes?.map((node: any) => {
        const connections = currentScenario.edges?.filter((edge: any) =>
          edge.from === node.nodeId || edge.to === node.nodeId ||
          edge.sourceNodeId === node.nodeId || edge.targetNodeId === node.nodeId ||
          edge.destinationNodeId === node.nodeId
        ).map((edge: any) => {
          const isSource = edge.from === node.nodeId || edge.sourceNodeId === node.nodeId;
          const otherNodeId = isSource ? (edge.to || edge.targetNodeId || edge.destinationNodeId) : (edge.from || edge.sourceNodeId);
          const otherNode = currentScenario.nodes?.find((n: any) => n.nodeId === otherNodeId);
          return `${isSource ? 'outputs to' : 'receives from'} ${otherNode?.displayName || otherNodeId}`;
        }).join(', ');

        return {
          name: node.displayName || node.nodeId,
          type: node.type || 'Node',
          purpose: `${node.type} component in the workflow architecture`,
          connections: connections || 'Standalone component'
        };
      }) || [];

      if (nodeDescriptions.length === 0) {
        throw new Error('No components available for documentation update');
      }

      // Add timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/architecture/update-from-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: currentScenario,
          newComponents: nodeDescriptions,
          updateDescription: `Updated architecture reference with current workflow containing ${nodeDescriptions.length} components`
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      // The architecture API returns summary, not documentation
      return data.summary || 'Reference documentation updated successfully';
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The AI service is taking too long to respond.');
      }
      console.error('Error updating reference doc:', error);
      throw error;
    }
  };

  const handleNavigateToNode = async (nodeId: string) => {
    try {
      // Import the navigation service dynamically
      const { nodeNavigationService } = await import('@/lib/services/claims/nodeNavigationService');

      // Check if node exists
      if (!nodeNavigationService.nodeExists(nodeId)) {
        toast({
          title: "Node Not Found",
          description: `Node "${nodeId}" does not exist in the current scenario.`,
          variant: "destructive",
        });
        return;
      }

      // Navigate to the node with smooth zoom animation
      const success = await nodeNavigationService.navigateToNode({
        nodeId,
        highlight: false,
        zoom: 1.5,
        duration: 800,
      });

      if (!success) {
        toast({
          title: "Navigation Failed",
          description: "Unable to navigate to the node. Make sure the graph is visible.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Navigation Error",
        description: "An error occurred while navigating to the node.",
        variant: "destructive",
      });
    }
  };

  // Scenario editor handlers
  const handleOpenScenarioEditor = () => {
    const text = loading.handleOpenScenarioEditor();
    loading.setScenarioEditText(text);
    modals.openScenarioEditor();
  };

  const handleLoadScenarioFromEditor = async () => {
    const success = await loading.handleLoadScenarioFromEditor(loading.scenarioEditText);
    if (success) {
      modals.closeScenarioEditor();
    }
  };

  const handleResetEditorToDefault = async () => {
    const newText = await loading.handleResetEditorToDefault();
    if (newText) {
      loading.setScenarioEditText(newText);
    }
  };


  // Scenario update handler for AI assistant
  const handleScenarioUpdate = (newScenario: string) => {
    try {
      const parsedScenario = JSON.parse(newScenario);
      console.log('🔍 DEBUG: handleScenarioUpdate received scenario with', parsedScenario.nodes?.length || 0, 'nodes');
      console.log('🔍 DEBUG: Scenario to load:', parsedScenario);

      // Load scenario into the editor (core engine)
      editor.loadScenario(parsedScenario);
      console.log('🔍 DEBUG: editor.loadScenario completed');

      // Also sync to the simulation store for template saving
      const simulationStore = useSimulationStore.getState();
      simulationStore._restoreScenarioState(parsedScenario);
      console.log('🔍 DEBUG: simulationStore._restoreScenarioState completed');

      toast({ title: "Success", description: "Scenario updated automatically by AI" });
    } catch (error) {
      console.error('🔍 DEBUG: handleScenarioUpdate error:', error);
      toast({
        variant: "destructive",
        title: "JSON Error",
        description: "AI generated invalid JSON: " + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  };


  // Loading screen
  if (loading.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading simulation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Toolbar */}
      <SimulationToolbar
        currentTemplate={editor.currentTemplate}
        currentExecution={editor.currentExecution}
        currentScenario={editor.currentScenario}
        currentTime={editor.currentTime}
        isSaving={isSaving}
  canUndo={!!editor.canUndo}
  canRedo={!!editor.canRedo}
        isRunning={editor.isRunning}
        hasUnsavedChanges={editor.hasUnsavedChanges}
        onTemplateManagerOpen={modals.openTemplateManager}
        onExecutionManagerOpen={modals.openExecutionManager}
        onSaveTemplate={handleSaveTemplate}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onToggleGlobalLedger={editor.toggleGlobalLedger}
        onStateInspectorToggle={modals.toggleStateInspector}
        onSidePanelMode={panel.setSidePanelMode}
        onJsonViewOpen={modals.openJsonView}
        onModelUpgradeOpen={modals.openModelUpgrade}
        onSaveVersion={() => {
          // TODO: Show save version dialog
          const versionName = prompt('Enter version name (e.g., "v1.0", "production"):');
          if (versionName && versionName.trim()) {
            // Save version logic will be implemented
            toast({
              title: "Version Saved",
              description: `Version "${versionName}" saved successfully.`,
            });
          }
        }}
        isStateInspectorOpen={modals.isStateInspectorOpen}
        disabled={false}
      />

      {/* Event-Driven Simulation Controls - SERVER-SIDE ONLY */}
      <EventDrivenControls
        isRunning={isStepLoading}
        currentEventIndex={displayCounts.processed}
        totalEvents={displayCounts.total}
        currentTime={0}
        canStepBackward={false}
        canStepForward={serverQueueSnapshot ? (serverQueueSnapshot.size > 0) : true}
        eventStoreHash=""
        simulationMode="step"
        onStartSimulation={handleCoreEngineStart}
        onStepBackward={() => {}}
        onStepForward={handleCoreEngineStep}
        onSeekToStart={() => {}}
        onSeekToEnd={handleSeekToEnd}
        onReset={handleCoreEngineReset}
        onModeChange={() => {}}
        onViewEvents={() => setIsEventQueueModalOpen(true)}
        onViewExternalEvents={() => setIsExternalEventsModalOpen(true)}
        onViewLedger={editor.toggleGlobalLedger}
        onViewModel={modals.openJsonView}
        externalEventsCount={editor.externalQueue?.getAllEvents()?.length || 0}
        ledgerCount={displayCounts.ledger}
        disabled={false}
        hasScenario={!!editor.scenario}
        isPanMode={isPanMode}
        onPanModeToggle={handlePanModeToggle}
      />


      {/* Event Queue Modal - Shows server-side queue data */}
      <EventQueueModal
        isOpen={isEventQueueModalOpen}
        onClose={() => setIsEventQueueModalOpen(false)}
        engine={serverEngineAdapter as any}
      />

      {/* External Events Modal */}
      <ExternalEventsModal
        key={externalEventsRefresh}
        isOpen={isExternalEventsModalOpen}
        onClose={() => setIsExternalEventsModalOpen(false)}
        externalQueue={editor.externalQueue}
        engine={serverEngineAdapter as any}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden min-h-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Empty state: no scenario loaded -> centered CTA + disable menus (handled via disabled props) */}
        {!editor.scenario && !loading.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white/90 rounded-lg shadow p-6 flex flex-col items-center space-y-4">
              <h2 className="text-lg font-medium">No scenario loaded</h2>
              <p className="text-sm text-gray-600">Load a scenario to enable simulation menus and controls.</p>
              <div className="pt-2">
                <button
                  onClick={handleOpenScenarioEditor}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Load scenario
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Graph Visualization */}
        <div className="flex-grow transition-all duration-300 relative bg-white overflow-hidden">
          <ErrorDisplay 
            errorMessages={editor.errorMessages} 
            onClearErrors={editor.clearErrors} 
          />

          <div className="h-full w-full">
            <GraphVisualization
              isPanMode={isPanMode}
              onPanModeToggle={handlePanModeToggle}
              activeNodeIds={activeNodeIds}
            />
          </div>
        </div>

        {/* Side Panel */}
        <SidePanelContainer
          isVisible={panel.isPanelVisible}
          panelWidth={panel.panelWidth}
          sidePanelMode={panel.sidePanelMode}
          scenarioContent={editor.scenario ? JSON.stringify(editor.scenario, null, 2) : loading.defaultScenarioContent}
          referenceDoc={(() => {
            const refDoc = editor.currentTemplate?.referenceDoc;
            console.log('🏗️ TemplateEditor: Passing referenceDoc to SidePanelContainer:', refDoc ? `${refDoc.length} characters` : 'NULL/UNDEFINED');
            console.log('🏗️ Current template ID:', editor.currentTemplate?.id);
            console.log('🏗️ Current template name:', editor.currentTemplate?.name);
            return refDoc;
          })()}
          onSidePanelModeChange={panel.setSidePanelMode}
          onToggleVisibility={panel.togglePanelVisibility}
          onMouseDown={panel.handleMouseDown}
          onScenarioUpdate={handleScenarioUpdate}
          loadScenario={useSimulationStore.getState().loadScenario}
          onReferenceDocUpdate={handleReferenceDocUpdate}
          onGenerateReferenceDoc={handleGenerateReferenceDoc}
          onUpdateReferenceDoc={handleUpdateReferenceDoc}
          onNavigateToNode={handleNavigateToNode}
          onNavigateToGroup={handleNavigateToGroup}
        />
      </main>

      {/* Scenario Editor Modal */}
      <ScenarioEditorModal
        isOpen={modals.isScenarioEditorOpen}
        scenarioEditText={loading.scenarioEditText}
        onOpenChange={modals.setIsScenarioEditorOpen}
        onScenarioEditTextChange={loading.setScenarioEditText}
        onLoadScenario={handleLoadScenarioFromEditor}
        onResetToDefault={handleResetEditorToDefault}
      />

      {/* State Inspector Panel */}
      <StateInspectorPanel 
        isOpen={modals.isStateInspectorOpen} 
        onClose={() => modals.setIsStateInspectorOpen(false)} 
      />

      {/* Modals - Using server-side data adapter */}
      <NodeInspectorModal
        engine={serverEngineAdapter as any}
        templateId={editor.currentTemplate?.id}
        executionId={editor.currentExecution?.id}
        currentStep={currentStep}
      />
      <SimpleTokenInspector engine={serverEngineAdapter as any} />
      <GlobalLedgerModal
        engine={serverEngineAdapter as any}
        templateId={editor.currentTemplate?.id}
        executionId={editor.currentExecution?.id}
        currentStep={currentStep}
      />
      <TemplateManagerModal
        isOpen={modals.isTemplateManagerOpen}
        onClose={modals.closeTemplateManager}
      />
      <ExecutionManagerModal
        isOpen={modals.isExecutionManagerOpen}
        onClose={modals.closeExecutionManager}
        externalQueue={editor.externalQueue}
        engine={serverEngineAdapter as any}
        onExternalEventsChanged={() => setExternalEventsRefresh(prev => prev + 1)}
      />
      <ScenarioManagerModal
        isOpen={modals.isScenarioManagerOpen}
        onClose={modals.closeScenarioManager}
      />
      <ModelUpgradeModal
        isOpen={modals.isModelUpgradeOpen}
        onClose={modals.closeModelUpgrade}
      />
      <JsonViewModal
        isOpen={modals.isJsonViewOpen}
        onClose={modals.closeJsonView}
      />


    </div>
  );
}
