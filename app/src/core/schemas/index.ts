/**
 * Core Schema Definitions and Validation
 *
 * These schemas define the structure and validation rules for all
 * data types used across the SDK and UI. They ensure data integrity
 * and provide clear contracts for component interfaces.
 */

import {
  ScenarioConfig,
  NodeConfig,
  EdgeConfig,
  EventData,
  Token,
  ValidationResult,
  NodeType,
  EventType,
  MultiplexerConfig,
  BatcherConfig,
  EngineConfig,
} from '../types';

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Base validator class for type-safe validation
 */
abstract class BaseValidator<T> {
  abstract validate(data: unknown): ValidationResult & { data?: T };

  protected createResult(
    isValid: boolean,
    errors: string[] = [],
    warnings: string[] = [],
    data?: T
  ): ValidationResult & { data?: T } {
    return { isValid, errors, warnings, data };
  }

  protected validateRequired(value: any, fieldName: string): string | null {
    return value == null ? `${fieldName} is required` : null;
  }

  protected validateString(value: any, fieldName: string, minLength = 0): string | null {
    if (typeof value !== 'string') {
      return `${fieldName} must be a string`;
    }
    if (value.length < minLength) {
      return `${fieldName} must be at least ${minLength} characters`;
    }
    return null;
  }

  protected validateNumber(value: any, fieldName: string, min?: number, max?: number): string | null {
    if (typeof value !== 'number') {
      return `${fieldName} must be a number`;
    }
    if (min !== undefined && value < min) {
      return `${fieldName} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${fieldName} must be at most ${max}`;
    }
    return null;
  }

  protected validateArray(value: any, fieldName: string, minLength = 0): string | null {
    if (!Array.isArray(value)) {
      return `${fieldName} must be an array`;
    }
    if (value.length < minLength) {
      return `${fieldName} must have at least ${minLength} items`;
    }
    return null;
  }

  protected validateEnum<T extends string>(
    value: any,
    fieldName: string,
    validValues: readonly T[]
  ): string | null {
    if (!validValues.includes(value)) {
      return `${fieldName} must be one of: ${validValues.join(', ')}`;
    }
    return null;
  }
}

// ============================================================================
// NODE SCHEMA VALIDATION
// ============================================================================

/**
 * Validates node configuration objects
 */
export class NodeConfigValidator extends BaseValidator<NodeConfig> {
  validate(data: unknown): ValidationResult & { data?: NodeConfig } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Node config must be an object']);
    }

    const node = data as any;

    // Validate required fields
    const requiredError = this.validateRequired(node.id, 'id');
    if (requiredError) errors.push(requiredError);

    const typeError = this.validateRequired(node.type, 'type');
    if (typeError) errors.push(typeError);

    const nameError = this.validateRequired(node.name, 'name');
    if (nameError) errors.push(nameError);

    // Validate field types
    const idError = this.validateString(node.id, 'id', 1);
    if (idError) errors.push(idError);

    const nodeNameError = this.validateString(node.name, 'name', 1);
    if (nodeNameError) errors.push(nodeNameError);

    // Validate node type
    const validNodeTypes: NodeType[] = [
      'DataSource', 'Processor', 'Sink', 'Multiplexer',
      'Batcher', 'Filter', 'Joiner'
    ];
    const nodeTypeError = this.validateEnum(node.type, 'type', validNodeTypes);
    if (nodeTypeError) errors.push(nodeTypeError);

    // Validate config object
    if (node.config !== undefined && typeof node.config !== 'object') {
      errors.push('config must be an object');
    }

    // Type-specific validation
    if (node.type && errors.length === 0) {
      const typeSpecificErrors = this.validateNodeTypeSpecific(node);
      errors.push(...typeSpecificErrors);
    }

    // Validate optional fields
    if (node.description !== undefined) {
      const descError = this.validateString(node.description, 'description');
      if (descError) errors.push(descError);
    }

    if (node.position !== undefined) {
      if (typeof node.position !== 'object' ||
          typeof node.position.x !== 'number' ||
          typeof node.position.y !== 'number') {
        errors.push('position must be an object with x and y numbers');
      }
    }

    return this.createResult(errors.length === 0, errors, warnings, node as NodeConfig);
  }

  private validateNodeTypeSpecific(node: any): string[] {
    const errors: string[] = [];

    switch (node.type) {
      case 'DataSource':
        if (!node.config?.maxEmissions || typeof node.config.maxEmissions !== 'number') {
          errors.push('DataSource nodes must have config.maxEmissions (number)');
        }
        if (node.config.maxEmissions <= 0) {
          errors.push('DataSource maxEmissions must be greater than 0');
        }
        break;

      case 'Processor':
        if (!node.config?.transformation) {
          errors.push('Processor nodes must have config.transformation');
        }
        break;

      case 'Sink':
        if (!node.config?.storageType) {
          errors.push('Sink nodes must have config.storageType');
        }
        break;

      case 'Multiplexer':
        if (!node.config?.strategy) {
          errors.push('Multiplexer nodes must have config.strategy');
        }
        break;

      case 'Batcher':
        if (!node.config?.batchSize || typeof node.config.batchSize !== 'number') {
          errors.push('Batcher nodes must have config.batchSize (number)');
        }
        if (node.config.batchSize <= 0) {
          errors.push('Batcher batchSize must be greater than 0');
        }
        break;
    }

    return errors;
  }
}

