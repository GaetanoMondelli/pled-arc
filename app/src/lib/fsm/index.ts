// Export all FSM components
export { EventQueue } from './EventQueue';
export { EventProcessor } from './EventProcessor';
export { SimpleFSM } from './SimpleFSM';
export { ActionExecutor } from './ActionExecutor';
export { FSMOrchestrator } from './FSMOrchestrator';
export { NodeFSMAdapter } from './NodeFSMAdapter';
export { StateMultiplexer } from './StateMultiplexer';

export type {
  Event,
  Message,
  Rule,
  StateTransition,
  Action,
  FSMState,
  FSMTransition,
  FSMDefinition
} from './types';

export type { ActionContext, ActionResult } from './ActionExecutor';
export type { StateRoute, StateMultiplexerConfig, StateContext } from './StateMultiplexer';

// Helper function to create a simple FSM definition from FSL-like string
export function createFSMDefinitionFromString(fslString: string): import('./types').FSMDefinition {
  const lines = fslString.split(';').map(line => line.trim()).filter(Boolean);
  const states = new Set<string>();
  const transitions: import('./types').FSMTransition[] = [];

  // Parse transitions
  for (const line of lines) {
    const match = line.match(/(\w+)\s+'([^']+)'\s*->\s*(\w+)/);
    if (match) {
      const [, from, trigger, to] = match;
      states.add(from);
      states.add(to);
      transitions.push({ from, to, trigger });
    }
  }

  // Create state objects
  const stateObjects: import('./types').FSMState[] = Array.from(states).map(stateId => ({
    id: stateId,
    actions: [] // Default to no actions
  }));

  return {
    states: stateObjects,
    transitions,
    initialState: 'idle' // Default initial state
  };
}

// Helper function to create simple rules
export function createSimpleRules(): import('./types').Rule[] {
  return [
    {
      id: 'start_rule',
      eventType: 'START_EVENT',
      messageType: 'start'
    },
    {
      id: 'complete_rule',
      eventType: 'COMPLETE_EVENT',
      messageType: 'complete'
    },
    {
      id: 'fail_rule',
      eventType: 'FAIL_EVENT',
      messageType: 'fail'
    },
    {
      id: 'retry_rule',
      eventType: 'RETRY_EVENT',
      messageType: 'retry'
    },
    {
      id: 'reset_rule',
      eventType: 'RESET_EVENT',
      messageType: 'reset'
    }
  ];
}