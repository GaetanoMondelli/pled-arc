/**
 * Core Interfaces for Event-Driven Simulation System
 *
 * These interfaces define the contracts between components in both
 * SDK and UI implementations. They ensure consistent behavior
 * across all system components.
 */

import {
  EventData,
  Token,
  NodeConfig,
  ScenarioConfig,
  NodeInternalState,
  ProcessorResult,
  ActivityEntry,
  QueueSnapshot,
  EngineConfig,
  EngineStats,
  ValidationResult,
  EventListener,
  Callback,
  MultiplexerConfig,
  BatcherConfig,
  NodeType,
  EventType,
} from '../types';

// ============================================================================
// CORE PROCESSOR INTERFACE
// ============================================================================

/**
 * Base interface that all node processors must implement
 */
export interface IProcessor {
  /** The type of node this processor handles */
  readonly nodeType: NodeType;

  /**
   * Initialize the internal state for a node
   */
  initializeState(nodeConfig: NodeConfig): NodeInternalState;

  /**
   * Process an incoming event and produce results
   */
  process(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState
  ): ProcessorResult;

  /**
   * Validate that an event can be processed by this processor
   */
  canProcess(event: EventData, nodeConfig: NodeConfig): boolean;

  /**
   * Get processor information and configuration schema
   */
  getProcessorInfo(): {
    nodeType: NodeType;
    description: string;
    supportedEvents: EventType[];
    configSchema: Record<string, any>;
    examples: Record<string, any>[];
  };

  /**
   * Clean up processor resources (optional)
   */
  cleanup?(nodeConfig: NodeConfig, state: NodeInternalState): void;
}

// ============================================================================
// QUEUE INTERFACE
// ============================================================================

/**
 * Event queue interface for managing simulation events
 */
export interface IActivityQueue {
  /**
   * Add an event to the queue
   */
  enqueue(eventData: Omit<EventData, 'id'>): EventData;

  /**
   * Remove and return the next event to process
   */
  dequeue(): EventData | null;

  /**
   * Peek at the next event without removing it
   */
  peek(): EventData | null;

  /**
   * Get the current queue size
   */
  size(): number;

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean;

  /**
   * Clear all events from the queue
   */
  clear(): void;

  /**
   * Take a snapshot of the current queue state
   */
  takeSnapshot(step: number, timestamp: number): QueueSnapshot;

  /**
   * Get all queue snapshots
   */
  getSnapshots(): QueueSnapshot[];

  /**
   * Get current queue state for monitoring
   */
  getCurrentState(): {
    size: number;
    nextTick: number | null;
    events: EventData[];
    performance: {
      avgProcessingTime: number;
      eventsPerSecond: number;
    };
  };

  /**
   * Validate queue integrity
   */
  validateQueue(): ValidationResult;

  /**
   * Get all events currently in the queue (for debugging)
   */
  getAllEvents(): EventData[];
}

// ============================================================================
// ACTIVITY LEDGER INTERFACE
// ============================================================================

/**
 * Activity logging interface for audit trails and business reporting
 */
export interface IActivityLedger {
  /**
   * Log a business activity
   */
  log(activity: Omit<ActivityEntry, 'id' | 'timestamp'>): ActivityEntry;

  /**
   * Get all logged activities
   */
  getActivities(): ActivityEntry[];

  /**
   * Get activities for a specific node
   */
  getActivitiesByNode(nodeId: string): ActivityEntry[];

  /**
   * Get activities within a time range
   */
  getActivitiesByTimeRange(startTick: number, endTick: number): ActivityEntry[];

  /**
   * Get activities for specific correlation IDs (token tracking)
   */
  getActivitiesByCorrelation(correlationIds: string[]): ActivityEntry[];

  /**
   * Trace a token's complete journey through the system
   */
  traceToken(correlationId: string): {
    journey: ActivityEntry[];
    summary: {
      totalSteps: number;
      duration: number;
      nodesVisited: string[];
      actionsPerformed: string[];
      startTime: number;
      endTime: number;
    };
  };

  /**
   * Get business summary statistics
   */
  getSummary(): {
    totalActivities: number;
    nodeActivityCounts: Record<string, number>;
    actionCounts: Record<string, number>;
    duration: number;
    tokensProcessed: number;
    businessMetrics: Record<string, number>;
  };

  /**
   * Clear all logged activities
   */
  clear(): void;

  /**
   * Validate ledger integrity
   */
  validateLedger(): ValidationResult;

  /**
   * Export activities in various formats
   */
  export(format: 'json' | 'csv' | 'business_report'): string;
}

// ============================================================================
// SCENARIO INTERFACE
// ============================================================================

/**
 * Scenario management interface
 */
