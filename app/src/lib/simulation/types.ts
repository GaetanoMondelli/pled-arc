import { z } from "zod";

// Basic Enhanced FSM schema to avoid circular dependency
export const EnhancedFSMProcessNodeSchema = z.object({
  nodeId: z.string(),
  type: z.literal("EnhancedFSMProcessNode"),
  displayName: z.string(),
  x: z.number(),
  y: z.number(),
  eventInputs: z.array(z.any()).default([]),
  messageInputs: z.array(z.any()).default([]),
  tokenInputs: z.array(z.any()).default([]),
  outputs: z.array(z.any()).default([]),
  fsm: z.any(), // Simplified to avoid complexity
});

export interface EnhancedFSMProcessNodeState {
  currentState: string;
  previousState?: string;
  stateChangedAt: number;
  variables: Record<string, any>;
  stateVariables: Record<string, any>;
  eventBuffer: any[];
  messageBuffer: any[];
  tokenBuffers: Record<string, any[]>;
  lastProcessedTime: number;
  processedEventCount: number;
  processedMessageCount: number;
  feedbackDepth: number;
  circuitBreakerState: {
    isOpen: boolean;
    eventCount: number;
    windowStartTime: number;
  };
  stateHistory: Array<{
    state: string;
    enteredAt: number;
  }>;
  transitionHistory: any[];
  pendingActions: any[];
  actionHistory: any[];
  errors: any[];
}

export const SourceTokenSummarySchema = z.object({
  id: z.string(),
  originNodeId: z.string(),
  originalValue: z.any(),
  createdAt: z.number(),
  // Enhanced lineage tracking - recursive source token details
  completeLineage: z.array(z.string()).optional(), // Array of ancestor token IDs back to sources
  generationLevel: z.number().optional(), // 0 for DataSource tokens, 1+ for derived
  ultimateSources: z.array(z.string()).optional(), // Token IDs of all ultimate source tokens
});
export type SourceTokenSummary = z.infer<typeof SourceTokenSummarySchema>;

// Enhanced aggregation details for detailed calculation breakdowns
export const AggregationDetailsSchema = z.object({
  method: z.enum(["sum", "average", "count", "first", "last"]),
  inputTokens: z.array(
    z.object({
      tokenId: z.string(),
      value: z.any(),
      contribution: z.number(), // For average: value/count, for sum: value/total, etc.
    }),
  ),
  calculation: z.string(), // e.g., "avg(5, 7, 9) = (5+7+9)/3 = 21/3 = 7"
  resultValue: z.any(),
});
export type AggregationDetails = z.infer<typeof AggregationDetailsSchema>;

// Enhanced transformation details for ProcessNode operations
export const TransformationDetailsSchema = z.object({
  formula: z.string(),
  inputMapping: z.record(z.string(), z.any()), // Maps input node IDs to their token values
  calculation: z.string(), // Human-readable calculation breakdown
  resultValue: z.any(),
});
export type TransformationDetails = z.infer<typeof TransformationDetailsSchema>;

// Lineage metadata for tracking generation levels and ultimate sources
export const LineageMetadataSchema = z.object({
  generationLevel: z.number(), // 0 for DataSource tokens, 1+ for derived tokens
  ultimateSources: z.array(z.string()), // Token IDs of all ultimate source tokens
  operationType: z.enum(["creation", "aggregation", "transformation", "consumption", "transfer"]),
});
export type LineageMetadata = z.infer<typeof LineageMetadataSchema>;

