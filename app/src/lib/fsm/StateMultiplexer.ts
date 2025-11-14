import { Event } from './types';

export interface StateRoute {
  condition: string;
  outputName: string;
  action: {
    type: 'emit' | 'log' | 'custom';
    data: any;
  };
}

export interface StateMultiplexerConfig {
  routes: StateRoute[];
  defaultOutput?: string;
}

export interface StateContext {
  currentState: string;
  previousState?: string;
  variables: Record<string, any>;
  context: any;
  timestamp: string;
}

/**
 * StateMultiplexer - Routes FSM state changes to different outputs
 *
 * Takes FSM state context as input and routes to different outputs based on conditions
 * This allows "if state == X then do Y" logic to be separate from FSM
 */
export class StateMultiplexer {
  private config: StateMultiplexerConfig;
  private nodeId: string;

  constructor(nodeId: string, config: StateMultiplexerConfig) {
    this.nodeId = nodeId;
    this.config = config;
  }

  /**
   * Process state context and route to appropriate outputs
   */
  processStateContext(stateContext: StateContext): {
    outputs: Array<{
      outputName: string;
      data: any;
      shouldEmit: boolean;
    }>;
    matchedRoutes: StateRoute[];
  } {
    const outputs: Array<{ outputName: string; data: any; shouldEmit: boolean }> = [];
    const matchedRoutes: StateRoute[] = [];

    for (const route of this.config.routes) {
      try {
        const shouldRoute = this.evaluateCondition(route.condition, stateContext);

        if (shouldRoute) {
          matchedRoutes.push(route);

          // Process the action
          const outputData = this.processAction(route.action, stateContext);

          outputs.push({
            outputName: route.outputName,
            data: outputData,
            shouldEmit: true
          });
        }
      } catch (error) {
        console.error(`Error evaluating route condition "${route.condition}":`, error);
      }
    }

    // If no routes matched and there's a default output
    if (outputs.length === 0 && this.config.defaultOutput) {
      outputs.push({
        outputName: this.config.defaultOutput,
        data: stateContext,
        shouldEmit: true
      });
    }

    return { outputs, matchedRoutes };
  }

  /**
   * Evaluate condition string against state context
   */
  private evaluateCondition(condition: string, stateContext: StateContext): boolean {
    try {
      // Create input object that matches the token structure used in simulation
      const input = {
        value: stateContext.currentState, // For conditions like: input.value === 'idle'
        data: {
          currentState: stateContext.currentState,
          previousState: stateContext.previousState,
        },
      };

      // Create a safe evaluation context
      const context = stateContext.context || {};
      const variables = stateContext.variables || {};

      // Evaluate with input, context, and variables available
      const func = new Function('input', 'context', 'variables', `return ${condition}`);
      return func(input, context, variables);
    } catch (error) {
      console.error('Condition evaluation error:', error, 'Condition:', condition);
      return false;
    }
  }

  /**
   * Process action and return output data
   */
  private processAction(action: { type: string; data: any }, stateContext: StateContext): any {
    switch (action.type) {
      case 'emit':
        return this.processEmitAction(action.data, stateContext);

      case 'log':
        console.log(`[StateMultiplexer ${this.nodeId}] ${action.data}`);
        return {
          type: 'log',
          message: action.data,
          state: stateContext.currentState,
          timestamp: stateContext.timestamp
        };

      case 'custom':
        return {
          type: 'custom',
          data: action.data,
          state: stateContext.currentState,
          context: stateContext.context,
          timestamp: stateContext.timestamp
        };

      default:
        return action.data;
    }
  }

  /**
   * Process emit action - can be simple data or expression
   */
  private processEmitAction(data: any, stateContext: StateContext): any {
    if (typeof data === 'string') {
      try {
        // Check if it's a simple reference to context
        if (data === 'input.data.context') {
          return stateContext.context;
        }

        // Check if it's a JSON-like expression
        if (data.includes('{') && data.includes('}')) {
          // Replace context references
          const processedData = data
            .replace(/input\.data\.context/g, JSON.stringify(stateContext.context))
            .replace(/input\.data\.currentState/g, `"${stateContext.currentState}"`);

          // Try to evaluate as JSON
          return JSON.parse(processedData);
        }

        // Otherwise return as string
        return data;
      } catch (error) {
        console.error('Error processing emit data:', error);
        return data;
      }
    }

    return data;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: StateMultiplexerConfig): void {
    this.config = newConfig;
  }

  /**
   * Get current configuration
   */
  getConfig(): StateMultiplexerConfig {
    return { ...this.config };
  }

  /**
   * Get possible output names from routes
   */
  getPossibleOutputs(): string[] {
    const outputs = new Set<string>();

    this.config.routes.forEach(route => {
      outputs.add(route.outputName);
    });

    if (this.config.defaultOutput) {
      outputs.add(this.config.defaultOutput);
    }

    return Array.from(outputs);
  }

  /**
   * Test a condition against a given state context (for debugging)
   */
  testCondition(condition: string, stateContext: StateContext): boolean {
    return this.evaluateCondition(condition, stateContext);
  }
}