// ============================================================================
// EDGE SCHEMA VALIDATION
// ============================================================================

/**
 * Validates edge configuration objects
 */
export class EdgeConfigValidator extends BaseValidator<EdgeConfig> {
  validate(data: unknown): ValidationResult & { data?: EdgeConfig } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Edge config must be an object']);
    }

    const edge = data as any;

    // Validate required fields
    ['id', 'sourceNodeId', 'targetNodeId'].forEach(field => {
      const error = this.validateRequired(edge[field], field);
      if (error) errors.push(error);

      const stringError = this.validateString(edge[field], field, 1);
      if (stringError) errors.push(stringError);
    });

    // Validate optional fields
    if (edge.condition !== undefined) {
      const conditionErrors = this.validateEdgeCondition(edge.condition);
      errors.push(...conditionErrors);
    }

    if (edge.weight !== undefined) {
      const weightError = this.validateNumber(edge.weight, 'weight', 0, 1);
      if (weightError) errors.push(weightError);
    }

    return this.createResult(errors.length === 0, errors, warnings, edge as EdgeConfig);
  }

  private validateEdgeCondition(condition: any): string[] {
    const errors: string[] = [];

    if (typeof condition !== 'object' || condition === null) {
      return ['condition must be an object'];
    }

    const validTypes = ['always', 'value', 'expression', 'probability'];
    const typeError = this.validateEnum(condition.type, 'condition.type', validTypes);
    if (typeError) errors.push(typeError);

    switch (condition.type) {
      case 'probability':
        const probError = this.validateNumber(condition.probability, 'condition.probability', 0, 1);
        if (probError) errors.push(probError);
        break;
      case 'expression':
        if (!condition.expression || typeof condition.expression !== 'string') {
          errors.push('condition.expression must be a non-empty string');
        }
        break;
    }

    return errors;
  }
}

// ============================================================================
// SCENARIO SCHEMA VALIDATION
// ============================================================================

/**
 * Validates complete scenario configurations
 */
export class ScenarioConfigValidator extends BaseValidator<ScenarioConfig> {
  private nodeValidator = new NodeConfigValidator();
  private edgeValidator = new EdgeConfigValidator();

