import { useState, useCallback, useRef, useEffect } from 'react';
import { SimulationEngine } from '@/core';
import { ExternalEventQueue, ExternalEvent } from '@/core/ExternalEventQueue';
import { useSimulationStore } from "@/stores/simulationStore";


/**
 * Hook for managing template editor with core SimulationEngine integration
 *
 * Replaces legacy store logic with direct core system integration.
 * Maintains same interface for compatibility while using core APIs internally.
 */
export function useTemplateEditor() {
  // Core system instances (single instances per component)
  const engineRef = useRef<SimulationEngine | null>(null);
  const externalQueueRef = useRef<ExternalEventQueue | null>(null);

  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tick, setTick] = useState(0);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [scenario, setScenario] = useState<any>(null);
  const [globalActivityLog, setGlobalActivityLog] = useState<any[]>([]);

  // Legacy store selectors for template management (keeping this temporarily)
  const currentTemplate = useSimulationStore(state => state.currentTemplate);
  const currentExecution = useSimulationStore(state => state.currentExecution);
  const hasUnsavedChanges = useSimulationStore(state => state.hasUnsavedChanges);
  const loadTemplates = useSimulationStore(state => state.loadTemplates);
  const updateCurrentTemplate = useSimulationStore(state => state.updateCurrentTemplate);
  const setExternalQueue = useSimulationStore(state => state.setExternalQueue);

  // Initialize core engine once
  useEffect(() => {
    if (!engineRef.current) {
      console.log('🚀 Initializing core SimulationEngine...');
      engineRef.current = new SimulationEngine();

      // Check if there's already an external queue in the store (from URL loading)
      const existingQueue = useSimulationStore.getState().externalQueue;
      if (existingQueue) {
        console.log('🔄 Reusing existing external queue from store (has events from URL loading)');
        externalQueueRef.current = existingQueue;
        // CRITICAL: Must connect existing queue to engine, otherwise events won't be processed!
        externalQueueRef.current.setSimulationEngine(engineRef.current);
      } else {
        console.log('🆕 Creating new external queue');
        externalQueueRef.current = new ExternalEventQueue();
        externalQueueRef.current.setSimulationEngine(engineRef.current);
        // Register external queue with simulation store for URL loading
        setExternalQueue(externalQueueRef.current);
      }

      console.log('✅ Core engine initialized and external queue set up');
    }
  }, [setExternalQueue]);

  // Core simulation controls using engine
  const loadScenario = useCallback(async (scenarioData: any) => {
    if (!engineRef.current) return;

    console.log('📥 Loading scenario into core engine...', scenarioData.name);
    console.log('🔍 Original scenario nodes count:', scenarioData.nodes?.length || 0);

    try {
      // Core engine now natively supports V3 format!
      engineRef.current.initialize(scenarioData);
      setScenario(scenarioData);
      setErrorMessages([]);

      console.log('✅ Scenario loaded successfully with', scenarioData.nodes?.length || 0, 'nodes');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessages([errorMsg]);
      console.error('❌ Failed to load scenario:', error);
    }
  }, []);

  // Initialize engine with scenario from simulation store when available
  useEffect(() => {
    const simulationStore = useSimulationStore.getState();
    const storeScenario = simulationStore.scenario;

    if (engineRef.current && storeScenario && !scenario) {
      console.log('🔄 Loading scenario from simulation store into engine...');
      loadScenario(storeScenario);
    }
  }, [loadScenario, scenario]);

  const play = useCallback(async () => {
    if (!engineRef.current || isRunning) return;

    console.log('▶️ Starting simulation...');
    setIsRunning(true);

    try {
      // Use core engine's run method
      await engineRef.current.run({
        maxSteps: 1000,
        realTimeMode: false
      });

      // Update UI state from engine
      const stats = engineRef.current.getStats();
      setCurrentTime(stats.currentTick);
      setTick(stats.currentTick);

      // Get activity log from engine ledger
      const ledger = engineRef.current.getLedger();
      const activities = ledger.getActivities();
      setGlobalActivityLog(activities);

      console.log('✅ Simulation completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Simulation failed';
      setErrorMessages(prev => [...prev, errorMsg]);
      console.error('❌ Simulation failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  const pause = useCallback(() => {
    if (!engineRef.current) return;

    console.log('⏸️ Pausing simulation...');
    engineRef.current.pause();
    setIsRunning(false);
  }, []);

  const stepForward = useCallback(async (steps: number = 1) => {
    if (!engineRef.current) return;

    console.log(`⏭️ Stepping forward ${steps} step(s)...`);

    try {
      // Track activities before step to identify nodes involved in this step
      const beforeActivities = engineRef.current.getLedger().getActivities();
      const beforeCount = beforeActivities.length;

      for (let i = 0; i < steps; i++) {
        const stepEvent = await engineRef.current.step();
        if (!stepEvent) {
          console.log('✅ No more steps available');
          break;
        }

        // Get activities added by this step to identify involved nodes
        const afterActivities = engineRef.current.getLedger().getActivities();
        const newActivities = afterActivities.slice(beforeCount + (i * 10)); // Approximate new activities for this step

        // Extract unique node IDs involved in this step
        const involvedNodeIds = [...new Set([
          stepEvent.sourceNodeId,
          stepEvent.targetNodeId || stepEvent.sourceNodeId,
          ...newActivities.map(activity => activity.nodeId)
        ])].filter(Boolean);

        console.log(`📍 Step ${i + 1} involved nodes:`, involvedNodeIds);

        // Update node activity tracking
        const markNodesAsRecentlyActive = useSimulationStore.getState().markNodesAsRecentlyActive;
        markNodesAsRecentlyActive(involvedNodeIds);
      }

      // Update UI state
      const stats = engineRef.current.getStats();
      setCurrentTime(stats.currentTick);
      setTick(stats.currentTick);

      // Update activity log
      const ledger = engineRef.current.getLedger();
      const activities = ledger.getActivities();
      setGlobalActivityLog(activities);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Step failed';
      setErrorMessages(prev => [...prev, errorMsg]);
      console.error('❌ Step failed:', error);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrorMessages([]);
  }, []);

  // Global ledger toggle (using core engine's ledger)
  const toggleGlobalLedger = useCallback(() => {
    // Always toggle the modal state first
    const storeToggle = useSimulationStore.getState().toggleGlobalLedger;
    storeToggle();

    // If we have an engine, update the activity log with fresh data
    if (engineRef.current) {
      const ledger = engineRef.current.getLedger();
      const activities = ledger.getActivities();
      setGlobalActivityLog(activities);
      console.log(`📊 Global ledger toggled: ${activities.length} activities from core engine`);
    } else {
      console.log(`📊 Global ledger toggled: using legacy store data`);
    }
  }, []);

  // History controls (not implemented in core yet - placeholders)
  const undo = useCallback(() => {
    console.log('⚠️ Undo not implemented in core engine yet');
  }, []);

  const redo = useCallback(() => {
    console.log('⚠️ Redo not implemented in core engine yet');
  }, []);

  const canUndo = false;
  const canRedo = false;

  // Fixed values for compatibility
  const simulationSpeed = 1;
  const isRecording = false;
  const availableScenarios: any[] = [];

  return {
    // Simulation controls
    loadScenario,
    play,
    pause,
    stepForward,
    tick,
    isRunning,
    currentTime,
    simulationSpeed,

    // Scenario state
    scenario,
    currentTemplate,
    currentExecution,
    hasUnsavedChanges,

    // History
    undo,
    redo,
    canUndo,
    canRedo,

    // Errors
    errorMessages,
    clearErrors,

    // UI toggles
    toggleGlobalLedger,

    // Template management (still using legacy for now)
    loadTemplates,
    updateCurrentTemplate,

    // Activity log (from core engine)
    globalActivityLog,

    // Event sourcing (placeholders for compatibility)
    isRecording,
    currentScenario: scenario,
    availableScenarios,

    // Core system access (for advanced usage)
    engine: engineRef.current,
    externalQueue: externalQueueRef.current,
  };
}
