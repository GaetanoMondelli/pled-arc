/**
 * Base Processor - Foundation for all node types
 *
 * Every node in your workflow (like "Generate Data", "Process Data", "Save Results")
 * is powered by a processor. This base class provides the common functionality
 * that all processors need.
 *
 * Think of it like a template that defines how any workflow step should behave.
 */

import {
  EventData,
  ActivityEntry,
  NodeConfig,
  NodeInternalState,
  ProcessorResult,
  Token,
  TokenType,
  TokenMetadata,
  TokenLineageStep,
  NodeType,
} from '../types';

/**
 * Abstract base class for all node processors
 *
 * Every processor must implement:
 * - nodeType: What kind of node this is (e.g., "DataSource", "Processor")
 * - process: What to do when an event arrives at this node
 */
export abstract class BaseProcessor {
  abstract readonly nodeType: string;

  /**
   * Process an event at this node
   * This is the main method that defines what this node does
   */
  abstract process(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState
  ): ProcessorResult;

  /**
   * Display node documentation if available
   */
  protected displayNodeDocumentation(nodeConfig: NodeConfig): void {
    const nodeId = nodeConfig.nodeId || nodeConfig.id;

    if (nodeConfig.description) {
      console.log(`📄 ${this.nodeType} ${nodeId}: ${nodeConfig.description}`);
    }
  }

  /**
   * Initialize the internal state for this node
   * This sets up the node's memory and variables
   */
  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    // Display documentation when node is initialized
    this.displayNodeDocumentation(nodeConfig);

    return {
      nodeId: nodeConfig.id,
      nodeType: this.nodeType,
      inputBuffers: { default: [] },
      outputBuffer: [],
      variables: {},
      statistics: {
        eventsProcessed: 0,
        totalProcessingTime: 0,
        lastProcessedTimestamp: 0,
        errors: 0,
      },
    };
  }

  /**
   * Helper method to create a new event
   */
  protected createEvent(
    type: string,
    targetNodeId: string,
    timestamp: number,
    data: any,
    causedBy?: string,
    correlationIds?: string[]
  ): Omit<EventData, 'id'> {
    return {
      timestamp,
      type,
      sourceNodeId: targetNodeId,
      targetNodeId,
      data,
      causedBy,
      correlationIds,
      metadata: {
        createdAt: Date.now(),
      },
    };
  }

  /**
   * Helper method to create a token with tracking information
   */
  protected createToken(
    value: any,
    sourceNodeId: string,
    timestamp: number,
    existingCorrelationIds?: string[]
  ): any {
    // IMPORTANT: Only generate new correlation ID if no existing ones (i.e., for DataSource)
    // For all other processors, preserve the existing correlation IDs!
    const correlationIds = existingCorrelationIds && existingCorrelationIds.length > 0
      ? existingCorrelationIds  // Preserve existing correlation IDs
      : [this.generateCorrelationId()]; // Only generate new ID if none exist

    return {
      id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      value,
      sourceNodeId,
      createdAt: timestamp,
      correlationIds,
      metadata: {
        createdBy: sourceNodeId,
      },
    };
  }

  /**
   * Helper method to create a token for aggregation scenarios where multiple input tokens
   * are combined into one output token (e.g., JOIN, AGGREGATE operations)
   */
  protected createAggregatedToken(
    value: any,
    sourceNodeId: string,
    timestamp: number,
    inputTokenCorrelationIds: string[][]
  ): any {
    // Flatten and deduplicate correlation IDs from all input tokens
    const allCorrelationIds = inputTokenCorrelationIds
      .flat()
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    return {
      id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      value,
      sourceNodeId,
      createdAt: timestamp,
      correlationIds: allCorrelationIds,
      metadata: {
        createdBy: sourceNodeId,
        aggregated: true,
        inputTokenCount: inputTokenCorrelationIds.length,
      },
    };
  }

  /**
   * Helper method to create an activity entry
   */
  protected createActivity(
    timestamp: number,
    nodeId: string,
    action: string,
    value: any,
    correlationIds?: string[]
  ): Omit<ActivityEntry, 'seq'> {
    return {
      timestamp,
      nodeId,
      nodeType: this.nodeType,
      action,
      value,
      correlationIds,
    };
  }

  /**
   * Helper method to update node statistics
   */
  protected updateStatistics(
    state: NodeInternalState,
    timestamp: number,
    processingTime: number = 0,
    hadError: boolean = false
  ): void {
    state.statistics.eventsProcessed++;
    state.statistics.lastProcessedTimestamp = timestamp;
    state.statistics.totalProcessingTime += processingTime;
    if (hadError) {
      state.statistics.errors++;
    }
  }

  /**
   * Helper method to validate event data
   */
  protected validateEvent(event: EventData, expectedTypes: string[]): boolean {
    if (!expectedTypes.includes(event.type)) {
      console.warn(`${this.nodeType} received unexpected event type: ${event.type}. Expected: ${expectedTypes.join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Helper method to validate node configuration
   */
  protected validateConfig(nodeConfig: NodeConfig, requiredFields: string[]): boolean {
    const missingFields = requiredFields.filter(field => !(field in nodeConfig.data));
    if (missingFields.length > 0) {
      console.warn(`${this.nodeType} missing required config fields: ${missingFields.join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Generate a unique correlation ID for tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    return `c${timestamp}_${random}`;
  }

  /**
   * Get processor information for debugging
   */
  getProcessorInfo(): {
    nodeType: string;
    version: string;
    supportedEvents: string[];
    configSchema: Record<string, any>;
  } {
    return {
      nodeType: this.nodeType,
      version: '1.0.0',
      supportedEvents: this.getSupportedEventTypes(),
      configSchema: this.getConfigSchema(),
    };
  }

  /**
   * Override this to specify which event types this processor handles
   */
  protected getSupportedEventTypes(): string[] {
    return ['*']; // By default, accept all event types
  }

  /**
   * Override this to specify the configuration schema for this processor
   */
  protected getConfigSchema(): Record<string, any> {
    return {}; // By default, no specific config required
  }

  /**
   * Override this to provide custom validation logic
   */
  protected customValidation(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): boolean {
    return true; // By default, always valid
  }

  /**
   * Common error handling wrapper
   */
  protected handleError(
    error: Error,
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState
  ): ProcessorResult {
    console.error(`Error in ${this.nodeType} processor:`, error);

    // Update error statistics
    this.updateStatistics(state, event.timestamp, 0, true);

    // Create error activity
    const errorActivity = this.createActivity(
      event.timestamp,
      nodeConfig.id,
      'error_occurred',
      error.message
    );

    return {
      newEvents: [],
      newState: state,
      activities: [errorActivity],
    };
  }
}