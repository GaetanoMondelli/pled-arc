/**
 * Event Sourcing Integration for Simulation Store
 *
 * This extends the existing simulation store with event sourcing capabilities.
 * It captures all external events and enables deterministic replay.
 */

import { create } from "zustand";
import { nanoid } from "@/lib/utils/nanoid";
import { useSimulationStore } from "./simulationStore";
import {
  eventCapture,
  scenarioManager,
  type CoreEvent,
  type SimulationScenario,
  type SimulationSnapshot,
  type CoreEventType
} from "@/lib/simulation/eventSourcing";
import { enhancedReplayEngine } from "@/lib/simulation/replayEngine";
import type { Scenario } from "@/lib/simulation/types";

// ============================================================================
// EVENT SOURCING STORE STATE
// ============================================================================

interface EventSourcingState {
  // Current scenario being recorded/replayed
  currentScenario: SimulationScenario | null;

  // Recording state
  isRecording: boolean;
  recordingSessionId: string | null;

  // Replay state
  isReplaying: boolean;
  replayProgress: {
    currentTime: number;
    totalEvents: number;
    processedEvents: number;
  } | null;

  // Available scenarios
  availableScenarios: SimulationScenario[];

  // Event sourcing actions
  startRecording: (scenarioName: string, description?: string) => void;
  stopRecording: () => void;
  saveCurrentScenario: () => void;
  loadScenario: (scenarioId: string) => Promise<void>;
  replayScenario: (scenarioId: string, targetTime?: number) => Promise<void>;
  createSnapshot: (description?: string) => void;

  // Event capture methods
  captureUserAction: (action: string, details: any) => void;
  captureManualInput: (nodeId: string, value: any) => void;
  captureSimulationControl: (action: 'play' | 'pause' | 'step' | 'reset') => void;
  captureModelUpgrade: (newModel: Scenario, reason?: string) => void;

  // Scenario management
  createNewScenario: (name: string, description?: string) => SimulationScenario;
  deleteScenario: (scenarioId: string) => void;
  exportScenario: (scenarioId: string) => string;
  importScenario: (scenarioJson: string) => SimulationScenario;
  listScenarios: () => SimulationScenario[];

  // Model comparison
  compareModels: (scenarioId: string, modelA: Scenario, modelB: Scenario) => Promise<any>;

  // Integration with existing simulation store
  _onSimulationTick: () => void;
  _onNodeInteraction: (nodeId: string, action: string, data: any) => void;
}

// ============================================================================
// ENHANCED SIMULATION STORE WITH EVENT SOURCING
// ============================================================================

