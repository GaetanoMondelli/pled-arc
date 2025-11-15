/**
 * V3 Schema Validation for DocuSign Unlocked
 *
 * This module provides validation for the V3 schema format used by both
 * frontend UI and backend processors. It ensures consistency between
 * UI node configurations and backend processing.
 */

import { z } from 'zod';

// ============================================================================
// V3 SCHEMA DEFINITIONS
// ============================================================================

export const PositionSchema = z.object({
  x: z.number().describe('X coordinate for node positioning in the visual editor'),
  y: z.number().describe('Y coordinate for node positioning in the visual editor'),
});

export const InterfaceSchema = z.object({
  type: z.enum(['SimpleValue', 'AggregationResult', 'TransformationResult', 'Any'])
    .describe('Interface type defining the expected data structure'),
  requiredFields: z.array(z.string())
    .describe('Array of field paths that must be present in the data'),
});

export const GenerationConfigSchema = z.object({
  type: z.enum(['random', 'sequence', 'constant'])
    .describe('Type of value generation strategy'),
  valueMin: z.number().describe('Minimum value for random generation'),
  valueMax: z.number().describe('Maximum value for random generation'),
  hardcodedValue: z.any().optional().describe('Single hardcoded value for constant generation'),
  hardcodedValues: z.array(z.any()).optional().describe('Array of hardcoded values for cycling'),
});

export const AggregationTriggerSchema = z.object({
  type: z.enum(['time', 'count', 'threshold'])
    .describe('Trigger mechanism for aggregation processing'),
  window: z.number().min(0)
    .describe('Time window in seconds or count threshold for triggering aggregation'),
});

export const AggregationConfigSchema = z.object({
  method: z.enum(['sum', 'average', 'count', 'first', 'last', 'min', 'max'])
    .describe('Aggregation method to apply to input data'),
  formula: z.string().describe('Mathematical formula for aggregation calculation'),
  trigger: AggregationTriggerSchema,
});

export const TransformationConfigSchema = z.object({
  formula: z.string().describe('Mathematical transformation formula'),
  fieldMapping: z.record(z.string())
    .describe('Maps output field paths to transformation expressions'),
});

export const InputSchema = z.object({
  name: z.string().describe('Unique identifier for this input within the node'),
  nodeId: z.string().optional().describe('Source node ID for this input connection'),
  sourceOutputName: z.string().optional().describe('Name of the output from the source node'),
  interface: InterfaceSchema,
  alias: z.string().optional().describe('Alias name for referencing this input in formulas'),
  required: z.boolean().describe('Whether this input is required for node processing'),
});

export const OutputSchema = z.object({
  name: z.string().describe('Unique identifier for this output within the node'),
  destinationNodeId: z.string().describe('Target node ID for this output connection'),
  destinationInputName: z.string().describe('Name of the input on the destination node'),
  interface: InterfaceSchema,
  transformation: TransformationConfigSchema.optional()
    .describe('Optional transformation to apply to output data'),
});

export const BaseNodeSchema = z.object({
  nodeId: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .describe('Unique identifier for the node'),
  displayName: z.string().describe('Human-readable name displayed in the editor'),
  position: PositionSchema,
  type: z.enum(['DataSource', 'Queue', 'ProcessNode', 'FSMProcessNode', 'Sink', 'Multiplexer']),
});

// ============================================================================
// V3 NODE TYPE SCHEMAS
// ============================================================================

export const DataSourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('DataSource'),
  interval: z.number().min(0.1)
    .describe('Time interval in seconds between data generation'),
  outputs: z.array(OutputSchema).describe('Array of output connections'),
  generation: GenerationConfigSchema,
});

export const QueueNodeSchema = BaseNodeSchema.extend({
  type: z.literal('Queue'),
  inputs: z.array(InputSchema).describe('Array of input connections'),
  outputs: z.array(OutputSchema).describe('Array of output connections'),
  aggregation: AggregationConfigSchema,
  capacity: z.number().min(1).optional()
    .describe('Maximum number of tokens the queue can hold'),
});

