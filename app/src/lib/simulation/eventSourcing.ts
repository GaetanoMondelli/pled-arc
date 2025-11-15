/**
 * Event Sourcing System for Simulation
 *
 * This implements the brilliant event sourcing architecture discussed:
 * - Core events (external inputs) vs Derived events (model calculations)
 * - Deterministic replay capability
 * - Model testing with same external events
 * - Simulation scenario storage and management
 */

import { nanoid } from "@/lib/nanoid";
import type { Scenario, AnyNodeState, HistoryEntry } from "./types";

// ============================================================================
// CORE EVENT TYPES - External events that drive the simulation
// ============================================================================

export type CoreEventType =
  | 'simulation_start'
  | 'manual_input_injection'  // User manually injects token
  | 'timer_tick'             // System timer advancement
  | 'model_upgrade'          // Model definition change during simulation
  | 'external_data_feed'     // External data source update
  | 'user_interaction'       // User clicks/drags/edits during simulation
  | 'simulation_control';    // Play/pause/step commands

export interface CoreEvent {
  id: string;
  timestamp: number;          // Simulation time when event occurred
  realTimestamp: number;      // Wall clock time when event was captured
  type: CoreEventType;
  nodeId?: string;           // Optional: which node this affects
  payload: {
    data?: any;              // Event-specific data
    value?: any;             // For input injections
    modelDefinition?: Scenario; // For model upgrades
    action?: 'play' | 'pause' | 'step' | 'reset'; // For simulation controls
    userAction?: string;     // Description of user action
    source?: string;         // Data source identifier
    [key: string]: any;      // Extensible payload
  };
  metadata: {
    eventSequence: number;   // Global event sequence number
    userId?: string;         // Who triggered this event
    sessionId: string;       // Current simulation session
    version: string;         // Event schema version
    causedBy?: string;       // Reference to triggering event ID
  };
}

// ============================================================================
// SIMULATION SCENARIO - Event sourcing container
// ============================================================================

export interface SimulationScenario {
  id: string;
  name: string;
  description?: string;

  // Event Sourcing Core
  initialModel: Scenario;                    // Starting model definition
  coreEvents: CoreEvent[];                   // External events that drive everything

  // Performance Optimization
  snapshots: SimulationSnapshot[];           // Periodic state snapshots

  // Metadata
  createdAt: number;
  updatedAt: number;
  version: string;
  tags?: string[];

  // Runtime State (not persisted)
  isReplayMode?: boolean;
  currentReplayIndex?: number;
}

export interface SimulationSnapshot {
  id: string;
  timestamp: number;                         // Simulation time
  realTimestamp: number;                     // When snapshot was taken
  coreEventIndex: number;                    // Last core event included in this snapshot

  // Complete simulation state at this point
  modelDefinition: Scenario;
  nodeStates: Record<string, AnyNodeState>;
  simulationTime: number;
  eventCounter: number;

  // Derived state (for performance)
  globalActivityLog: HistoryEntry[];
  nodeActivityLogs: Record<string, HistoryEntry[]>;

  // Metadata
  description?: string;
  snapshotType: 'manual' | 'automatic' | 'before_model_upgrade';
}

// ============================================================================
// EVENT CAPTURE SERVICE
// ============================================================================

export class EventCaptureService {
  private currentSession: string;
  private eventSequence: number = 0;
  private isCapturing: boolean = false;

  constructor() {
    this.currentSession = nanoid(12);
  }

  startCapturing(): void {
    this.isCapturing = true;
    this.eventSequence = 0;
    console.log(`🎬 Event capture started - Session: ${this.currentSession}`);
  }

  stopCapturing(): void {
    this.isCapturing = false;
    console.log(`🛑 Event capture stopped - Captured ${this.eventSequence} events`);
  }

  captureEvent(type: CoreEventType, payload: CoreEvent['payload'], metadata?: Partial<CoreEvent['metadata']>): CoreEvent | null {
    if (!this.isCapturing) return null;

    const event: CoreEvent = {
      id: nanoid(12),
      timestamp: payload.simulationTime || 0,
      realTimestamp: Date.now(),
      type,
      nodeId: payload.nodeId,
      payload,
      metadata: {
        eventSequence: this.eventSequence++,
        sessionId: this.currentSession,
        version: '1.0',
        ...metadata
      }
    };

    console.log(`📝 Captured event: ${type} (seq: ${event.metadata.eventSequence})`);
    return event;
  }

  // Specific event capture methods for common scenarios
  captureSimulationStart(initialModel: Scenario): CoreEvent | null {
    return this.captureEvent('simulation_start', {
      modelDefinition: initialModel,
      simulationTime: 0
    });
  }

  captureManualInput(nodeId: string, value: any, simulationTime: number): CoreEvent | null {
    return this.captureEvent('manual_input_injection', {
      nodeId,
      value,
      simulationTime,
      data: { injectionType: 'manual', targetNode: nodeId }
    });
  }

  captureTimerTick(simulationTime: number): CoreEvent | null {
    return this.captureEvent('timer_tick', {
      simulationTime,
      data: { tickType: 'automatic' }
    });
  }

