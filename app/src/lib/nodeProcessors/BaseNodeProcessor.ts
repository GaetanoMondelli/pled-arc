/**
 * Base Node Processor
 * 
 * Abstract base class for all node processors.
 * Node processors are PURE FUNCTIONS that:
 * 
 * 1. Take an event + node config as input
 * 2. Return new events as output
 * 3. NO side effects (no I/O, no mutations)
 * 4. Deterministic (same input = same output)
 * 
 * This makes them:
 * - Easy to test
 * - Easy to replay
 * - Safe for parallel processing
 * - Perfect for event sourcing
 * 
 * @module BaseNodeProcessor
 */

import { StoredEvent, BaseEvent, createEvent } from '@/stores/eventStore';

/**
 * Node configuration (from React Flow node data)
 */
export interface NodeConfig {
  id: string;
  type: string;
  data: any;
  position?: { x: number; y: number };
}

/**
 * Token representation
 */
export interface Token {
  id: string;
  value: any;
  correlationIds?: string[];
  createdAtTick: number;
  originNodeId: string;
}

/**
 * Node internal state (mutable during processing)
 */
export interface NodeInternalState {
  /** Current state/mode of the node */
  currentState?: string;

  /** Internal variables/counters */
  variables: Record<string, any>;

  /** Multi-input buffers (inputName -> tokens[]) */
  inputBuffers: Record<string, Token[]>;

  /** Single output buffer */
  outputBuffer: Token[];

  /** Last processed tick */
  lastProcessedTick: number;

  /** Required input names for multi-input nodes */
  requiredInputs?: string[];

  /** Activity log */
  activityLog: Array<{
    timestamp: number;
    event: string;
    message: string;
  }>;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  /** New events generated */
  newEvents: Omit<StoredEvent, 'id'>[];
  
  /** Updated node state */
  updatedState: NodeInternalState;
  
  /** Errors if any */
  errors?: string[];
}

/**
 * Abstract base class for node processors
 */
export abstract class BaseNodeProcessor {
  /** Node type this processor handles */
  abstract readonly nodeType: string;
  
  /**
   * Process an event for this node
   * 
   * This is the main entry point. Implementations should:
   * 1. Check if event is relevant to this node
   * 2. Update internal state
   * 3. Generate output events
   * 4. Return result
   * 
   * @param event - The event to process
   * @param nodeConfig - Node configuration from diagram
   * @param currentState - Current internal state of node
   * @returns Processing result with new events and updated state
   */
  abstract process(
    event: StoredEvent,
    nodeConfig: NodeConfig,
    currentState: NodeInternalState
  ): ProcessingResult;
  
  /**
   * Initialize node state
   * Called when node is first created or scenario is loaded
   */
  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    // Default inputs for simple nodes
    const defaultInputs = ['default'];
    const requiredInputs = nodeConfig.data?.requiredInputs || defaultInputs;

    // Initialize input buffers
    const inputBuffers: Record<string, Token[]> = {};
    requiredInputs.forEach((inputName: string) => {
      inputBuffers[inputName] = [];
    });

    return {
      variables: {},
      inputBuffers,
      outputBuffer: [],
      lastProcessedTick: 0,
      requiredInputs,
      activityLog: [],
    };
  }
  
  /**
   * Validate node configuration
   * Called when diagram is loaded
   */
  validateConfig(nodeConfig: NodeConfig): string[] {
    const errors: string[] = [];
    
    if (!nodeConfig.id) {
      errors.push('Node must have an id');
    }
    
    if (!nodeConfig.type) {
      errors.push('Node must have a type');
    }
    
    return errors;
  }
  
  /**
   * Helper: Create activity log entry
   */
  protected logActivity(
    state: NodeInternalState,
    timestamp: number,
    event: string,
    message: string
  ): void {
    state.activityLog.push({
      tick,
      event,
      message,
    });
  }

  /**
   * Helper: Check if all required inputs have tokens
   */
  protected canProcess(state: NodeInternalState): boolean {
    if (!state.requiredInputs) return true;

    return state.requiredInputs.every(inputName =>
      state.inputBuffers[inputName]?.length > 0
    );
  }

  /**
   * Helper: Consume one token from each required input (FIFO)
   */
  protected consumeInputTokens(state: NodeInternalState): Token[] {
    if (!state.requiredInputs) return [];

    const consumedTokens: Token[] = [];

    state.requiredInputs.forEach(inputName => {
      const buffer = state.inputBuffers[inputName];
      if (buffer && buffer.length > 0) {
        const token = buffer.shift()!; // Remove first token
        consumedTokens.push(token);
      }
    });

    return consumedTokens;
  }

  /**
   * Helper: Add token to input buffer
   */
  protected addTokenToInput(
    state: NodeInternalState,
    inputName: string,
    token: Token
  ): void {
    if (!state.inputBuffers[inputName]) {
      state.inputBuffers[inputName] = [];
    }
    state.inputBuffers[inputName].push(token);
  }
  
  /**
   * Helper: Check if event targets this node
   */
  protected isEventForNode(event: StoredEvent, nodeId: string): boolean {
    // Event targets this node if:
    // 1. sourceNodeId matches (event from this node)
    // 2. Event is DataArrival with toNodeId matching
    
    if (event.sourceNodeId === nodeId) return true;
    
    if (event.type === 'DataArrival') {
      const data = event.data as any;
      return data.toNodeId === nodeId;
    }
    
    return false;
  }
  
  /**
   * Helper: Create output event
   */
  protected createOutputEvent(
    type: StoredEvent['type'],
    sourceNodeId: string,
    timestamp: number,
    data: any,
    causedBy?: string,
    correlationIds?: string[]
  ): Omit<StoredEvent, 'id'> {
    return createEvent(type, sourceNodeId, data, {
      tick,
      causedBy,
      correlationIds,
      metadata: {
        context: 'simulation',
      },
    });
  }

  /**
   * Helper: Create token with correlation IDs from consumed tokens
   */
  protected createToken(
    value: any,
    sourceNodeId: string,
    timestamp: number,
    consumedTokens?: Token[]
  ): Token {
    // Merge correlation IDs from all consumed tokens
    const correlationIds: string[] = [];
    if (consumedTokens) {
      consumedTokens.forEach(token => {
        correlationIds.push(token.id);
        if (token.correlationIds) {
          correlationIds.push(...token.correlationIds);
        }
      });
    }

    return {
      id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      value,
      correlationIds: correlationIds.length > 0 ? correlationIds : undefined,
      createdAtTick: tick,
      originNodeId: sourceNodeId,
    };
  }
}

/**
 * Registry of node processors
 */
export class NodeProcessorRegistry {
  private processors = new Map<string, BaseNodeProcessor>();
  
  /**
   * Register a processor for a node type
   */
  register(processor: BaseNodeProcessor): void {
    this.processors.set(processor.nodeType, processor);
  }
  
  /**
   * Get processor for node type
   */
  get(nodeType: string): BaseNodeProcessor | undefined {
    return this.processors.get(nodeType);
  }
  
  /**
   * Check if processor exists for node type
   */
  has(nodeType: string): boolean {
    return this.processors.has(nodeType);
  }
  
  /**
   * Get all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.processors.keys());
  }
}

// Global registry instance
export const nodeProcessorRegistry = new NodeProcessorRegistry();
