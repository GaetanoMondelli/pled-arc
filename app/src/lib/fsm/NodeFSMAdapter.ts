import { FSMOrchestrator, createFSMDefinitionFromString, Event, Rule, FSMDefinition } from './index';
import type { FSMProcessNode } from '@/lib/simulation/types';

/**
 * Adapter that bridges template-editor nodes with the decoupled FSM architecture
 * This allows existing FSM nodes to use Event Queue → Event Processor → FSM → Action Executor
 */
export class NodeFSMAdapter {
  private orchestrator: FSMOrchestrator;
  private nodeId: string;
  private nodeConfig: FSMProcessNode;

  constructor(nodeId: string, nodeConfig: FSMProcessNode) {
    this.nodeId = nodeId;
    this.nodeConfig = nodeConfig;

    // Convert existing FSM config to our FSM definition
    const fsmDefinition = this.convertNodeConfigToFSMDefinition(nodeConfig);

    // Create rules for token events
    const rules = this.createTokenRules();

    // Initialize orchestrator
    this.orchestrator = new FSMOrchestrator(
      fsmDefinition,
      rules,
      nodeId,
      nodeConfig.fsmVariables || {}
    );
  }

  /**
   * Convert existing node FSM config to our FSMDefinition format
   */
  private convertNodeConfigToFSMDefinition(config: FSMProcessNode): FSMDefinition {
    // If FSL exists, parse it
    if (config.fsl) {
      try {
        return createFSMDefinitionFromString(config.fsl);
      } catch (error) {
        console.warn('Failed to parse FSL, falling back to config.fsm:', error);
      }
    }

    // Otherwise convert from config.fsm
    const fsm = config.fsm;
    if (!fsm) {
      // Default FSM for nodes
      return {
        states: [
          { id: 'idle', actions: [] },
          { id: 'processing', actions: [] },
          { id: 'emitting', actions: [] }
        ],
        transitions: [
          { from: 'idle', to: 'processing', trigger: 'token_received' },
          { from: 'processing', to: 'emitting', trigger: 'processing_complete' },
          { from: 'emitting', to: 'idle', trigger: 'token_emitted' }
        ],
        initialState: 'idle'
      };
    }

    // Convert states - handle both string array and object array
    const states = (fsm.states || []).map((state: any) => {
      if (typeof state === 'string') {
        return { id: state, actions: [] };
      } else {
        // Convert state actions to our format
        const actions = [];

        // Convert onEntry actions
        if (state.onEntry) {
          if (Array.isArray(state.onEntry)) {
            // Array format
            actions.push(...state.onEntry.map((action: any) => ({
              id: `${state.name}_entry_${action.action}`,
              type: action.action === 'log' ? 'LOG_MESSAGE' : 'CREATE_EVENT',
              state: state.name,
              data: action,
              enabled: true
            })));
          } else {
            // Object format (output -> formula mapping)
            Object.entries(state.onEntry).forEach(([output, formula]) => {
              actions.push({
                id: `${state.name}_emit_${output}`,
                type: 'CREATE_EVENT',
                state: state.name,
                data: {
                  eventType: 'TOKEN_EMITTED',
                  output,
                  formula
                },
                enabled: true
              });
            });
          }
        }

        return {
          id: state.name,
          actions
        };
      }
    });

    return {
      states,
      transitions: fsm.transitions || [],
      initialState: fsm.initialState || states[0]?.id || 'idle'
    };
  }

  /**
   * Create rules for converting node events to FSM messages
   */
  private createTokenRules(): Rule[] {
    return [
      {
        id: 'token_input_rule',
        eventType: 'TOKEN_INPUT',
        messageType: 'token_received'
      },
      {
        id: 'processing_complete_rule',
        eventType: 'PROCESSING_COMPLETE',
        messageType: 'processing_complete'
      },
      {
        id: 'token_emit_rule',
        eventType: 'TOKEN_EMIT',
        messageType: 'token_emitted'
      },
      {
        id: 'input_ready_rule',
        eventType: 'INPUT_READY',
        messageType: 'inputs_ready'
      },
      {
        id: 'evaluation_complete_rule',
        eventType: 'EVALUATION_COMPLETE',
        messageType: 'evaluation_complete'
      },
      // Add custom rules from FSL or config if needed
      ...this.extractCustomRules()
    ];
  }

