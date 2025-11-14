import { Message, StateTransition, FSMDefinition, Action } from './types';

/**
 * Simple FSM - Pure state machine logic
 */
export class SimpleFSM {
  private definition: FSMDefinition;
  private currentState: string;
  private transitions: Map<string, Map<string, string>> = new Map();

  constructor(definition: FSMDefinition) {
    this.definition = definition;
    this.currentState = definition.initialState;
    this.buildTransitionMap();
  }

  private buildTransitionMap(): void {
    for (const transition of this.definition.transitions) {
      if (!this.transitions.has(transition.from)) {
        this.transitions.set(transition.from, new Map());
      }
      this.transitions.get(transition.from)!.set(transition.trigger, transition.to);
    }
  }

  processMessage(message: Message): StateTransition | null {
    const stateTransitions = this.transitions.get(this.currentState);
    if (!stateTransitions) {
      return null;
    }

    const nextState = stateTransitions.get(message.type);
    if (!nextState) {
      return null;
    }

    const transition: StateTransition = {
      from: this.currentState,
      to: nextState,
      trigger: message.type,
      timestamp: message.timestamp
    };

    this.currentState = nextState;
    return transition;
  }

  getCurrentState(): string {
    return this.currentState;
  }

  getActionsForCurrentState(): Action[] {
    const state = this.definition.states.find(s => s.id === this.currentState);
    return state ? state.actions.filter(a => a.enabled) : [];
  }

  getActionsForState(stateId: string): Action[] {
    const state = this.definition.states.find(s => s.id === stateId);
    return state ? state.actions.filter(a => a.enabled) : [];
  }

  canTransition(messageType: string): boolean {
    const stateTransitions = this.transitions.get(this.currentState);
    return stateTransitions ? stateTransitions.has(messageType) : false;
  }

  getAllStates(): string[] {
    return this.definition.states.map(s => s.id);
  }

  getAllTransitions(): Array<{from: string, to: string, trigger: string}> {
    return this.definition.transitions.map(t => ({
      from: t.from,
      to: t.to,
      trigger: t.trigger
    }));
  }

  // Force state change (for testing/debugging)
  setState(state: string): void {
    if (this.definition.states.some(s => s.id === state)) {
      this.currentState = state;
    }
  }
}