  validate(data: unknown): ValidationResult & { data?: ScenarioConfig } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Scenario config must be an object']);
    }

    const scenario = data as any;

    // Validate required fields
    const requiredFields = ['id', 'name', 'nodes', 'edges'];
    requiredFields.forEach(field => {
      const error = this.validateRequired(scenario[field], field);
      if (error) errors.push(error);
    });

    // Validate field types
    const idError = this.validateString(scenario.id, 'id', 1);
    if (idError) errors.push(idError);

    const nameError = this.validateString(scenario.name, 'name', 1);
    if (nameError) errors.push(nameError);

    const nodesError = this.validateArray(scenario.nodes, 'nodes', 1);
    if (nodesError) errors.push(nodesError);

    const edgesError = this.validateArray(scenario.edges, 'edges');
    if (edgesError) errors.push(edgesError);

    // Validate nodes
    if (Array.isArray(scenario.nodes)) {
      scenario.nodes.forEach((node: any, index: number) => {
        const nodeResult = this.nodeValidator.validate(node);
        if (!nodeResult.isValid) {
          errors.push(...nodeResult.errors.map(err => `nodes[${index}]: ${err}`));
        }
      });
    }

    // Validate edges
    if (Array.isArray(scenario.edges)) {
      scenario.edges.forEach((edge: any, index: number) => {
        const edgeResult = this.edgeValidator.validate(edge);
        if (!edgeResult.isValid) {
          errors.push(...edgeResult.errors.map(err => `edges[${index}]: ${err}`));
        }
      });
    }

    // Cross-validation (edges reference valid nodes)
    if (Array.isArray(scenario.nodes) && Array.isArray(scenario.edges)) {
      const nodeIds = new Set(scenario.nodes.map((n: any) => n.id));
      scenario.edges.forEach((edge: any, index: number) => {
        if (!nodeIds.has(edge.sourceNodeId)) {
          errors.push(`edges[${index}]: sourceNodeId "${edge.sourceNodeId}" does not reference an existing node`);
        }
        if (!nodeIds.has(edge.targetNodeId)) {
          errors.push(`edges[${index}]: targetNodeId "${edge.targetNodeId}" does not reference an existing node`);
        }
      });

      // Check for cycles (warning)
      const hasCycles = this.detectCycles(scenario.nodes, scenario.edges);
      if (hasCycles) {
        warnings.push('Scenario contains cycles - may cause infinite loops');
      }

      // Check for disconnected nodes (warning)
      const disconnectedNodes = this.findDisconnectedNodes(scenario.nodes, scenario.edges);
      if (disconnectedNodes.length > 0) {
        warnings.push(`Disconnected nodes found: ${disconnectedNodes.join(', ')}`);
      }
    }

    return this.createResult(errors.length === 0, errors, warnings, scenario as ScenarioConfig);
  }

  private detectCycles(nodes: any[], edges: any[]): boolean {
    const graph = new Map<string, string[]>();

    // Build adjacency list
    nodes.forEach(node => graph.set(node.id, []));
    edges.forEach(edge => {
      const targets = graph.get(edge.sourceNodeId) || [];
      targets.push(edge.targetNodeId);
      graph.set(edge.sourceNodeId, targets);
    });

    // DFS cycle detection
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) return true;
      }
    }

    return false;
  }

  private findDisconnectedNodes(nodes: any[], edges: any[]): string[] {
    const connectedNodes = new Set<string>();

    edges.forEach(edge => {
      connectedNodes.add(edge.sourceNodeId);
      connectedNodes.add(edge.targetNodeId);
    });

    return nodes
      .filter(node => !connectedNodes.has(node.id))
      .map(node => node.id);
  }
}

// ============================================================================
// EVENT SCHEMA VALIDATION
// ============================================================================

/**
 * Validates event data objects
 */
export class EventDataValidator extends BaseValidator<EventData> {
  validate(data: unknown): ValidationResult & { data?: EventData } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Event data must be an object']);
    }

    const event = data as any;

    // Validate required fields
    const requiredFields = ['id', 'timestamp', 'type', 'sourceNodeId', 'targetNodeId'];
    requiredFields.forEach(field => {
      const error = this.validateRequired(event[field], field);
      if (error) errors.push(error);
    });

    // Validate field types
    const idError = this.validateString(event.id, 'id', 1);
    if (idError) errors.push(idError);

    const timestampError = this.validateNumber(event.timestamp, 'timestamp', 0);
    if (timestampError) errors.push(timestampError);

    const sourceError = this.validateString(event.sourceNodeId, 'sourceNodeId', 1);
    if (sourceError) errors.push(sourceError);

    const targetError = this.validateString(event.targetNodeId, 'targetNodeId', 1);
    if (targetError) errors.push(targetError);

    // Validate event type
    const validEventTypes: EventType[] = [
      'SimulationStart', 'DataEmit', 'TokenArrival', 'ProcessComplete',
      'BatchReady', 'TimeTimeout', 'Multiplex', 'SimulationEnd'
    ];
    const typeError = this.validateEnum(event.type, 'type', validEventTypes);
    if (typeError) errors.push(typeError);

    // Validate optional arrays
    if (event.correlationIds !== undefined) {
      const corrError = this.validateArray(event.correlationIds, 'correlationIds');
      if (corrError) errors.push(corrError);
    }

    return this.createResult(errors.length === 0, errors, warnings, event as EventData);
  }
}

