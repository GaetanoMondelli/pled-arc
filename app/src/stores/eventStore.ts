/**
 * Event Store - Immutable Event Log
 * 
 * Core component of the event-driven architecture that stores ALL events
 * in an append-only log. This enables:
 * 
 * 1. **Deterministic Replay** - Replay events to recreate any state
 * 2. **Event Sourcing** - Complete audit trail of what happened
 * 3. **Time-Travel Debugging** - Step through event timeline
 * 4. **Causality Tracking** - Understand what caused what
 * 5. **Blockchain Integration** - Hash events for immutable proof
 * 
 * @module eventStore
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { now as nowTimestamp } from '@/lib/time/timestampService';

// ============================================================================
// TICK MANAGEMENT
// ============================================================================

/** Default tick duration in milliseconds */
export const DEFAULT_TICK_DURATION_MS = 1;

/** Current tick configuration */
let currentTickDurationMs = DEFAULT_TICK_DURATION_MS;

/**
 * Set tick duration for time conversion
 */
export function setTickDuration(durationMs: number): void {
  currentTickDurationMs = Math.max(1, durationMs);
}

/**
 * Get current tick duration
 */
export function getTickDuration(): number {
  return currentTickDurationMs;
}

/**
 * Convert real timestamp to tick
 */
export function timestampToTick(timestamp: number, tickDurationMs = currentTickDurationMs): number {
  return Math.floor(timestamp / tickDurationMs);
}

/**
 * Convert tick to timestamp
 */