  captureModelUpgrade(newModel: Scenario, simulationTime: number, reason?: string): CoreEvent | null {
    return this.captureEvent('model_upgrade', {
      modelDefinition: newModel,
      simulationTime,
      data: { reason, upgradeType: 'runtime' }
    });
  }

  captureUserInteraction(action: string, details: any, simulationTime: number): CoreEvent | null {
    return this.captureEvent('user_interaction', {
      userAction: action,
      simulationTime,
      data: details
    });
  }

  captureSimulationControl(action: 'play' | 'pause' | 'step' | 'reset', simulationTime: number): CoreEvent | null {
    return this.captureEvent('simulation_control', {
      action,
      simulationTime
    });
  }

  newSession(): string {
    this.currentSession = nanoid(12);
    this.eventSequence = 0;
    return this.currentSession;
  }
}

// ============================================================================
// SCENARIO MANAGER - Save/load simulation scenarios
// ============================================================================

export class SimulationScenarioManager {
  private scenarios: Map<string, SimulationScenario> = new Map();

  createScenario(name: string, initialModel: Scenario, description?: string): SimulationScenario {
    const scenario: SimulationScenario = {
      id: nanoid(12),
      name,
      description,
      initialModel,
      coreEvents: [],
      snapshots: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0',
      tags: []
    };

    this.scenarios.set(scenario.id, scenario);
    console.log(`📦 Created scenario: "${name}" (${scenario.id})`);
    return scenario;
  }

  addEventToScenario(scenarioId: string, event: CoreEvent): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      console.error(`Scenario ${scenarioId} not found`);
      return;
    }

    scenario.coreEvents.push(event);
    scenario.updatedAt = Date.now();
    console.log(`➕ Added event to scenario "${scenario.name}": ${event.type}`);
  }

  createSnapshot(scenarioId: string, state: {
    modelDefinition: Scenario;
    nodeStates: Record<string, AnyNodeState>;
    simulationTime: number;
    eventCounter: number;
    globalActivityLog: HistoryEntry[];
    nodeActivityLogs: Record<string, HistoryEntry[]>;
  }, description?: string): SimulationSnapshot {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const snapshot: SimulationSnapshot = {
      id: nanoid(12),
      timestamp: state.simulationTime,
      realTimestamp: Date.now(),
      coreEventIndex: scenario.coreEvents.length - 1,
      modelDefinition: JSON.parse(JSON.stringify(state.modelDefinition)),
      nodeStates: JSON.parse(JSON.stringify(state.nodeStates)),
      simulationTime: state.simulationTime,
      eventCounter: state.eventCounter,
      globalActivityLog: [...state.globalActivityLog],
      nodeActivityLogs: { ...state.nodeActivityLogs },
      description,
      snapshotType: 'manual'
    };

    scenario.snapshots.push(snapshot);
    scenario.updatedAt = Date.now();

    console.log(`📸 Created snapshot for "${scenario.name}" at t=${state.simulationTime}`);
    return snapshot;
  }

  saveScenario(scenario: SimulationScenario): void {
    // In a real implementation, this would persist to storage
    // For now, we keep it in memory
    scenario.updatedAt = Date.now();
    console.log(`💾 Saved scenario: "${scenario.name}" (${scenario.coreEvents.length} events, ${scenario.snapshots.length} snapshots)`);
  }

  loadScenario(scenarioId: string): SimulationScenario | null {
    const scenario = this.scenarios.get(scenarioId);
    if (scenario) {
      console.log(`📂 Loaded scenario: "${scenario.name}"`);
    }
    return scenario || null;
  }

  listScenarios(): SimulationScenario[] {
    return Array.from(this.scenarios.values());
  }

  deleteScenario(scenarioId: string): boolean {
    const deleted = this.scenarios.delete(scenarioId);
    if (deleted) {
      console.log(`🗑️ Deleted scenario: ${scenarioId}`);
    }
    return deleted;
  }

  exportScenario(scenarioId: string): string {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    return JSON.stringify(scenario, null, 2);
  }

  importScenario(scenarioJson: string): SimulationScenario {
    const scenario = JSON.parse(scenarioJson) as SimulationScenario;
    scenario.id = nanoid(12); // Generate new ID to avoid conflicts
    scenario.updatedAt = Date.now();

    this.scenarios.set(scenario.id, scenario);
    console.log(`📥 Imported scenario: "${scenario.name}"`);
    return scenario;
  }
}

// ============================================================================
// DETERMINISTIC REPLAY ENGINE
// ============================================================================

