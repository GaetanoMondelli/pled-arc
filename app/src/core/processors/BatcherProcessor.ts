/**
 * Batcher Processor - Collects tokens for batch processing
 *
 * A Batcher is like a loading dock that collects items until it has enough
 * to ship efficiently. It waits for a certain number of tokens or a timeout
 * before releasing them all at once for processing.
 *
 * Business Examples:
 * - Collecting orders for bulk shipping
 * - Batching payments for efficient processing
 * - Accumulating data for report generation
 * - Grouping messages for bulk email sending
 * - Combining database operations for performance
 *
 * Key Features:
 * - Size-based batching (flush when batch is full)
 * - Time-based batching (flush after timeout)
 * - Condition-based batching (custom flush logic)
 * - Priority handling (urgent tokens bypass batching)
 * - Overflow handling (what to do when batch exceeds capacity)
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';
import { BatcherConfig, BatchFlushCondition, BatchOrdering, Token } from '../types';

/**
 * Batcher processor for collecting and batch processing tokens
 */
export class BatcherProcessor extends BaseProcessor {
  readonly nodeType = 'Batcher';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      // Validate that this is an event we can handle
      if (!this.validateEvent(event, ['TokenArrival', 'TimeTimeout', 'BatchReady'])) {
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

      switch (event.type) {
        case 'TokenArrival':
          return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);

        case 'TimeTimeout':
          return this.handleTimeTimeout(event, nodeConfig, newState, newEvents, activities);

        case 'BatchReady':
          return this.handleBatchReady(event, nodeConfig, newState, newEvents, activities);

        default:
          throw new Error(`Unhandled event type: ${event.type}`);
      }

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

    const config = nodeConfig.config as BatcherConfig;
    const batchSize = config.batchSize || 10;
    const timeoutMs = config.timeoutMs || 5000;

    // Initialize batch queue if needed
    if (!newState.batchQueue) {
      newState.batchQueue = [];
      newState.batchStartTime = event.timestamp;
    }

    // Check if token should bypass batching (priority tokens)
    const shouldBypass = this.shouldBypassBatching(token, config);
    if (shouldBypass) {
      // Send priority token immediately
      newEvents.push({
        timestamp: event.timestamp + 1,
        type: 'DataEmit',
        sourceNodeId: nodeConfig.id,
        targetNodeId: nodeConfig.id,
        data: { token, priority: true },
        causedBy: event.id,
        correlationIds: token.correlationIds,
        metadata: { bypass: true, reason: 'priority' },
      });

      activities.push({
        timestamp: event.timestamp,
        nodeId: nodeConfig.id,
        nodeType: this.nodeType,
        action: 'priority_bypass',
        value: token.value,
        details: `Priority token bypassed batching`,
        correlationIds: token.correlationIds,
      });

      newState.tokensBypassed = (newState.tokensBypassed || 0) + 1;
      return { newEvents, newState, activities };
    }

    // Add token to batch
    this.addTokenToBatch(token, newState, config);

    activities.push({
      timestamp: event.timestamp,
      nodeId: nodeConfig.id,
      nodeType: this.nodeType,
      action: 'token_batched',
      value: token.value,
      details: `Added token to batch (${newState.batchQueue.length}/${batchSize})`,
      correlationIds: token.correlationIds,
    });

    // Check if batch should be flushed
    const shouldFlush = this.shouldFlushBatch(newState, config, event.timestamp);

    if (shouldFlush.flush) {
      this.flushBatch(event, nodeConfig, newState, newEvents, activities, shouldFlush.reason);
    } else {
      // Set up timeout timer if this is the first token in batch
      if (newState.batchQueue.length === 1 && timeoutMs > 0) {
        newEvents.push({
          timestamp: event.timestamp + timeoutMs,
          type: 'TimeTimeout',
          sourceNodeId: nodeConfig.id,
          targetNodeId: nodeConfig.id,
          data: { reason: 'batch_timeout', batchStartTime: newState.batchStartTime },
          causedBy: event.id,
          metadata: { timeout: true },
        });
      }
    }