export function tickToTimestamp(tick: number, tickDurationMs = currentTickDurationMs): number {
  return tick * tickDurationMs;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Base event interface - all events must implement this
 */
export interface BaseEvent {
  /** Unique event ID */
  id: string;

  /** Logical tick (discrete time) */
  timestamp: number;

  /** Real timestamp when event was created/received */
  realTimestamp: number;

  /** Simulation timestamp (for replay/debugging) */
  simulationTimestamp: number;

  /** Type of event (determines how it's processed) */
  type: EventType;

  /** Node that generated this event */
  sourceNodeId: string;

  /** Parent event ID (causality chain) - single parent */
  causedBy?: string;

  /** Correlation IDs for aggregation scenarios */
  correlationIds?: string[];

  /** Event payload (type-specific data) */
  data: any;

  /** Metadata for debugging/auditing */
  metadata?: {
    /** Execution context (simulation, production, replay) */
    context?: 'simulation' | 'production' | 'replay';

    /** User or system that triggered this */
    triggeredBy?: string;

    /** Additional tags for querying */
    tags?: string[];

    /** Tick duration in ms (for time conversion) */
    tickDurationMs?: number;
  };
}

/**
 * Event types in the system
 */
export type EventType =
  // Source events (external inputs)
  | 'SourceEmit'           // Data source emitted data
  | 'ExternalInput'        // External API/stream input

  // Processing events
  | 'ProcessStart'         // Node started processing
  | 'ProcessComplete'      // Node finished processing
  | 'ProcessError'         // Node encountered error

  // Data movement events
  | 'TokenArrival'         // Token arrived at node input
  | 'TokenConsumed'        // Token consumed from input buffer
  | 'DataArrival'          // Data arrived at node
  | 'DataEmit'             // Data emitted from node
  | 'DataQueued'           // Data queued in buffer
  | 'DataDequeued'         // Data dequeued from buffer

  // Buffer events (for multi-input nodes)
  | 'BufferUpdated'        // Input buffer state changed
  | 'InputReady'           // All required inputs available

  // Queue events
  | 'QueueEmit'            // Queue emitted batch

  // FSM events
  | 'FSMTransition'        // FSM state transition
  | 'FSMActionExecuted'    // FSM action executed
  | 'FSMGuardEvaluated'    // FSM guard evaluated

  // System events
  | 'SimulationStart'      // Simulation started
  | 'SimulationEnd'        // Simulation ended
  | 'NodeStateChanged'     // Node internal state changed
  | 'ErrorOccurred';       // Error occurred

/**
 * Specific event interfaces for type safety
 */
export interface SourceEmitEvent extends BaseEvent {
  type: 'SourceEmit';
  data: {
    /** Emitted data payload */
    payload: any;
    
    /** Target nodes (if known) */
    targetNodeIds?: string[];
  };
}

export interface DataArrivalEvent extends BaseEvent {
  type: 'DataArrival';
  data: {
    /** Data that arrived */
    payload: any;
    
    /** Source of the data */
    fromNodeId: string;
    
    /** Target node */
    toNodeId: string;
  };
}

export interface FSMTransitionEvent extends BaseEvent {
  type: 'FSMTransition';
  sourceNodeId: string; // FSM node ID
  data: {
    /** Previous state */
    fromState: string;
    
    /** New state */
    toState: string;
    
    /** Trigger that caused transition */
    trigger: string;
    
    /** Context/data during transition */
    context?: any;
  };
}

export interface ProcessCompleteEvent extends BaseEvent {
  type: 'ProcessComplete';
  data: {
    /** Processing result */
    result: any;

    /** Processing duration (in ticks) */
    duration: number;

    /** Input that was processed */
    input?: any;

    /** Tokens that were consumed */
    consumedTokens?: Array<{
      tokenId: string;
      inputName: string;
    }>;
  };
}

export interface TokenConsumedEvent extends BaseEvent {
  type: 'TokenConsumed';
  data: {
    /** Token that was consumed */
    tokenId: string;

    /** Input buffer name */
    inputName: string;

    /** Remaining buffer size */
    remainingBufferSize: number;
  };
}

export interface BufferUpdatedEvent extends BaseEvent {
  type: 'BufferUpdated';
  data: {
    /** Input buffer name */
    inputName: string;

    /** New buffer size */
    bufferSize: number;

    /** Operation (added, removed, cleared) */
    operation: 'added' | 'removed' | 'cleared';

    /** Token ID involved */
    tokenId?: string;
  };
}

export interface InputReadyEvent extends BaseEvent {
  type: 'InputReady';
  data: {
    /** Ready input buffers */
    readyInputs: string[];

    /** Tokens available for processing */
    availableTokens: Array<{
      inputName: string;
      tokenId: string;
      value: any;
    }>;
  };
}

// Union type of all events
export type StoredEvent =
  | SourceEmitEvent
  | DataArrivalEvent
  | FSMTransitionEvent
  | ProcessCompleteEvent
  | TokenConsumedEvent
  | BufferUpdatedEvent
  | InputReadyEvent
  | BaseEvent;

// ============================================================================
// EVENT STORE STATE
// ============================================================================

interface EventStoreState {
  /** All events in chronological order (append-only) */
  events: StoredEvent[];
  
  /** Index for fast lookups by event ID */
  eventsById: Map<string, StoredEvent>;
  
  /** Index for fast lookups by node ID */
  eventsByNodeId: Map<string, StoredEvent[]>;
  
  /** Index for causality chains */
  eventsByCause: Map<string, StoredEvent[]>; // causedBy -> events
  
  /** Current event cursor for replay */
  currentEventIndex: number;
  
  /** Is store in replay mode? */
  isReplayMode: boolean;
  
  // ============================================================================
  // WRITE OPERATIONS (Append-Only)
  // ============================================================================
  
  /**
   * Append a new event to the log
   * This is the ONLY way to add events (immutability)
   */
  appendEvent: (event: Omit<StoredEvent, 'id'>) => StoredEvent;
  
  /**
   * Append multiple events (batch operation)
   */
  appendEvents: (events: Omit<StoredEvent, 'id'>[]) => StoredEvent[];
  
  /**
   * Clear all events (use with caution - loses history!)
   */
  clearEvents: () => void;
  
  // ============================================================================
  // READ OPERATIONS (Query)
  // ============================================================================
  
  /**
   * Get all events
   */
  getAllEvents: () => StoredEvent[];
  
  /**
   * Get event by ID
   */
  getEventById: (id: string) => StoredEvent | undefined;
  
  /**
   * Get events in time range
   */
  getEventsByTimeRange: (startTime: number, endTime: number) => StoredEvent[];
  
  /**
   * Get events by node ID
   */
  getEventsByNodeId: (nodeId: string) => StoredEvent[];
  
  /**
   * Get events by type
   */
  getEventsByType: (type: EventType) => StoredEvent[];
  
  /**
   * Get causality chain (all events caused by an event)
   */
  getCausalityChain: (eventId: string) => StoredEvent[];
  
  /**
   * Get root cause (traverse causedBy chain backwards)
   */
  getRootCause: (eventId: string) => StoredEvent | undefined;
  
  // ============================================================================
  // REPLAY OPERATIONS
  // ============================================================================
  
  /**
   * Enter replay mode
   */
  startReplay: () => void;
  
  /**
   * Exit replay mode
   */
  stopReplay: () => void;
  
  /**
   * Get current event in replay
   */
  getCurrentReplayEvent: () => StoredEvent | undefined;
  
  /**
   * Move to next event in replay
   */
  stepForward: () => StoredEvent | undefined;
  
  /**
   * Move to previous event in replay
   */
  stepBackward: () => StoredEvent | undefined;
  
  /**
   * Jump to specific event
   */
  seekToEvent: (eventId: string) => StoredEvent | undefined;
  
  /**
   * Jump to specific time
   */
  seekToTime: (timestamp: number) => StoredEvent | undefined;
  
  // ============================================================================
  // BLOCKCHAIN/AUDIT OPERATIONS
  // ============================================================================
  
  /**
   * Get hash of all events (for blockchain proof)
   */
  getEventsHash: () => string;
  
  /**
   * Export events for storage/blockchain
   */
  exportEvents: () => StoredEvent[];
  
  /**
   * Import events (for replay/audit)
   */
  importEvents: (events: StoredEvent[]) => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useEventStore = create<EventStoreState>((set, get) => ({
  // Initial state
  events: [],
  eventsById: new Map(),
  eventsByNodeId: new Map(),
  eventsByCause: new Map(),
  currentEventIndex: -1,
  isReplayMode: false,
  
  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================
  
  appendEvent: (event) => {
    const now = nowTimestamp();
    const newEvent: StoredEvent = {
      id: nanoid(),
      ...event,
      // Set defaults for timing fields
      timestamp: event.timestamp ?? 0,
      realTimestamp: event.realTimestamp ?? now,
      simulationTimestamp: event.simulationTimestamp ?? (event.timestamp ?? 0),
    };
    
    set((state) => {
      // Create new indexes
      const newEventsById = new Map(state.eventsById);
      newEventsById.set(newEvent.id, newEvent);
      
      const newEventsByNodeId = new Map(state.eventsByNodeId);
      const nodeEvents = newEventsByNodeId.get(newEvent.sourceNodeId) || [];
      newEventsByNodeId.set(newEvent.sourceNodeId, [...nodeEvents, newEvent]);
      
      const newEventsByCause = new Map(state.eventsByCause);
      if (newEvent.causedBy) {
        const causedEvents = newEventsByCause.get(newEvent.causedBy) || [];
        newEventsByCause.set(newEvent.causedBy, [...causedEvents, newEvent]);
      }
      
      return {
        events: [...state.events, newEvent],
        eventsById: newEventsById,
        eventsByNodeId: newEventsByNodeId,
        eventsByCause: newEventsByCause,
      };
    });
    
    return newEvent;
  },
  
  appendEvents: (events) => {
    const newEvents = events.map(event => ({
      id: nanoid(),
      ...event,
      timestamp: event.timestamp ?? nowTimestamp(),
    })) as StoredEvent[];
    
    set((state) => {
      // Rebuild indexes
      const newEventsById = new Map(state.eventsById);
      const newEventsByNodeId = new Map(state.eventsByNodeId);
      const newEventsByCause = new Map(state.eventsByCause);
      
      newEvents.forEach(event => {
        newEventsById.set(event.id, event);
        
        const nodeEvents = newEventsByNodeId.get(event.sourceNodeId) || [];
        newEventsByNodeId.set(event.sourceNodeId, [...nodeEvents, event]);
        
        if (event.causedBy) {
          const causedEvents = newEventsByCause.get(event.causedBy) || [];
          newEventsByCause.set(event.causedBy, [...causedEvents, event]);
        }
      });
      
      return {
        events: [...state.events, ...newEvents],
        eventsById: newEventsById,
        eventsByNodeId: newEventsByNodeId,
        eventsByCause: newEventsByCause,
      };
    });
    
    return newEvents;
  },
  
  clearEvents: () => {
    set({
      events: [],
      eventsById: new Map(),
      eventsByNodeId: new Map(),
      eventsByCause: new Map(),
      currentEventIndex: -1,
    });
  },
  
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================
  
  getAllEvents: () => {
    return get().events;
  },
  
  getEventById: (id) => {
    return get().eventsById.get(id);
  },
  
  getEventsByTimeRange: (startTime, endTime) => {
    return get().events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  },
  
  getEventsByNodeId: (nodeId) => {
    return get().eventsByNodeId.get(nodeId) || [];
  },
  
  getEventsByType: (type) => {
    return get().events.filter(event => event.type === type);
  },
  
  getCausalityChain: (eventId) => {
    const chain: StoredEvent[] = [];
    const visited = new Set<string>();
    
    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const causedEvents = get().eventsByCause.get(id) || [];
      causedEvents.forEach(event => {
        chain.push(event);
        traverse(event.id);
      });
    };
    
    traverse(eventId);
    return chain;
  },
  
  getRootCause: (eventId) => {
    let currentEvent = get().eventsById.get(eventId);
    if (!currentEvent) return undefined;
    
    // Traverse backwards through causedBy chain
    while (currentEvent.causedBy) {
      const parentEvent = get().eventsById.get(currentEvent.causedBy);
      if (!parentEvent) break;
      currentEvent = parentEvent;
    }
    
    return currentEvent;
  },
  
  // ============================================================================
  // REPLAY OPERATIONS
  // ============================================================================
  
  startReplay: () => {
    set({ isReplayMode: true, currentEventIndex: -1 });
  },
  
  stopReplay: () => {
    set({ isReplayMode: false, currentEventIndex: -1 });
  },
  
  getCurrentReplayEvent: () => {
    const { events, currentEventIndex } = get();
    if (currentEventIndex < 0 || currentEventIndex >= events.length) {
      return undefined;
    }
    return events[currentEventIndex];
  },
  
  stepForward: () => {
    const { events, currentEventIndex } = get();
    const nextIndex = currentEventIndex + 1;
    
    if (nextIndex >= events.length) {
      return undefined; // End of events
    }
    
    set({ currentEventIndex: nextIndex });
    return events[nextIndex];
  },
  
  stepBackward: () => {
    const { events, currentEventIndex } = get();
    const prevIndex = currentEventIndex - 1;
    
    if (prevIndex < 0) {
      return undefined; // Beginning of events
    }
    
    set({ currentEventIndex: prevIndex });
    return events[prevIndex];
  },
  
  seekToEvent: (eventId) => {
    const { events } = get();
    const index = events.findIndex(e => e.id === eventId);
    
    if (index === -1) return undefined;
    
    set({ currentEventIndex: index });
    return events[index];
  },
  
  seekToTime: (timestamp) => {
    const { events } = get();
    
    // Binary search for closest event at or after timestamp
    let left = 0;
    let right = events.length - 1;
    let resultIndex = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (events[mid].timestamp >= timestamp) {
        resultIndex = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    if (resultIndex === -1) return undefined;
    
    set({ currentEventIndex: resultIndex });
    return events[resultIndex];
  },
  
  // ============================================================================
  // BLOCKCHAIN/AUDIT OPERATIONS
  // ============================================================================
  
  getEventsHash: () => {
    // Simple hash implementation (replace with crypto library in production)
    const eventsJson = JSON.stringify(get().events);
    let hash = 0;
    for (let i = 0; i < eventsJson.length; i++) {
      const char = eventsJson.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  },
  
  exportEvents: () => {
    return [...get().events]; // Return copy
  },
  
  importEvents: (events) => {
    set((state) => {
      // Rebuild all indexes
      const newEventsById = new Map<string, StoredEvent>();
      const newEventsByNodeId = new Map<string, StoredEvent[]>();
      const newEventsByCause = new Map<string, StoredEvent[]>();
      
      events.forEach(event => {
        newEventsById.set(event.id, event);
        
        const nodeEvents = newEventsByNodeId.get(event.sourceNodeId) || [];
        newEventsByNodeId.set(event.sourceNodeId, [...nodeEvents, event]);
        
        if (event.causedBy) {
          const causedEvents = newEventsByCause.get(event.causedBy) || [];
          newEventsByCause.set(event.causedBy, [...causedEvents, event]);
        }
      });
      
      return {
        events: [...events],
        eventsById: newEventsById,
        eventsByNodeId: newEventsByNodeId,
        eventsByCause: newEventsByCause,
        currentEventIndex: -1,
        isReplayMode: false,
      };
    });
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new event with proper typing
 */
export function createEvent<T extends EventType>(
  type: T,
  sourceNodeId: string,
  data: any,
  options?: {
    tick?: number;
    timestamp?: number; // Legacy support
    realTimestamp?: number;
    causedBy?: string;
    correlationIds?: string[];
    metadata?: BaseEvent['metadata'];
  }
): Omit<StoredEvent, 'id'> {
  const now = nowTimestamp();
  const tick = options?.tick ?? timestampToTick(options?.timestamp ?? now);

  return {
    type,
    sourceNodeId,
    tick,
    realTimestamp: options?.realTimestamp ?? now,
    simulationTimestamp: tickToTimestamp(tick),
    // Legacy timestamp for backward compatibility
    timestamp: tickToTimestamp(tick),
    causedBy: options?.causedBy,
    correlationIds: options?.correlationIds,
    data,
    metadata: {
      ...options?.metadata,
      tickDurationMs: currentTickDurationMs,
    },
  };
}

/**
 * Create event at specific tick (for simulation)
 */
export function createEventAtTick<T extends EventType>(
  type: T,
  sourceNodeId: string,
  timestamp: number,
  data: any,
  options?: {
    causedBy?: string;
    correlationIds?: string[];
    metadata?: BaseEvent['metadata'];
  }
): Omit<StoredEvent, 'id'> {
  return createEvent(type, sourceNodeId, data, {
    ...options,
    timestamp,
    realTimestamp: nowTimestamp(),
  });
}

/**
 * Get event statistics
 */
export function getEventStats(events: StoredEvent[]) {
  const stats = {
    total: events.length,
    byType: {} as Record<EventType, number>,
    byNode: {} as Record<string, number>,
    timeRange: {
      start: events.length > 0 ? events[0].timestamp : 0,
      end: events.length > 0 ? events[events.length - 1].timestamp : 0,
    },
  };
  
  events.forEach(event => {
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    stats.byNode[event.sourceNodeId] = (stats.byNode[event.sourceNodeId] || 0) + 1;
  });
  
  return stats;
}