export const HistoryEntrySchema = z.object({
  timestamp: z.number(), // Simulation time
  epochTimestamp: z.number(), // Real-world event time
  sequence: z.number(), // Monotonically increasing event counter
  nodeId: z.string(),
  action: z.string(),
  value: z.any().optional(),
  sourceTokenIds: z.array(z.string()).optional(),
  sourceTokenSummaries: z.array(SourceTokenSummarySchema).optional(),
  details: z.string().optional(),

  // FSM STATE - SINGLE SOURCE OF TRUTH
  state: z.string(), // Current FSM state when this action occurred
  bufferSize: z.number().optional(), // Input buffer size at time of action
  outputBufferSize: z.number().optional(), // Output buffer size at time of action

  // EVENT TYPE - NEW: Distinguish external vs execution events
  eventType: z.enum(["external_event", "execution_event"]).optional(),

  // Enhanced lineage tracking fields
  operationType: z.enum(["creation", "aggregation", "transformation", "consumption", "transfer"]).optional(),
  aggregationDetails: AggregationDetailsSchema.optional(),
  transformationDetails: TransformationDetailsSchema.optional(),
  lineageMetadata: LineageMetadataSchema.optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const TokenSchema = z.object({
  id: z.string(),
  value: z.any(),
  createdAt: z.number(), // Simulation time
  history: z.array(HistoryEntrySchema),
  originNodeId: z.string(),
});
export type Token = z.infer<typeof TokenSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

const BaseNodeSchema = z.object({
  nodeId: z.string(),
  displayName: z.string(),
  position: PositionSchema,
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  isCollapsed: z.boolean().optional(),
});

// V3 Schema Components
export const InterfaceSchema = z.object({
  type: z.string(),
  requiredFields: z.array(z.string()),
});
export type Interface = z.infer<typeof InterfaceSchema>;

export const GenerationConfigSchema = z.object({
  type: z.string(),
  valueMin: z.number(),
  valueMax: z.number(),
  // Support for hardcoded values (circular pattern)
  hardcodedValue: z.any().optional(),
  hardcodedValues: z.array(z.any()).optional(),
});
export type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

export const AggregationTriggerSchema = z.object({
  type: z.string(),
  window: z.number().positive(),
});
export type AggregationTrigger = z.infer<typeof AggregationTriggerSchema>;

export const AggregationConfigSchema = z.object({
  method: z.string(),
  formula: z.string(),
  trigger: AggregationTriggerSchema,
});
export type AggregationConfig = z.infer<typeof AggregationConfigSchema>;

export const TransformationConfigSchema = z.object({
  formula: z.string(),
  fieldMapping: z.record(z.string(), z.string()),
});
export type TransformationConfig = z.infer<typeof TransformationConfigSchema>;

// V3 Input/Output schemas
export const InputV3Schema = z.object({
  name: z.string(),
  nodeId: z.string().optional(),
  sourceOutputName: z.string().optional(),
  interface: InterfaceSchema,
  alias: z.string().optional(),
  required: z.boolean(),
});
export type InputV3 = z.infer<typeof InputV3Schema>;

export const OutputV3Schema = z.object({
  name: z.string(),
  destinationNodeId: z.string(),
  destinationInputName: z.string(),
  interface: InterfaceSchema,
  transformation: TransformationConfigSchema.optional(),
});
export type OutputV3 = z.infer<typeof OutputV3Schema>;

// DataSource Schema
export const DataSourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal("DataSource"),
  interval: z.number().positive(),
  outputs: z.array(OutputV3Schema),
  generation: GenerationConfigSchema,
});
export type DataSourceNode = z.infer<typeof DataSourceNodeSchema>;

// Queue Schema
export const QueueNodeSchema = BaseNodeSchema.extend({
  type: z.literal("Queue"),
  inputs: z.array(InputV3Schema),
  outputs: z.array(OutputV3Schema),
  aggregation: AggregationConfigSchema,
  capacity: z.number().positive().optional(),
});
export type QueueNode = z.infer<typeof QueueNodeSchema>;

// ProcessNode Schema
export const ProcessNodeSchema = BaseNodeSchema.extend({
  type: z.literal("ProcessNode"),
  inputs: z.array(InputV3Schema),
  outputs: z.array(OutputV3Schema),
});
export type ProcessNode = z.infer<typeof ProcessNodeSchema>;

// FSM State Actions - cleaner mapping like ProcessNode outputs
export const FSMStateActionsSchema = z.object({
  onEntry: z.record(z.string(), z.string()).optional(), // output_name: formula
  onExit: z.record(z.string(), z.string()).optional(), // output_name: formula
  logs: z.array(z.string()).optional(), // log messages
});
export type FSMStateActions = z.infer<typeof FSMStateActionsSchema>;

// FSM Transition Definition
export const FSMTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string(), // "token_received", "timer", "condition"
  condition: z.string().optional(), // formula to evaluate for conditional triggers
  guard: z.string().optional(), // additional guard condition
});
export type FSMTransition = z.infer<typeof FSMTransitionSchema>;

// FSM Output Configuration - dynamically inferred from emit actions
export const FSMOutputConfigSchema = z.object({
  name: z.string(), // output name referenced in emit actions
  interface: InterfaceSchema,
  destinationNodeId: z.string().optional(), // can be connected later
  destinationInputName: z.string().optional(),
});
export type FSMOutputConfig = z.infer<typeof FSMOutputConfigSchema>;

