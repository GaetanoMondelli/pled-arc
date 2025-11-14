/**
 * Data Source Processor - Forwards external events
 *
 * DataSources receive events from external queues and forward them to connected nodes.
 * They do NOT generate or emit anything on their own.
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';

export class DataSourceProcessor extends BaseProcessor {
  readonly nodeType = 'DataSource';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      if (!this.validateEvent(event, ['SimulationStart', 'DataEmit'])) {
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
        // DataSources do nothing on simulation start - they wait for external events
        this.updateStatistics(state, event.timestamp);
        return { newEvents, newState: state, activities };
      }

      if (event.type === 'DataEmit') {
        return this.handleExternalEvent(event, nodeConfig, newState, newEvents, activities);
      }

      return { newEvents, newState, activities };
    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  /**
   * Handle external DataEmit events - forward the token
   */
  private handleExternalEvent(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Only process external events targeting this DataSource
    if (event.targetNodeId !== nodeConfig.id) {
      return { newEvents, newState: state, activities };
    }

    const { token } = event.data;
    if (!token) {
      return { newEvents, newState: state, activities };
    }

    // Record the event
    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'token_emitted',
        token.value,
        token.correlationIds
      )
    );

    // Add token to output buffer for routing
    state.outputBuffer.push(token);
    this.updateStatistics(state, event.timestamp);

    return { newEvents, newState: state, activities };
  }

  protected getSupportedEventTypes(): string[] {
    return ['SimulationStart', 'DataEmit'];
  }

  protected getConfigSchema(): Record<string, any> {
    return {
      outputs: {
        type: 'array',
        description: 'Output connections to other nodes',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            destinationNodeId: { type: 'string' },
            destinationInputName: { type: 'string' },
            interface: { type: 'object' }
          }
        }
      }
    };
  }
}