/**
 * MultiplexerProcessor - V3 Schema Compatible
 *
 * Routes tokens to multiple output targets using configurable strategies:
 * - round_robin: Distributes tokens evenly across all outputs
 * - random: Random distribution
 * - weighted: Distribution based on configured weights
 * - conditional: Distribution based on evaluated conditions
 */

import { BaseProcessor } from './BaseProcessor';
import { EventData, NodeConfig, NodeInternalState, ProcessorResult } from '../types';

interface MultiplexerConfig {
  strategy: 'round_robin' | 'random' | 'weighted' | 'conditional';
  weights?: number[];
  conditions?: string[];
  processingDelay?: number;
}

export class MultiplexerProcessor extends BaseProcessor {
  readonly nodeType = 'Multiplexer';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      // Validate that this is an event we can handle
      if (!this.validateEvent(event, ['TokenArrival'])) {
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
    const outputNames = this.getOutputNames(nodeConfig);

    if (outputNames.length === 0) {
      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.id,
          'warning',
          'No outputs configured for multiplexer',
          token.correlationIds
        )
      );
      return { newEvents, newState, activities };
    }

    // Update state counters
    newState.tokensReceived = (newState.tokensReceived || 0) + 1;
    newState.lastProcessedTick = event.timestamp;

    // Select output based on strategy
    const selectedOutput = this.selectOutput(token, outputNames, config, newState);

    // Log the routing decision
    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'token_routed',
        selectedOutput,
        token.correlationIds
      )
    );

    // Create DataEmit event for the selected output
    const processingDelay = config.processingDelay || 10;
    const emitTick = event.timestamp + processingDelay;

    // Create new token with routing metadata (preserve exact correlation IDs)
    const routedToken = {
      ...token,
      id: `${token.id}_routed_${selectedOutput}`,
      sourceNodeId: nodeConfig.id,
      createdAt: emitTick,
      correlationIds: token.correlationIds, // Preserve exact correlation IDs
      metadata: {
        ...token.metadata,
        routedBy: nodeConfig.id,
        routingStrategy: config.strategy,
        selectedOutput,
      }
    };

    newEvents.push({
      timestamp: emitTick,
      type: 'DataEmit',
      sourceNodeId: nodeConfig.id,
      targetNodeId: nodeConfig.id, // Multiplexer emits from itself
      data: { token: routedToken, outputName: selectedOutput },
      causedBy: event.id,
      correlationIds: token.correlationIds,
      metadata: {
        multiplexing: true,
        strategy: config.strategy,
        selectedOutput,
      },
    });

    // Update routing statistics
    newState.routingCounts = newState.routingCounts || {};
    newState.routingCounts[selectedOutput] = (newState.routingCounts[selectedOutput] || 0) + 1;

    // Update strategy-specific state
    this.updateStrategyState(config.strategy, selectedOutput, outputNames, newState);

    return { newEvents, newState, activities };
  }

  private selectOutput(
    token: any,
    outputNames: string[],
    config: MultiplexerConfig,
    state: NodeInternalState
  ): string {
    switch (config.strategy) {
      case 'round_robin':
        const rrIndex = (state.roundRobinIndex || 0) % outputNames.length;
        return outputNames[rrIndex];

      case 'random':
        return outputNames[Math.floor(Math.random() * outputNames.length)];

      case 'weighted':
        if (!config.weights || config.weights.length !== outputNames.length) {
          // Fallback to round robin if weights are invalid
          return this.selectOutput(token, outputNames, { strategy: 'round_robin' }, state);
        }
        return this.selectWeightedOutput(outputNames, config.weights);

      case 'conditional':
        if (!config.conditions || config.conditions.length !== outputNames.length) {
          // Fallback to round robin if conditions are invalid
          return this.selectOutput(token, outputNames, { strategy: 'round_robin' }, state);
        }
        return this.selectConditionalOutput(token, outputNames, config.conditions);

      default:
        return outputNames[0]; // Fallback to first output
    }
  }

  private selectWeightedOutput(outputNames: string[], weights: number[]): string {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) {
      return outputNames[0];
    }

    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return outputNames[i];
      }
    }
    return outputNames[outputNames.length - 1];
  }

  private selectConditionalOutput(
    token: any,
    outputNames: string[],
    conditions: string[]
  ): string {
    // Simple condition evaluation - check if token matches condition patterns
    for (let i = 0; i < conditions.length; i++) {
      if (this.evaluateCondition(token, conditions[i])) {
        return outputNames[i];
      }
    }
    // Default to first output if no conditions match
    return outputNames[0];
  }

  private evaluateCondition(token: any, condition: string): boolean {
    try {
      // Simple condition evaluation - extend this for more complex conditions
      if (condition === 'true') return true;
      if (condition === 'false') return false;

      // Check for simple value comparisons
      if (condition.includes('===')) {
        const [left, right] = condition.split('===').map(s => s.trim());
        // Handle token.value comparison
        if (left === 'token.value') {
          const expectedValue = right.replace(/['"]/g, ''); // Remove quotes
          return String(token.value) === expectedValue;
        }
        return String(token.value) === right.replace(/['"]/g, '');
      }

      if (condition.includes('==')) {
        const [left, right] = condition.split('==').map(s => s.trim());
        // Handle token.value comparison
        if (left === 'token.value') {
          const expectedValue = right.replace(/['"]/g, ''); // Remove quotes
          return String(token.value) === expectedValue;
        }
        return String(token.value) === right.replace(/['"]/g, '');
      }

      if (condition.includes('>')) {
        const [left, right] = condition.split('>').map(s => s.trim());
        return Number(token.value) > Number(right);
      }

      if (condition.includes('<')) {
        const [left, right] = condition.split('<').map(s => s.trim());
        return Number(token.value) < Number(right);
      }

      return false;
    } catch {
      return false;
    }
  }

  private getOutputNames(nodeConfig: NodeConfig): string[] {
    // V3 Schema format
    if (nodeConfig.outputs && Array.isArray(nodeConfig.outputs)) {
      return nodeConfig.outputs.map((output: any) => output.name || 'output');
    }

    // Legacy format fallback
    if (nodeConfig.config?.outputs && Array.isArray(nodeConfig.config.outputs)) {
      return nodeConfig.config.outputs.map((output: any) => output.name || 'output');
    }

    return [];
  }

  private getValidatedConfig(nodeConfig: NodeConfig): MultiplexerConfig {
    // V3 Schema format - configuration is at top level
    if (nodeConfig.multiplexing !== undefined) {
      return {
        strategy: nodeConfig.multiplexing.strategy || 'round_robin',
        weights: nodeConfig.multiplexing.weights,
        conditions: nodeConfig.multiplexing.conditions,
        processingDelay: 10
      };
    }

    // Legacy format - configuration is nested under config
    if (nodeConfig.config?.multiplexing) {
      return {
        strategy: nodeConfig.config.multiplexing.strategy || 'round_robin',
        weights: nodeConfig.config.multiplexing.weights,
        conditions: nodeConfig.config.multiplexing.conditions,
        processingDelay: nodeConfig.config.processingDelay || 10
      };
    }

    // Default configuration
    return {
      strategy: 'round_robin',
      processingDelay: 10
    };
  }

  private updateStrategyState(
    strategy: string,
    selectedOutput: string,
    outputNames: string[],
    newState: NodeInternalState
  ): void {
    switch (strategy) {
      case 'round_robin':
        newState.roundRobinIndex = ((newState.roundRobinIndex || 0) + 1) % outputNames.length;
        break;

      case 'load_balanced':
        // Load balancing metrics are updated in routing counts
        break;

      // Other strategies might need state updates
    }
  }

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    return {
      nodeId: nodeConfig.id,
      tokensReceived: 0,
      routingCounts: {},
      roundRobinIndex: 0,
      lastProcessedTick: -1,
      errors: [],
    };
  }

  getProcessorInfo() {
    return {
      nodeType: this.nodeType as const,
      description: 'Routes tokens to multiple target nodes using configurable strategies',
      supportedEvents: ['TokenArrival'] as const,
      configSchema: {
        strategy: {
          type: 'string',
          enum: ['round_robin', 'random', 'weighted', 'conditional'],
          default: 'round_robin',
          description: 'Strategy for selecting output targets'
        },
        weights: {
          type: 'array',
          items: { type: 'number' },
          description: 'Weights for weighted distribution strategy'
        },
        conditions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Conditions for conditional distribution strategy'
        },
        processingDelay: {
          type: 'number',
          default: 10,
          minimum: 0,
          description: 'Delay in ticks before routing tokens'
        }
      },
      examples: [
        {
          name: 'Round Robin Router',
          description: 'Distribute tokens evenly across multiple outputs',
          config: {
            strategy: 'round_robin',
            processingDelay: 5
          }
        },
        {
          name: 'Weighted Router',
          description: 'Route based on output weights',
          config: {
            strategy: 'weighted',
            weights: [0.5, 0.3, 0.2],
            processingDelay: 10
          }
        }
      ]
    };
  }
}