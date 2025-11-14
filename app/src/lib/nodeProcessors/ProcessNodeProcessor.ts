/**
 * Process Node Processor
 * 
 * Processes events for generic processing nodes that:
 * - Transform data
 * - Apply functions
 * - Add delays
 * 
 * @module ProcessNodeProcessor
 */

import { StoredEvent } from '@/stores/eventStore';
import {
  BaseNodeProcessor,
  NodeConfig,
  NodeInternalState,
  ProcessingResult,
  nodeProcessorRegistry,
} from './BaseNodeProcessor';

export class ProcessNodeProcessor extends BaseNodeProcessor {
  readonly nodeType = 'ProcessNode';

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);

    return {
      ...baseState,
      variables: {
        processedCount: 0,
        totalProcessingTicks: 0,
        isProcessing: false,
      },
    };
  }
  
  process(
    event: StoredEvent,
    nodeConfig: NodeConfig,
    currentState: NodeInternalState
  ): ProcessingResult {
    const newEvents: Omit<StoredEvent, 'id'>[] = [];
    const updatedState = { ...currentState };
    const config = nodeConfig.data;

    // Handle TokenArrival events
    if (event.type === 'TokenArrival') {
      const data = event.data as any;

      // Add token to appropriate input buffer
      const inputName = data.inputName || 'default';
      const token = data.token;

      this.addTokenToInput(updatedState, inputName, token);

      // Log token arrival
      this.logActivity(
        updatedState,
        event.timestamp,
        'arrival',
        `Token ${token.id} arrived at input ${inputName}`
      );

      // Create BufferUpdated event
      newEvents.push(
        this.createOutputEvent(
          'BufferUpdated',
          nodeConfig.id,
          event.timestamp,
          {
            inputName,
            bufferSize: updatedState.inputBuffers[inputName].length,
            operation: 'added',
            tokenId: token.id,
          },
          event.id
        )
      );

      // Check if we can start processing
      if (!updatedState.variables.isProcessing && this.canProcess(updatedState)) {
        this.startProcessing(updatedState, nodeConfig, event, newEvents);
      }
    }

    // Handle ProcessComplete events
    if (event.type === 'ProcessComplete' && event.sourceNodeId === nodeConfig.id) {
      const data = event.data as any;

      // Create output token
      const outputToken = this.createToken(
        data.result,
        nodeConfig.id,
        event.timestamp,
        data.consumedTokens
      );

      // Add to output buffer
      updatedState.outputBuffer.push(outputToken);

      // Emit result to connected nodes
      newEvents.push(
        this.createOutputEvent(
          'DataEmit',
          nodeConfig.id,
          event.timestamp,
          {
            token: outputToken,
            processingTicks: data.duration,
            targetNodeIds: [],
          },
          event.id,
          outputToken.correlationIds
        )
      );

      updatedState.variables.isProcessing = false;
      updatedState.lastProcessedTick = event.timestamp;

      this.logActivity(
        updatedState,
        event.timestamp,
        'complete',
        `Completed processing - output token ${outputToken.id}: ${JSON.stringify(data.result)}`
      );

      // Check if we can start processing next batch
      if (this.canProcess(updatedState)) {
        this.startProcessing(updatedState, nodeConfig, event, newEvents);
      }
    }

    return {
      newEvents,
      updatedState,
    };
  }

  /**
   * Start processing if all required inputs are available
   */
  private startProcessing(
    state: NodeInternalState,
    nodeConfig: NodeConfig,
    triggerEvent: StoredEvent,
    newEvents: Omit<StoredEvent, 'id'>[]
  ): void {
    const config = nodeConfig.data;

    // Consume tokens from all required inputs
    const consumedTokens = this.consumeInputTokens(state);

    if (consumedTokens.length === 0) return;

    // Emit ProcessStart event
    newEvents.push(
      this.createOutputEvent(
        'ProcessStart',
        nodeConfig.id,
        triggerEvent.timestamp,
        {
          consumedTokens: consumedTokens.map(t => ({
            tokenId: t.id,
            inputName: 'default', // TODO: Map back to input names
          })),
        },
        triggerEvent.id
      )
    );

    // Calculate processing time in ticks
    const processingTicks = this.calculateProcessingTimeTicks(config, consumedTokens);
    const completionTimestamp = triggerEvent.timestamp + processingTicks;

    // Transform data from all consumed tokens
    const result = this.transformTokens(config, consumedTokens);

    // Schedule completion
    newEvents.push(
      this.createOutputEvent(
        'ProcessComplete',
        nodeConfig.id,
        completionTimestamp,
        {
          result,
          duration: processingTicks,
          consumedTokens,
        },
        triggerEvent.id
      )
    );

    state.variables.isProcessing = true;
    state.variables.processedCount += 1;
    state.variables.totalProcessingTicks += processingTicks;

    this.logActivity(
      state,
      triggerEvent.timestamp,
      'process',
      `Started processing ${consumedTokens.length} tokens - will complete at timestamp=${completionTimestamp}`
    );
  }
  
  /**
   * Calculate processing time in ticks based on config and tokens
   */
  private calculateProcessingTimeTicks(config: any, tokens: any[]): number {
    const { processingTime, processingTimeDistribution } = config;
    const baseTimeTicks = Math.max(1, Math.floor((processingTime || 1) * 1000)); // Convert to ticks (assuming 1ms tick)

    switch (processingTimeDistribution) {
      case 'fixed':
        return baseTimeTicks;

      case 'uniform':
        const min = Math.floor(baseTimeTicks * 0.5);
        const max = Math.floor(baseTimeTicks * 1.5);
        return Math.max(1, Math.floor(Math.random() * (max - min) + min));

      case 'exponential':
        return Math.max(1, Math.floor(-Math.log(1 - Math.random()) * baseTimeTicks));

      case 'normal':
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return Math.max(1, Math.floor(baseTimeTicks + z * (baseTimeTicks * 0.2)));

      default:
        return baseTimeTicks;
    }
  }

  /**
   * Transform tokens based on config (supports multi-input aggregation)
   */
  private transformTokens(config: any, tokens: any[]): any {
    const { transformation, transformFunction } = config;

    // Extract values from tokens
    const values = tokens.map(token => token.value);

    if (transformFunction) {
      try {
        // Execute custom transformation function
        // eslint-disable-next-line no-new-func
        const fn = new Function('values', 'tokens', `return ${transformFunction}`);
        return fn(values, tokens);
      } catch (error) {
        console.error('Error executing transform function:', error);
        return values[0]; // Fallback to first value
      }
    }

    // Handle multi-input transformations
    if (values.length > 1) {
      switch (transformation) {
        case 'sum':
          return values.reduce((acc, val) => {
            return typeof val === 'number' ? acc + val : acc;
          }, 0);

        case 'average':
          const numericValues = values.filter(v => typeof v === 'number');
          return numericValues.length > 0
            ? numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length
            : 0;

        case 'max':
          const maxNumeric = values.filter(v => typeof v === 'number');
          return maxNumeric.length > 0 ? Math.max(...maxNumeric) : values[0];

        case 'min':
          const minNumeric = values.filter(v => typeof v === 'number');
          return minNumeric.length > 0 ? Math.min(...minNumeric) : values[0];

        case 'concat':
          return values.join('');

        case 'merge':
          // Merge objects
          return values.reduce((acc, val) => {
            if (typeof val === 'object' && val !== null) {
              return { ...acc, ...val };
            }
            return acc;
          }, {});

        default:
          return values[0]; // Default to first value
      }
    }

    // Single input transformations
    const input = values[0];
    switch (transformation) {
      case 'passthrough':
        return input;

      case 'double':
        return typeof input === 'number' ? input * 2 : input;

      case 'increment':
        return typeof input === 'number' ? input + 1 : input;

      case 'stringify':
        return JSON.stringify(input);

      case 'parse':
        try {
          return typeof input === 'string' ? JSON.parse(input) : input;
        } catch {
          return input;
        }

      default:
        return input;
    }
  }
}

// Register processor
nodeProcessorRegistry.register(new ProcessNodeProcessor());
