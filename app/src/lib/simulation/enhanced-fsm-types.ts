import { z } from "zod";

/**
 * Enhanced FSM Node Type Definitions
 *
 * This file defines the enhanced FSM node architecture that supports:
 * 1. Dual input streams: Events (raw data) and Messages (structured tokens)
 * 2. Flexible event interpretation rules
 * 3. Enhanced action system with output routing
 * 4. Feedback loop capabilities
 */

// ============================================================================
// Local Interface Schema (to avoid circular dependency)
// ============================================================================

export const InterfaceSchema = z.object({
  type: z.string(),
  requiredFields: z.array(z.string()),
});
export type Interface = z.infer<typeof InterfaceSchema>;

// ============================================================================
// Event vs Message Distinction
// ============================================================================

export const EventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  rawData: z.any(),
  metadata: z.record(z.string(), z.any()).optional(),
  sourceType: z.enum(["external", "internal", "feedback"]).default("external"),
  processingHints: z.record(z.string(), z.any()).optional(),
});
export type Event = z.infer<typeof EventSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
  payload: z.record(z.string(), z.any()),
  sourceEventId: z.string().optional(),
  interpretationRuleId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Event Interpretation Rules
// ============================================================================

export const EventInterpretationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().default(100),
  conditions: z.object({
    eventTypes: z.array(z.string()).optional(),
    eventPattern: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    sourceTypes: z.array(z.enum(["external", "internal", "feedback"])).optional(),
  }),
  method: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("pattern"),
      patterns: z.array(z.object({
        pattern: z.string(),
        messageType: z.string(),
        extractFields: z.record(z.string(), z.string()).optional(),
      })),
    }),
    z.object({
      type: z.literal("formula"),
      formula: z.string(),
      messageType: z.string(),
    }),
    z.object({
      type: z.literal("ai"),
      model: z.string().optional(),
      prompt: z.string(),
      messageTypes: z.array(z.string()),
      confidenceThreshold: z.number().min(0).max(1).default(0.8),
    }),
    z.object({
      type: z.literal("script"),
      script: z.string(),
      messageType: z.string(),
    }),
    z.object({
      type: z.literal("passthrough"),
      messageType: z.string(),
      fieldMapping: z.record(z.string(), z.string()).optional(),
    }),
  ]),
});
export type EventInterpretationRule = z.infer<typeof EventInterpretationRuleSchema>;

// ============================================================================
// Enhanced Action System
// ============================================================================

export const ActionOutputSchema = z.object({
  id: z.string(),
  type: z.discriminatedUnion("outputType", [
    z.object({
      outputType: z.literal("event"),
      eventType: z.string(),
      data: z.record(z.string(), z.any()),
      targetStream: z.enum(["self", "external"]).default("self"),
    }),
    z.object({
      outputType: z.literal("message"),
      messageType: z.string(),
      payload: z.record(z.string(), z.any()),
      targetNodeId: z.string().optional(),
    }),
    z.object({
      outputType: z.literal("token"),
      formula: z.string(),
      destinationNodeId: z.string().optional(),
      destinationInputName: z.string().optional(),
    }),
    z.object({
      outputType: z.literal("api_call"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      url: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.record(z.string(), z.any()).optional(),
      responseMapping: z.record(z.string(), z.string()).optional(),
    }),
    z.object({
      outputType: z.literal("log"),
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
      message: z.string(),
    }),
    z.object({
      outputType: z.literal("email"),
      to: z.string(),
      subject: z.string(),
      body: z.string(),
      attachments: z.array(z.string()).optional(),
    }),
    z.object({
      outputType: z.literal("variable"),
      variableName: z.string(),
      value: z.any(),
      operation: z.enum(["set", "increment", "append"]).default("set"),
    }),
  ]),
  condition: z.string().optional(),
  delay: z.number().optional(),
});
export type ActionOutput = z.infer<typeof ActionOutputSchema>;

export const EnhancedFSMActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  trigger: z.enum(["onEntry", "onExit", "onTransition", "onMessage", "onEvent"]),
  outputs: z.array(ActionOutputSchema),
  onError: z.enum(["stop", "continue", "retry"]).default("continue"),
  retryCount: z.number().default(0),
  timeout: z.number().default(5000),
});
export type EnhancedFSMAction = z.infer<typeof EnhancedFSMActionSchema>;

// ============================================================================
// Feedback Loop Management
// ============================================================================

export const FeedbackLoopConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxDepth: z.number().default(10),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().default(100),
    timeWindow: z.number().default(60000),
    cooldownPeriod: z.number().default(30000),
  }),
  routing: z.object({
    allowSelfFeedback: z.boolean().default(true),
    allowExternalFeedback: z.boolean().default(true),
    blacklistedNodes: z.array(z.string()).default([]),
  }),
});
export type FeedbackLoopConfig = z.infer<typeof FeedbackLoopConfigSchema>;

// ============================================================================
// Enhanced FSM Definition
// ============================================================================

