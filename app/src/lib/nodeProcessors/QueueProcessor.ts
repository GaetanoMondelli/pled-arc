/**
 * Queue Node Processor
 * 
 * Processes events for Queue nodes that buffer data with:
 * - FIFO/LIFO/Priority ordering
 * - Capacity limits
 * - Processing delays
 * 
 * @module QueueProcessor
 */

import { StoredEvent } from '@/stores/eventStore';
import {
  BaseNodeProcessor,
  NodeConfig,
  NodeInternalState,
  ProcessingResult,
  nodeProcessorRegistry,
} from './BaseNodeProcessor';

export class QueueProcessor extends BaseNodeProcessor {
  readonly nodeType = 'Queue';

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);

    return {
      ...baseState,
      variables: {
        queuedCount: 0,
        processedCount: 0,
        droppedCount: 0,
        isProcessing: false,
        batchSize: nodeConfig.data?.batchSize || 1,
        nextAggregationTick: null, // Track when next time-based aggregation should occur
        pendingAggregationTick: null, // Track if we have a scheduled aggregation
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
      const token = data.token;
      const inputName = data.inputName || 'default';

      // Add token to input buffer (default behavior)
      this.addTokenToInput(updatedState, inputName, token);

      this.logActivity(
        updatedState,
        event.timestamp,
        'enqueue',
        `Token ${token.id} queued - buffer size: ${updatedState.inputBuffers[inputName].length}`
      );

      // Create DataQueued event
      newEvents.push(
        this.createOutputEvent(
          'DataQueued',
          nodeConfig.id,
          event.timestamp,
          {
            tokenId: token.id,
            queueSize: updatedState.inputBuffers[inputName].length,
          },
          event.id
        )
      );

      updatedState.variables.queuedCount += 1;

      // Handle time-based aggregation scheduling
      // Check both config.aggregation (legacy) and nodeConfig.aggregation (V3 schema)
      const aggregationConfig = config?.aggregation || (nodeConfig as any).aggregation;

      console.log('🔍 Queue aggregation check:', {
        nodeId: nodeConfig.id,
        configAggregation: config?.aggregation,
        nodeAggregation: (nodeConfig as any).aggregation,
        triggerType: aggregationConfig?.trigger?.type
      });

      if (aggregationConfig?.trigger?.type === 'time') {
        console.log('✅ Scheduling time-based aggregation for', nodeConfig.id);
        this.scheduleTimeBasedAggregation(updatedState, nodeConfig, event, newEvents);
      } else {
        console.log('❌ No time-based trigger found, using batch logic');
        // Handle batch-based aggregation (original logic)
        const batchSize = updatedState.variables.batchSize;
        const currentBufferSize = updatedState.inputBuffers[inputName].length;

        if (currentBufferSize >= batchSize && !updatedState.variables.isProcessing) {
          this.emitBatch(updatedState, nodeConfig, event, newEvents);
        }
      }
    }

    // Handle time-based aggregation trigger
    if (event.type === 'AggregationTrigger') {
      this.performTimeBasedAggregation(updatedState, nodeConfig, event, newEvents);
    }

    return {
      newEvents,
      updatedState,
    };
  }

  /**
   * Emit a batch of tokens
   */
  private emitBatch(
    state: NodeInternalState,
    nodeConfig: NodeConfig,
    triggerEvent: StoredEvent,
    newEvents: Omit<StoredEvent, 'id'>[]
  ): void {
    const config = nodeConfig.data;
    const inputName = 'default';
    const buffer = state.inputBuffers[inputName];
    const batchSize = state.variables.batchSize;

    if (buffer.length < batchSize) return;

    // Take batch from front of queue (FIFO)
    const batchTokens = buffer.splice(0, batchSize);

    // Create aggregated correlation IDs
    const allCorrelationIds: string[] = [];
    batchTokens.forEach(token => {
      allCorrelationIds.push(token.id);
      if (token.correlationIds) {
        allCorrelationIds.push(...token.correlationIds);
      }
    });

    // Determine aggregated value
    let aggregatedValue: any;
    const values = batchTokens.map(t => t.value);

    switch (config.aggregation || 'array') {
      case 'sum':
        aggregatedValue = values.reduce((acc, val) =>
          typeof val === 'number' ? acc + val : acc, 0);
        break;
      case 'average':
        const numericValues = values.filter(v => typeof v === 'number');
        aggregatedValue = numericValues.length > 0
          ? numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length
          : 0;
        break;
      case 'count':
        aggregatedValue = batchTokens.length;
        break;
      case 'array':
      default:
        aggregatedValue = values;
        break;
    }

    // Create output token
    const outputToken = this.createToken(
      aggregatedValue,
      nodeConfig.id,
      triggerEvent.timestamp,
      batchTokens
    );

    // Add to output buffer
    state.outputBuffer.push(outputToken);

    // Emit QueueEmit event
    newEvents.push(
      this.createOutputEvent(
        'QueueEmit',
        nodeConfig.id,
        triggerEvent.timestamp,
        {
          batchSize: batchTokens.length,
          aggregatedValue,
        },
        triggerEvent.id
      )
    );

    // Emit DataEmit event for routing
    newEvents.push(
      this.createOutputEvent(
        'DataEmit',
        nodeConfig.id,
        triggerEvent.timestamp,
        {
          token: outputToken,
          targetNodeIds: [],
        },
        triggerEvent.id,
        allCorrelationIds
      )
    );

    state.variables.processedCount += batchTokens.length;
    state.lastProcessedTick = triggerEvent.timestamp;

    this.logActivity(
      state,
      triggerEvent.timestamp,
      'emit_batch',
      `Emitted batch of ${batchTokens.length} tokens as ${outputToken.id}: ${JSON.stringify(aggregatedValue)}`
    );
  }

  /**
   * Schedule time-based aggregation when first token arrives or window expires
   */
  private scheduleTimeBasedAggregation(
    state: NodeInternalState,
    nodeConfig: NodeConfig,
    triggerEvent: StoredEvent,
    newEvents: Omit<StoredEvent, 'id'>[]
  ): void {
    const config = nodeConfig.data;
    const aggregationConfig = config?.aggregation || (nodeConfig as any).aggregation;
    const windowSizeMs = (aggregationConfig?.trigger?.window || 60) * 1000; // Convert seconds to milliseconds

    // Calculate next aggregation time aligned to window boundaries
    const currentTick = triggerEvent.timestamp;
    const nextAggregationTick = Math.ceil(currentTick / windowSizeMs) * windowSizeMs;

    // Only schedule if we don't already have a pending aggregation at this time
    if (state.variables.pendingAggregationTick !== nextAggregationTick) {
      state.variables.pendingAggregationTick = nextAggregationTick;
      state.variables.nextAggregationTick = nextAggregationTick;

      // Schedule AggregationTrigger event
      newEvents.push(
        this.createOutputEvent(
          'AggregationTrigger',
          nodeConfig.id,
          nextAggregationTick,
          {
            windowStart: nextAggregationTick - windowSizeMs,
            windowEnd: nextAggregationTick,
            triggerType: 'time',
          },
          triggerEvent.id
        )
      );

      this.logActivity(
        state,
        triggerEvent.timestamp,
        'schedule_aggregation',
        `Scheduled time-based aggregation for timestamp ${nextAggregationTick} (window: ${windowSizeMs}ms)`
      );
    }
  }

  /**
   * Perform time-based aggregation when trigger fires
   */
  private performTimeBasedAggregation(
    state: NodeInternalState,
    nodeConfig: NodeConfig,
    triggerEvent: StoredEvent,
    newEvents: Omit<StoredEvent, 'id'>[]
  ): void {
    const config = nodeConfig.data;
    const aggregationConfig = config?.aggregation || (nodeConfig as any).aggregation;
    const inputName = 'default';
    const buffer = state.inputBuffers[inputName] || [];

    // Clear the pending aggregation since we're now processing it
    state.variables.pendingAggregationTick = null;

    if (buffer.length === 0) {
      this.logActivity(
        state,
        triggerEvent.timestamp,
        'aggregation_empty',
        'Time-based aggregation triggered but no tokens in buffer'
      );
      return;
    }

    // Take all tokens from buffer for time-based aggregation
    const tokensToAggregate = buffer.splice(0, buffer.length);

    // Create aggregated correlation IDs
    const allCorrelationIds: string[] = [];
    tokensToAggregate.forEach(token => {
      allCorrelationIds.push(token.id);
      if (token.correlationIds) {
        allCorrelationIds.push(...token.correlationIds);
      }
    });

    // Apply aggregation method
    let aggregatedValue: any;
    const values = tokensToAggregate.map(t => t.value?.value || t.value); // Handle nested value structure

    switch (aggregationConfig?.method || 'sum') {
      case 'sum':
        aggregatedValue = values.reduce((acc, val) =>
          typeof val === 'number' ? acc + val : acc, 0);
        break;
      case 'average':
        const numericValues = values.filter(v => typeof v === 'number');
        aggregatedValue = numericValues.length > 0
          ? numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length
          : 0;
        break;
      case 'count':
        aggregatedValue = tokensToAggregate.length;
        break;
      case 'first':
        aggregatedValue = values[0];
        break;
      case 'last':
        aggregatedValue = values[values.length - 1];
        break;
      case 'min':
        const minValues = values.filter(v => typeof v === 'number');
        aggregatedValue = minValues.length > 0 ? Math.min(...minValues) : 0;
        break;
      case 'max':
        const maxValues = values.filter(v => typeof v === 'number');
        aggregatedValue = maxValues.length > 0 ? Math.max(...maxValues) : 0;
        break;
      default:
        aggregatedValue = values;
        break;
    }

    // Create output token with aggregation result
    const outputToken = this.createToken(
      { aggregatedValue, tokenCount: tokensToAggregate.length },
      nodeConfig.id,
      triggerEvent.timestamp,
      tokensToAggregate
    );

    // Add to output buffer
    state.outputBuffer.push(outputToken);

    // Emit DataEmit event for routing to connected nodes
    newEvents.push(
      this.createOutputEvent(
        'DataEmit',
        nodeConfig.id,
        triggerEvent.timestamp,
        {
          token: outputToken,
          targetNodeIds: [], // Will be populated by engine via edge map
        },
        triggerEvent.id,
        allCorrelationIds
      )
    );

    state.variables.processedCount += tokensToAggregate.length;
    state.lastProcessedTick = triggerEvent.timestamp;

    this.logActivity(
      state,
      triggerEvent.timestamp,
      'time_aggregation',
      `Aggregated ${tokensToAggregate.length} tokens using ${aggregationConfig?.method}: ${JSON.stringify(aggregatedValue)}`
    );
  }

}

// Register processor
nodeProcessorRegistry.register(new QueueProcessor());