export const ProcessingConfigSchema = z.object({
  type: z.enum(['transform', 'aggregation']).describe('Type of processing to perform'),
  formula: z.string().optional().describe('JavaScript formula for data transformation'),
  aiPrompt: z.string().optional().describe('AI prompt for data transformation'),
  description: z.string().optional().describe('Optional description of the processing logic'),
}).refine((data) => data.formula || data.aiPrompt, {
  message: "Either formula or aiPrompt must be provided",
  path: ["formula", "aiPrompt"],
});

export const ProcessNodeSchema = BaseNodeSchema.extend({
  type: z.literal('ProcessNode'),
  inputs: z.array(InputSchema).describe('Array of input connections'),
  outputs: z.array(OutputSchema).describe('Array of output connections'),
  processing: ProcessingConfigSchema.optional().describe('Processing configuration for this node (newer V3 format)'),
}).refine((data) => {
  // Either processing field is provided, or outputs have transformations (older V3 format)
  const hasProcessing = data.processing !== undefined;
  const hasOutputTransformations = data.outputs.some((output: any) => output.transformation !== undefined);
  return hasProcessing || hasOutputTransformations;
}, {
  message: "ProcessNode must have either 'processing' field or 'transformation' in outputs",
  path: ["processing"],
});

export const FSMActionSchema = z.object({
  action: z.enum(['emit', 'log', 'set_variable', 'increment', 'decrement'])
    .describe('Type of action to perform'),
  target: z.string().optional()
    .describe('Target output name (for emit) or variable name (for set_variable)'),
  value: z.any().optional().describe('Value to emit or set (can be any type)'),
  formula: z.string().optional().describe('Formula to evaluate for dynamic value'),
});

export const FSMStateSchema = z.object({
  name: z.string().describe('State name identifier'),
  isInitial: z.boolean().optional().describe('Whether this is the initial state'),
  isFinal: z.boolean().optional().describe('Whether this is a final state'),
  onEntry: z.array(FSMActionSchema).optional()
    .describe('Actions to execute when entering this state'),
  onExit: z.array(FSMActionSchema).optional()
    .describe('Actions to execute when exiting this state'),
});

export const FSMTransitionSchema = z.object({
  from: z.string().describe('Source state name'),
  to: z.string().describe('Target state name'),
  trigger: z.enum(['token_received', 'timer', 'condition', 'emission_complete', 'manual'])
    .describe('Event that triggers this transition'),
  condition: z.string().optional()
    .describe('Optional condition formula that must be true for transition'),
  guard: z.string().optional().describe('Additional guard condition'),
});

export const FSMDefinitionSchema = z.object({
  states: z.array(FSMStateSchema).describe('Array of FSM states'),
  transitions: z.array(FSMTransitionSchema).describe('Array of FSM transitions'),
  variables: z.record(z.any()).optional().describe('FSM state variables'),
});

export const FSMProcessNodeSchema = BaseNodeSchema.extend({
  type: z.literal('FSMProcessNode'),
  inputs: z.array(InputSchema).describe('Array of input connections'),
  outputs: z.array(OutputSchema).describe('Array of output connections'),
  fsm: FSMDefinitionSchema.describe('Finite State Machine definition'),
  fsl: z.string().optional()
    .describe('Raw FSL (Finite State Language) code for editing and display'),
});

export const SinkNodeSchema = BaseNodeSchema.extend({
  type: z.literal('Sink'),
  inputs: z.array(InputSchema).describe('Array of input connections'),
});

export const MultiplexerConfigSchema = z.object({
  strategy: z.enum(['round_robin', 'random', 'weighted', 'conditional'])
    .describe('Strategy for distributing tokens across outputs'),
  weights: z.array(z.number()).optional()
    .describe('Weights for weighted distribution strategy'),
  conditions: z.array(z.string()).optional()
    .describe('Conditions for conditional distribution strategy'),
});

