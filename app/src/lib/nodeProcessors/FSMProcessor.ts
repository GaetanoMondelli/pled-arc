/**
 * FSM (Finite State Machine) Node Processor
 * 
 * Processes events for FSM nodes with state transitions, guards, and actions.
 * This is the most complex processor as it handles:
 * 
 * - State transitions based on events
 * - Guard conditions (can transition?)
 * - Entry/exit actions
 * - Context variables
 * 
 * @module FSMProcessor
 */

import { StoredEvent } from '@/stores/eventStore';
import {
  BaseNodeProcessor,
  NodeConfig,
  NodeInternalState,
  ProcessingResult,
  nodeProcessorRegistry,
} from './BaseNodeProcessor';

interface FSMState {
  id: string;
  name: string;
  onEntry?: string; // Action to execute on entry
  onExit?: string;  // Action to execute on exit
}

interface FSMTransition {
  from: string;
  to: string;
  trigger: string;
  guard?: string; // Condition to check
  action?: string; // Action to execute
}

export class FSMProcessor extends BaseNodeProcessor {
  readonly nodeType = 'FSMProcessor';

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);
    const config = nodeConfig.data;

    return {
      ...baseState,
      currentState: config.initialState || config.states?.[0]?.id || 'idle',
      variables: {
        transitionCount: 0,
        context: {}, // FSM context variables
        fsmState: config.initialState || config.states?.[0]?.id || 'idle',
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
    
    // Handle TokenArrival events as FSM triggers
    if (event.type === 'TokenArrival') {
      const data = event.data as any;
      const token = data.token;
      const inputName = data.inputName || 'default';

      // Add token to input buffer
      this.addTokenToInput(updatedState, inputName, token);

      // Extract trigger from token value
      const trigger = token.value?.trigger || token.value?.type || 'default';

      // Find applicable transition
      const currentFsmState = updatedState.variables.fsmState;
      const transition = this.findTransition(config, currentFsmState, trigger);

      if (!transition) {
        this.logActivity(
          updatedState,
          event.timestamp,
          'no-transition',
          `No transition found for trigger '${trigger}' in state '${currentFsmState}'`
        );
        return { newEvents, updatedState };
      }

      // Check guard condition
      if (transition.guard) {
        const guardResult = this.evaluateGuard(
          transition.guard,
          updatedState.variables.context,
          token.value
        );

        if (!guardResult) {
          this.logActivity(
            updatedState,
            event.timestamp,
            'guard-failed',
            `Guard '${transition.guard}' failed for transition ${transition.from} -> ${transition.to}`
          );
          return { newEvents, updatedState };
        }
      }

      // Consume the token (FSM processes immediately)
      const consumedTokens = [updatedState.inputBuffers[inputName].shift()!];

      // Execute transition
      const oldState = currentFsmState;
      const newState = transition.to;

      // Exit action
      const exitAction = this.getStateDefinition(config, oldState)?.onExit;
      if (exitAction) {
        this.executeAction(
          exitAction,
          updatedState.variables.context,
          token.value
        );
      }

      // Transition action
      if (transition.action) {
        this.executeAction(
          transition.action,
          updatedState.variables.context,
          token.value
        );
      }

      // Update FSM state
      updatedState.variables.fsmState = newState;
      updatedState.currentState = newState;
      updatedState.variables.transitionCount += 1;
      updatedState.lastProcessedTick = event.timestamp;

      // Entry action
      const entryAction = this.getStateDefinition(config, newState)?.onEntry;
      if (entryAction) {
        this.executeAction(
          entryAction,
          updatedState.variables.context,
          token.value
        );
      }

      // Log transition
      this.logActivity(
        updatedState,
        event.timestamp,
        'transition',
        `Transitioned from '${oldState}' to '${newState}' via trigger '${trigger}'`
      );

      // Emit transition event
      newEvents.push(
        this.createOutputEvent(
          'FSMTransition',
          nodeConfig.id,
          event.timestamp,
          {
            fromState: oldState,
            toState: newState,
            trigger,
            context: updatedState.variables.context,
          },
          event.id
        )
      );

      // Create output token with FSM state information
      const outputToken = this.createToken(
        {
          state: newState,
          context: updatedState.variables.context,
          trigger,
          input: token.value,
        },
        nodeConfig.id,
        event.timestamp,
        consumedTokens
      );

      // Add to output buffer
      updatedState.outputBuffer.push(outputToken);

      // Emit data to connected nodes
      newEvents.push(
        this.createOutputEvent(
          'DataEmit',
          nodeConfig.id,
          event.timestamp,
          {
            token: outputToken,
            targetNodeIds: [],
          },
          event.id,
          outputToken.correlationIds
        )
      );
    }
    
    return {
      newEvents,
      updatedState,
    };
  }
  
  validateConfig(nodeConfig: NodeConfig): string[] {
    const errors = super.validateConfig(nodeConfig);
    const config = nodeConfig.data;
    
    if (!config.states || config.states.length === 0) {
      errors.push('FSM must have at least one state');
    }
    
    if (!config.initialState) {
      errors.push('FSM must have an initialState');
    }
    
    if (config.transitions) {
      config.transitions.forEach((t: FSMTransition, i: number) => {
        if (!t.from || !t.to) {
          errors.push(`Transition ${i} must have 'from' and 'to' states`);
        }
      });
    }
    
    return errors;
  }
  
  /**
   * Find applicable transition for current state and trigger
   */
  private findTransition(
    config: any,
    currentState: string,
    trigger: string
  ): FSMTransition | null {
    const transitions = config.transitions || [];
    
    return transitions.find(
      (t: FSMTransition) => t.from === currentState && t.trigger === trigger
    ) || null;
  }
  
  /**
   * Get state definition
   */
  private getStateDefinition(config: any, stateId: string): FSMState | null {
    const states = config.states || [];
    return states.find((s: FSMState) => s.id === stateId) || null;
  }
  
  /**
   * Evaluate guard condition
   * 
   * Guard is a simple expression like:
   * - "count > 5"
   * - "status === 'active'"
   * - "amount >= 100"
   */
  private evaluateGuard(
    guard: string,
    context: any,
    payload: any
  ): boolean {
    try {
      // Create evaluation context
      const evalContext = { ...context, ...payload };
      
      // Simple expression evaluation
      // In production, use a proper expression evaluator or VM
      // eslint-disable-next-line no-new-func
      const fn = new Function(...Object.keys(evalContext), `return ${guard}`);
      return fn(...Object.values(evalContext));
    } catch (error) {
      console.error(`Error evaluating guard '${guard}':`, error);
      return false;
    }
  }
  
  /**
   * Execute action
   * 
   * Action is a simple statement like:
   * - "count += 1"
   * - "status = 'processed'"
   * - "total = amount * quantity"
   */
  private executeAction(
    action: string,
    context: any,
    payload: any
  ): void {
    try {
      // Create evaluation context
      const evalContext = { ...context, ...payload };
      
      // Simple statement execution
      // eslint-disable-next-line no-new-func
      const fn = new Function(...Object.keys(evalContext), action);
      fn(...Object.values(evalContext));
      
      // Update context with changes (shallow merge)
      Object.assign(context, evalContext);
    } catch (error) {
      console.error(`Error executing action '${action}':`, error);
    }
  }
}

// Register processor
nodeProcessorRegistry.register(new FSMProcessor());