export const useEventSourcingStore = create<EventSourcingState>((set, get) => ({
  // Initial state
  currentScenario: null,
  isRecording: false,
  recordingSessionId: null,
  isReplaying: false,
  replayProgress: null,
  availableScenarios: [],

  // ============================================================================
  // RECORDING CONTROL
  // ============================================================================

  startRecording: (scenarioName: string, description?: string) => {
    const simulationStore = useSimulationStore.getState();

    if (!simulationStore.scenario) {
      console.error("Cannot start recording: No scenario loaded in simulation");
      return;
    }

    // Create new scenario
    const scenario = scenarioManager.createScenario(
      scenarioName,
      simulationStore.scenario,
      description
    );

    // Start event capture
    eventCapture.startCapturing();
    const sessionId = eventCapture.newSession();

    // Capture initial simulation start event
    const startEvent = eventCapture.captureSimulationStart(simulationStore.scenario);
    if (startEvent) {
      scenarioManager.addEventToScenario(scenario.id, startEvent);
    }

    set({
      currentScenario: scenario,
      isRecording: true,
      recordingSessionId: sessionId,
      availableScenarios: [...get().availableScenarios, scenario]
    });

    console.log(`🎬 Started recording scenario: "${scenarioName}"`);
  },

  stopRecording: () => {
    eventCapture.stopCapturing();

    set({
      isRecording: false,
      recordingSessionId: null
    });

    console.log("🛑 Stopped recording");
  },

  saveCurrentScenario: () => {
    const { currentScenario } = get();
    if (currentScenario) {
      scenarioManager.saveScenario(currentScenario);
      console.log(`💾 Saved scenario: "${currentScenario.name}"`);
    }
  },

  // ============================================================================
  // SCENARIO MANAGEMENT
  // ============================================================================

  loadScenario: async (scenarioId: string) => {
    const scenario = scenarioManager.loadScenario(scenarioId);
    if (!scenario) {
      console.error(`Scenario ${scenarioId} not found`);
      return;
    }

    set({ currentScenario: scenario });

    // Load the initial model into simulation store
    const simulationStore = useSimulationStore.getState();
    await simulationStore.loadScenario(scenario.initialModel);

    console.log(`📂 Loaded scenario: "${scenario.name}"`);
  },

  replayScenario: async (scenarioId: string, targetTime?: number) => {
    const scenario = scenarioManager.loadScenario(scenarioId);
    if (!scenario) {
      console.error(`Scenario ${scenarioId} not found`);
      return;
    }

    set({
      isReplaying: true,
      replayProgress: { currentTime: 0, totalEvents: scenario.coreEvents.length, processedEvents: 0 }
    });

    try {
      const result = await enhancedReplayEngine.replayScenario(scenario, {
        targetTime,
        validateAgainstOriginal: true,
        onProgress: (progress) => {
          set({ replayProgress: progress });
        }
      });

      // Apply final state to simulation store
      const simulationStore = useSimulationStore.getState();

      // Restore complete simulation state from replay
      simulationStore.loadScenario(result.finalState.scenario).then(() => {
        // After scenario is loaded, restore the state
        useSimulationStore.setState({
          nodeStates: result.finalState.nodeStates,
          currentTime: result.finalState.currentTime,
          eventCounter: result.finalState.eventCounter,
          globalActivityLog: result.finalState.globalActivityLog,
          nodeActivityLogs: result.finalState.nodeActivityLogs,
          errorMessages: [...simulationStore.errorMessages, ...result.finalState.errorMessages]
        });
      });

      console.log("✅ Replay completed successfully");
      console.log("Performance:", result.performance);
      console.log("Validation:", result.validation);

      if (result.validation.errors.length > 0) {
        console.warn("⚠️ Replay validation errors:", result.validation.errors);
      }

    } catch (error) {
      console.error("❌ Replay failed:", error);
    } finally {
      set({
        isReplaying: false,
        replayProgress: null
      });
    }
  },

  createSnapshot: (description?: string) => {
    const { currentScenario } = get();
    if (!currentScenario) {
      console.error("Cannot create snapshot: No current scenario");
      return;
    }

    const simulationStore = useSimulationStore.getState();
    if (!simulationStore.scenario) {
      console.error("Cannot create snapshot: No simulation state");
      return;
    }

    const snapshot = scenarioManager.createSnapshot(currentScenario.id, {
      modelDefinition: simulationStore.scenario,
      nodeStates: simulationStore.nodeStates,
      simulationTime: simulationStore.currentTime,
      eventCounter: simulationStore.eventCounter,
      globalActivityLog: simulationStore.globalActivityLog,
      nodeActivityLogs: simulationStore.nodeActivityLogs
    }, description);

    console.log(`📸 Created snapshot: ${snapshot.id}`);
  },

  // ============================================================================
  // EVENT CAPTURE METHODS
  // ============================================================================

  captureUserAction: (action: string, details: any) => {
    if (!get().isRecording) return;

    const simulationStore = useSimulationStore.getState();
    const event = eventCapture.captureUserInteraction(
      action,
      details,
      simulationStore.currentTime
    );

    if (event && get().currentScenario) {
      scenarioManager.addEventToScenario(get().currentScenario!.id, event);
    }
  },

  captureManualInput: (nodeId: string, value: any) => {
    if (!get().isRecording) return;

    const simulationStore = useSimulationStore.getState();
    const event = eventCapture.captureManualInput(
      nodeId,
      value,
      simulationStore.currentTime
    );

    if (event && get().currentScenario) {
      scenarioManager.addEventToScenario(get().currentScenario!.id, event);
    }
  },

  captureSimulationControl: (action: 'play' | 'pause' | 'step' | 'reset') => {
    if (!get().isRecording) return;

    const simulationStore = useSimulationStore.getState();
    const event = eventCapture.captureSimulationControl(
      action,
      simulationStore.currentTime
    );

    if (event && get().currentScenario) {
      scenarioManager.addEventToScenario(get().currentScenario!.id, event);
    }
  },

  captureModelUpgrade: (newModel: Scenario, reason?: string) => {
    if (!get().isRecording) return;

    const simulationStore = useSimulationStore.getState();
    const event = eventCapture.captureModelUpgrade(
      newModel,
      simulationStore.currentTime,
      reason
    );

    if (event && get().currentScenario) {
      scenarioManager.addEventToScenario(get().currentScenario!.id, event);

      // Create snapshot before model upgrade
      get().createSnapshot(`Before model upgrade: ${reason || 'Unknown reason'}`);
    }
  },

  // ============================================================================
  // SCENARIO MANAGEMENT
  // ============================================================================

  createNewScenario: (name: string, description?: string) => {
    const simulationStore = useSimulationStore.getState();
    if (!simulationStore.scenario) {
      throw new Error("Cannot create scenario: No model loaded");
    }

    const scenario = scenarioManager.createScenario(name, simulationStore.scenario, description);

    set({
      availableScenarios: [...get().availableScenarios, scenario]
    });

    return scenario;
  },

  deleteScenario: (scenarioId: string) => {
    scenarioManager.deleteScenario(scenarioId);

    set({
      availableScenarios: get().availableScenarios.filter(s => s.id !== scenarioId),
      currentScenario: get().currentScenario?.id === scenarioId ? null : get().currentScenario
    });
  },

  exportScenario: (scenarioId: string) => {
    return scenarioManager.exportScenario(scenarioId);
  },

  importScenario: (scenarioJson: string) => {
    const scenario = scenarioManager.importScenario(scenarioJson);

    set({
      availableScenarios: [...get().availableScenarios, scenario]
    });

    return scenario;
  },

  listScenarios: () => {
    return scenarioManager.listScenarios();
  },

  // ============================================================================
  // MODEL COMPARISON
  // ============================================================================

  compareModels: async (scenarioId: string, modelA: Scenario, modelB: Scenario) => {
    console.log(`🔬 Comparing models for scenario: ${scenarioId}`);

    // This would replay the same events with different models
    // For now, return a mock comparison
    return {
      modelAResults: { finalTime: 100, tokenCount: 50 },
      modelBResults: { finalTime: 95, tokenCount: 55 },
      differences: [
        { timestamp: 50, field: 'tokenCount', valueA: 25, valueB: 30 }
      ]
    };
  },

  // ============================================================================
  // INTEGRATION HOOKS - Called by simulation store
  // ============================================================================

  _onSimulationTick: () => {
    if (!get().isRecording) return;

    const simulationStore = useSimulationStore.getState();
    const event = eventCapture.captureTimerTick(simulationStore.currentTime);

    if (event && get().currentScenario) {
      scenarioManager.addEventToScenario(get().currentScenario!.id, event);
    }
  },

  _onNodeInteraction: (nodeId: string, action: string, data: any) => {
    if (!get().isRecording) return;

    get().captureUserAction(`node_${action}`, {
      nodeId,
      action,
      data,
      timestamp: useSimulationStore.getState().currentTime
    });
  }
}));

