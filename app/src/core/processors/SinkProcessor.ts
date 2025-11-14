/**
 * Sink Processor - Collects final results
 *
 * A Sink is like a storage container that collects the final results
 * of your workflow. It's the end point where processed data goes.
 *
 * Examples:
 * - Saving data to a database
 * - Writing to a file
 * - Sending an email notification
 * - Updating a dashboard
 * - Logging results
 *
 * This processor is designed to be the final destination for your data.
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';

/**
 * SinkProcessor - Consumes tokens as final destination
 *
 * Configuration options:
 * - storageType: How to store the results (memory, file, database, etc.)
 * - capacity: Maximum number of tokens this sink can hold
 * - autoFlush: Whether to automatically flush when capacity is reached
 * - flushInterval: How often to flush stored data
 * - validation: Rules for accepting tokens
 */
export class SinkProcessor extends BaseProcessor {
  readonly nodeType = 'Sink';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      // Validate that this is an event we can handle
      if (!this.validateEvent(event, ['TokenArrival', 'FlushComplete'])) {
        return this.handleError(
          new Error(`Unexpected event type: ${event.type}`),
          event,
          nodeConfig,
          state
        );
      }

      const newEvents: Omit<EventData, 'id'>[] = [];
      const activities: Omit<ActivityEntry, 'seq'>[] = [];
      const newState = { ...state };