export const MultiplexerNodeSchema = BaseNodeSchema.extend({
  type: z.literal('Multiplexer'),
  inputs: z.array(InputSchema).describe('Array of input connections'),
  outputs: z.array(OutputSchema).describe('Array of output connections'),
  multiplexing: MultiplexerConfigSchema,
});



// ============================================================================
// UNION TYPES
// ============================================================================

export const NodeSchema = z.union([
  DataSourceNodeSchema,
  QueueNodeSchema,
  ProcessNodeSchema,
  FSMProcessNodeSchema,
  SinkNodeSchema,
  MultiplexerNodeSchema,
]);

export const V3TemplateSchema = z.object({
  version: z.literal('3.0').describe('Schema version identifier'),
  nodes: z.array(NodeSchema).describe('Array of nodes that make up the simulation graph'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type V3Position = z.infer<typeof PositionSchema>;
export type V3Interface = z.infer<typeof InterfaceSchema>;
export type V3GenerationConfig = z.infer<typeof GenerationConfigSchema>;
export type V3AggregationTrigger = z.infer<typeof AggregationTriggerSchema>;
export type V3AggregationConfig = z.infer<typeof AggregationConfigSchema>;
export type V3TransformationConfig = z.infer<typeof TransformationConfigSchema>;
export type V3ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
export type V3Input = z.infer<typeof InputSchema>;
export type V3Output = z.infer<typeof OutputSchema>;
export type V3BaseNode = z.infer<typeof BaseNodeSchema>;
export type V3DataSourceNode = z.infer<typeof DataSourceNodeSchema>;
export type V3QueueNode = z.infer<typeof QueueNodeSchema>;
export type V3ProcessNode = z.infer<typeof ProcessNodeSchema>;
export type V3FSMAction = z.infer<typeof FSMActionSchema>;
export type V3FSMState = z.infer<typeof FSMStateSchema>;
export type V3FSMTransition = z.infer<typeof FSMTransitionSchema>;
export type V3FSMDefinition = z.infer<typeof FSMDefinitionSchema>;
export type V3FSMProcessNode = z.infer<typeof FSMProcessNodeSchema>;
export type V3SinkNode = z.infer<typeof SinkNodeSchema>;
export type V3MultiplexerConfig = z.infer<typeof MultiplexerConfigSchema>;
export type V3MultiplexerNode = z.infer<typeof MultiplexerNodeSchema>;
export type V3Node = z.infer<typeof NodeSchema>;
export type V3Template = z.infer<typeof V3TemplateSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a complete V3 template
 */
export function validateV3Template(template: unknown): V3Template {
  return V3TemplateSchema.parse(template);
}

/**
 * Validates a single V3 node
 */
export function validateV3Node(node: unknown): V3Node {
  return NodeSchema.parse(node);
}

/**
 * Validates a specific node type
 */
export function validateV3DataSourceNode(node: unknown): V3DataSourceNode {
  return DataSourceNodeSchema.parse(node);
}

export function validateV3QueueNode(node: unknown): V3QueueNode {
  return QueueNodeSchema.parse(node);
}

export function validateV3ProcessNode(node: unknown): V3ProcessNode {
  return ProcessNodeSchema.parse(node);
}

export function validateV3FSMProcessNode(node: unknown): V3FSMProcessNode {
  return FSMProcessNodeSchema.parse(node);
}

export function validateV3SinkNode(node: unknown): V3SinkNode {
  return SinkNodeSchema.parse(node);
}

export function validateV3MultiplexerNode(node: unknown): V3MultiplexerNode {
  return MultiplexerNodeSchema.parse(node);
}

/**
 * Checks if a node configuration is valid V3 format
 */
export function isValidV3Node(node: unknown): boolean {
  try {
    NodeSchema.parse(node);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets validation errors for a node without throwing
 */
export function getV3ValidationErrors(node: unknown): string[] {
  try {
    NodeSchema.parse(node);
    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    }
    return [String(error)];
  }
}