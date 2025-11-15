/**
 * Replay Engine - Deterministic Time-Travel Debugging
 * 
 * This engine enables deterministic replay of event sequences with
 * time-travel debugging capabilities. Core features:
 * 
 * 1. **Deterministic Replay** - Same events + same scenario = same outputs
 * 2. **Time-Travel** - Step forward/backward through event timeline
 * 3. **State Snapshots** - Capture system state at any point
 * 4. **Seek Operations** - Jump to specific events or timestamps
 * 5. **Audit Trail** - Full visibility into what happened and why
 * 
 * @module replayEngine
 */

import { create } from 'zustand';
import { StoredEvent, useEventStore } from './eventStore';
import { EventQueue } from './eventQueue';
import { useEventQueue } from './eventQueue';
import { useActivityLogger } from './activityLogger';

// ============================================================================
// STATE SNAPSHOT
// ============================================================================

/**
 * Snapshot of the entire system state at a specific point in time
 */
export interface StateSnapshot {
  /** Timestamp of this snapshot */
  timestamp: number;
  
  /** Event that triggered this snapshot */
  eventId: string;
  
  /** Index in event sequence */
  eventIndex: number;
  
  /** Node states at this point */
  nodeStates: Map<string, NodeState>;
  
  /** Pending events in queue */
  pendingEvents: StoredEvent[];
  
  /** Metadata for debugging */
  metadata?: {
    /** Memory usage estimate */
    memoryUsage?: number;
    
    /** Number of active nodes */
    activeNodeCount?: number;
    
    /** Custom debug info */
    debugInfo?: any;
  };
}

/**
 * State of a single node
 */
export interface NodeState {
  /** Node ID */
  nodeId: string;
  
  /** Node type */
  nodeType: string;
  
  /** Current state (for FSMs, queues, etc.) */
  state: any;
  
  /** Internal variables/counters */
  variables?: Record<string, any>;
  
  /** Data in buffers/queues */
  buffer?: any[];
  
  /** Activity log for this node */
  activityLog?: ActivityLogEntry[];
}

/**
 * Activity log entry for a node
 */
export interface ActivityLogEntry {
  timestamp: number;
  eventType: string;
  message: string;
  data?: any;
}

// ============================================================================
// REPLAY CONFIGURATION
// ============================================================================

/**
 * Configuration for replay engine
 */
export interface ReplayConfig {
  /** Scenario/diagram to use for replay */
  scenario: {
    nodes: any[];
    edges: any[];
  };
  
  /** Events to replay */
  events: StoredEvent[];
  
  /** Should capture snapshots at every event? */
  captureAllSnapshots?: boolean;
  
  /** Capture snapshot every N events */
  snapshotInterval?: number;
  
  /** Maximum number of snapshots to keep in memory */
  maxSnapshots?: number;
  
  /** Custom node processors */
  nodeProcessors?: Map<string, any>;
}

/**
 * Replay result/report
 */
export interface ReplayResult {
  /** Was replay successful? */
  success: boolean;
  
  /** Final state snapshot */
  finalState: StateSnapshot;
  
  /** All captured snapshots */
  snapshots: StateSnapshot[];
  
  /** Statistics */
  stats: {
    totalEvents: number;
    eventsProcessed: number;
    duration: number;
    errors: number;
  };
  
  /** Errors encountered */
  errors?: Array<{
    eventId: string;
    error: Error;
    timestamp: number;
  }>;
}

// ============================================================================
// REPLAY ENGINE STORE
// ============================================================================

interface ReplayEngineState {
  /** Current replay configuration */
  config: ReplayConfig | null;
  
  /** Is replay currently running? */
  isReplaying: boolean;
  
  /** Current event index being replayed */
  currentEventIndex: number;
  
  /** Current system state */
  currentState: StateSnapshot | null;
  
  /** All captured snapshots */
  snapshots: StateSnapshot[];
  
  /** Snapshot index (for navigation) */
  snapshotIndex: Map<number, StateSnapshot>; // eventIndex -> snapshot
  
  /** Errors encountered during replay */
  errors: Array<{
    eventId: string;
    error: Error;
    timestamp: number;
  }>;
  
  // ============================================================================
  // REPLAY CONTROL
  // ============================================================================
  
  /**
   * Start a new replay session
   */
  startReplay: (config: ReplayConfig) => Promise<void>;
  
  /**
   * Stop current replay
   */
  stopReplay: () => void;
  