// ============================================================================
// TOKEN SCHEMA VALIDATION
// ============================================================================

/**
 * Validates token objects
 */
export class TokenValidator extends BaseValidator<Token> {
  validate(data: unknown): ValidationResult & { data?: Token } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Token must be an object']);
    }

    const token = data as any;

    // Validate required fields
    const requiredFields = ['id', 'type', 'correlationIds', 'metadata', 'timestamp', 'sourceNodeId', 'lineage'];
    requiredFields.forEach(field => {
      const error = this.validateRequired(token[field], field);
      if (error) errors.push(error);
    });

    // Validate field types
    const idError = this.validateString(token.id, 'id', 1);
    if (idError) errors.push(idError);

    const timestampError = this.validateNumber(token.timestamp, 'timestamp', 0);
    if (timestampError) errors.push(timestampError);

    const sourceError = this.validateString(token.sourceNodeId, 'sourceNodeId', 1);
    if (sourceError) errors.push(sourceError);

    // Validate token type
    const validTokenTypes = ['data', 'control', 'batch', 'timer', 'error', 'heartbeat'];
    const typeError = this.validateEnum(token.type, 'type', validTokenTypes);
    if (typeError) errors.push(typeError);

    // Validate arrays
    const corrError = this.validateArray(token.correlationIds, 'correlationIds');
    if (corrError) errors.push(corrError);

    const lineageError = this.validateArray(token.lineage, 'lineage');
    if (lineageError) errors.push(lineageError);

    // Validate metadata object
    if (typeof token.metadata !== 'object' || token.metadata === null) {
      errors.push('metadata must be an object');
    }

    return this.createResult(errors.length === 0, errors, warnings, token as Token);
  }
}

// ============================================================================
// CONFIGURATION VALIDATORS
// ============================================================================

/**
 * Validates engine configuration
 */
export class EngineConfigValidator extends BaseValidator<EngineConfig> {
  validate(data: unknown): ValidationResult & { data?: EngineConfig } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data !== 'object' || data === null) {
      return this.createResult(false, ['Engine config must be an object']);
    }

    const config = data as any;

    // All fields are optional, but validate types if present
    if (config.maxSteps !== undefined) {
      const error = this.validateNumber(config.maxSteps, 'maxSteps', 1);
      if (error) errors.push(error);
    }

    if (config.maxTicks !== undefined) {
      const error = this.validateNumber(config.maxTicks, 'maxTicks', 1);
      if (error) errors.push(error);
    }

    if (config.realTimeSpeed !== undefined) {
      const error = this.validateNumber(config.realTimeSpeed, 'realTimeSpeed', 0.1, 100);
      if (error) errors.push(error);
    }

    ['realTimeMode', 'debugMode', 'enableLineageTracking', 'batchingEnabled', 'timeoutHandling'].forEach(field => {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    });

    return this.createResult(errors.length === 0, errors, warnings, config as EngineConfig);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create all validators with shared configuration
 */
export function createValidators() {
  return {
    node: new NodeConfigValidator(),
    edge: new EdgeConfigValidator(),
    scenario: new ScenarioConfigValidator(),
    event: new EventDataValidator(),
    token: new TokenValidator(),
    engine: new EngineConfigValidator(),
  };
}

/**
 * Validate any type of configuration object
 */
export function validateConfig<T>(
  type: 'node' | 'edge' | 'scenario' | 'event' | 'token' | 'engine',
  data: unknown
): ValidationResult & { data?: T } {
  const validators = createValidators();
  return validators[type].validate(data) as ValidationResult & { data?: T };
}

/**
 * Quick validation helper that throws on error
 */
export function assertValid<T>(
  type: 'node' | 'edge' | 'scenario' | 'event' | 'token' | 'engine',
  data: unknown
): T {
  const result = validateConfig<T>(type, data);

  if (!result.isValid) {
    throw new Error(`Invalid ${type} configuration: ${result.errors.join(', ')}`);
  }

  return result.data!;
}