  /**
   * Extract custom rules from FSL or config
   */
  private extractCustomRules(): Rule[] {
    const rules: Rule[] = [];

    // Parse FSL for custom triggers if available
    if (this.nodeConfig.fsl) {
      // Simple extraction of custom triggers from FSL
      const lines = this.nodeConfig.fsl.split('\n');
      lines.forEach(line => {
        const triggerMatch = line.match(/on\s+([^-]+)\s*->/);
        if (triggerMatch) {
          const trigger = triggerMatch[1].trim();
          if (!['token_received', 'processing_complete', 'token_emitted'].includes(trigger)) {
            rules.push({
              id: `custom_${trigger}_rule`,
              eventType: trigger.toUpperCase().replace(/\./g, '_'),
              messageType: trigger
            });
          }
        }
      });
    }

    return rules;
  }

  /**
   * Process a token input event
   */
  async processTokenInput(token: any, inputName: string = 'default'): Promise<{
    newState: string;
    stateOutput: any;
    eventsGenerated: Event[];
    actionsExecuted: number;
  }> {
    const previousState = this.orchestrator.getCurrentState();

    const event: Event = {
      id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'TOKEN_INPUT',
      timestamp: new Date().toISOString(),
      data: {
        token,
        inputName,
        nodeId: this.nodeId
      },
      source: 'node_input'
    };

    const result = await this.orchestrator.addEvent(event);
    const newState = this.orchestrator.getCurrentState();

    // Always emit state context as output
    const stateOutput = this.createStateContextOutput(newState, previousState, token);

    return {
      newState,
      stateOutput,
      eventsGenerated: result.messages.map(m => ({
        id: m.id,
        type: m.type,
        timestamp: m.timestamp,
        data: m.data,
        source: 'message_processor'
      })),
      actionsExecuted: result.actionsExecuted
    };
  }

  /**
   * Process a custom event (e.g., from user interaction or external trigger)
   */
  async processCustomEvent(eventType: string, data: any = {}): Promise<{
    newState: string;
    transitionsTriggered: number;
    actionsExecuted: number;
  }> {
    const event: Event = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        nodeId: this.nodeId
      },
      source: 'custom_trigger'
    };

    const result = await this.orchestrator.addEvent(event);

    return {
      newState: this.orchestrator.getCurrentState(),
      transitionsTriggered: result.transitions.length,
      actionsExecuted: result.actionsExecuted
    };
  }

  /**
   * Get current state information
   */
  getState(): {
    currentState: string;
    possibleTransitions: string[];
    variables: Record<string, any>;
    eventHistory: Event[];
  } {
    return {
      currentState: this.orchestrator.getCurrentState(),
      possibleTransitions: this.orchestrator.getPossibleTransitions(),
      variables: this.orchestrator.getVariables(),
      eventHistory: this.orchestrator.getEvents()
    };
  }

  /**
   * Update FSM configuration (for when user changes config in modal)
   */
  updateConfig(newConfig: FSMProcessNode): void {
    this.nodeConfig = newConfig;

    // Create new definition and rules
    const fsmDefinition = this.convertNodeConfigToFSMDefinition(newConfig);
    const rules = this.createTokenRules();

    // Update orchestrator
    this.orchestrator.updateRules(rules);
    // Note: We'd need to add updateFSMDefinition method to orchestrator for full config updates
  }

  /**
   * Force state change (for debugging/testing)
   */
  setState(state: string): void {
    this.orchestrator.setState(state);
  }

  /**
   * Update variables
   */
  updateVariables(variables: Record<string, any>): void {
    this.orchestrator.updateVariables(variables);
  }

  /**
   * Get statistics
   */
  getStats(): {
    eventsProcessed: number;
    currentState: string;
    queueSize: number;
    variables: Record<string, any>;
  } {
    return this.orchestrator.getStats();
  }

  /**
   * Clear event history (for reset)
   */
  reset(): void {
    this.orchestrator.clearEvents();
    this.orchestrator.setState(this.convertNodeConfigToFSMDefinition(this.nodeConfig).initialState);
  }

  /**
   * Create state context output for StateMultiplexer
   */
  private createStateContextOutput(currentState: string, previousState: string, inputContext: any): any {
    return {
      data: {
        currentState,
        previousState,
        variables: this.orchestrator.getVariables(),
        context: inputContext,
        timestamp: new Date().toISOString()
      }
    };
  }
}