  /**
   * Replay all events to completion
   */
  replayAll: () => Promise<ReplayResult>;
  
  /**
   * Process the next event
   */
  stepForward: () => Promise<StateSnapshot | null>;
  
  /**
   * Go back to previous event state
   */
  stepBackward: () => Promise<StateSnapshot | null>;
  
  /**
   * Seek to specific event
   */
  seekToEvent: (eventId: string) => Promise<StateSnapshot | null>;
  
  /**
   * Seek to specific event index
   */
  seekToIndex: (index: number) => Promise<StateSnapshot | null>;
  
  /**
   * Seek to specific timestamp
   */
  seekToTimestamp: (timestamp: number) => Promise<StateSnapshot | null>;
  
  // ============================================================================
  // STATE QUERIES
  // ============================================================================
  
  /**
   * Get current state snapshot
   */
  getCurrentState: () => StateSnapshot | null;
  
  /**
   * Get state at specific event index
   */
  getStateAtIndex: (index: number) => StateSnapshot | null;
  
  /**
   * Get all snapshots
   */
  getAllSnapshots: () => StateSnapshot[];
  
  /**
   * Get node state at current point
   */
  getNodeState: (nodeId: string) => NodeState | null;
  
  /**
   * Get replay progress (0-1)
   */
  getProgress: () => number;
  
  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================
  
  /**
   * Process a single event
   */
  _processEvent: (event: StoredEvent) => Promise<void>;
  
  /**
   * Capture current state snapshot
   */
  _captureSnapshot: (eventId: string, eventIndex: number) => StateSnapshot;
  
  /**
   * Initialize node states from scenario
   */
  _initializeNodeStates: () => void;
  
  /**
   * Reset replay engine
   */
  _reset: () => void;
}