// ============================================================================
// INTEGRATION HELPER - Call this to set up event sourcing hooks
// ============================================================================

let isIntegrationSetup = false;

export function setupEventSourcingIntegration() {
  // Only run once
  if (isIntegrationSetup) {
    console.log("🔗 Event sourcing integration already setup, skipping");
    return;
  }
  isIntegrationSetup = true;

  const eventSourcingStore = useEventSourcingStore.getState();
  const simulationStore = useSimulationStore.getState();

  // Hook into simulation tick and controls
  const originalTick = simulationStore.tick;
  const originalPlay = simulationStore.play;
  const originalPause = simulationStore.pause;
  const originalStepForward = simulationStore.stepForward;

  // Update all at once to avoid multiple notifications
  useSimulationStore.setState({
    tick: () => {
      originalTick();
      eventSourcingStore._onSimulationTick();
    },
    play: () => {
      eventSourcingStore.captureSimulationControl('play');
      originalPlay();
    },
    pause: () => {
      eventSourcingStore.captureSimulationControl('pause');
      originalPause();
    },
    stepForward: (timeIncrement?: number) => {
      eventSourcingStore.captureSimulationControl('step');
      originalStepForward(timeIncrement);
    }
  });

  console.log("🔗 Event sourcing integration setup complete");
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

export function useEventSourcing() {
  return {
    // Recording
    startRecording: useEventSourcingStore(state => state.startRecording),
    stopRecording: useEventSourcingStore(state => state.stopRecording),
    isRecording: useEventSourcingStore(state => state.isRecording),

    // Scenarios
    currentScenario: useEventSourcingStore(state => state.currentScenario),
    availableScenarios: useEventSourcingStore(state => state.availableScenarios),
    createNewScenario: useEventSourcingStore(state => state.createNewScenario),
    loadScenario: useEventSourcingStore(state => state.loadScenario),

    // Replay
    replayScenario: useEventSourcingStore(state => state.replayScenario),
    isReplaying: useEventSourcingStore(state => state.isReplaying),
    replayProgress: useEventSourcingStore(state => state.replayProgress),

    // Snapshots
    createSnapshot: useEventSourcingStore(state => state.createSnapshot),

    // Event capture
    captureUserAction: useEventSourcingStore(state => state.captureUserAction),
    captureManualInput: useEventSourcingStore(state => state.captureManualInput)
  };
}