export const EnhancedFSMStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["initial", "intermediate", "final", "error"]).default("intermediate"),
  timeout: z.number().optional(),
  variables: z.record(z.string(), z.any()).optional(),
  actions: z.array(EnhancedFSMActionSchema).optional(),
});
export type EnhancedFSMState = z.infer<typeof EnhancedFSMStateSchema>;

export const EnhancedFSMTransitionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  trigger: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("message"),
      messageType: z.string(),
      condition: z.string().optional(),
    }),
    z.object({
      type: z.literal("event"),
      eventType: z.string(),
      condition: z.string().optional(),
    }),
    z.object({
      type: z.literal("timer"),
      timeout: z.number(),
    }),
    z.object({
      type: z.literal("condition"),
      condition: z.string(),
    }),
    z.object({
      type: z.literal("manual"),
      description: z.string().optional(),
    }),
  ]),
  actions: z.array(EnhancedFSMActionSchema).optional(),
  guard: z.string().optional(),
  priority: z.number().default(100),
});
export type EnhancedFSMTransition = z.infer<typeof EnhancedFSMTransitionSchema>;

export const EnhancedFSMDefinitionSchema = z.object({
  states: z.array(EnhancedFSMStateSchema),
  transitions: z.array(EnhancedFSMTransitionSchema),
  initialState: z.string(),
  variables: z.record(z.string(), z.any()).optional(),
  interpretationRules: z.array(EventInterpretationRuleSchema),
  feedbackConfig: FeedbackLoopConfigSchema.optional(),
  outputs: z.array(z.object({
    name: z.string(),
    interface: InterfaceSchema,
    description: z.string().optional(),
  })).optional(),
});
export type EnhancedFSMDefinition = z.infer<typeof EnhancedFSMDefinitionSchema>;

// ============================================================================
// Enhanced Input/Output Definitions
// ============================================================================

export const EventInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  bufferSize: z.number().default(1000),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const MessageInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  messageTypes: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  interface: InterfaceSchema,
  bufferSize: z.number().default(100),
});
export type MessageInput = z.infer<typeof MessageInputSchema>;

// ============================================================================
// Enhanced FSM Process Node (Schema only - no imports)
// ============================================================================

// Define base node schema locally to avoid circular dependency
const LocalBaseNodeSchema = z.object({
  nodeId: z.string(),
  displayName: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  isCollapsed: z.boolean().optional(),
});

const LocalInputV3Schema = z.object({
  name: z.string(),
  nodeId: z.string().optional(),
  sourceOutputName: z.string().optional(),
  interface: InterfaceSchema,
  alias: z.string().optional(),
  required: z.boolean(),
});

export const EnhancedFSMProcessNodeSchema = LocalBaseNodeSchema.extend({
  type: z.literal("EnhancedFSMProcessNode"),
  eventInputs: z.array(EventInputSchema).default([]),
  messageInputs: z.array(MessageInputSchema).default([]),
  tokenInputs: z.array(LocalInputV3Schema).default([]),
  fsm: EnhancedFSMDefinitionSchema,
  fsl: z.string().optional(),
  config: z.object({
    debugMode: z.boolean().default(false),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    enableMetrics: z.boolean().default(true),
    maxEventHistory: z.number().default(1000),
    maxMessageHistory: z.number().default(1000),
  }).optional(),
  version: z.string().default("1.0"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type EnhancedFSMProcessNode = z.infer<typeof EnhancedFSMProcessNodeSchema>;

// ============================================================================
// Runtime State Definitions
// ============================================================================

export interface EnhancedFSMProcessNodeState {
  currentState: string;
  previousState?: string;
  stateChangedAt: number;
  variables: Record<string, any>;
  stateVariables: Record<string, any>;
  eventBuffer: Event[];
  messageBuffer: Message[];
  tokenBuffers: Record<string, any[]>;
  lastProcessedTime: number;
  processedEventCount: number;
  processedMessageCount: number;
  feedbackDepth: number;
  circuitBreakerState: {
    isOpen: boolean;
    eventCount: number;
    windowStartTime: number;
    lastTriggerTime?: number;
  };
  stateHistory: Array<{
    state: string;
    enteredAt: number;
    exitedAt?: number;
    trigger?: string;
  }>;
  transitionHistory: Array<{
    from: string;
    to: string;
    timestamp: number;
    trigger: string;
    messageId?: string;
    eventId?: string;
  }>;
  pendingActions: Array<{
    actionId: string;
    scheduledAt: number;
    executeAt: number;
    context: any;
  }>;
  actionHistory: Array<{
    actionId: string;
    executedAt: number;
    result: "success" | "error" | "timeout";
    output?: any;
    error?: string;
  }>;
  errors: Array<{
    timestamp: number;
    type: string;
    message: string;
    context?: any;
  }>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface InterpretationResult {
  messages: Message[];
  confidence?: number;
  error?: string;
  processingTime: number;
}

export interface ActionExecutionResult {
  actionId: string;
  success: boolean;
  outputs: Array<{
    type: string;
    data: any;
    error?: string;
  }>;
  executionTime: number;
  error?: string;
}

export interface FeedbackLoop {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  outputType: string;
  createdAt: number;
  depth: number;
}