export const useReplayEngine = create<ReplayEngineState>((set, get) => ({
  // Initial state
  config: null,
  isReplaying: false,
  currentEventIndex: -1,
  currentState: null,
  snapshots: [],
  snapshotIndex: new Map(),
  errors: [],
  
  // ============================================================================
  // REPLAY CONTROL
  // ============================================================================
  
  startReplay: async (config) => {
    // Reset state
    get()._reset();
    
    // Set config
    // Normalize scenario nodes to ensure consistent nodeId field
    if (config.scenario && Array.isArray(config.scenario.nodes)) {
      config.scenario.nodes = config.scenario.nodes.map((n: any) => ({
        ...n,
        nodeId: n.nodeId || n.id || n.name,
      }));
    }

    set({ config, isReplaying: true });

    // Set time strategy based on config (optional flag)
    try {
      const ts = (config as any).timeStrategy;
      const { setTimeStrategy, setSimulationTime } = await import('@/lib/time/timestampService');
      if (ts === 'simulation') {
        setTimeStrategy('simulation');
        // Initialize simulation clock to first event timestamp (if available)
        const firstTs = config.events && config.events.length > 0 ? config.events[0].timestamp : 0;
        setSimulationTime(firstTs || 0);
      } else {
        setTimeStrategy('real');
      }
    } catch (e) {
      // ignore if import fails
    }
    
    // Initialize node states from scenario
    get()._initializeNodeStates();
    
    // Capture initial snapshot
    const initialSnapshot = get()._captureSnapshot('initial', -1);
    set((state) => ({
      currentState: initialSnapshot,
      snapshots: [initialSnapshot],
      snapshotIndex: new Map([[0, initialSnapshot]]),
    }));
  },
  
  stopReplay: () => {
    set({ isReplaying: false });
  },
  
  replayAll: async () => {
    const startTime = Date.now();
    const { config } = get();
    
    if (!config) {
      throw new Error('No replay config set. Call startReplay first.');
    }
    
    const events = config.events;
    let eventsProcessed = 0;
    
    try {
      // Process all events
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        await get()._processEvent(event);
        eventsProcessed++;
        
        // Capture snapshot if needed
        const shouldCapture = 
          config.captureAllSnapshots ||
          (config.snapshotInterval && i % config.snapshotInterval === 0);
        
        if (shouldCapture) {
          const snapshot = get()._captureSnapshot(event.id, i);
          set((state) => {
            const newSnapshots = [...state.snapshots, snapshot];
            const newIndex = new Map(state.snapshotIndex);
            newIndex.set(i, snapshot);
            
            // Limit snapshots if maxSnapshots set
            if (config.maxSnapshots && newSnapshots.length > config.maxSnapshots) {
              newSnapshots.shift();
            }
            
            return {
              snapshots: newSnapshots,
              snapshotIndex: newIndex,
              currentState: snapshot,
              currentEventIndex: i,
            };
          });
        }
      }
      
      // Capture final snapshot
      const finalSnapshot = get()._captureSnapshot('final', events.length - 1);
      
      const duration = Date.now() - startTime;
      const { errors } = get();
      
      return {
        success: errors.length === 0,
        finalState: finalSnapshot,
        snapshots: get().snapshots,
        stats: {
          totalEvents: events.length,
          eventsProcessed,
          duration,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        finalState: get().currentState!,
        snapshots: get().snapshots,
        stats: {
          totalEvents: events.length,
          eventsProcessed,
          duration,
          errors: get().errors.length + 1,
        },
        errors: [
          ...get().errors,
          {
            eventId: 'unknown',
            error: error as Error,
            timestamp: Date.now(),
          },
        ],
      };
    }
  },
  
  stepForward: async () => {
    const { config, currentEventIndex } = get();

    if (!config) {
      throw new Error('No replay config set. Call startReplay first.');
    }

    const eventQueue = useEventQueue.getState();

    // If queue is empty, try seeding it from the event store for remaining events
    if (eventQueue.isEmpty()) {
      try {
        const storeEvents = useEventStore.getState().getAllEvents();
        const startIndex = currentEventIndex + 1;
        const remaining = storeEvents.slice(startIndex);
        if (remaining.length > 0) {
          eventQueue.enqueueAll(remaining);
        }
      } catch (e) {
        console.warn('Could not seed event queue from event store', e);
      }
    }

    const event = eventQueue.dequeue();

    if (!event) {
      console.log('Already at last event (queue empty)');
      return null;
    }

    // Process the dequeued event
    await get()._processEvent(event);

    // Advance currentEventIndex to point to this event in the canonical event store
    const allEvents = useEventStore.getState().getAllEvents();
    const newIndex = allEvents.findIndex(e => e.id === event.id);
    const snapshot = get()._captureSnapshot(event.id, newIndex);

    set((state) => ({
      currentEventIndex: newIndex,
      currentState: snapshot,
      snapshots: [...state.snapshots, snapshot],
    }));

    return snapshot;
  },
  
  stepBackward: async () => {
    const { currentEventIndex, snapshotIndex } = get();
    
    if (currentEventIndex <= 0) {
      console.log('Already at first event');
      return null;
    }
    
    const prevIndex = currentEventIndex - 1;
    
    // Look for nearest snapshot
    let snapshot = snapshotIndex.get(prevIndex);
    
    if (!snapshot) {
      // Need to replay from nearest earlier snapshot
      let nearestIndex = prevIndex;
      while (nearestIndex >= 0 && !snapshot) {
        snapshot = snapshotIndex.get(nearestIndex);
        nearestIndex--;
      }
      
      if (!snapshot) {
        // Replay from beginning
        await get().seekToIndex(prevIndex);
        return get().currentState;
      }
      
      // Replay from nearest snapshot to target
      // TODO: Implement replay from snapshot
      console.warn('Replay from snapshot not yet implemented, replaying from start');
      await get().seekToIndex(prevIndex);
      return get().currentState;
    }
    
    set({
      currentEventIndex: prevIndex,
      currentState: snapshot,
    });
    
    return snapshot;
  },
  
  seekToEvent: async (eventId) => {
    const { config } = get();
    
    if (!config) {
      throw new Error('No replay config set. Call startReplay first.');
    }
    
    const index = config.events.findIndex(e => e.id === eventId);
    
    if (index === -1) {
      console.error(`Event ${eventId} not found`);
      return null;
    }
    
    return get().seekToIndex(index);
  },
  
  seekToIndex: async (targetIndex) => {
    const { config } = get();
    
    if (!config) {
      throw new Error('No replay config set. Call startReplay first.');
    }
    
    if (targetIndex < 0 || targetIndex >= config.events.length) {
      console.error(`Invalid index ${targetIndex}`);
      return null;
    }
    
    // Reset and replay up to target
    get()._initializeNodeStates();
    
    for (let i = 0; i <= targetIndex; i++) {
      const event = config.events[i];
      await get()._processEvent(event);
    }
    
    const snapshot = get()._captureSnapshot(
      config.events[targetIndex].id,
      targetIndex
    );
    
    set({
      currentEventIndex: targetIndex,
      currentState: snapshot,
    });
    
    return snapshot;
  },
  
  seekToTimestamp: async (timestamp) => {
    const { config } = get();
    
    if (!config) {
      throw new Error('No replay config set. Call startReplay first.');
    }
    
    // Find first event at or after timestamp
    const index = config.events.findIndex(e => e.timestamp >= timestamp);
    
    if (index === -1) {
      // Timestamp is after all events
      return get().seekToIndex(config.events.length - 1);
    }
    
    return get().seekToIndex(index);
  },
  
  // ============================================================================
  // STATE QUERIES
  // ============================================================================
  
  getCurrentState: () => {
    return get().currentState;
  },
  
  getStateAtIndex: (index) => {
    return get().snapshotIndex.get(index) || null;
  },
  
  getAllSnapshots: () => {
    return get().snapshots;
  },
  
  getNodeState: (nodeId) => {
    const { currentState } = get();
    if (!currentState) return null;
    
    return currentState.nodeStates.get(nodeId) || null;
  },
  
  getProgress: () => {
    const { config, currentEventIndex } = get();
    if (!config || config.events.length === 0) return 0;
    
    return (currentEventIndex + 1) / config.events.length;
  },
  
  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================
  
  _processEvent: async (event) => {
    const { config, currentState } = get();
    
    if (!config) return;
    
    try {
      // Get node and its current state
      const node = config.scenario.nodes.find((n: any) => n.nodeId === event.sourceNodeId);
      if (!node) {
        throw new Error(`Node ${event.sourceNodeId} not found in scenario`);
      }
      
      // nodeStates is a Map, use .get()
      const nodeState = currentState?.nodeStates?.get(event.sourceNodeId);
      if (!nodeState) {
        console.error('❌ Node state not found!', {
          lookingFor: event.sourceNodeId,
          availableNodeStates: currentState?.nodeStates ? Array.from(currentState.nodeStates.keys()) : [],
          mapSize: currentState?.nodeStates?.size,
          event,
        });
        throw new Error(`Node state for ${event.sourceNodeId} not found`);
      }
      
      // Import and call node processors
      const { processEvent: processNodeEvent } = await import('@/lib/executionEngines/nodeProcessors');
      
      const result = processNodeEvent(event, node, nodeState as any, config);
      
      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }
      
      // Apply state updates
      if (result.stateUpdates) {
        set((state) => {
          if (!state.currentState) return state;
          
          // Clone the Map and update the specific node
          const newNodeStates = new Map(state.currentState.nodeStates);
          const currentNodeState = newNodeStates.get(event.sourceNodeId) || {};
          newNodeStates.set(event.sourceNodeId, {
            ...currentNodeState,
            ...result.stateUpdates,
          } as any);
          
          return {
            currentState: {
              ...state.currentState,
              nodeStates: newNodeStates,
            },
          };
        });
      }
      
      // Log the event to activity logger for display
      const activityLogger = useActivityLogger.getState();
      activityLogger.logFromEvent(event);
      
      // Log for debugging
      console.log(`✅ Processed event: ${event.type} @ ${event.timestamp.toFixed(3)}s on node ${node.displayName || event.sourceNodeId}`);
      
      if (result.newEvents && result.newEvents.length > 0) {
        console.log(`   Generated ${result.newEvents.length} new events`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing event ${event.id}:`, error);
      
      set((state) => ({
        errors: [
          ...state.errors,
          {
            eventId: event.id,
            error: error as Error,
            timestamp: event.timestamp,
          },
        ],
      }));
    }
  },
  
  _captureSnapshot: (eventId, eventIndex) => {
    const { config } = get();
    
    if (!config) {
      throw new Error('No config set');
    }
    
    // Capture current node states
    const nodeStates = new Map<string, NodeState>();

    config.scenario.nodes.forEach((node: any) => {
      // TODO: Capture actual node state from processors
      // Use node.nodeId as the canonical identifier across the system
      const canonicalId = node.nodeId || node.id || node.name;
      nodeStates.set(canonicalId, {
        nodeId: canonicalId,
        nodeType: node.type,
        state: {}, // Would come from node processor
        variables: {},
        buffer: [],
        activityLog: [],
      });
    });
    
    const timestamp = eventIndex >= 0 
      ? config.events[eventIndex]?.timestamp || 0
      : 0;
    
    return {
      timestamp,
      eventId,
      eventIndex,
      nodeStates,
      pendingEvents: [], // Would come from event queue
      metadata: {
        activeNodeCount: nodeStates.size,
      },
    };
  },
  
  _initializeNodeStates: () => {
    const { config, currentState } = get();
    
    if (!config) return;
    
    console.log('🔧 Initializing node states from scenario');
    
    const nodeStates: Record<string, any> = {};
    
    // Initialize each node with default state
    config.scenario.nodes.forEach((node: any) => {
      switch (node.type) {
        case 'DataSource':
          nodeStates[node.nodeId] = {
            lastEmissionTime: -1,
            currentState: 'idle',
            outputBuffer: [],
            tokensEmitted: 0,
          };
          break;
          
        case 'ProcessNode':
          nodeStates[node.nodeId] = {
            inputBuffer: [],
            outputBuffer: [],
            currentState: 'idle',
            tokensProcessed: 0,
            tokensEmitted: 0,
          };
          break;
          
        case 'Queue':
          nodeStates[node.nodeId] = {
            inputBuffer: [],
            outputBuffer: [],
            currentState: 'idle',
            tokensEmitted: 0,
          };
          break;
          
        case 'Sink':
          nodeStates[node.nodeId] = {
            consumedTokens: [],
            consumedTokenCount: 0,
            currentState: 'idle',
          };
          break;
          
        case 'FSMProcessNode':
          const fsmNode = node as any;
          const initialState = fsmNode.fsm?.initialState || 'idle';
          nodeStates[node.nodeId] = {
            inputBuffer: [],
            outputBuffer: [],
            currentState: initialState,
            currentFSMState: initialState,
            fsmVariables: fsmNode.fsm?.variables ? { ...fsmNode.fsm.variables } : {},
            tokensProcessed: 0,
            tokensEmitted: 0,
          };
          break;
          
        default:
          // Generic node state
          nodeStates[node.nodeId] = {
            currentState: 'idle',
            inputBuffer: [],
            outputBuffer: [],
          };
      }
    });
    
    // Create initial state snapshot
    const initialSnapshot: StateSnapshot = {
      eventId: 'initial',
      eventIndex: -1,
      timestamp: 0,
      nodeStates: new Map(Object.entries(nodeStates)),
      pendingEvents: [],
    };
    
    set({
      currentState: initialSnapshot,
      snapshots: [initialSnapshot],
      snapshotIndex: new Map([[0, initialSnapshot]]),
    });
    
    console.log(`✅ Initialized ${Object.keys(nodeStates).length} node states`);
  },
  
  _reset: () => {
    set({
      config: null,
      isReplaying: false,
      currentEventIndex: -1,
      currentState: null,
      snapshots: [],
      snapshotIndex: new Map(),
      errors: [],
    });
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Replay events and get final result
 */
export async function replayEvents(
  events: StoredEvent[],
  scenario: any
): Promise<ReplayResult> {
  const engine = useReplayEngine.getState();
  
  await engine.startReplay({
    scenario,
    events,
    captureAllSnapshots: false,
    snapshotInterval: 100,
  });
  
  return engine.replayAll();
}

/**
 * Compare two state snapshots
 */
export function compareSnapshots(
  snapshot1: StateSnapshot,
  snapshot2: StateSnapshot
): {
  nodesDifferent: string[];
  stateChanges: Record<string, any>;
} {
  const nodesDifferent: string[] = [];
  const stateChanges: Record<string, any> = {};
  
  snapshot1.nodeStates.forEach((state1, nodeId) => {
    const state2 = snapshot2.nodeStates.get(nodeId);
    
    if (!state2) {
      nodesDifferent.push(nodeId);
      return;
    }
    
    // Simple deep comparison (would need better implementation)
    if (JSON.stringify(state1.state) !== JSON.stringify(state2.state)) {
      nodesDifferent.push(nodeId);
      stateChanges[nodeId] = {
        before: state1.state,
        after: state2.state,
      };
    }
  });
  
  return { nodesDifferent, stateChanges };
}

/**
 * Export replay session for audit
 */
export function exportReplaySession(): {
  config: ReplayConfig | null;
  snapshots: StateSnapshot[];
  errors: any[];
} {
  const state = useReplayEngine.getState();
  
  return {
    config: state.config,
    snapshots: state.snapshots,
    errors: state.errors,
  };
}
