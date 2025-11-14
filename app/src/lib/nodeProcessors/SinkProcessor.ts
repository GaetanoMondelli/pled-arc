/**
 * Sink Node Processor
 * 
 * Processes events for Sink nodes that:
 * - Collect/aggregate data
 * - Store results
 * - Generate metrics
 * 
 * @module SinkProcessor
 */

import { StoredEvent } from '@/stores/eventStore';
import {
  BaseNodeProcessor,
  NodeConfig,
  NodeInternalState,
  ProcessingResult,
  nodeProcessorRegistry,
} from './BaseNodeProcessor';

export class SinkProcessor extends BaseNodeProcessor {
  readonly nodeType = 'Sink';

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);

    return {
      ...baseState,
      // Sink nodes don't emit, so no output buffer needed
      outputBuffer: [],
      variables: {
        receivedCount: 0,
        totalValue: 0,
        minValue: Infinity,
        maxValue: -Infinity,
        values: [],
        receivedTokens: [], // Store all received tokens
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

      // Store token (sink consumes but doesn't emit)
      updatedState.variables.receivedTokens.push({
        token,
        arrivalTick: event.timestamp,
        fromNodeId: data.fromNodeId,
      });

      updatedState.variables.receivedCount += 1;
      updatedState.lastProcessedTick = event.timestamp;

      // Update statistics based on token value
      const value = token.value;
      if (typeof value === 'number') {
        updatedState.variables.totalValue += value;
        updatedState.variables.minValue = Math.min(
          updatedState.variables.minValue,
          value
        );
        updatedState.variables.maxValue = Math.max(
          updatedState.variables.maxValue,
          value
        );
        updatedState.variables.values.push(value);
      } else if (typeof value?.value === 'number') {
        const numValue = value.value;
        updatedState.variables.totalValue += numValue;
        updatedState.variables.minValue = Math.min(
          updatedState.variables.minValue,
          numValue
        );
        updatedState.variables.maxValue = Math.max(
          updatedState.variables.maxValue,
          numValue
        );
        updatedState.variables.values.push(numValue);
      }

      this.logActivity(
        updatedState,
        event.timestamp,
        'receive',
        `Received token ${token.id}: ${JSON.stringify(value)} - total received: ${updatedState.variables.receivedCount}`
      );

      // Create TokenConsumed event (for audit trail)
      newEvents.push(
        this.createOutputEvent(
          'TokenConsumed',
          nodeConfig.id,
          event.timestamp,
          {
            tokenId: token.id,
            inputName,
            remainingBufferSize: 0, // Sink doesn't buffer
          },
          event.id,
          token.correlationIds
        )
      );

      // Optional: Emit metrics event (if sink is configured to report metrics)
      if (config.emitMetrics) {
        const statistics = this.getStatistics(updatedState);
        newEvents.push(
          this.createOutputEvent(
            'NodeStateChanged',
            nodeConfig.id,
            event.timestamp,
            {
              statistics,
              type: 'metrics_update',
            },
            event.id
          )
        );
      }
    }

    return {
      newEvents,
      updatedState,
    };
  }
  
  /**
   * Get aggregated statistics
   */
  getStatistics(state: NodeInternalState): any {
    return {
      count: state.variables.receivedCount,
      average: state.variables.values.length > 0
        ? state.variables.totalValue / state.variables.values.length
        : 0,
      min: state.variables.minValue,
      max: state.variables.maxValue,
      values: state.variables.values,
    };
  }
}

// Register processor
nodeProcessorRegistry.register(new SinkProcessor());