export interface IScenario {
  /**
   * Get the complete scenario configuration
   */
  getConfig(): ScenarioConfig;

  /**
   * Get a specific node by ID
   */
  getNode(nodeId: string): NodeConfig | null;

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(nodeType: NodeType): NodeConfig[];

  /**
   * Get target node IDs for a given source node
   */
  getTargets(sourceNodeId: string): string[];

  /**
   * Get source node IDs for a given target node
   */
  getSources(targetNodeId: string): string[];

  /**
   * Validate the scenario configuration
   */
  validate(): ValidationResult;

  /**
   * Get scenario statistics
   */
  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodeTypeBreakdown: Record<NodeType, number>;
    startingNodes: string[];
    endingNodes: string[];
    maxDepth: number;
    hasCycles: boolean;
  };

  /**
   * Clone the scenario with optional modifications
   */
  clone(modifications?: Partial<ScenarioConfig>): IScenario;

  /**
   * Export scenario in various formats
   */
  export(format: 'json' | 'yaml' | 'graphviz'): string;
}

// ============================================================================
// SIMULATION ENGINE INTERFACE
// ============================================================================

/**
 * Main simulation engine interface
 */
export interface ISimulationEngine {
  /**
   * Initialize the engine with a scenario
   */
  initialize(scenarioConfig: ScenarioConfig): void;

  /**
   * Run the complete simulation
   */
  run(config?: EngineConfig): Promise<EngineStats>;

  /**
   * Execute a single simulation step
   */
  step(): Promise<EventData | null>;

  /**
   * Reset the engine to initial state
   */
  reset(): void;

  /**
   * Pause the simulation (for real-time mode)
   */
  pause(): void;

  /**
   * Resume a paused simulation
   */
  resume(): void;

  /**
   * Stop the simulation completely
   */
  stop(): void;

  /**
   * Get current engine status
   */
  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    currentStep: number;
    currentTick: number;
    completionPercentage: number;
    estimatedTimeRemaining?: number;
  };

  /**
   * Get runtime statistics
   */
  getStats(): EngineStats;

  /**
   * Get access to the activity queue
   */
  getQueue(): IActivityQueue;

  /**
   * Get access to the activity ledger
   */
  getLedger(): IActivityLedger;

  /**
   * Get access to the scenario
   */
  getScenario(): IScenario | null;

  /**
   * Validate current engine state
   */
  validateState(): ValidationResult;

  /**
   * Register event listeners
   */
  on(event: 'step' | 'complete' | 'error' | 'pause' | 'resume', listener: EventListener): void;

  /**
   * Unregister event listeners
   */
  off(event: 'step' | 'complete' | 'error' | 'pause' | 'resume', listener: EventListener): void;

  /**
   * Generate comprehensive report
   */
  generateReport(): {
    summary: EngineStats;
    queueAnalysis: QueueSnapshot[];
    activityAnalysis: ActivityEntry[];
    businessSummary: Record<string, any>;
    recommendations: string[];
  };

  /**
   * Print a human-readable report to console
   */
  printReport(): void;
}

// ============================================================================
// SPECIALIZED PROCESSOR INTERFACES
// ============================================================================

/**
 * Interface for multiplexer processors
 */
export interface IMultiplexerProcessor extends IProcessor {
  /**
   * Configure multiplexing strategy
   */
  setStrategy(strategy: MultiplexerConfig): void;

  /**
   * Get current load balancing information
   */
  getLoadInfo(): Record<string, { queueSize: number; avgProcessingTime: number; }>;

  /**
   * Handle target failure and rerouting
   */
  handleTargetFailure(targetNodeId: string, alternativeTargets: string[]): void;
}

/**
 * Interface for batch processors
 */
export interface IBatchProcessor extends IProcessor {
  /**
   * Configure batching behavior
   */
  setBatchConfig(config: BatcherConfig): void;

  /**
   * Get current batch status
   */
  getBatchStatus(): {
    currentBatchSize: number;
    timeUntilFlush: number;
    batchesProcessed: number;
    avgBatchSize: number;
  };

  /**
   * Force flush current batch
   */
  flushBatch(): Token[];
}


// ============================================================================
// FACTORY INTERFACES
// ============================================================================

/**
 * Interface for creating processors
 */
export interface IProcessorFactory {
  /**
   * Create a processor for a specific node type
   */
  createProcessor(nodeType: NodeType): IProcessor;

  /**
   * Register a custom processor
   */
  registerProcessor(nodeType: NodeType, processorClass: new () => IProcessor): void;

  /**
   * Get all available processor types
   */
  getAvailableProcessors(): Array<{
    nodeType: NodeType;
    description: string;
    configSchema: Record<string, any>;
  }>;
}

/**
 * Interface for creating scenarios
 */
