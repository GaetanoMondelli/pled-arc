/**
 * FSM Process Node Processor (V3 Schema)
 *
 * Handles V3 FSMProcessNode format with:
 * - fsm.states, fsm.transitions, fsm.initialState
 * - fsl (Finite State Language) support
 * - inputs/outputs arrays
 * - State-based actions and transitions
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';

interface FSMState {
  id: string;
  name: string;
  isInitial?: boolean;
  isFinal?: boolean;
  actions?: {
    onEntry?: Record<string, string>;
    onExit?: Record<string, string>;
  };
}

interface FSMTransition {
  from: string;
  to: string;
  trigger?: string;
  condition?: string;
  guard?: string;
}

interface FSMDefinition {
  initialState: string;
  states: FSMState[];
  transitions: FSMTransition[];
  variables?: Record<string, any>;
}

interface FSMProcessNodeState extends NodeInternalState {
  currentState: string;
  fsmVariables: Record<string, any>;
  stateHistory: Array<{
    from: string;
    to: string;
    timestamp: number;
    trigger?: string;
  }>;
}

export class FSMProcessNodeProcessor extends BaseProcessor {
  readonly nodeType = 'FSMProcessNode';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      if (!this.validateEvent(event, ['SimulationStart', 'TokenArrival'])) {
        return this.handleError(
          new Error(`Unexpected event type: ${event.type}`),
          event,
          nodeConfig,
          state
        );
      }

      const newEvents: Omit<EventData, 'id'>[] = [];
      const activities: Omit<ActivityEntry, 'seq'>[] = [];
      const newState = { ...state } as FSMProcessNodeState;

      if (event.type === 'SimulationStart') {
        return this.handleSimulationStart(event, nodeConfig, newState, newEvents, activities);
      }

      if (event.type === 'TokenArrival') {
        return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);
      }

      return { newEvents, newState, activities };
    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  private handleSimulationStart(
    event: EventData,
    nodeConfig: NodeConfig,
    state: FSMProcessNodeState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const fsmDef = this.getFSMDefinition(nodeConfig);

    // Initialize FSM state
    state.currentState = fsmDef.initialState;
    state.fsmVariables = { ...fsmDef.variables };
    state.stateHistory = [];

    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.nodeId || nodeConfig.id,
        'fsm_initialized',
        fsmDef.initialState
      )
    );

    this.updateStatistics(state, event.timestamp);
    return { newEvents, newState: state, activities };
  }

  private handleTokenArrival(
    event: EventData,
    nodeConfig: NodeConfig,
    state: FSMProcessNodeState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const { token } = event.data;
    const fsmDef = this.getFSMDefinition(nodeConfig);

    // Check for state transitions
    const transition = this.findTransition(fsmDef, state.currentState, token);

    if (transition) {
      const oldState = state.currentState;
      state.currentState = transition.to;

      // Record state change
      state.stateHistory.push({
        from: oldState,
        to: transition.to,
        timestamp: event.timestamp,
        trigger: transition.trigger
      });

      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.nodeId || nodeConfig.id,
          'fsm_transition',
          { from: oldState, to: transition.to, token: token.value }
        )
      );
    } else {
      // No transition found, token stays in current state
      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.nodeId || nodeConfig.id,
          'fsm_no_transition',
          { state: state.currentState, token: token.value }
        )
      );
    }

    // ALWAYS create output token with current state information
    const outputTarget = this.getOutputTarget(nodeConfig);
    console.log('FSM DEBUG:', {
      nodeId: nodeConfig.nodeId || nodeConfig.id,
      outputTarget,
      hasOutputs: !!nodeConfig.outputs,
      outputs: nodeConfig.outputs
    });

    const outputToken = this.createStateOutputToken(nodeConfig, state, token, event.timestamp);
    console.log('FSM OUTPUT TOKEN:', outputToken);

    if (outputToken && outputTarget) {
      console.log('FSM: Creating TokenArrival event to', outputTarget);
      newEvents.push(
        this.createEvent(
          'TokenArrival',
          outputTarget,
          event.timestamp,
          { token: outputToken },
          nodeConfig.nodeId || nodeConfig.id
        )
      );
    } else {
      console.log('FSM: No output token or target', { outputToken: !!outputToken, outputTarget });
    }

    this.updateStatistics(state, event.timestamp);
    return { newEvents, newState: state, activities };
  }

  private getFSMDefinition(nodeConfig: NodeConfig): FSMDefinition {
    // V3 format: node.fsm contains the FSM definition
    if (nodeConfig.fsm) {
      return nodeConfig.fsm as FSMDefinition;
    }

    // Fallback to legacy format
    const config = nodeConfig.config || {};
    if (config.states && config.transitions) {
      return {
        initialState: config.states.find((s: any) => s.isInitial)?.id || config.states[0]?.id,
        states: config.states,
        transitions: config.transitions,
        variables: config.variables
      };
    }

    throw new Error('FSM definition not found in node configuration');
  }

  private findTransition(fsmDef: FSMDefinition, currentState: string, token: any): FSMTransition | null {
    return fsmDef.transitions.find(transition => {
      if (transition.from !== currentState) return false;

      // Check condition if specified
      if (transition.condition) {
        try {
          // Simple condition evaluation - can be enhanced
          if (transition.condition.includes('action')) {
            const actionMatch = transition.condition.match(/data\.action === "([^"]+)"/);
            if (actionMatch) {
              return token.value?.action === actionMatch[1];
            }
          }
          return false;
        } catch (error) {
          console.warn(`FSM condition evaluation failed: ${transition.condition}`, error);
          return false;
        }
      }

      // Default: any token can trigger the transition
      return true;
    }) || null;
  }

  private createStateOutputToken(nodeConfig: NodeConfig, state: FSMProcessNodeState, inputToken: any, timestamp: number): any | null {
    // Create output token with state information
    // CRITICAL: Include the full token value data, not just a primitive
    const tokenData = typeof inputToken.value === 'object' ? inputToken.value : { value: inputToken.value };

    return this.createToken(
      {
        state: state.currentState,
        originalToken: tokenData,
        fsmId: nodeConfig.nodeId || nodeConfig.id
      },
      nodeConfig.nodeId || nodeConfig.id,
      timestamp,
      inputToken.correlationIds
    );
  }

  private getOutputTarget(nodeConfig: NodeConfig): string {
    // V3 format: check outputs array
    if (nodeConfig.outputs && nodeConfig.outputs.length > 0) {
      return nodeConfig.outputs[0].destinationNodeId;
    }

    // Fallback: no target (will be handled by routing)
    return '';
  }

  initializeState(nodeConfig: NodeConfig): FSMProcessNodeState {
    const fsmDef = this.getFSMDefinition(nodeConfig);
    const baseState = super.initializeState(nodeConfig);

    return {
      ...baseState,
      currentState: fsmDef.initialState,
      fsmVariables: { ...fsmDef.variables },
      stateHistory: []
    };
  }

  getConfigSchema(): Record<string, any> {
    return {
      fsm: {
        type: 'object',
        description: 'FSM definition with states and transitions',
        required: true,
        properties: {
          initialState: { type: 'string', description: 'Initial state ID' },
          states: { type: 'array', description: 'Array of state definitions' },
          transitions: { type: 'array', description: 'Array of transition definitions' }
        }
      },
      inputs: {
        type: 'array',
        description: 'Input definitions',
        default: []
      },
      outputs: {
        type: 'array',
        description: 'Output definitions',
        default: []
      }
    };
  }
}