// FSM Definition - much cleaner structure
// State can be either a simple string or an object with actions
export const FSMStateSchema = z.union([
  z.string(), // Simple state name like "idle"
  z.object({
    name: z.string(),
    onEntry: z.any().optional(), // Actions on state entry (flexible format)
    onExit: z.any().optional(),  // Actions on state exit (flexible format)
  })
]);

export const FSMDefinitionSchema = z.object({
  states: z.array(FSMStateSchema), // States can be strings or objects with actions
  initialState: z.string(), // clearly defined initial state
  transitions: z.array(FSMTransitionSchema),
  variables: z.record(z.string(), z.any()).optional(), // state variables
  stateActions: z.record(z.string(), FSMStateActionsSchema).optional(), // state_name: actions (legacy)
  outputs: z.array(z.string()).optional(), // output names that can be emitted
});
export type FSMDefinition = z.infer<typeof FSMDefinitionSchema>;

// FSMProcessNode Schema - native FSL-based processing node
export const FSMProcessNodeSchema = BaseNodeSchema.extend({
  type: z.literal("FSMProcessNode"),
  inputs: z.array(InputV3Schema),
  outputs: z.array(OutputV3Schema).optional(), // CRITICAL: FSM can have outputs for state changes
  fsm: FSMDefinitionSchema, // Native FSL definition with dynamic outputs
  fsl: z.string().optional(), // Raw FSL string for display/editing
});
export type FSMProcessNode = z.infer<typeof FSMProcessNodeSchema>;

// Sink Schema
export const SinkNodeSchema = BaseNodeSchema.extend({
  type: z.literal("Sink"),
  inputs: z.array(InputV3Schema),
});
export type SinkNode = z.infer<typeof SinkNodeSchema>;

// Module Node Schema - contains a sub-graph that can be collapsed/expanded
export const ModuleNodeSchema = BaseNodeSchema.extend({
  type: z.literal("Module"),
  // Interface definition - external inputs and outputs for the module
  inputs: z.array(InputV3Schema),
  outputs: z.array(OutputV3Schema),
  // The internal sub-graph - full scenario definition
  subGraph: z.object({
    nodes: z.array(z.lazy(() => AnyNodeSchema)), // Recursive reference to allow nested modules
    // Optional metadata
    version: z.string().default("3.0"),
  }),
  // UI state for collapse/expand
  isExpanded: z.boolean().default(false),
  // Optional module metadata
  moduleDescription: z.string().optional(),
  moduleVersion: z.string().default("1.0"),
  // Module library info (for reusable modules)
  isLibraryModule: z.boolean().default(false),
  libraryCategory: z.string().optional(),
});
export type ModuleNode = z.infer<typeof ModuleNodeSchema>;

// Group Node Schema for managing visual complexity
export const GroupNodeSchema = BaseNodeSchema.extend({
  type: z.literal("Group"),
  groupName: z.string(),
  groupColor: z.string().default("#6366f1"), // Default indigo color
  groupDescription: z.string().optional(),
  containedNodes: z.array(z.string()), // Array of nodeIds within this group
  isCollapsed: z.boolean().default(false),
  // Group inputs/outputs are computed from contained nodes
  inputs: z.array(InputV3Schema).optional(),
  outputs: z.array(OutputV3Schema).optional(),
  // Visual bounds for positioning
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});
export type GroupNode = z.infer<typeof GroupNodeSchema>;

// FSM Node Schema (simplified FSM)
export const FSMNodeSchema = BaseNodeSchema.extend({
  type: z.literal("FSM"),
  config: z.object({
    initialState: z.string(),
    states: z.record(z.object({
      on: z.record(z.union([
        z.string(),
        z.object({
          target: z.string(),
          actions: z.array(z.object({
            type: z.string(),
            target: z.string().optional(),
            value: z.any().optional(),
            formula: z.string().optional()
          })).optional()
        })
      ])).optional(),
      actions: z.object({
        onEntry: z.array(z.object({
          type: z.string(),
          target: z.string().optional(),
          value: z.any().optional()
        })).optional(),
        onExit: z.array(z.object({
          type: z.string(),
          target: z.string().optional(),
          value: z.any().optional()
        })).optional()
      }).optional()
    }))
  }),
  inputs: z.array(z.any()).optional(),
  outputs: z.array(z.any()).optional()
});
export type FSMNode = z.infer<typeof FSMNodeSchema>;


// Union type for all nodes
export const AnyNodeSchema = z.union([DataSourceNodeSchema, QueueNodeSchema, ProcessNodeSchema, FSMProcessNodeSchema, EnhancedFSMProcessNodeSchema, FSMNodeSchema, SinkNodeSchema, ModuleNodeSchema, GroupNodeSchema]);
export type AnyNode = z.infer<typeof AnyNodeSchema>;