      if (event.type === 'TokenArrival') {
        return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);
      }

      if (event.type === 'FlushComplete') {
        return this.handleFlushComplete(event, nodeConfig, newState, newEvents, activities);
      }

      return { newEvents, newState, activities };
    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  /**
   * Handle a token arriving at this sink
   */
  private handleTokenArrival(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const { token } = event.data;
    const config = this.getValidatedConfig(nodeConfig);

    // Validate the incoming token
    if (!this.validateToken(token, config)) {
      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.id,
          'token_rejected',
          token.value,
          token.correlationIds
        )
      );
      return { newEvents, newState: state, activities };
    }

    // Check capacity
    if (state.inputBuffers.default.length >= config.capacity) {
      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.id,
          'capacity_exceeded',
          token.value,
          token.correlationIds
        )
      );
      return { newEvents, newState: state, activities };
    }

    // Store the token
    state.inputBuffers.default.push(token);

    // Record the consumption
    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'token_consumed',
        token.value,
        token.correlationIds
      )
    );

    // Update statistics and storage info
    state.variables.totalTokensReceived = (state.variables.totalTokensReceived || 0) + 1;
    state.variables.lastTokenValue = token.value;
    state.variables.lastTokenTime = event.timestamp;

    // Check if we need to flush
    if (config.autoFlush && state.inputBuffers.default.length >= config.capacity) {
      return this.startFlush(event, nodeConfig, state, newEvents, activities, config, 'capacity_reached');
    }

    // Schedule periodic flush if configured
    if (config.flushInterval && !state.variables.flushScheduled) {
      newEvents.push(
        this.createEvent(
          'FlushComplete',
          nodeConfig.id,
          event.timestamp + config.flushInterval,
          { reason: 'periodic_flush' },
          event.id
        )
      );
      state.variables.flushScheduled = true;
    }

    this.updateStatistics(state, event.timestamp);
    return { newEvents, newState: state, activities };
  }

  /**
   * Handle completion of a flush operation
   */
  private handleFlushComplete(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Only process if this event is for this node
    if (event.sourceNodeId !== nodeConfig.id) {
      return { newEvents, newState: state, activities };
    }

    const { reason } = event.data;
    const config = this.getValidatedConfig(nodeConfig);

    return this.startFlush(event, nodeConfig, state, newEvents, activities, config, reason);
  }

  /**
   * Start a flush operation
   */
  private startFlush(
    triggerEvent: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[],
    config: any,
    reason: string
  ): ProcessorResult {
    const tokensToFlush = [...state.inputBuffers.default];

    if (tokensToFlush.length === 0) {
      activities.push(
        this.createActivity(
          triggerEvent.timestamp,
          nodeConfig.id,
          'flush_skipped',
          0
        )
      );
      state.variables.flushScheduled = false;
      return { newEvents, newState: state, activities };
    }

    // Perform the flush
    const flushResult = this.performFlush(tokensToFlush, config);

    // Record the flush
    activities.push(
      this.createActivity(
        triggerEvent.timestamp,
        nodeConfig.id,
        'tokens_flushed',
        tokensToFlush.length
      )
    );

    // Update state
    if (flushResult.success) {
      state.inputBuffers.default = []; // Clear the buffer
      state.variables.totalFlushes = (state.variables.totalFlushes || 0) + 1;
      state.variables.lastFlushTime = triggerEvent.timestamp;
      state.variables.lastFlushSize = tokensToFlush.length;
    } else {
      activities.push(
        this.createActivity(
          triggerEvent.timestamp,
          nodeConfig.id,
          'flush_failed',
          tokensToFlush.length
        )
      );
    }

    state.variables.flushScheduled = false;

    // Schedule next periodic flush if configured
    if (config.flushInterval && reason === 'periodic_flush') {
      newEvents.push(
        this.createEvent(
          'FlushComplete',
          nodeConfig.id,
          triggerEvent.timestamp + config.flushInterval,
          { reason: 'periodic_flush' },
          triggerEvent.id
        )
      );
      state.variables.flushScheduled = true;
    }

    this.updateStatistics(state, triggerEvent.timestamp);
    return { newEvents, newState: state, activities };
  }

  /**
   * Perform the actual flush operation
   */
  private performFlush(tokens: any[], config: any): { success: boolean; error?: string } {
    try {
      switch (config.storageType) {
        case 'memory':
          // Store in a results array (for testing)
          if (!config.results) config.results = [];
          config.results.push(...tokens.map(t => t.value));
          break;

        case 'console':
          // Log to console
          console.log(`📥 Sink flushed ${tokens.length} tokens:`, tokens.map(t => t.value));
          break;

        case 'file':
          // In a real implementation, this would write to a file
          console.log(`📄 Would write ${tokens.length} tokens to file: ${config.filename || 'output.json'}`);
          break;

        case 'database':
          // In a real implementation, this would save to database
          console.log(`💾 Would save ${tokens.length} tokens to database table: ${config.tableName || 'results'}`);
          break;

        case 'api':
          // In a real implementation, this would send to an API
          console.log(`🌐 Would send ${tokens.length} tokens to API: ${config.apiEndpoint || '/api/results'}`);
          break;

        default:
          console.warn(`Unknown storage type: ${config.storageType}, using memory`);
          if (!config.results) config.results = [];
          config.results.push(...tokens.map(t => t.value));
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown flush error'
      };
    }
  }

  /**
   * Validate token against sink rules
   */
  private validateToken(token: any, config: any): boolean {
    if (!token || token.value === undefined) {
      return false;
    }

    const validation = config.validation || {};

    // Type validation
    if (validation.acceptedTypes && validation.acceptedTypes.length > 0) {
      if (!validation.acceptedTypes.includes(typeof token.value)) {
        return false;
      }
    }

    // Value range validation
    if (validation.minValue !== undefined && token.value < validation.minValue) {
      return false;
    }

    if (validation.maxValue !== undefined && token.value > validation.maxValue) {
      return false;
    }

    // Pattern validation (for strings)
    if (validation.pattern && typeof token.value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(token.value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get and validate configuration with defaults
   */
  private getValidatedConfig(nodeConfig: NodeConfig): {
    storageType: string;
    capacity: number;
    autoFlush: boolean;
    flushInterval?: number;
    validation: any;
    filename?: string;
    tableName?: string;
    apiEndpoint?: string;
    results?: any[];
    inputs?: any[];
  } {
    // Support both V3 schema format and legacy format
    if (nodeConfig.inputs !== undefined) {
      // V3 Schema format - configuration is at top level
      return {
        storageType: 'memory', // Default for V3
        capacity: 1000, // Default for V3
        autoFlush: true, // Default for V3
        flushInterval: undefined,
        validation: {},
        filename: undefined,
        tableName: undefined,
        apiEndpoint: undefined,
        results: undefined,
        inputs: nodeConfig.inputs,
      };
    } else {
      // Legacy format fallback
      const config = nodeConfig.config || nodeConfig.data || {};
      return {
        storageType: config.storageType || 'memory',
        capacity: config.capacity || 1000,
        autoFlush: config.autoFlush !== false, // Default to true
        flushInterval: config.flushInterval,
        validation: config.validation || {},
        filename: config.filename,
        tableName: config.tableName,
        apiEndpoint: config.apiEndpoint,
        results: config.results,
        inputs: config.inputs,
      };
    }
  }

  /**
   * Get sink statistics
   */
  getSinkStats(state: NodeInternalState): {
    currentCapacity: number;
    maxCapacity: number;
    totalReceived: number;
    totalFlushed: number;
    lastFlushSize: number;
    utilizationPercentage: number;
  } {
    const config = this.getValidatedConfig({ id: '', type: '', name: '', data: state.variables });

    return {
      currentCapacity: state.inputBuffers.default?.length || 0,
      maxCapacity: config.capacity,
      totalReceived: state.variables.totalTokensReceived || 0,
      totalFlushed: state.variables.totalFlushes || 0,
      lastFlushSize: state.variables.lastFlushSize || 0,
      utilizationPercentage: ((state.inputBuffers.default?.length || 0) / config.capacity) * 100,
    };
  }

  /**
   * Get supported event types
   */
  protected getSupportedEventTypes(): string[] {
    return ['TokenArrival', 'FlushComplete'];
  }

  /**
   * Get configuration schema
   */
  protected getConfigSchema(): Record<string, any> {
    return {
      storageType: {
        type: 'string',
        default: 'memory',
        description: 'How to store the consumed tokens',
        enum: ['memory', 'console', 'file', 'database', 'api'],
      },
      capacity: {
        type: 'number',
        default: 1000,
        description: 'Maximum number of tokens this sink can hold',
        minimum: 1,
      },
      autoFlush: {
        type: 'boolean',
        default: true,
        description: 'Whether to automatically flush when capacity is reached',
      },
      flushInterval: {
        type: 'number',
        description: 'How often to flush stored data (milliseconds)',
        minimum: 1,
      },
      filename: {
        type: 'string',
        description: 'Filename for file storage type',
      },
      tableName: {
        type: 'string',
        description: 'Table name for database storage type',
      },
      apiEndpoint: {
        type: 'string',
        description: 'API endpoint for api storage type',
      },
      validation: {
        type: 'object',
        description: 'Rules for validating incoming tokens',
        properties: {
          acceptedTypes: { type: 'array', items: { type: 'string' } },
          minValue: { type: 'number' },
          maxValue: { type: 'number' },
          pattern: { type: 'string' },
        },
      },
    };
  }
}