export class ReplayEngine {
  async replayScenario(
    scenario: SimulationScenario,
    targetTime?: number,
    onProgress?: (progress: { currentTime: number; totalEvents: number; processedEvents: number }) => void
  ): Promise<{
    finalState: any;
    derivedEvents: HistoryEntry[];
    replayLog: string[];
  }> {
    console.log(`🔄 Starting replay of "${scenario.name}"`);

    const replayLog: string[] = [];
    let currentState = this.initializeState(scenario.initialModel);
    let currentTime = 0;
    let derivedEvents: HistoryEntry[] = [];

    // Find best snapshot to start from
    const startSnapshot = this.findBestSnapshot(scenario, targetTime || Infinity);
    if (startSnapshot) {
      currentState = this.restoreFromSnapshot(startSnapshot);
      currentTime = startSnapshot.timestamp;
      derivedEvents = [...startSnapshot.globalActivityLog];
      replayLog.push(`📸 Starting from snapshot at t=${currentTime}`);
    }

    // Replay events from snapshot point
    const eventsToReplay = scenario.coreEvents.filter(e => e.timestamp >= currentTime);

    for (let i = 0; i < eventsToReplay.length; i++) {
      const event = eventsToReplay[i];

      if (targetTime && event.timestamp > targetTime) {
        break;
      }

      const result = await this.processEvent(event, currentState);
      currentState = result.newState;
      derivedEvents.push(...result.derivedEvents);

      replayLog.push(`⚡ Processed ${event.type} at t=${event.timestamp}`);

      if (onProgress) {
        onProgress({
          currentTime: event.timestamp,
          totalEvents: eventsToReplay.length,
          processedEvents: i + 1
        });
      }
    }

    console.log(`✅ Replay complete. Final time: ${currentTime}`);

    return {
      finalState: currentState,
      derivedEvents,
      replayLog
    };
  }

  private initializeState(model: Scenario): any {
    // Initialize state from model definition
    // This would match the logic in simulationStore.loadScenario
    return {
      scenario: model,
      nodeStates: {},
      currentTime: 0,
      eventCounter: 0
    };
  }

  private findBestSnapshot(scenario: SimulationScenario, targetTime: number): SimulationSnapshot | null {
    // Find the latest snapshot that's before our target time
    const eligibleSnapshots = scenario.snapshots
      .filter(s => s.timestamp <= targetTime)
      .sort((a, b) => b.timestamp - a.timestamp);

    return eligibleSnapshots[0] || null;
  }

  private restoreFromSnapshot(snapshot: SimulationSnapshot): any {
    return {
      scenario: snapshot.modelDefinition,
      nodeStates: snapshot.nodeStates,
      currentTime: snapshot.simulationTime,
      eventCounter: snapshot.eventCounter
    };
  }

  private async processEvent(event: CoreEvent, currentState: any): Promise<{
    newState: any;
    derivedEvents: HistoryEntry[];
  }> {
    // This would integrate with the existing simulation engine
    // For now, we'll return a mock implementation
    const derivedEvents: HistoryEntry[] = [];

    switch (event.type) {
      case 'timer_tick':
        // Process timer tick - this would call the existing tick() logic
        derivedEvents.push({
          timestamp: event.timestamp,
          epochTimestamp: event.realTimestamp,
          sequence: currentState.eventCounter++,
          nodeId: 'system',
          action: 'timer_tick',
          value: event.timestamp,
          details: 'System timer advancement',
          state: 'processing',
          bufferSize: 0,
          outputBufferSize: 0
        });
        break;

      case 'manual_input_injection':
        // Process manual input
        if (event.nodeId && event.payload.value !== undefined) {
          derivedEvents.push({
            timestamp: event.timestamp,
            epochTimestamp: event.realTimestamp,
            sequence: currentState.eventCounter++,
            nodeId: event.nodeId,
            action: 'token_injected',
            value: event.payload.value,
            details: `Manual injection: ${event.payload.value}`,
            state: 'receiving',
            bufferSize: 0,
            outputBufferSize: 0
          });
        }
        break;

      case 'model_upgrade':
        // Process model upgrade
        if (event.payload.modelDefinition) {
          currentState.scenario = event.payload.modelDefinition;
          derivedEvents.push({
            timestamp: event.timestamp,
            epochTimestamp: event.realTimestamp,
            sequence: currentState.eventCounter++,
            nodeId: 'system',
            action: 'model_upgraded',
            value: 0,
            details: 'Model definition upgraded during simulation',
            state: 'upgrading',
            bufferSize: 0,
            outputBufferSize: 0
          });
        }
        break;
    }

    return {
      newState: { ...currentState, currentTime: event.timestamp },
      derivedEvents
    };
  }
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

export const eventCapture = new EventCaptureService();
export const scenarioManager = new SimulationScenarioManager();
export const replayEngine = new ReplayEngine();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function compareScenarioResults(
  scenarioId: string,
  modelA: Scenario,
  modelB: Scenario
): Promise<{
  resultsA: any;
  resultsB: any;
  differences: Array<{
    timestamp: number;
    field: string;
    valueA: any;
    valueB: any;
  }>;
}> {
  // This would replay the same core events with different models
  // and compare the results for A/B testing
  return Promise.resolve({
    resultsA: {},
    resultsB: {},
    differences: []
  });
}

export function validateEventSequence(events: CoreEvent[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check chronological order
  for (let i = 1; i < events.length; i++) {
    if (events[i].timestamp < events[i-1].timestamp) {
      errors.push(`Event ${i} is out of chronological order`);
    }
  }

  // Check for required simulation_start event
  if (events.length > 0 && events[0].type !== 'simulation_start') {
    errors.push('First event must be simulation_start');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}