// Scenario Schema
export const ScenarioSchema = z.object({
  // Protocol V3 only; default to "3.0" if missing
  version: z.literal("3.0").default("3.0"),
  nodes: z.array(AnyNodeSchema),
  // Group configuration for managing visual complexity
  groups: z.object({
    tags: z.array(z.object({
      name: z.string(),
      color: z.string(),
      description: z.string().optional(),
    })).optional(),
    visualMode: z.enum(["all", "grouped", "filtered"]).default("all"),
    activeFilters: z.array(z.string()).optional(), // Active tag filters
    groupPositions: z.record(z.object({
      x: z.number(),
      y: z.number(),
    })).optional(), // Deprecated: now stored in GroupNode.position
  }).optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// State machine state definitions
export type NodeStateMachineState =
  | "source_idle" | "source_generating" | "source_emitting" | "source_waiting"
  | "queue_idle" | "queue_accumulating" | "queue_processing" | "queue_emitting"
  | "process_idle" | "process_collecting" | "process_ready" | "process_evaluating" | "process_outputting"
  | "splitter_idle" | "splitter_evaluating" | "splitter_route_output1" | "splitter_route_output2"
  | "sink_idle" | "sink_processing"
  | string; // Allow custom FSM states for FSMProcessNode

export interface StateMachineInfo {
  currentState: NodeStateMachineState;
  previousState?: NodeStateMachineState;
  stateChangedAt?: number;
  transitionHistory: Array<{
    from: NodeStateMachineState;
    to: NodeStateMachineState;
    timestamp: number;
    trigger?: string;
  }>;
}

// Simulation-specific state types
export interface NodeState {
  lastProcessedTime?: number;
  // State machine tracking
  stateMachine?: StateMachineInfo;
  [key: string]: any;
}

export interface DataSourceState extends NodeState {
  lastEmissionTime: number;
}

export interface QueueState extends NodeState {
  inputBuffer: Token[];
  outputBuffer: Token[];
  lastAggregationTime: number;
}

export interface ProcessNodeState extends NodeState {
  inputBuffers: Record<string, Token[]>;
  lastFiredTime?: number;
}

export interface FSMProcessNodeState extends NodeState {
  inputBuffers: Record<string, Token[]>;
  fsmVariables: Record<string, any>; // FSM state variables
  currentFSMState: string; // Current state in the FSM definition
  lastTransitionTime?: number;
}

export interface SinkState extends NodeState {
  consumedTokenCount: number;
  lastConsumedTime?: number;
  consumedTokens: Token[];
}

export interface ModuleState extends NodeState {
  // Input/output buffers for the module's interface
  inputBuffers: Record<string, Token[]>; // Tokens waiting at module inputs
  outputBuffers: Record<string, Token[]>; // Tokens ready to be sent from module outputs
  // Internal simulation state for the sub-graph
  subGraphStates: Record<string, AnyNodeState>; // Node states within the module
  // UI state
  isExpanded: boolean;
  // Execution state
  lastProcessedTime?: number;
  processedTokenCount: number;
  // Performance tracking
  internalEventCounter: number;
}

export interface FSMState extends NodeState {
  currentState: string;
  variables: Record<string, any>;
  inputBuffer: Token[];
  outputBuffer: Token[];
  stateHistory: Array<{
    timestamp: number;
    fromState: string;
    toState: string;
    event: string;
  }>;
}

export interface MultiplexerState extends NodeState {
  // Input buffers for processing
  inputBuffers: Record<string, Token[]>;
  // Output tracking
  lastRoutedTime?: number;
  routedTokenCount: number;
  // Route match tracking
  lastMatchedRoutes: string[];
}

export type AnyNodeState = DataSourceState | QueueState | ProcessNodeState | FSMProcessNodeState | EnhancedFSMProcessNodeState | FSMState | SinkState | ModuleState | MultiplexerState;

// For React Flow
export interface RFNodeData {
  label: string;
  type: AnyNode["type"];
  config: AnyNode;
  isActive?: boolean;
  error?: string;
  details?: string;
  // State machine information for display
  stateMachine?: {
    currentState: NodeStateMachineState;
    stateDisplayName?: string;
    transitionCount?: number;
  };
  // Group-specific data
  nodeCount?: number;
  nodeState?: any; // For FSM nodes
}

export interface RFEdgeData {
  animated?: boolean;
}
