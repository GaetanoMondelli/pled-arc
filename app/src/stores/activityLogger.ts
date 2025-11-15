/**
 * Activity Logger - Compatibility with Legacy Activity Logs
 * 
 * This module provides the same activity logging features as the legacy
 * simulationStore, built on top of the new event-driven architecture.
 * 
 * Features:
 * - Per-node activity logs (nodeActivityLogs)
 * - Global activity ledger (globalActivityLog)
 * - Rich metadata (FSM states, buffer sizes, lineage)
 * - Filtering by node, time, action type
 * - Same HistoryEntry format as legacy
 * 
 * @module activityLogger
 */

import { create } from 'zustand';
import { StoredEvent, useEventStore } from './eventStore';
import { useEventProcessor } from '@/lib/executionEngines/EventProcessor';

// ============================================================================
// TYPES (Compatible with legacy HistoryEntry)
// ============================================================================

export type OperationType = 
  | 'creation'
  | 'consumption'
  | 'transformation'
  | 'aggregation'
  | 'routing'
  | 'state_change'
  | 'error';

export interface HistoryEntry {
  /** Simulation timestamp */
  timestamp: number;
  
  /** Real-world timestamp */
  epochTimestamp: number;
  
  /** Sequence number (global order) */
  sequence: number;
  
  /** Node that performed this action */
  nodeId: string;
  
  /** Action type (e.g., "consuming", "emitting", "fsm_transition") */
  action: string;
  
  /** Value involved (if any) */
  value?: any;
  
  /** Source token IDs (for lineage) */
  sourceTokenIds?: string[];
  
  /** Enhanced source summaries */
  sourceTokenSummaries?: any[];
  
  
  /** FSM state at this time */
  state?: string;
  
  /** Input buffer size */
  bufferSize?: number;
  
  /** Output buffer size */
  outputBufferSize?: number;
  
  /** Operation type category */
  operationType?: OperationType;
  
  /** Aggregation details (for aggregation operations) */
  aggregationDetails?: any;
  
  /** Transformation details (for transformations) */
  transformationDetails?: any;
  
  /** Lineage metadata */
  lineageMetadata?: any;
  
  /** Custom fields */
  [key: string]: any;
}

// ============================================================================
// ACTIVITY LOGGER STORE
// ============================================================================

interface ActivityLoggerState {
  /** Per-node activity logs */
  nodeActivityLogs: Record<string, HistoryEntry[]>;
  
  /** Global activity ledger (all events) */
  globalActivityLog: HistoryEntry[];
  
  /** Event counter for sequence numbers */
  eventCounter: number;
  
  /** Max entries per node log */
  maxNodeLogs: number;
  
  /** Max entries in global log */
  maxGlobalLogs: number;
  
  // ============================================================================
  // LOGGING OPERATIONS
  // ============================================================================
  
  /**
   * Log an activity for a node (legacy-compatible)
   */
  logNodeActivity: (
    nodeId: string,
    details: {
      action: string;
      value?: any;
      sourceTokenIds?: string[];
      sourceTokenSummaries?: any[];
      details?: string;
      [key: string]: any;
    },
    timestamp: number
  ) => HistoryEntry;
  
  /**
   * Log from an event (auto-extract details)
   */
  logFromEvent: (event: StoredEvent) => HistoryEntry | null;
  
  /**
   * Clear all logs
   */
  clearLogs: () => void;
  
  /**
   * Clear logs for specific node
   */
  clearNodeLogs: (nodeId: string) => void;
  
  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================
  
  /**
   * Get all activity logs for a node
   */
  getNodeActivityLogs: (nodeId: string) => HistoryEntry[];
  
  /**
   * Get global activity log
   */
  getGlobalActivityLog: () => HistoryEntry[];
  
  /**
   * Get logs filtered by time range
   */
  getLogsByTimeRange: (startTime: number, endTime: number) => HistoryEntry[];
  
  /**
   * Get logs filtered by action type
   */
  getLogsByAction: (action: string) => HistoryEntry[];
  
  /**
   * Get logs filtered by node IDs
   */
  getLogsByNodes: (nodeIds: string[]) => HistoryEntry[];
  
  /**
   * Get statistics for a node
   */
  getNodeStats: (nodeId: string) => {
    totalActivities: number;
    byAction: Record<string, number>;
    firstActivity: number;
    lastActivity: number;
  };
}

