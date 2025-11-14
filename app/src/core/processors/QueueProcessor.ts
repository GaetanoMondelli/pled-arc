/**
 * Queue Processor - Manages workflow queues and prioritization
 *
 * A Queue is like a waiting line at a bank - it manages the order
 * in which work gets processed. It can prioritize urgent tasks,
 * manage capacity, and ensure fair processing.
 *
 * Business Examples:
 * - Customer support ticket queue (priority: urgent, normal, low)
 * - Order fulfillment queue (first-come-first-served)
 * - Payment processing queue (with retry logic)
 * - Job scheduling queue (background tasks)
 * - Print queue (documents waiting to print)
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../implementations/ActivityQueue';

export interface QueueConfig {
  maxSize: number;
  processingStrategy: 'fifo' | 'lifo' | 'priority' | 'round_robin';
  priorityLevels?: number;
  processingRate?: number; // tokens per tick
  overflowAction: 'reject' | 'drop_oldest' | 'drop_lowest_priority';
  autoProcess?: boolean;
  aggregation?: {
    method: 'sum' | 'average' | 'count' | 'max' | 'min';
    trigger: {
      type: 'count' | 'time';
      window: number;
    };
    formula?: string;
  };
  batching?: {
    maxBatchSize: number;
    timeWindow: number; // milliseconds
    groupBy?: string; // field to group by (e.g. 'customerId')
  };
}

export class QueueProcessor extends BaseProcessor {
  readonly nodeType = 'Queue';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      if (!this.validateEvent(event, ['TokenArrival', 'ProcessComplete', 'QueueProcess', 'SimulationStart', 'AggregationTrigger'])) {
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

      if (event.type === 'SimulationStart') {
        // Initialize queue state
        return { newEvents, newState, activities };
      }

      if (event.type === 'TokenArrival') {
        return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);
      }

      if (event.type === 'AggregationTrigger') {
        return this.handleAggregationTrigger(event, nodeConfig, newState, newEvents, activities);
      }

      return { newEvents, newState, activities };

    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  private handleTokenArrival(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const token = event.data?.token;
    if (!token) {
      throw new Error('TokenArrival event missing token data');
    }

    const config = this.getValidatedConfig(nodeConfig);

    // Initialize queue if needed
    if (!newState.queue) {
      newState.queue = [];
      newState.processed = 0;
      newState.rejected = 0;
      newState.aggregationBuffer = [];
    }

    // Handle aggregation mode
    if (config.aggregation) {
      this.handleAggregation(config, newState, token, newEvents, activities, event);
    } else if (config.batching) {
      this.handleBatching(config, newState, token, newEvents, activities, event);
    } else {
      // Regular queue behavior
      // Check capacity
      if (newState.queue.length >= config.maxSize) {
        this.handleOverflow(config, newState, token, activities, event);
      } else {
        // Add to queue
        this.addToQueue(config, newState, token, activities, event);
      }

      // Auto-process if enabled
      if (config.autoProcess && newState.queue.length > 0) {
        this.processQueue(config, newState, newEvents, activities, event);
      }
    }

    return { newEvents, newState, activities };
  }

  private addToQueue(
    config: QueueConfig,
    state: NodeInternalState,
    token: any,
    activities: any[],
    event: EventData
  ): void {
    const queueItem = {
      token,
      arrivalTime: event.timestamp,
      priority: token.metadata?.priority || 5
    };

    switch (config.processingStrategy) {
      case 'fifo':
        state.queue.push(queueItem);
        break;
      case 'lifo':
        state.queue.unshift(queueItem);
        break;
      case 'priority':
        this.insertByPriority(state.queue, queueItem);
        break;
      case 'round_robin':
        state.queue.push(queueItem);
        break;
    }

    activities.push({
      timestamp: event.timestamp,
      nodeId: event.targetNodeId,
      nodeType: this.nodeType,
      action: 'token_queued',
      value: token.value,
      details: `Token added to queue (position: ${state.queue.length}, strategy: ${config.processingStrategy})`,
      correlationIds: token.correlationIds,
    });
  }

  private insertByPriority(queue: any[], item: any): void {
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      if (item.priority < queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    queue.splice(insertIndex, 0, item);
  }

  private handleOverflow(
    config: QueueConfig,
    state: NodeInternalState,
    token: any,
    activities: any[],
    event: EventData
  ): void {
    switch (config.overflowAction) {
      case 'reject':
        state.rejected++;
        activities.push({
          timestamp: event.timestamp,
          nodeId: event.targetNodeId,
          nodeType: this.nodeType,
          action: 'token_rejected',
          value: token.value,
          details: `Token rejected - queue at capacity (${config.maxSize})`,
          correlationIds: token.correlationIds,
        });
        break;

      case 'drop_oldest':
        const oldest = state.queue.shift();
        this.addToQueue(config, state, token, activities, event);
        activities.push({
          timestamp: event.timestamp,
          nodeId: event.targetNodeId,
          nodeType: this.nodeType,
          action: 'token_dropped',
          value: oldest?.token?.value,
          details: 'Oldest token dropped due to capacity limit',
        });
        break;

      case 'drop_lowest_priority':
        const lowestPriorityIndex = this.findLowestPriority(state.queue);
        if (lowestPriorityIndex >= 0) {
          const dropped = state.queue.splice(lowestPriorityIndex, 1)[0];
          this.addToQueue(config, state, token, activities, event);
          activities.push({
            timestamp: event.timestamp,
            nodeId: event.targetNodeId,
            nodeType: this.nodeType,
            action: 'token_dropped',
            value: dropped?.token?.value,
            details: 'Lowest priority token dropped for higher priority token',
          });
        }
        break;
    }
  }

  private findLowestPriority(queue: any[]): number {
    let lowestIndex = -1;
    let lowestPriority = -1;

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority > lowestPriority) {
        lowestPriority = queue[i].priority;
        lowestIndex = i;
      }
    }

    return lowestIndex;
  }

  private processQueue(
    config: QueueConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    const processingRate = config.processingRate || 1;
    const toProcess = Math.min(processingRate, state.queue.length);

    for (let i = 0; i < toProcess; i++) {
      const queueItem = state.queue.shift();
      if (queueItem) {
        const waitTime = event.timestamp - queueItem.arrivalTime;

        // Emit processed token
        newEvents.push({
          timestamp: event.timestamp + 10, // Small processing delay
          type: 'DataEmit',
          sourceNodeId: event.targetNodeId,
          targetNodeId: event.targetNodeId,
          data: {
            token: {
              ...queueItem.token,
              metadata: {
                ...queueItem.token.metadata,
                queueWaitTime: waitTime,
                processedByQueue: true,
              }
            }
          },
          causedBy: event.id,
          correlationIds: queueItem.token.correlationIds,
        });

        activities.push({
          timestamp: event.timestamp,
          nodeId: event.targetNodeId,
          nodeType: this.nodeType,
          action: 'token_processed',
          value: queueItem.token.value,
          details: `Token processed from queue (wait time: ${waitTime} ticks)`,
          correlationIds: queueItem.token.correlationIds,
        });

        state.processed++;
      }
    }
  }

  private handleAggregation(
    config: QueueConfig,
    state: NodeInternalState,
    token: any,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    if (!config.aggregation) return;

    // Add token to aggregation buffer
    state.aggregationBuffer.push({
      token,
      arrivalTime: event.timestamp,
    });

    activities.push({
      timestamp: event.timestamp,
      nodeId: event.targetNodeId,
      nodeType: this.nodeType,
      action: 'token_buffered',
      value: token.value,
      details: `Token added to aggregation buffer (${state.aggregationBuffer.length}/${config.aggregation.trigger.window})`,
      correlationIds: token.correlationIds,
    });

    // Handle time-based aggregation scheduling
    if (config.aggregation.trigger.type === 'time') {
      this.scheduleTimeBasedAggregation(config.aggregation, state, newEvents, event);
    }
    // Check if aggregation trigger is met (for count-based)
    else if (this.shouldTriggerAggregation(config.aggregation, state)) {
      this.performAggregation(config.aggregation, state, newEvents, activities, event);
    }
  }

  private shouldTriggerAggregation(aggregation: NonNullable<QueueConfig['aggregation']>, state: NodeInternalState): boolean {
    if (aggregation.trigger.type === 'count') {
      return state.aggregationBuffer.length >= aggregation.trigger.window;
    }

    if (aggregation.trigger.type === 'time') {
      // For time-based aggregation, we trigger immediately and schedule next aggregation
      // This is a simplified approach - in reality you'd want to schedule future events
      if (state.aggregationBuffer.length > 0) {
        return true;
      }
    }

    return false;
  }

  private performAggregation(
    aggregation: NonNullable<QueueConfig['aggregation']>,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    const tokens = state.aggregationBuffer.map(item => item.token);
    const values = tokens.map(token => typeof token.value === 'number' ? token.value : 0);

    let aggregatedValue: number;
    let method = aggregation.method;

    switch (method) {
      case 'sum':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        break;
      case 'average':
        aggregatedValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'max':
        aggregatedValue = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'min':
        aggregatedValue = values.length > 0 ? Math.min(...values) : 0;
        break;
      default:
        aggregatedValue = 0;
    }

    // Create batch token - emit aggregated value for mathematical operations, arrays for business logic
    const isSimpleMathematical = ['sum', 'average', 'count', 'max', 'min'].includes(method) &&
                                 !aggregation.formula; // No custom formula means simple math

    const batchToken = {
      value: isSimpleMathematical ? aggregatedValue : tokens.map(t => t.value),
      metadata: {
        aggregated: true,
        method: method,
        sourceCount: tokens.length,
        aggregatedValue: aggregatedValue, // Always keep mathematical result available
        sourceValues: tokens.map(t => t.value), // Keep original values for reference
        batchId: `batch_${Date.now()}`,
      },
      correlationIds: tokens.flatMap(t => t.correlationIds || []),
    };

    // Emit batch result
    newEvents.push({
      timestamp: event.timestamp + 1, // Small delay for processing
      type: 'DataEmit',
      sourceNodeId: event.targetNodeId,
      targetNodeId: event.targetNodeId,
      data: {
        token: batchToken
      },
      causedBy: event.id,
      correlationIds: batchToken.correlationIds,
    });

    activities.push({
      timestamp: event.timestamp,
      nodeId: event.targetNodeId,
      nodeType: this.nodeType,
      action: 'aggregation_performed',
      value: aggregatedValue,
      details: `Aggregated ${tokens.length} tokens using ${method}: ${aggregatedValue}`,
      correlationIds: batchToken.correlationIds,
    });

    // Clear aggregation buffer
    state.aggregationBuffer = [];
    state.processed += tokens.length;
  }

  private handleBatching(
    config: QueueConfig,
    state: NodeInternalState,
    token: any,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    if (!config.batching) return;

    // Initialize batching buffer if needed
    if (!state.batchingBuffer) {
      state.batchingBuffer = {};
    }

    // Group tokens by the specified field (e.g., customerId)
    const groupKey = config.batching.groupBy ? token.value[config.batching.groupBy] : 'default';
    if (!state.batchingBuffer[groupKey]) {
      state.batchingBuffer[groupKey] = [];
    }

    // Add token to appropriate batch group
    state.batchingBuffer[groupKey].push({
      token,
      arrivalTime: event.timestamp,
    });

    activities.push({
      timestamp: event.timestamp,
      nodeId: event.targetNodeId,
      nodeType: this.nodeType,
      action: 'token_batched',
      value: token.value,
      details: `Token added to batch group '${groupKey}' (${state.batchingBuffer[groupKey].length} tokens)`,
      correlationIds: token.correlationIds,
    });

    // Check if any batch group should be triggered
    this.checkBatchTriggers(config.batching, state, newEvents, activities, event);
  }

  private checkBatchTriggers(
    batching: NonNullable<QueueConfig['batching']>,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    if (!state.batchingBuffer) return;

    for (const [groupKey, batch] of Object.entries(state.batchingBuffer)) {
      if (this.shouldTriggerBatch(batching, batch, event.timestamp)) {
        this.emitBatch(groupKey, batch, state, newEvents, activities, event);
      }
    }
  }

  private shouldTriggerBatch(
    batching: NonNullable<QueueConfig['batching']>,
    batch: any[],
    currentTick: number
  ): boolean {
    // Trigger on maxBatchSize
    if (batch.length >= batching.maxBatchSize) {
      return true;
    }

    // Trigger on timeWindow (check if oldest token has exceeded time window)
    if (batch.length > 0 && batching.timeWindow > 0) {
      const oldestTokenTime = batch[0].arrivalTime;
      return (currentTick - oldestTokenTime) >= batching.timeWindow;
    }

    return false;
  }

  private emitBatch(
    groupKey: string,
    batch: any[],
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: any[],
    event: EventData
  ): void {
    const tokens = batch.map(b => b.token);

    // Create batch token with grouped tokens
    const batchToken = {
      value: tokens.map(t => t.value), // Array of original values for business processing
      metadata: {
        batched: true,
        groupKey: groupKey,
        sourceCount: tokens.length,
        batchId: `batch_${groupKey}_${Date.now()}`,
      },
      correlationIds: tokens.flatMap(t => t.correlationIds || []),
    };

    // Emit batch result
    newEvents.push({
      timestamp: event.timestamp + 1,
      type: 'DataEmit',
      sourceNodeId: event.targetNodeId,
      targetNodeId: event.targetNodeId,
      data: {
        token: batchToken
      },
      causedBy: event.id,
      correlationIds: batchToken.correlationIds,
    });

    activities.push({
      timestamp: event.timestamp,
      nodeId: event.targetNodeId,
      nodeType: this.nodeType,
      action: 'batch_emitted',
      value: batchToken.value,
      details: `Emitted batch for group '${groupKey}' with ${tokens.length} tokens`,
      correlationIds: batchToken.correlationIds,
    });

    // Remove emitted tokens from the batch buffer
    delete state.batchingBuffer[groupKey];
    state.processed += tokens.length;
  }

  private getValidatedConfig(nodeConfig: NodeConfig): QueueConfig {
    // Check if this is V3 Schema format (has inputs/outputs fields, aggregation, or batching)
    if (nodeConfig.inputs !== undefined || nodeConfig.outputs !== undefined ||
        nodeConfig.aggregation !== undefined || nodeConfig.batching !== undefined) {
      // V3 Schema format - configuration is at top level
      return {
        maxSize: nodeConfig.capacity || 100,
        processingStrategy: nodeConfig.processingStrategy || 'fifo',
        priorityLevels: nodeConfig.priorityLevels || 5,
        processingRate: nodeConfig.processingRate || 1,
        overflowAction: nodeConfig.overflowAction || 'reject',
        autoProcess: nodeConfig.autoProcess !== false, // Default true
        aggregation: nodeConfig.aggregation,
        batching: nodeConfig.batching,
      };
    }

    // Legacy format - configuration is nested in config object
    const config = nodeConfig.config || {};
    return {
      maxSize: config.maxSize || 100,
      processingStrategy: config.processingStrategy || 'fifo',
      priorityLevels: config.priorityLevels || 5,
      processingRate: config.processingRate || 1,
      overflowAction: config.overflowAction || 'reject',
      autoProcess: config.autoProcess !== false,
      aggregation: config.aggregation,
      batching: config.batching,
    };
  }

  getProcessorInfo() {
    return {
      nodeType: this.nodeType as const,
      description: 'Manages workflow queues with prioritization and capacity control',
      supportedEvents: ['TokenArrival', 'ProcessComplete', 'QueueProcess'] as const,
      configSchema: {
        maxSize: {
          type: 'number',
          default: 100,
          minimum: 1,
          description: 'Maximum number of tokens the queue can hold'
        },
        processingStrategy: {
          type: 'string',
          enum: ['fifo', 'lifo', 'priority', 'round_robin'],
          default: 'fifo',
          description: 'Strategy for processing queued tokens'
        },
        priorityLevels: {
          type: 'number',
          default: 5,
          minimum: 1,
          description: 'Number of priority levels (1=highest, N=lowest)'
        },
        processingRate: {
          type: 'number',
          default: 1,
          minimum: 1,
          description: 'Number of tokens to process per tick'
        },
        overflowAction: {
          type: 'string',
          enum: ['reject', 'drop_oldest', 'drop_lowest_priority'],
          default: 'reject',
          description: 'What to do when queue is at capacity'
        },
        autoProcess: {
          type: 'boolean',
          default: true,
          description: 'Automatically process tokens as they arrive'
        }
      },
      examples: [
        {
          name: 'Customer Support Queue',
          description: 'Priority-based ticket processing',
          config: {
            maxSize: 50,
            processingStrategy: 'priority',
            priorityLevels: 3,
            processingRate: 2,
            overflowAction: 'drop_lowest_priority'
          }
        },
        {
          name: 'Order Processing Queue',
          description: 'First-come-first-served order handling',
          config: {
            maxSize: 200,
            processingStrategy: 'fifo',
            processingRate: 10,
            overflowAction: 'reject'
          }
        }
      ]
    };
  }

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    return {
      queue: [],
      processed: 0,
      rejected: 0,
      errors: [],
      aggregationBuffer: [],
      nextAggregationTick: null,
      pendingAggregationTick: null,
    };
  }

  private scheduleTimeBasedAggregation(
    aggregation: NonNullable<QueueConfig['aggregation']>,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    event: EventData
  ): void {
    const windowSizeMs = aggregation.trigger.window * 1000; // Convert seconds to milliseconds

    // Calculate next aggregation time aligned to window boundaries
    const currentTick = event.timestamp;
    const nextAggregationTick = Math.ceil(currentTick / windowSizeMs) * windowSizeMs;

    // Only schedule if we don't already have a pending aggregation at this time
    if (state.pendingAggregationTick !== nextAggregationTick) {
      state.pendingAggregationTick = nextAggregationTick;
      state.nextAggregationTick = nextAggregationTick;

      console.log('🕒 SCHEDULING TIME-BASED AGGREGATION:', {
        nodeId: event.targetNodeId,
        currentTick,
        nextAggregationTick,
        windowSizeMs
      });

      // Schedule AggregationTrigger event
      newEvents.push({
        timestamp: nextAggregationTick,
        type: 'AggregationTrigger',
        sourceNodeId: event.targetNodeId,
        targetNodeId: event.targetNodeId,
        data: {
          windowStart: nextAggregationTick - windowSizeMs,
          windowEnd: nextAggregationTick,
          triggerType: 'time',
        },
        causedBy: event.id,
      });
    }
  }

  private handleAggregationTrigger(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    console.log('🕒 HANDLING AGGREGATION TRIGGER:', event.targetNodeId);

    const config = this.getValidatedConfig(nodeConfig);

    // Clear the pending aggregation since we're now processing it
    newState.pendingAggregationTick = null;

    if (!config.aggregation || newState.aggregationBuffer.length === 0) {
      console.log('❌ No aggregation config or empty buffer');
      return { newEvents, newState, activities };
    }

    // Perform the aggregation
    this.performAggregation(config.aggregation, newState, newEvents, activities, event);

    return { newEvents, newState, activities };
  }
}