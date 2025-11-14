// Simple FSM Types for Clean Architecture

export interface Event {
  id: string;
  type: string;
  timestamp: string;
  data: any;
  source?: string;
}

export interface Message {
  id: string;
  type: string;
  timestamp: string;
  data: any;
  fromEvent: string;
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  timestamp: string;
}

export interface Action {
  id: string;
  type: string;
  state: string;
  data: any;
  enabled: boolean;
}

export interface FSMState {
  id: string;
  actions: Action[];
}

export interface FSMTransition {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
}

export interface FSMDefinition {
  states: FSMState[];
  transitions: FSMTransition[];
  initialState: string;
}

export interface Rule {
  id: string;
  eventType: string;
  messageType: string;
  condition?: string;
  transform?: (event: Event) => any;
}