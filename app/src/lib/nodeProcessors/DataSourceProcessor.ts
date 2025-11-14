/**
 * Data Source Node Processor
 * 
 * Processes events for DataSource nodes that generate data based on:
 * - Random distribution
 * - Scheduled intervals
 * - External triggers
 * 
 * @module DataSourceProcessor
 */

import { StoredEvent } from '@/stores/eventStore';
import {
  BaseNodeProcessor,
  NodeConfig,
  NodeInternalState,
  ProcessingResult,
  nodeProcessorRegistry,
} from './BaseNodeProcessor';

export class DataSourceProcessor extends BaseNodeProcessor {
  readonly nodeType = 'DataSource';

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);

    // DataSource nodes don't need input buffers, only output
    return {
      ...baseState,
      inputBuffers: {}, // No inputs
      requiredInputs: [], // No required inputs
      variables: {
        generatedCount: 0,
        nextEmissionTick: 0,
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
    
    // Data sources respond to:
    // 1. SimulationStart - schedule first emission
    // 2. SourceEmit - generate and emit data
    
    if (event.type === 'SimulationStart') {
      // PRE-CALCULATE all future DataEmit events with actual values!
      const config = nodeConfig.data || {};

      // Ignore legacy time-based config (generation, interval)
      // Use event-sourcing defaults for tests that don't have proper config
      const maxEvents = config.maxEvents || 10; // Default for tests
      const rate = config.rate || 1; // events per second

      for (let i = 1; i <= maxEvents; i++) {
        const emissionTick = Math.round(i * (1000 / rate)); // Convert rate to ticks

        // PRE-CALCULATE the actual data value
        const value = this.generateData(config, updatedState);

        // Create token with the actual value and correlation ID
        const cId = `c${Date.now()}-${i}`; // Simple correlation ID
        const token = this.createToken(value, nodeConfig.id || nodeConfig.nodeId, emissionTick);

        // Add cID to token
        token.correlationIds = [cId];

        // Create DataEmit event directly with the actual value
        newEvents.push(
          this.createOutputEvent(
            'DataEmit',
            nodeConfig.id || nodeConfig.nodeId,
            emissionTick,
            {
              token,
              cId, // Add correlation ID to event data
              targetNodeIds: [], // Will be populated by engine via edge map
            },
            event.id,
            [cId] // Correlation ID array
          )
        );

        updatedState.variables.generatedCount += 1;
      }

      this.logActivity(
        updatedState,
        event.timestamp,
        'pre_calculated',
        `Pre-calculated ${maxEvents} data values and queued DataEmit events`
      );
    }
    
    // Handle DataEmit events - either from own generation or external events
    if (event.type === 'DataEmit') {
      const isOwnEvent = event.sourceNodeId === (nodeConfig.id || nodeConfig.nodeId);
      const isExternalEvent = event.data?.externalEvent === true;
      const targetNodeId = event.targetNodeId || event.data?.token?.targetNodeId;
      const isTargetedToThis = targetNodeId === (nodeConfig.id || nodeConfig.nodeId);

      // Handle external events targeted to this DataSource (event relayer mode)
      if (isExternalEvent && isTargetedToThis) {
        console.log(`🔥 DataSource ${nodeConfig.id} processing external event with correlation IDs:`, event.data?.token?.correlationIds);

        // In event relayer mode, forward the external token preserving correlation IDs
        const originalToken = event.data?.token;
        if (originalToken) {
          // Create a new token emission preserving the correlation IDs
          const forwardedToken = {
            ...originalToken,
            sourceNodeId: nodeConfig.id || nodeConfig.nodeId,
            timestamp: event.timestamp
          };

          // Create DataEmit event to forward the token
          newEvents.push(
            this.createOutputEvent(
              'DataEmit',
              nodeConfig.id || nodeConfig.nodeId,
              event.timestamp,
              {
                token: forwardedToken,
                targetNodeIds: [], // Will be populated by engine via edge map
                externalEvent: true
              },
              event.id,
              originalToken.correlationIds || [] // Preserve correlation IDs
            )
          );

          this.logActivity(
            updatedState,
            event.timestamp,
            'token_emitted',
            `Forwarded external token with value: ${JSON.stringify(originalToken.value)}`,
            `Forwarded external event token`,
            originalToken.correlationIds?.[0] // Use first correlation ID
          );
        }
      }
      // Handle own generated events
      else if (isOwnEvent) {
        console.log(`🔥 Processing own DataEmit from ${event.sourceNodeId} - token routing will be handled by EventProcessor`);

        // The EventProcessor will handle routing this DataEmit to connected nodes
        // We just need to acknowledge this event was processed
        updatedState.lastProcessedTick = event.timestamp;

        this.logActivity(
          updatedState,
          event.timestamp,
          'emitting',
          `Processed DataEmit - token will be routed to connected nodes`
        );
      }
    }

    return {
      newEvents,
      updatedState,
    };
  }
  
  validateConfig(nodeConfig: NodeConfig): string[] {
    const errors = super.validateConfig(nodeConfig);
    const config = nodeConfig.data;
    
    if (!config.dataType) {
      errors.push('DataSource must have a dataType');
    }
    
    if (config.rate !== undefined && config.rate <= 0) {
      errors.push('DataSource rate must be positive');
    }
    
    return errors;
  }
  
  /**
   * Generate data based on config
   */
  private generateData(config: any = {}, state: NodeInternalState): any {
    const { dataType = 'number', valueRange = {} } = config;

    switch (dataType) {
      case 'number':
        const min = valueRange?.min ?? 0;
        const max = valueRange?.max ?? 100;
        return Math.random() * (max - min) + min;

      case 'string':
        return `data-${state.variables.generatedCount}`;

      case 'object':
        return {
          id: state.variables.generatedCount,
          value: Math.random() * 100,
          timestamp: state.lastProcessedTick,
        };

      default:
        return { value: Math.random() * 100 };
    }
  }

  /**
   * Calculate delay in ticks until next emission
   */
  private getNextEmissionDelayTicks(config: any = {}): number {
    const { rate = 1, distribution = 'uniform' } = config;
    const baseDelayTicks = rate ? Math.max(1, Math.floor(1000 / rate)) : 1000; // Convert rate to ticks (assuming 1ms tick)

    switch (distribution) {
      case 'poisson':
        // Exponential inter-arrival times for Poisson process
        return Math.max(1, Math.floor(-Math.log(1 - Math.random()) * baseDelayTicks));

      case 'uniform':
        return baseDelayTicks;

      case 'exponential':
        return Math.max(1, Math.floor(-Math.log(1 - Math.random()) * baseDelayTicks));

      default:
        return baseDelayTicks;
    }
  }
}

// Register processor
nodeProcessorRegistry.register(new DataSourceProcessor());