    return { newEvents, newState, activities };
  }

  private handleTimeTimeout(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Only flush if this timeout is for the current batch
    const batchStartTime = event.data?.batchStartTime;
    if (batchStartTime === newState.batchStartTime && newState.batchQueue?.length > 0) {
      this.flushBatch(event, nodeConfig, newState, newEvents, activities, 'timeout');
    }

    return { newEvents, newState, activities };
  }

  private handleBatchReady(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Manual batch flush trigger
    if (newState.batchQueue?.length > 0) {
      this.flushBatch(event, nodeConfig, newState, newEvents, activities, 'manual');
    }

    return { newEvents, newState, activities };
  }

  private shouldBypassBatching(token: Token, config: BatcherConfig): boolean {
    // Check token priority
    if (token.metadata?.priority !== undefined && token.metadata.priority <= 1) {
      return true; // High priority tokens bypass batching
    }

    // Check token type
    if (token.type === 'control' || token.type === 'error') {
      return true; // Control and error tokens bypass batching
    }

    // Check custom bypass conditions
    if (config.bypassCondition) {
      // In a real implementation, you'd evaluate the condition
      // For now, just check if token value is marked as urgent
      return token.metadata?.urgent === true;
    }

    return false;
  }

  private addTokenToBatch(token: Token, state: NodeInternalState, config: BatcherConfig): void {
    const ordering = config.ordering || 'fifo';

    switch (ordering) {
      case 'fifo':
        state.batchQueue.push(token);
        break;

      case 'lifo':
        state.batchQueue.unshift(token);
        break;

      case 'priority':
        // Insert based on priority (lower number = higher priority)
        const priority = token.metadata?.priority || 5;
        let insertIndex = state.batchQueue.length;

        for (let i = 0; i < state.batchQueue.length; i++) {
          const existingPriority = state.batchQueue[i].metadata?.priority || 5;
          if (priority < existingPriority) {
            insertIndex = i;
            break;
          }
        }

        state.batchQueue.splice(insertIndex, 0, token);
        break;

      case 'timestamp':
        // Insert based on timestamp (oldest first)
        state.batchQueue.push(token);
        state.batchQueue.sort((a, b) => a.timestamp - b.timestamp);
        break;

      default:
        state.batchQueue.push(token);
    }
  }

  private shouldFlushBatch(
    state: NodeInternalState,
    config: BatcherConfig,
    currentTick: number
  ): { flush: boolean; reason: string } {
    const batchQueue = state.batchQueue || [];
    const batchSize = config.batchSize || 10;

    // Size-based flush
    if (batchQueue.length >= batchSize) {
      return { flush: true, reason: 'size_limit' };
    }

    // Custom condition-based flush
    if (config.flushCondition) {
      const condition = config.flushCondition;

      switch (condition.type) {
        case 'size':
          return { flush: batchQueue.length >= (condition.value || batchSize), reason: 'custom_size' };

        case 'time':
          const elapsed = currentTick - (state.batchStartTime || 0);
          return { flush: elapsed >= (condition.value || 5000), reason: 'custom_time' };

        case 'condition':
          // In a real implementation, you'd evaluate the expression
          // For demonstration, check if any token has urgent flag
          const hasUrgent = batchQueue.some(token => token.metadata?.urgent);
          return { flush: hasUrgent, reason: 'custom_condition' };
      }
    }

    return { flush: false, reason: 'no_flush' };
  }

  private flushBatch(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[],
    reason: string
  ): void {
    const batchQueue = newState.batchQueue || [];

    if (batchQueue.length === 0) return;

    // Create batch token
    const batchToken = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'batch' as const,
      value: batchQueue.map(token => token.value),
      correlationIds: Array.from(new Set(batchQueue.flatMap(token => token.correlationIds))),
      metadata: {
        batchSize: batchQueue.length,
        batchReason: reason,
        batchStartTime: newState.batchStartTime,
        batchEndTime: event.timestamp,
        originalTokens: batchQueue.map(token => token.id),
        priority: Math.min(...batchQueue.map(token => token.metadata?.priority || 5)),
      },
      timestamp: event.timestamp,
      sourceNodeId: nodeConfig.id,
      lineage: [],
    };

    // Emit the batch
    newEvents.push({
      timestamp: event.timestamp + 1,
      type: 'DataEmit',
      sourceNodeId: nodeConfig.id,
      targetNodeId: nodeConfig.id,
      data: { token: batchToken, batch: true },
      causedBy: event.id,
      correlationIds: batchToken.correlationIds,
      metadata: {
        batch: true,
        size: batchQueue.length,
        reason,
      },
    });

    // Log the batch flush
    activities.push({
      timestamp: event.timestamp,
      nodeId: nodeConfig.id,
      nodeType: this.nodeType,
      action: 'batch_flushed',
      value: batchQueue.length,
      details: `Flushed batch of ${batchQueue.length} tokens (reason: ${reason})`,
      correlationIds: batchToken.correlationIds,
    });

    // Update statistics
    newState.batchesFlushed = (newState.batchesFlushed || 0) + 1;
    newState.totalTokensBatched = (newState.totalTokensBatched || 0) + batchQueue.length;
    newState.lastFlushReason = reason;

    // Clear the batch
    newState.batchQueue = [];
    newState.batchStartTime = undefined;
  }

  getProcessorInfo() {
    return {
      nodeType: this.nodeType as const,
      description: 'Collects tokens and releases them in batches for efficient processing',
      supportedEvents: ['TokenArrival', 'TimeTimeout', 'BatchReady'] as const,
      configSchema: {
        batchSize: {
          type: 'number',
          default: 10,
          minimum: 1,
          description: 'Number of tokens to collect before flushing batch'
        },
        timeoutMs: {
          type: 'number',
          default: 5000,
          minimum: 0,
          description: 'Maximum time to wait before flushing partial batch (in milliseconds)'
        },
        ordering: {
          type: 'string',
          enum: ['fifo', 'lifo', 'priority', 'timestamp'],
          default: 'fifo',
          description: 'Order in which tokens are added to batch'
        },
        flushCondition: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['size', 'time', 'condition']
            },
            value: { type: 'number' },
            expression: { type: 'string' }
          },
          description: 'Custom condition for flushing batches'
        },
        bypassCondition: {
          type: 'string',
          description: 'Expression for tokens that should bypass batching'
        }
      },
      examples: [
        {
          name: 'Order Batching',
          description: 'Batch orders for efficient shipping',
          config: {
            batchSize: 20,
            timeoutMs: 3600000, // 1 hour
            ordering: 'timestamp'
          }
        },
        {
          name: 'Payment Processing',
          description: 'Batch payments for bulk processing',
          config: {
            batchSize: 100,
            timeoutMs: 1800000, // 30 minutes
            ordering: 'priority',
            flushCondition: {
              type: 'condition',
              expression: 'urgent === true'
            }
          }
        },
        {
          name: 'Report Generation',
          description: 'Collect data points for periodic reports',
          config: {
            batchSize: 1000,
            timeoutMs: 86400000, // 24 hours
            ordering: 'fifo'
          }
        }
      ]
    };
  }

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    return {
      batchQueue: [],
      batchStartTime: undefined,
      batchesFlushed: 0,
      totalTokensBatched: 0,
      tokensBypassed: 0,
      lastFlushReason: null,
      errors: [],
    };
  }
}