export const useActivityLogger = create<ActivityLoggerState>((set, get) => ({
  // Initial state
  nodeActivityLogs: {},
  globalActivityLog: [],
  eventCounter: 0,
  maxNodeLogs: 500,
  maxGlobalLogs: 1000,
  
  // ============================================================================
  // LOGGING OPERATIONS
  // ============================================================================
  
  logNodeActivity: (nodeId, logDetails, timestamp) => {
    const { eventCounter, maxNodeLogs, maxGlobalLogs } = get();
    
    // Get current node state from processor
    const processor = useEventProcessor.getState();
    const nodeState = processor.getNodeState(nodeId);
    
    // Determine operation type
    const operationType = determineOperationType(logDetails.action);
    
    // Get FSM state
    let currentState = 'unknown';
    if (nodeState) {
      currentState = nodeState.currentState || 'unknown';
    }
    
    // Get buffer sizes
    const bufferSize = nodeState?.buffer?.length || 0;
    
    // Create history entry
    const newEntry: HistoryEntry = {
      timestamp,
      epochTimestamp: Date.now(),
      sequence: eventCounter,
      nodeId,
      action: logDetails.action,
      value: logDetails.value,
      sourceTokenIds: logDetails.sourceTokenIds,
      sourceTokenSummaries: logDetails.sourceTokenSummaries,
      details: logDetails.details,
      state: currentState,
      bufferSize,
      operationType,
      ...logDetails, // Include any custom fields
    };
    
    // Update logs
    set((state) => {
      const currentNodeLogs = state.nodeActivityLogs[nodeId] || [];
      const updatedNodeLogs = [...currentNodeLogs, newEntry].slice(-maxNodeLogs);
      
      const currentGlobalLog = state.globalActivityLog || [];
      const updatedGlobalLog = [...currentGlobalLog, newEntry].slice(-maxGlobalLogs);
      
      return {
        nodeActivityLogs: {
          ...state.nodeActivityLogs,
          [nodeId]: updatedNodeLogs,
        },
        globalActivityLog: updatedGlobalLog,
        eventCounter: state.eventCounter + 1,
      };
    });
    
    console.log(`✅ [ACTIVITY] ${nodeId}: ${logDetails.action} @ t=${timestamp}`);
    
    return newEntry;
  },
  
  logFromEvent: (event) => {
    // Auto-convert events to activity logs
    const action = eventTypeToAction(event.type);
    
    console.debug('[ACTIVITY] logFromEvent called for', event.type, 'on', event.sourceNodeId);

    if (!action) return null; // Not all events need logs
    
    const details = {
      action,
      value: (event.data as any)?.payload || (event.data as any)?.result,
      details: formatEventDetails(event),
    };
    
    return get().logNodeActivity(event.sourceNodeId, details, event.timestamp);
  },
  
  clearLogs: () => {
    set({
      nodeActivityLogs: {},
      globalActivityLog: [],
      eventCounter: 0,
    });
  },
  
  clearNodeLogs: (nodeId) => {
    set((state) => {
      const updated = { ...state.nodeActivityLogs };
      delete updated[nodeId];
      
      // Also remove from global log
      const filteredGlobal = state.globalActivityLog.filter(
        entry => entry.nodeId !== nodeId
      );
      
      return {
        nodeActivityLogs: updated,
        globalActivityLog: filteredGlobal,
      };
    });
  },
  
  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================
  
  getNodeActivityLogs: (nodeId) => {
    return get().nodeActivityLogs[nodeId] || [];
  },
  
  getGlobalActivityLog: () => {
    return get().globalActivityLog;
  },
  
  getLogsByTimeRange: (startTime, endTime) => {
    return get().globalActivityLog.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  },
  
  getLogsByAction: (action) => {
    return get().globalActivityLog.filter(
      entry => entry.action === action
    );
  },
  
  getLogsByNodes: (nodeIds) => {
    const nodeIdSet = new Set(nodeIds);
    return get().globalActivityLog.filter(
      entry => nodeIdSet.has(entry.nodeId)
    );
  },
  
  getNodeStats: (nodeId) => {
    const logs = get().getNodeActivityLogs(nodeId);
    
    const byAction: Record<string, number> = {};
    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    });
    
    return {
      totalActivities: logs.length,
      byAction,
      firstActivity: logs[0]?.timestamp || 0,
      lastActivity: logs[logs.length - 1]?.timestamp || 0,
    };
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine operation type from action string
 */
function determineOperationType(action: string): OperationType {
  if (action.includes('create') || action.includes('emit')) return 'creation';
  if (action.includes('consum') || action.includes('receive')) return 'consumption';
  if (action.includes('transform') || action.includes('process')) return 'transformation';
  if (action.includes('aggregat') || action.includes('merge')) return 'aggregation';
  if (action.includes('route') || action.includes('forward')) return 'routing';
  if (action.includes('transition') || action.includes('state')) return 'state_change';
  if (action.includes('error') || action.includes('fail')) return 'error';
  
  return 'transformation'; // Default
}

/**
 * Convert event type to activity action string
 */
function eventTypeToAction(eventType: StoredEvent['type']): string | null {
  const mapping: Record<string, string> = {
    'SourceEmit': 'scheduled',
    'TokenArrival': 'receiving',
    'DataArrival': 'receiving',
    'DataEmit': 'emitting',
    'DataQueued': 'queuing',
    'DataDequeued': 'dequeuing',
    'QueueEmit': 'emitting',
    'ProcessStart': 'processing',
    'ProcessComplete': 'completed',
    'FSMTransition': 'fsm_transition',
    'FSMActionExecuted': 'fsm_action',
    'NodeStateChanged': 'state_changed',
    'ErrorOccurred': 'error',
  };
  
  return mapping[eventType] || null;
}

/**
 * Format event details for logging
 */
function formatEventDetails(event: StoredEvent): string {
  switch (event.type) {
    case 'SourceEmit':
      return '-'; // Simple dash for emission events

    case 'DataEmit':
      const tokenData = (event.data as any)?.token;
      if (tokenData && typeof tokenData.value === 'number') {
        return `value: ${tokenData.value.toFixed(2)}`;
      }
      return 'data emitted';

    case 'FSMTransition':
      const fsmData = event.data as any;
      return `${fsmData.fromState} → ${fsmData.toState}`;

    case 'ProcessComplete':
      return `completed`;

    case 'DataQueued':
      return `queued`;

    case 'SimulationStart':
      return '-';

    default:
      return '-'; // Simple dash instead of JSON dump
  }
}

// ============================================================================
// AUTO-LOGGING INTEGRATION
// ============================================================================

/**
 * Enable auto-logging from event store
 * This automatically creates activity logs from events
 */
export function enableAutoLogging() {
  const eventStore = useEventStore.getState();
  const activityLogger = useActivityLogger.getState();
  
  // Subscribe to new events
  useEventStore.subscribe((state, prevState) => {
    const newEvents = state.events.slice(prevState.events.length);
    
    newEvents.forEach(event => {
      activityLogger.logFromEvent(event);
    });
  });
  
  console.log('✅ Auto-logging enabled - events will create activity logs');
}

// ============================================================================
// LEGACY COMPATIBILITY HELPERS
// ============================================================================

/**
 * Get activity logs in legacy format (for existing UI components)
 */
export function getLegacyActivityLogs() {
  const { nodeActivityLogs, globalActivityLog } = useActivityLogger.getState();
  
  return {
    nodeActivityLogs,
    globalActivityLog,
  };
}

/**
 * Export activity logs for saving/blockchain
 */
export function exportActivityLogs() {
  const { globalActivityLog } = useActivityLogger.getState();
  
  return {
    logs: globalActivityLog,
    exportedAt: Date.now(),
    totalEntries: globalActivityLog.length,
  };
}

/**
 * Import activity logs (from saved execution)
 */
export function importActivityLogs(data: {
  logs: HistoryEntry[];
  nodeActivityLogs?: Record<string, HistoryEntry[]>;
}) {
  const logger = useActivityLogger.getState();
  
  if (data.nodeActivityLogs) {
    // Direct import of node logs
    useActivityLogger.setState({
      nodeActivityLogs: data.nodeActivityLogs,
      globalActivityLog: data.logs,
    });
  } else {
    // Rebuild node logs from global log
    const nodeActivityLogs: Record<string, HistoryEntry[]> = {};
    
    data.logs.forEach(entry => {
      if (!nodeActivityLogs[entry.nodeId]) {
        nodeActivityLogs[entry.nodeId] = [];
      }
      nodeActivityLogs[entry.nodeId].push(entry);
    });
    
    useActivityLogger.setState({
      nodeActivityLogs,
      globalActivityLog: data.logs,
    });
  }
  
  console.log(`✅ Imported ${data.logs.length} activity log entries`);
}
