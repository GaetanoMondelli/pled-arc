/**
 * Core Types for Event-Driven Simulation System
 *
 * These types are shared between SDK and UI implementations.
 * Both the SDK and UI components import from this core module
 * to ensure consistency across the entire system.
 */

// Re-export claims types
export * from './claims';

// ============================================================================
// BASE EVENT TYPES
// ============================================================================

/**
 * Base event data structure for all simulation events
 */
export interface EventData {
  id: string;
  timestamp: number;
  type: EventType;
  sourceNodeId: string;
  targetNodeId: string;
  data?: Record<string, any>;
  causedBy?: string;
  correlationIds?: string[];
  metadata?: Record<string, any>;
}

/**
 * All possible event types in the simulation
 */
export type EventType =
  | 'SimulationStart'    // Engine initialization
  | 'DataEmit'          // Node outputs data
  | 'TokenArrival'      // Token arrives at node
  | 'ProcessComplete'   // Node finishes processing
  | 'BatchReady'        // Batch processing trigger
  | 'TimeTimeout'       // Time-based trigger
  | 'Multiplex'         // Multiplexer routing
  | 'SimulationEnd';    // Engine shutdown

// ============================================================================
// NODE AND SCENARIO TYPES
// ============================================================================

/**
 * Configuration for individual nodes
 */
export interface NodeConfig {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
  metadata?: Record<string, any>;

  // V3 Schema compatibility
  nodeId?: string;
  displayName?: string;
  interval?: number;
  generation?: any;
  outputs?: any[];
  inputs?: any[];
  fsm?: any;
  fsl?: string;
  aggregation?: any;
  capacity?: number;

  // Environment info for deterministic execution
  environment?: {
    runtime?: string;        // 'Browser' | 'Node.js'
    jsEngine?: string;       // Version info (Chrome/119, Node/v18.17.0)
    platform?: string;      // OS platform
    recordedAt?: string;     // ISO timestamp when config was created
    determinismNotes?: string[]; // Notes about potential non-deterministic factors
  };
}

/**
 * All supported node types
 */
export type NodeType =
  | 'DataSource'        // Generates data
  | 'Queue'            // Manages workflow queues
  | 'ProcessNode'       // Transforms data
  | 'FSMProcessNode'    // Finite state machine workflows
  | 'Sink'             // Stores data
  | 'Multiplexer';      // Routes to multiple targets

/**
 * Edge configuration for connecting nodes
 */
export interface EdgeConfig {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  name?: string;
  condition?: EdgeCondition;
  weight?: number;
  metadata?: Record<string, any>;
}

/**
 * Conditional routing for edges
 */
export interface EdgeCondition {
  type: 'always' | 'value' | 'expression' | 'probability';
  expression?: string;
  value?: any;
  probability?: number;
}

/**
 * Complete scenario configuration
 */
export interface ScenarioConfig {
  id: string;
  name: string;
  description?: string;
  version?: string;
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  metadata?: {
    author?: string;
    created?: string;
    tags?: string[];
    businessProcess?: string;
  };
}

// ============================================================================
// TOKEN AND DATA TYPES
// ============================================================================

/**
 * Data token that flows through the system
 */
export interface Token {
  id: string;
  value: any;
  type: TokenType;
  correlationIds: string[];
  metadata: TokenMetadata;
  timestamp: number;
  sourceNodeId: string;
  lineage: TokenLineageStep[];
}

/**
 * Token classification types
 */
export type TokenType =
  | 'data'           // Regular data token
  | 'control'        // Control flow token
  | 'batch'          // Batch collection token
  | 'error'          // Error handling token
  | 'heartbeat';     // System health token

/**
 * Token metadata for tracking and debugging
 */
export interface TokenMetadata {
  priority?: number;
  ttl?: number;
  retryCount?: number;
  batchId?: string;
  userId?: string;
  sessionId?: string;
  businessContext?: Record<string, any>;
}

/**
 * Token lineage tracking for audit trails
 */