export interface IScenarioFactory {
  /**
   * Create a scenario from configuration
   */
  createScenario(config: ScenarioConfig): IScenario;

  /**
   * Create a predefined scenario template
   */
  createTemplate(template: 'simple_pipeline' | 'complex_pipeline' | 'fsm_workflow'): IScenario;

  /**
   * Validate scenario configuration before creation
   */
  validateConfig(config: ScenarioConfig): ValidationResult;
}

// ============================================================================
// MONITORING AND DEBUGGING INTERFACES
// ============================================================================

/**
 * Interface for real-time monitoring
 */
export interface IMonitor {
  /**
   * Start monitoring the simulation
   */
  startMonitoring(engine: ISimulationEngine): void;

  /**
   * Stop monitoring
   */
  stopMonitoring(): void;

  /**
   * Get current metrics
   */
  getMetrics(): {
    performance: {
      eventsPerSecond: number;
      avgStepTime: number;
      memoryUsage: number;
    };
    business: {
      tokensProcessed: number;
      errorsEncountered: number;
      completionRate: number;
    };
    queue: {
      currentSize: number;
      avgSize: number;
      peakSize: number;
    };
  };

  /**
   * Set up alerts for specific conditions
   */
  setAlert(condition: string, callback: Callback): void;
}

/**
 * Interface for debugging tools
 */
export interface IDebugger {
  /**
   * Set breakpoints for specific events or nodes
   */
  setBreakpoint(condition: 'node' | 'event' | 'tick', value: string | number): void;

  /**
   * Step through simulation with debugging
   */
  stepDebug(): Promise<{
    event: EventData;
    beforeState: any;
    afterState: any;
    processingTime: number;
  }>;

  /**
   * Inspect current system state
   */
  inspect(): {
    queue: EventData[];
    nodeStates: Record<string, NodeInternalState>;
    recentActivities: ActivityEntry[];
  };

  /**
   * Get execution trace for debugging
   */
  getTrace(): Array<{
    step: number;
    event: EventData;
    duration: number;
    changes: string[];
  }>;
}

// ============================================================================
// INTEGRATION INTERFACES
// ============================================================================

/**
 * Interface for UI integration
 */
export interface IUIAdapter {
  /**
   * Convert engine state to UI-friendly format
   */
  getUIState(): {
    nodes: Array<{ id: string; status: string; position: { x: number; y: number } }>;
    edges: Array<{ id: string; active: boolean; flowRate: number }>;
    queue: Array<{ id: string; type: string; priority: number }>;
    activities: Array<{ id: string; message: string; timestamp: number }>;
  };

  /**
   * Handle UI interactions
   */
  handleUIAction(action: string, payload: any): void;

  /**
   * Subscribe to state changes for real-time updates
   */
  onStateChange(callback: Callback): void;
}

/**
 * Interface for external system integration
 */
export interface IExternalAdapter {
  /**
   * Import data from external systems
   */
  importData(source: string, format: string): Promise<any>;

  /**
   * Export results to external systems
   */
  exportResults(destination: string, format: string, data: any): Promise<void>;

  /**
   * Set up real-time data feeds
   */
  setupDataFeed(source: string, callback: Callback): void;
}

// ============================================================================
// UTILITY INTERFACES
// ============================================================================

/**
 * Interface for configuration management
 */
export interface IConfigManager {
  /**
   * Load configuration from various sources
   */
  loadConfig(source: 'file' | 'url' | 'database', path: string): Promise<any>;

  /**
   * Save configuration
   */
  saveConfig(config: any, destination: string): Promise<void>;

  /**
   * Validate configuration
   */
  validateConfig(config: any, schema: any): ValidationResult;

  /**
   * Merge configurations with precedence rules
   */
  mergeConfigs(...configs: any[]): any;
}

/**
 * Interface for plugin system
 */
export interface IPlugin {
  /**
   * Plugin metadata
   */
  readonly name: string;
  readonly version: string;
  readonly description: string;

  /**
   * Initialize the plugin
   */
  initialize(engine: ISimulationEngine): void;

  /**
   * Clean up plugin resources
   */
  cleanup(): void;

  /**
   * Handle plugin-specific events
   */
  handleEvent(event: string, data: any): void;
}

/**
 * Interface for plugin manager
 */
export interface IPluginManager {
  /**
   * Register a plugin
   */
  registerPlugin(plugin: IPlugin): void;

  /**
   * Load plugins from directory
   */
  loadPlugins(directory: string): Promise<void>;

  /**
   * Get all registered plugins
   */
  getPlugins(): IPlugin[];

  /**
   * Enable/disable plugins
   */
  enablePlugin(name: string): void;
  disablePlugin(name: string): void;
}