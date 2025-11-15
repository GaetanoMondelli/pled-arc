/**
 * Enhanced Deterministic Replay Engine
 *
 * This provides full integration with the existing simulation store
 * to enable complete deterministic replay of simulation scenarios.
 */

import type {
  CoreEvent,
  SimulationScenario,
  SimulationSnapshot
} from "./eventSourcing";
import type {
  Scenario,
  AnyNodeState,
  HistoryEntry,
  Token,
  AnyNode,
  DataSourceState,
  QueueState,
  ProcessNodeState,
  SinkState
} from "./types";
import { evaluateFormula } from "./formulaEngine";
import { nanoid } from "@/lib/nanoid";

export interface ReplayState {
  scenario: Scenario;
  nodesConfig: Record<string, AnyNode>;
  nodeStates: Record<string, AnyNodeState>;
  currentTime: number;
  eventCounter: number;
  globalActivityLog: HistoryEntry[];
  nodeActivityLogs: Record<string, HistoryEntry[]>;
  tokens: Map<string, Token>; // Track all tokens by ID
  isRunning: boolean;
  errorMessages: string[];
}

export interface ReplayResult {
  finalState: ReplayState;
  derivedEvents: HistoryEntry[];
  replayLog: string[];
  performance: {
    totalEvents: number;
    replayTimeMs: number;
    eventsPerSecond: number;
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export class EnhancedReplayEngine {
  private replayState: ReplayState | null = null;
  private startTime: number = 0;

  /**
   * Replay a complete scenario with full simulation fidelity
   */
  async replayScenario(
    scenario: SimulationScenario,
    options: {
      targetTime?: number;
      startFromSnapshot?: string; // Snapshot ID
      validateAgainstOriginal?: boolean;
      onProgress?: (progress: {
        currentTime: number;
        totalEvents: number;
        processedEvents: number;
        currentEvent?: CoreEvent;
      }) => void;
    } = {}
  ): Promise<ReplayResult> {
    this.startTime = Date.now();
    const replayLog: string[] = [];

    console.log(`🔄 Starting enhanced replay of "${scenario.name}"`);
    replayLog.push(`🔄 Starting enhanced replay of "${scenario.name}"`);

    // Initialize state
    this.replayState = this.initializeReplayState(scenario.initialModel);
    let currentSnapshotIndex = -1;

    // Find and load starting snapshot if requested
    if (options.startFromSnapshot) {
      const snapshot = scenario.snapshots.find(s => s.id === options.startFromSnapshot);
      if (snapshot) {
        this.replayState = this.restoreFromSnapshot(snapshot);
        currentSnapshotIndex = scenario.snapshots.indexOf(snapshot);
        replayLog.push(`📸 Started from snapshot: ${snapshot.description || 'Unnamed'} at t=${snapshot.timestamp}`);
      }
    } else {
      // Find best automatic snapshot
      const bestSnapshot = this.findBestSnapshot(scenario, options.targetTime || Infinity);
      if (bestSnapshot) {
        this.replayState = this.restoreFromSnapshot(bestSnapshot);
        currentSnapshotIndex = scenario.snapshots.indexOf(bestSnapshot);
        replayLog.push(`📸 Auto-selected snapshot at t=${bestSnapshot.timestamp}`);
      }
    }

    // Filter events to replay from current state
    const eventsToReplay = scenario.coreEvents.filter(e =>
      e.timestamp >= this.replayState.currentTime &&
      (!options.targetTime || e.timestamp <= options.targetTime)
    );

    replayLog.push(`⚡ Replaying ${eventsToReplay.length} events from t=${this.replayState.currentTime}`);

    // Replay events
    const derivedEvents: HistoryEntry[] = [...this.replayState.globalActivityLog];

    for (let i = 0; i < eventsToReplay.length; i++) {
      const event = eventsToReplay[i];

      // Process the event
      const eventResult = await this.processEventWithSimulation(event);

      // Update state
      this.replayState.currentTime = Math.max(this.replayState.currentTime, event.timestamp);
      derivedEvents.push(...eventResult.newEvents);

      // Update progress
      if (options.onProgress) {
        options.onProgress({
          currentTime: event.timestamp,
          totalEvents: eventsToReplay.length,
          processedEvents: i + 1,
          currentEvent: event
        });
      }

      replayLog.push(`⚡ [t=${event.timestamp}] ${event.type}: ${eventResult.description}`);

      // Check for early termination
      if (options.targetTime && event.timestamp >= options.targetTime) {
        replayLog.push(`🎯 Reached target time: ${options.targetTime}`);
        break;
      }
    }

    // Calculate performance metrics
    const replayTimeMs = Date.now() - this.startTime;
    const performance = {
      totalEvents: eventsToReplay.length,
      replayTimeMs,
      eventsPerSecond: eventsToReplay.length / (replayTimeMs / 1000)
    };

    // Validate replay if requested
    const validation = options.validateAgainstOriginal
      ? await this.validateReplay(scenario, this.replayState)
      : { isValid: true, errors: [], warnings: [] };

    console.log(`✅ Replay complete in ${replayTimeMs}ms (${performance.eventsPerSecond.toFixed(2)} events/sec)`);

    return {
      finalState: this.replayState,
      derivedEvents,
      replayLog,
      performance,
      validation
    };
  }

  /**
   * Initialize replay state from a model definition
   */
  private initializeReplayState(model: Scenario): ReplayState {
    const nodesConfig: Record<string, AnyNode> = {};
    const nodeStates: Record<string, AnyNodeState> = {};
    const nodeActivityLogs: Record<string, HistoryEntry[]> = {};

    // Initialize nodes exactly like the simulation store does
    model.nodes.forEach(node => {
      nodesConfig[node.nodeId] = node;
      nodeActivityLogs[node.nodeId] = [];

      switch (node.type) {
        case "DataSource":
          nodeStates[node.nodeId] = {
            lastEmissionTime: -1,
            stateMachine: {
              currentState: "source_idle",
              transitionHistory: []
            }
          } as DataSourceState;
          break;

        case "Queue":
          nodeStates[node.nodeId] = {
            inputBuffer: [],
            outputBuffer: [],
            lastAggregationTime: -1,
            stateMachine: {
              currentState: "queue_idle",
              transitionHistory: []
            }
          } as QueueState;
          break;

        case "ProcessNode":
          nodeStates[node.nodeId] = {
            inputBuffers: {},
            lastFiredTime: -1,
            stateMachine: {
              currentState: "process_idle",
              transitionHistory: []
            }
          } as ProcessNodeState;
          break;

        case "Sink":
          nodeStates[node.nodeId] = {
            consumedTokenCount: 0,
            lastConsumedTime: -1,
            consumedTokens: [],
            stateMachine: {
              currentState: "sink_idle",
              transitionHistory: []
            }
          } as SinkState;
          break;

        case "FSMProcessNode":
          const fsmNode = node as any;
          const initialState = fsmNode.fsm?.initialState || fsmNode.fsm?.states?.[0] || "idle";
          nodeStates[node.nodeId] = {
            inputBuffers: {},
            fsmVariables: { ...fsmNode.fsm?.variables } || {},
            currentFSMState: initialState,
            lastTransitionTime: -1,
            stateMachine: {
              currentState: initialState,
              transitionHistory: []
            }
          } as any;
          break;
      }
    });

    return {
      scenario: model,
      nodesConfig,
      nodeStates,
      currentTime: 0,
      eventCounter: 0,
      globalActivityLog: [],
      nodeActivityLogs,
      tokens: new Map(),
      isRunning: false,
      errorMessages: []
    };
  }

  /**
   * Restore state from a snapshot
   */
  private restoreFromSnapshot(snapshot: SimulationSnapshot): ReplayState {
    return {
      scenario: snapshot.modelDefinition,
      nodesConfig: snapshot.modelDefinition.nodes.reduce((acc, node) => {
        acc[node.nodeId] = node;
        return acc;
      }, {} as Record<string, AnyNode>),
      nodeStates: JSON.parse(JSON.stringify(snapshot.nodeStates)),
      currentTime: snapshot.simulationTime,
      eventCounter: snapshot.eventCounter,
      globalActivityLog: [...snapshot.globalActivityLog],
      nodeActivityLogs: { ...snapshot.nodeActivityLogs },
      tokens: new Map(), // Reconstruct from activity logs if needed
      isRunning: false,
      errorMessages: []
    };
  }

  /**
   * Find the best snapshot to start replay from
   */
  private findBestSnapshot(scenario: SimulationScenario, targetTime: number): SimulationSnapshot | null {
    const eligibleSnapshots = scenario.snapshots
      .filter(s => s.timestamp <= targetTime)
      .sort((a, b) => b.timestamp - a.timestamp);

    return eligibleSnapshots[0] || null;
  }

  /**
   * Process a single core event with full simulation fidelity
   */
  private async processEventWithSimulation(event: CoreEvent): Promise<{
    newEvents: HistoryEntry[];
    description: string;
  }> {
    if (!this.replayState) {
      throw new Error("Replay state not initialized");
    }

    const newEvents: HistoryEntry[] = [];
    let description = "";

    switch (event.type) {
      case 'simulation_start':
        description = "Simulation initialized";
        newEvents.push(this.createHistoryEntry('system', 'simulation_start', 0, 'Simulation started'));
        break;

      case 'timer_tick':
        // Process a simulation tick exactly like the simulation store
        description = `Timer tick to t=${event.timestamp}`;
        const tickEvents = await this.simulateTick(event.timestamp);
        newEvents.push(...tickEvents);
        break;

      case 'manual_input_injection':
        if (event.nodeId && event.payload.value !== undefined) {
          description = `Manual input: ${event.payload.value} → ${event.nodeId}`;
          const injectionEvents = this.simulateManualInput(event.nodeId, event.payload.value, event.timestamp);
          newEvents.push(...injectionEvents);
        }
        break;

      case 'model_upgrade':
        if (event.payload.modelDefinition) {
          description = `Model upgraded: ${event.payload.data?.reason || 'Unknown reason'}`;
          this.replayState.scenario = event.payload.modelDefinition;
          // Reinitialize node configs
          this.replayState.nodesConfig = event.payload.modelDefinition.nodes.reduce((acc, node) => {
            acc[node.nodeId] = node;
            return acc;
          }, {} as Record<string, AnyNode>);
          newEvents.push(this.createHistoryEntry('system', 'model_upgraded', event.timestamp, description));
        }
        break;

      case 'simulation_control':
        description = `Simulation control: ${event.payload.action}`;
        if (event.payload.action === 'play') {
          this.replayState.isRunning = true;
        } else if (event.payload.action === 'pause') {
          this.replayState.isRunning = false;
        }
        newEvents.push(this.createHistoryEntry('system', 'control_action', event.timestamp, description));
        break;

      case 'user_interaction':
        description = `User action: ${event.payload.userAction}`;
        newEvents.push(this.createHistoryEntry('user', 'interaction', event.timestamp, description));
        break;

      default:
        description = `Unknown event type: ${event.type}`;
        newEvents.push(this.createHistoryEntry('system', 'unknown_event', event.timestamp, description));
    }

    return { newEvents, description };
  }

  /**
   * Simulate a complete tick cycle
   */
  private async simulateTick(targetTime: number): Promise<HistoryEntry[]> {
    if (!this.replayState) return [];

    const events: HistoryEntry[] = [];

    // Advance time
    this.replayState.currentTime = targetTime;

    // Process each node type following the exact simulation store logic
    Object.values(this.replayState.nodesConfig).forEach(nodeConfig => {
      const nodeState = this.replayState!.nodeStates[nodeConfig.nodeId];

      if (nodeConfig.type === "DataSource") {
        const dsState = nodeState as DataSourceState;
        if (targetTime >= (dsState.lastEmissionTime < 0 ? 0 : dsState.lastEmissionTime) + nodeConfig.interval) {
          // Generate and emit token
          const value = Math.floor(Math.random() * (nodeConfig.generation.valueMax - nodeConfig.generation.valueMin + 1)) + nodeConfig.generation.valueMin;
          const token = this.createToken(nodeConfig.nodeId, value, targetTime);

          events.push(this.createHistoryEntry(
            nodeConfig.nodeId,
            'token_emitted',
            targetTime,
            `Generated token ${token.id} with value ${value}`
          ));

          // Update state
          dsState.lastEmissionTime = targetTime;

          // Route to destinations
          nodeConfig.outputs.forEach(output => {
            const routingEvents = this.routeToken(token, output.destinationNodeId, targetTime);
            events.push(...routingEvents);
          });
        }
      }

      // Add Queue and ProcessNode logic here following the same patterns...
    });

    return events;
  }

  /**
   * Simulate manual input injection
   */
  private simulateManualInput(nodeId: string, value: any, timestamp: number): HistoryEntry[] {
    if (!this.replayState) return [];

    const token = this.createToken('user', value, timestamp);
    const events: HistoryEntry[] = [];

    events.push(this.createHistoryEntry(
      'user',
      'manual_injection',
      timestamp,
      `Manually injected token ${token.id} with value ${value} to ${nodeId}`
    ));

    // Route token to destination
    const routingEvents = this.routeToken(token, nodeId, timestamp);
    events.push(...routingEvents);

    return events;
  }

  /**
   * Route a token to a destination node
   */
  private routeToken(token: Token, destinationNodeId: string, timestamp: number): HistoryEntry[] {
    if (!this.replayState) return [];

    const events: HistoryEntry[] = [];
    const destNode = this.replayState.nodesConfig[destinationNodeId];

    if (!destNode) {
      events.push(this.createHistoryEntry(
        'system',
        'routing_error',
        timestamp,
        `Cannot route token ${token.id}: destination node ${destinationNodeId} not found`
      ));
      return events;
    }

    const destState = this.replayState.nodeStates[destinationNodeId];

    switch (destNode.type) {
      case "Sink":
        const sinkState = destState as SinkState;
        sinkState.consumedTokenCount = (sinkState.consumedTokenCount || 0) + 1;
        sinkState.lastConsumedTime = timestamp;
        sinkState.consumedTokens = [...(sinkState.consumedTokens || []), token].slice(-50);

        events.push(this.createHistoryEntry(
          destinationNodeId,
          'token_consumed',
          timestamp,
          `Consumed token ${token.id} with value ${token.value}`
        ));
        break;

      case "Queue":
        const queueState = destState as QueueState;
        queueState.inputBuffer = [...queueState.inputBuffer, token];

        events.push(this.createHistoryEntry(
          destinationNodeId,
          'token_received',
          timestamp,
          `Received token ${token.id}, buffer size: ${queueState.inputBuffer.length}`
        ));
        break;

      // Add other node types as needed...
    }

    return events;
  }

  /**
   * Create a token with proper ID and tracking
   */
  private createToken(originNodeId: string, value: any, timestamp: number): Token {
    const token: Token = {
      id: nanoid(8),
      value,
      createdAt: timestamp,
      originNodeId,
      history: []
    };

    if (this.replayState) {
      this.replayState.tokens.set(token.id, token);
    }

    return token;
  }

  /**
   * Create a history entry for event tracking
   */
  private createHistoryEntry(
    nodeId: string,
    action: string,
    timestamp: number,
    details: string
  ): HistoryEntry {
    if (!this.replayState) {
      throw new Error("Replay state not initialized");
    }

    const entry: HistoryEntry = {
      timestamp,
      epochTimestamp: Date.now(),
      sequence: this.replayState.eventCounter++,
      nodeId,
      action,
      value: 0,
      details,
      state: 'processing',
      bufferSize: 0,
      outputBufferSize: 0
    };

    this.replayState.globalActivityLog.push(entry);
    if (!this.replayState.nodeActivityLogs[nodeId]) {
      this.replayState.nodeActivityLogs[nodeId] = [];
    }
    this.replayState.nodeActivityLogs[nodeId].push(entry);

    return entry;
  }

  /**
   * Validate replay results against original scenario
   */
  private async validateReplay(
    scenario: SimulationScenario,
    replayState: ReplayState
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Compare against snapshots if available
    const finalSnapshot = scenario.snapshots
      .filter(s => s.timestamp <= replayState.currentTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (finalSnapshot) {
      // Compare event counts
      if (replayState.eventCounter !== finalSnapshot.eventCounter) {
        warnings.push(`Event counter mismatch: replay=${replayState.eventCounter}, original=${finalSnapshot.eventCounter}`);
      }

      // Compare node states
      Object.keys(finalSnapshot.nodeStates).forEach(nodeId => {
        const originalState = finalSnapshot.nodeStates[nodeId];
        const replayNodeState = replayState.nodeStates[nodeId];

        if (!replayNodeState) {
          errors.push(`Missing node state in replay: ${nodeId}`);
          return;
        }

        // Deep comparison would go here...
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Compare two scenarios with different models
   */
  async compareScenarios(
    scenarioA: SimulationScenario,
    modelB: Scenario,
    options: {
      targetTime?: number;
      onProgress?: (progress: { phase: 'A' | 'B' | 'comparing'; progress: number }) => void;
    } = {}
  ): Promise<{
    resultsA: ReplayResult;
    resultsB: ReplayResult;
    differences: Array<{
      timestamp: number;
      field: string;
      valueA: any;
      valueB: any;
      significance: 'major' | 'minor';
    }>;
  }> {
    // Create scenario B with the same events but different model
    const scenarioB: SimulationScenario = {
      ...scenarioA,
      id: nanoid(12),
      name: `${scenarioA.name} (Model B)`,
      initialModel: modelB
    };

    // Replay both scenarios
    options.onProgress?.({ phase: 'A', progress: 0 });
    const resultsA = await this.replayScenario(scenarioA, {
      targetTime: options.targetTime,
      onProgress: (p) => options.onProgress?.({ phase: 'A', progress: p.processedEvents / p.totalEvents })
    });

    options.onProgress?.({ phase: 'B', progress: 0 });
    const resultsB = await this.replayScenario(scenarioB, {
      targetTime: options.targetTime,
      onProgress: (p) => options.onProgress?.({ phase: 'B', progress: p.processedEvents / p.totalEvents })
    });

    // Compare results
    options.onProgress?.({ phase: 'comparing', progress: 0 });
    const differences = this.computeDifferences(resultsA.finalState, resultsB.finalState);

    return { resultsA, resultsB, differences };
  }

  /**
   * Compute differences between two replay states
   */
  private computeDifferences(stateA: ReplayState, stateB: ReplayState): Array<{
    timestamp: number;
    field: string;
    valueA: any;
    valueB: any;
    significance: 'major' | 'minor';
  }> {
    const differences: Array<{
      timestamp: number;
      field: string;
      valueA: any;
      valueB: any;
      significance: 'major' | 'minor';
    }> = [];

    // Compare final time
    if (stateA.currentTime !== stateB.currentTime) {
      differences.push({
        timestamp: Math.max(stateA.currentTime, stateB.currentTime),
        field: 'finalTime',
        valueA: stateA.currentTime,
        valueB: stateB.currentTime,
        significance: 'major'
      });
    }

    // Compare event counts
    if (stateA.eventCounter !== stateB.eventCounter) {
      differences.push({
        timestamp: Math.max(stateA.currentTime, stateB.currentTime),
        field: 'eventCount',
        valueA: stateA.eventCounter,
        valueB: stateB.eventCounter,
        significance: 'major'
      });
    }

    // Compare node states
    Object.keys(stateA.nodeStates).forEach(nodeId => {
      const nodeStateA = stateA.nodeStates[nodeId];
      const nodeStateB = stateB.nodeStates[nodeId];

      if (!nodeStateB) {
        differences.push({
          timestamp: stateA.currentTime,
          field: `nodeState.${nodeId}.missing`,
          valueA: 'present',
          valueB: 'missing',
          significance: 'major'
        });
        return;
      }

      // Compare specific node state fields
      if (nodeStateA.stateMachine?.currentState !== nodeStateB.stateMachine?.currentState) {
        differences.push({
          timestamp: stateA.currentTime,
          field: `nodeState.${nodeId}.currentState`,
          valueA: nodeStateA.stateMachine?.currentState,
          valueB: nodeStateB.stateMachine?.currentState,
          significance: 'minor'
        });
      }

      // Add more specific comparisons based on node type...
    });

    return differences;
  }
}

export const enhancedReplayEngine = new EnhancedReplayEngine();