export interface TokenLineageStep {
  nodeId: string;
  nodeType: NodeType;
  action: string;
  timestamp: number;
  inputValue: any;
  outputValue: any;
  processingTime: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// QUEUE AND ACTIVITY TYPES
// ============================================================================

/**
 * Queue snapshot for debugging and monitoring
 */
export interface QueueSnapshot {
  step: number;
  timestamp: number;
  timestamp: number;
  queueSize: number;
  processed: number;
  total: number;
  activeEvents: EventSummary[];
  performance: {
    avgProcessingTime: number;
    eventsPerSecond: number;
    memoryUsage?: number;
  };
}

/**
 * Simplified event summary for snapshots
 */
export interface EventSummary {
  id: string;
  type: EventType;
  timestamp: number;
  nodeId: string;
  priority: number;
}

/**
 * Activity log entry for business auditing
 */
export interface ActivityEntry {
  id: string;
  timestamp: number;
  timestamp: number;
  nodeId: string;
  nodeType: NodeType;
  action: string;
  value: any;
  correlationIds?: string[];
  metadata?: Record<string, any>;
}

/**
 * Activity summary for reporting
 */
export interface ActivitySummary {
  totalActivities: number;
  nodeActivityCounts: Record<string, number>;
  actionCounts: Record<string, number>;
  duration: number;
  startTime: number;
  endTime: number;
  tokensProcessed: number;
  errorsEncountered: number;
  businessMetrics?: Record<string, number>;
}

// ============================================================================
// ENGINE AND PROCESSOR TYPES
// ============================================================================

/**
 * Engine configuration options
 */
export interface EngineConfig {
  maxSteps?: number;
  maxTicks?: number;
  realTimeMode?: boolean;
  realTimeSpeed?: number;
  debugMode?: boolean;
  enableLineageTracking?: boolean;
  batchingEnabled?: boolean;
  timeoutHandling?: boolean;
}

/**
 * Engine runtime statistics
 */
export interface EngineStats {
  totalSteps: number;
  totalTicks: number;
  eventsProcessed: number;
  tokensCreated: number;
  processingTime: number;
  averageStepTime: number;
  memoryUsage?: number;
  errorCount: number;
  isComplete: boolean;
}

/**
 * Node internal state (managed by processors)
 */
export interface NodeInternalState {
  [key: string]: any;
  stepCount?: number;
  lastProcessedTick?: number;
  accumulatedTokens?: Token[];
  batchQueue?: Token[];
  errors?: Error[];
}


/**
 * Processor execution result
 */
export interface ProcessorResult {
  newEvents: Omit<EventData, 'id'>[];
  newState: NodeInternalState;
  activities: Omit<ActivityEntry, 'seq'>[];
  tokens?: Token[];
  errors?: Error[];
}

// ============================================================================
// MULTIPLEXER AND BATCHING TYPES
// ============================================================================

/**
 * Multiplexer configuration
 */
export interface MultiplexerConfig {
  strategy: MultiplexStrategy;
  targets: string[];
  loadBalancing?: LoadBalancingConfig;
  failureHandling?: FailureHandlingConfig;
}

/**
 * Multiplexing strategies
 */
export type MultiplexStrategy =
  | 'broadcast'      // Send to all targets
  | 'round_robin'    // Rotate between targets
  | 'random'         // Random target selection
  | 'load_balanced'  // Based on target load
  | 'conditional'    // Based on token content
  | 'weighted';      // Weighted distribution

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  metric: 'queue_size' | 'processing_time' | 'custom';
  weights?: Record<string, number>;
  customMetricFn?: string; // Function name or expression
}

/**
 * Failure handling configuration
 */
export interface FailureHandlingConfig {
  retryCount: number;
  retryDelay: number;
  fallbackTargets?: string[];
  deadLetterQueue?: string;
}

/**
 * Batcher configuration
 */
export interface BatcherConfig {
  batchSize: number;
  timeoutMs?: number;
  flushCondition?: BatchFlushCondition;
  ordering?: BatchOrdering;
}

/**
 * Batch flush conditions
 */
export interface BatchFlushCondition {
  type: 'size' | 'time' | 'condition';
  value?: number;
  expression?: string;
}

/**
 * Batch ordering strategies
 */
export type BatchOrdering = 'fifo' | 'lifo' | 'priority' | 'timestamp';

// ============================================================================
// VALIDATION AND ERROR TYPES
// ============================================================================

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

/**
 * System error types
 */
export interface SystemError extends Error {
  code: ErrorCode;
  nodeId?: string;
  timestamp?: number;
  correlationId?: string;
  recoverable: boolean;
  metadata?: Record<string, any>;
}

/**
 * Error classification codes
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROCESSING_ERROR'
  | 'TIMEOUT_ERROR'
  | 'MEMORY_ERROR'
  | 'NETWORK_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'BUSINESS_LOGIC_ERROR'
  | 'SYSTEM_ERROR';

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic callback function type
 */
export type Callback<T = any> = (data: T) => void | Promise<void>;

/**
 * Event listener function type
 */
export type EventListener<T = EventData> = (event: T) => void | Promise<void>;

/**
 * Predicate function type
 */
export type Predicate<T = any> = (item: T) => boolean;

/**
 * Transform function type
 */
export type Transform<TInput = any, TOutput = any> = (input: TInput) => TOutput;

/**
 * Async transform function type
 */
export type AsyncTransform<TInput = any, TOutput = any> = (input: TInput) => Promise<TOutput>;

/**
 * Utility type for making all properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Utility type for making specific properties required
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for configuration with defaults
 */
export type WithDefaults<T, D> = T & Required<D>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default values and limits
 */
export const DEFAULTS = {
  ENGINE: {
    MAX_STEPS: 1000,
    MAX_TICKS: 100000,
    REAL_TIME_SPEED: 1,
    DEBUG_MODE: false,
  },
  QUEUE: {
    MAX_SIZE: 10000,
    SNAPSHOT_INTERVAL: 100,
  },
  TOKENS: {
    DEFAULT_TTL: 3600000, // 1 hour
    MAX_LINEAGE_STEPS: 1000,
  },
  BATCHING: {
    DEFAULT_SIZE: 10,
    DEFAULT_TIMEOUT: 5000,
  },
  MULTIPLEXER: {
    DEFAULT_STRATEGY: 'round_robin' as MultiplexStrategy,
    MAX_TARGETS: 100,
  },
} as const;

/**
 * Priority levels for events and tokens
 */
export const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4,
} as const;

export type PriorityLevel = typeof PRIORITY[keyof typeof PRIORITY];