/**
 * FSM (Finite State Machine) Processor - Complex workflow state management
 *
 * An FSM is like a sophisticated decision-making system that tracks the current
 * state of a business process and determines what actions to take based on
 * incoming events and predefined rules.
 *
 * Business Examples:
 * - Order lifecycle: pending → validated → paid → shipped → delivered
 * - Customer onboarding: applied → verified → approved → active
 * - Document approval: draft → review → approved → published
 * - Support ticket: open → in_progress → resolved → closed
 * - Manufacturing: raw → processing → quality_check → finished → shipped
 *
 * Key Features:
 * - State-based processing with configurable transitions
 * - Event-driven state changes with validation
 * - Conditional transitions based on token data
 * - Action execution on state entry/exit
 * - State history tracking for audit trails
 * - Parallel state machines for complex workflows
 * - Timeout handling for stuck states
 * - Business rule enforcement
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';

/**
 * FSM state definition
 */
export interface FSMState {
  id: string;
  name: string;
  description?: string;
  isInitial?: boolean;
  isFinal?: boolean;
  onEntry?: FSMAction[];    // Actions to execute when entering state
  onExit?: FSMAction[];     // Actions to execute when leaving state
  timeout?: {
    duration: number;       // Timeout in ticks
    targetState: string;    // State to transition to on timeout
    action?: FSMAction;     // Action to execute on timeout
  };
  metadata?: Record<string, any>;
}

/**
 * FSM transition definition
 */
export interface FSMTransition {
  id: string;
  from: string;           // Source state ID
  to: string;             // Target state ID
  event: string;          // Event type that triggers transition
  condition?: string;     // Condition expression (JavaScript-like)
  actions?: FSMAction[];  // Actions to execute during transition
  priority?: number;      // Priority for conflict resolution
  metadata?: Record<string, any>;
}

/**
 * FSM action definition
 */
export interface FSMAction {
  type: 'emit_data' | 'modify_token' | 'log_activity' | 'set_variable' | 'call_function' | 'send_notification';
  parameters: Record<string, any>;
  condition?: string;     // Conditional execution
}

/**
 * Complete FSM configuration
 */
export interface FSMConfig {
  states: FSMState[];
  transitions: FSMTransition[];
  variables?: Record<string, any>;    // FSM-wide variables
  globalTimeout?: number;             // Global timeout for stuck processes
  parallelExecution?: boolean;        // Allow multiple tokens in different states
  strictValidation?: boolean;         // Enforce strict state/transition validation
  auditLevel?: 'minimal' | 'standard' | 'detailed';
}

/**
 * Token state tracking within FSM
 */
interface TokenFSMState {
  tokenId: string;
  currentState: string;
  correlationIds: string[]; // Store correlation IDs for token provenance
  stateHistory: Array<{
    state: string;
    entryTick: number;
    exitTick?: number;
    trigger?: string;
  }>;
  variables: Record<string, any>;
  lastTransition?: {
    from: string;
    to: string;
    trigger: string;
    timestamp: number;
  };
  timeoutScheduled?: {
    timestamp: number;
    targetState: string;
  };
}

/**
 * FSM processor for complex state-based workflows
 */
export class FSMProcessor extends BaseProcessor {
  readonly nodeType = 'FSM';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      // Validate that this is an event we can handle
      if (!this.validateEvent(event, ['TokenArrival', 'TimeTimeout', 'SimulationStart'])) {
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

      switch (event.type) {
        case 'SimulationStart':
          return this.handleSimulationStart(event, nodeConfig, newState, newEvents, activities);

        case 'TokenArrival':
          return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);

        case 'TimeTimeout':
          return this.handleTimeout(event, nodeConfig, newState, newEvents, activities);

        default:
          throw new Error(`Unhandled event type: ${event.type}`);
      }

    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  private handleSimulationStart(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Handle both direct config and nested fsm config structures
    const rawConfig = (nodeConfig.config || nodeConfig.fsm) as any;

    // Convert V3 format to processor format if needed
    const config = this.normalizeConfig(rawConfig);

    // Initialize FSM state
    newState.fsmConfig = config;
    newState.tokenStates = new Map<string, TokenFSMState>();
    newState.globalVariables = { ...config.variables || {} };
    newState.lastProcessedTick = event.timestamp;

    // Validate FSM configuration
    const validation = this.validateFSMConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid FSM configuration: ${validation.errors.join(', ')}`);
    }

    // FSM initialization - internal setup, no need to log this

    return { newEvents, newState, activities };
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

    // Debug: FSM processing token

    const config = newState.fsmConfig as FSMConfig;
    const tokenStates = newState.tokenStates as Map<string, TokenFSMState>;

    // Get or create token state
    let tokenState = tokenStates.get(token.id);
    if (!tokenState) {
      // New token - initialize in initial state
      const initialState = config.states.find(s => s.isInitial);
      if (!initialState) {
        throw new Error('FSM has no initial state defined');
      }

      tokenState = {
        tokenId: token.id,
        currentState: initialState.id,
        correlationIds: token.correlationIds || [], // Store correlation IDs for provenance
        stateHistory: [{
          state: initialState.id,
          entryTick: event.timestamp,
          trigger: 'arrival'
        }],
        variables: {},
      };

      tokenStates.set(token.id, tokenState);

      // Execute entry actions for initial state
      this.executeStateActions(initialState.onEntry || [], tokenState, token, event, nodeConfig, newEvents, activities);

      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.id,
          'token_entered_fsm',
          initialState.id,
          token.correlationIds
        )
      );

      // Process transitions for new token too - check if incoming data triggers transition
      this.processTokenTransitions(token, tokenState, event, nodeConfig, newState, newEvents, activities);
    } else {
      // Existing token - process transitions
      // Debug: Processing transitions
      this.processTokenTransitions(token, tokenState, event, nodeConfig, newState, newEvents, activities);
    }

    // Schedule timeout if needed
    this.scheduleStateTimeout(tokenState, config, event, newEvents);

    return { newEvents, newState, activities };
  }

  private handleTimeout(
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const tokenId = event.data?.tokenId;
    const timeoutType = event.data?.timeoutType;

    if (!tokenId) {
      return { newEvents, newState, activities };
    }

    const tokenStates = newState.tokenStates as Map<string, TokenFSMState>;
    const tokenState = tokenStates.get(tokenId);

    if (!tokenState) {
      return { newEvents, newState, activities };
    }

    const config = newState.fsmConfig as FSMConfig;

    if (timeoutType === 'state_timeout') {
      // Handle state timeout
      const currentState = config.states.find(s => s.id === tokenState.currentState);
      if (currentState?.timeout) {
        this.transitionToState(
          tokenState,
          currentState.timeout.targetState,
          'timeout',
          event,
          nodeConfig,
          newEvents,
          activities,
          config,
          tokenState.correlationIds // Use stored correlation IDs from token state
        );

        // Execute timeout action if defined
        if (currentState.timeout.action) {
          this.executeAction(currentState.timeout.action, tokenState, null, event, nodeConfig, newEvents, activities);
        }
      }
    }

    return { newEvents, newState, activities };
  }

  private processTokenTransitions(
    token: any,
    tokenState: TokenFSMState,
    event: EventData,
    nodeConfig: NodeConfig,
    newState: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): void {
    const config = newState.fsmConfig as FSMConfig;

    // Find applicable transitions from current state
    const applicableTransitions = config.transitions.filter(transition =>
      transition.from === tokenState.currentState
    );

    // Debug: Found transitions

    // Sort by priority
    applicableTransitions.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    // Find first transition with satisfied condition
    for (const transition of applicableTransitions) {
      const conditionResult = this.evaluateCondition(transition.condition, token, tokenState, newState.globalVariables);
      if (conditionResult) {
        // Execute transition
        this.executeTransition(transition, tokenState, token, event, nodeConfig, newEvents, activities, config);
        break;
      }
    }
  }

  private executeTransition(
    transition: FSMTransition,
    tokenState: TokenFSMState,
    token: any,
    event: EventData,
    nodeConfig: NodeConfig,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[],
    config: FSMConfig
  ): void {
    const fromState = config.states.find(s => s.id === transition.from);
    const toState = config.states.find(s => s.id === transition.to);

    if (!fromState || !toState) {
      throw new Error(`Invalid transition: ${transition.from} -> ${transition.to}`);
    }

    // Execute exit actions
    this.executeStateActions(fromState.onExit || [], tokenState, token, event, nodeConfig, newEvents, activities);

    // Execute transition actions
    this.executeActions(transition.actions || [], tokenState, token, event, nodeConfig, newEvents, activities);

    // Transition to new state
    this.transitionToState(tokenState, transition.to, transition.event, event, nodeConfig, newEvents, activities, config, token.correlationIds);

    // Execute entry actions
    this.executeStateActions(toState.onEntry || [], tokenState, token, event, nodeConfig, newEvents, activities);

    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'fsm_transition',
        { from: fromState.id, to: toState.id },
        token.correlationIds
      )
    );
  }

  private transitionToState(
    tokenState: TokenFSMState,
    newStateId: string,
    trigger: string,
    event: EventData,
    nodeConfig: NodeConfig,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[],
    config: FSMConfig,
    correlationIds?: string[]
  ): void {
    // Update state history
    const currentStateHistory = tokenState.stateHistory[tokenState.stateHistory.length - 1];
    if (currentStateHistory) {
      currentStateHistory.exitTick = event.timestamp;
    }

    // Record transition
    tokenState.lastTransition = {
      from: tokenState.currentState,
      to: newStateId,
      trigger,
      timestamp: event.timestamp,
    };

    // Update current state
    tokenState.currentState = newStateId;

    // Add new state to history
    tokenState.stateHistory.push({
      state: newStateId,
      entryTick: event.timestamp,
      trigger,
    });

    // Emit state based on configuration and state type
    const newState = config.states.find(s => s.id === newStateId);
    const isFinalState = newState?.isFinal || false;

    // Check if FSM has outputs configured - if so, emit after every transition
    // If no outputs configured, only emit on final states (backward compatibility)
    const hasOutputs = nodeConfig.outputs && nodeConfig.outputs.length > 0;
    const shouldEmit = hasOutputs || isFinalState;

    if (shouldEmit) {
      // Create token with current state value (preserve correlation IDs)
      const stateToken = this.createToken(
        newStateId, // Current state ID as the value
        nodeConfig.id,
        event.timestamp + 1,
        correlationIds // Preserve incoming correlation IDs
      );

      // Add FSM-specific metadata
      stateToken.metadata = {
        ...stateToken.metadata,
        fsmState: newStateId,
        isFinalState,
        totalStates: tokenState.stateHistory.length,
        tokenId: tokenState.tokenId
      };

      if (isFinalState) {
        stateToken.metadata.fsmCompleted = true;
        stateToken.metadata.finalState = newStateId;
      }

      // Emit state token - this should be routed to output destinations
      newEvents.push({
        timestamp: event.timestamp + 1,
        type: 'DataEmit',
        sourceNodeId: nodeConfig.id,
        targetNodeId: nodeConfig.id,
        data: {
          token: stateToken
        },
        causedBy: event.id,
        metadata: {
          fsmStateEmission: true,
          isFinalState,
          state: newStateId
        },
      });
    }
  }

  private executeStateActions(
    actions: FSMAction[],
    tokenState: TokenFSMState,
    token: any,
    event: EventData,
    nodeConfig: NodeConfig,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): void {
    this.executeActions(actions, tokenState, token, event, nodeConfig, newEvents, activities);
  }

  private executeActions(
    actions: FSMAction[],
    tokenState: TokenFSMState,
    token: any,
    event: EventData,
    nodeConfig: NodeConfig,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): void {
    for (const action of actions) {
      if (!action.condition || this.evaluateCondition(action.condition, token, tokenState, {})) {
        this.executeAction(action, tokenState, token, event, nodeConfig, newEvents, activities);
      }
    }
  }

  private executeAction(
    action: FSMAction,
    tokenState: TokenFSMState,
    token: any,
    event: EventData,
    nodeConfig: NodeConfig,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): void {
    switch (action.type) {
      case 'emit_data':
        newEvents.push({
          timestamp: event.timestamp + (action.parameters.delay || 1),
          type: 'DataEmit',
          sourceNodeId: nodeConfig.id,
          targetNodeId: nodeConfig.id,
          data: {
            token: {
              id: `${tokenState.tokenId}_action_${Date.now()}`,
              type: 'data',
              value: action.parameters.value,
              correlationIds: token?.correlationIds || [tokenState.tokenId],
              metadata: { actionGenerated: true, sourceAction: action.type },
              timestamp: event.timestamp,
              sourceNodeId: nodeConfig.id,
              lineage: [],
            }
          },
          causedBy: event.id,
          metadata: { actionGenerated: true },
        });
        break;

      case 'modify_token':
        if (token) {
          // Modify token properties
          Object.assign(token, action.parameters.changes || {});
        }
        break;

      case 'set_variable':
        tokenState.variables[action.parameters.name] = action.parameters.value;
        break;

      case 'log_activity':
        activities.push(
          this.createActivity(
            event.timestamp,
            nodeConfig.id,
            action.parameters.action || 'fsm_action',
            action.parameters.value || 'FSM action executed',
            token?.correlationIds
          )
        );
        break;

      case 'send_notification':
        // Create notification event
        newEvents.push({
          timestamp: event.timestamp + 1,
          type: 'DataEmit',
          sourceNodeId: nodeConfig.id,
          targetNodeId: nodeConfig.id,
          data: {
            notification: {
              type: action.parameters.type || 'info',
              message: action.parameters.message,
              recipient: action.parameters.recipient,
              tokenId: tokenState.tokenId,
            }
          },
          causedBy: event.id,
          metadata: { notification: true },
        });
        break;
    }
  }

  private evaluateCondition(
    condition: string | undefined,
    token: any,
    tokenState: TokenFSMState,
    globalVariables: Record<string, any>
  ): boolean {
    if (!condition) return true;

    try {
      // Simple condition evaluation - in production, use a proper expression evaluator
      // For demo purposes, support basic conditions

      // Handle direct property access like "action === 'start_processing'"
      if (token?.value && typeof token.value === 'object') {
        // Create evaluation context with token.value properties
        const context = {
          ...token.value,
          token: token,
          tokenState: tokenState,
          ...globalVariables
        };

        // Build evaluation function
        const func = new Function(...Object.keys(context), `return ${condition}`);
        return func(...Object.values(context));
      }

      if (condition.includes('token.value')) {
        const value = token?.value || 0;
        return eval(condition.replace('token.value', value.toString()));
      }

      if (condition.includes('state.variables.')) {
        // Replace state variables in condition
        let evaluableCondition = condition;
        for (const [key, value] of Object.entries(tokenState.variables)) {
          evaluableCondition = evaluableCondition.replace(`state.variables.${key}`, JSON.stringify(value));
        }
        return eval(evaluableCondition);
      }

      // Default: try to evaluate as-is (dangerous in production!)
      return eval(condition);
    } catch (error) {
      console.warn(`Failed to evaluate FSM condition: ${condition}`, error);
      return false;
    }
  }

  private scheduleStateTimeout(
    tokenState: TokenFSMState,
    config: FSMConfig,
    event: EventData,
    newEvents: Omit<EventData, 'id'>[]
  ): void {
    const currentState = config.states.find(s => s.id === tokenState.currentState);

    if (currentState?.timeout) {
      const timeoutTick = event.timestamp + currentState.timeout.duration;

      tokenState.timeoutScheduled = {
        timestamp: timeoutTick,
        targetState: currentState.timeout.targetState,
      };

      newEvents.push({
        timestamp: timeoutTick,
        type: 'TimeTimeout',
        sourceNodeId: event.sourceNodeId,
        targetNodeId: event.targetNodeId,
        data: {
          tokenId: tokenState.tokenId,
          timeoutType: 'state_timeout',
          currentState: currentState.id,
          targetState: currentState.timeout.targetState,
        },
        causedBy: event.id,
        metadata: { timeout: true, stateTimeout: true },
      });
    }
  }

  private validateFSMConfig(config: FSMConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for initial state
    const initialStates = config.states.filter(s => s.isInitial);
    if (initialStates.length === 0) {
      errors.push('FSM must have exactly one initial state');
    } else if (initialStates.length > 1) {
      errors.push('FSM can only have one initial state');
    }

    // Check for final states
    const finalStates = config.states.filter(s => s.isFinal);
    // Debug: Final states validation
    if (finalStates.length === 0) {
      errors.push('FSM should have at least one final state');
    }

    // Check transition validity
    const stateIds = new Set(config.states.map(s => s.id));
    for (const transition of config.transitions) {
      if (!stateIds.has(transition.from)) {
        errors.push(`Transition references unknown from state: ${transition.from}`);
      }
      if (!stateIds.has(transition.to)) {
        errors.push(`Transition references unknown to state: ${transition.to}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  getProcessorInfo() {
    return {
      nodeType: this.nodeType as const,
      description: 'Complex state-based workflow processor with configurable states and transitions',
      supportedEvents: ['TokenArrival', 'TimeTimeout', 'SimulationStart'] as const,
      configSchema: {
        states: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique state identifier' },
              name: { type: 'string', description: 'Human-readable state name' },
              description: { type: 'string' },
              isInitial: { type: 'boolean', default: false },
              isFinal: { type: 'boolean', default: false },
              onEntry: { type: 'array', description: 'Actions to execute on state entry' },
              onExit: { type: 'array', description: 'Actions to execute on state exit' },
              timeout: {
                type: 'object',
                properties: {
                  duration: { type: 'number', description: 'Timeout duration in ticks' },
                  targetState: { type: 'string', description: 'State to transition to on timeout' }
                }
              }
            },
            required: ['id', 'name']
          },
          minItems: 2
        },
        transitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              from: { type: 'string', description: 'Source state ID' },
              to: { type: 'string', description: 'Target state ID' },
              event: { type: 'string', description: 'Triggering event type' },
              condition: { type: 'string', description: 'Condition expression' },
              actions: { type: 'array', description: 'Actions to execute during transition' },
              priority: { type: 'number', default: 0 }
            },
            required: ['id', 'from', 'to', 'event']
          }
        },
        variables: { type: 'object', description: 'FSM-wide variables' },
        globalTimeout: { type: 'number', description: 'Global timeout for stuck processes' },
        parallelExecution: { type: 'boolean', default: false },
        strictValidation: { type: 'boolean', default: true },
        auditLevel: {
          type: 'string',
          enum: ['minimal', 'standard', 'detailed'],
          default: 'standard'
        }
      },
      examples: [
        {
          name: 'Order Processing FSM',
          description: 'Complete order lifecycle from pending to delivered',
          config: {
            states: [
              { id: 'pending', name: 'Pending', isInitial: true },
              { id: 'validated', name: 'Validated' },
              { id: 'paid', name: 'Paid' },
              { id: 'shipped', name: 'Shipped' },
              { id: 'delivered', name: 'Delivered', isFinal: true },
              { id: 'cancelled', name: 'Cancelled', isFinal: true }
            ],
            transitions: [
              { id: 't1', from: 'pending', to: 'validated', event: 'validate' },
              { id: 't2', from: 'validated', to: 'paid', event: 'payment' },
              { id: 't3', from: 'paid', to: 'shipped', event: 'ship' },
              { id: 't4', from: 'shipped', to: 'delivered', event: 'deliver' },
              { id: 't5', from: '*', to: 'cancelled', event: 'cancel' }
            ]
          }
        },
        {
          name: 'Document Approval FSM',
          description: 'Document review and approval workflow',
          config: {
            states: [
              { id: 'draft', name: 'Draft', isInitial: true },
              { id: 'review', name: 'Under Review', timeout: { duration: 72000, targetState: 'expired' } },
              { id: 'approved', name: 'Approved', isFinal: true },
              { id: 'rejected', name: 'Rejected' },
              { id: 'expired', name: 'Expired', isFinal: true }
            ],
            transitions: [
              { id: 't1', from: 'draft', to: 'review', event: 'submit' },
              { id: 't2', from: 'review', to: 'approved', event: 'approve' },
              { id: 't3', from: 'review', to: 'rejected', event: 'reject' },
              { id: 't4', from: 'rejected', to: 'draft', event: 'revise' }
            ]
          }
        }
      ]
    };
  }

  /**
   * Convert V3 FSM format to processor format
   */
  private normalizeConfig(rawConfig: any): FSMConfig {
    // If already in processor format, return as-is
    if (Array.isArray(rawConfig.states)) {
      return rawConfig as FSMConfig;
    }

    // Convert V3 format to processor format
    const states: FSMState[] = [];
    const transitions: FSMTransition[] = [];

    if (rawConfig.states && typeof rawConfig.states === 'object') {
      Object.entries(rawConfig.states).forEach(([stateId, stateConfig]: [string, any]) => {
        // Create state
        const state: FSMState = {
          id: stateId,
          name: stateId,
          isInitial: stateId === rawConfig.initialState,
          isFinal: !stateConfig.transitions || stateConfig.transitions.length === 0
        };
        states.push(state);

        // Create transitions from this state
        if (stateConfig.transitions) {
          stateConfig.transitions.forEach((transition: any) => {
            transitions.push({
              id: `${stateId}_to_${transition.targetState}`,
              from: stateId,
              to: transition.targetState,
              event: 'token_arrival', // Default event type
              condition: transition.condition,
              priority: 1,
              actions: []
            });
          });
        }
      });
    }

    return {
      states,
      transitions,
      variables: rawConfig.variables || {}
    };
  }

  initializeState(nodeConfig: NodeConfig): NodeInternalState {
    const baseState = super.initializeState(nodeConfig);
    return {
      ...baseState,
      fsmConfig: null,
      tokenStates: new Map(),
      globalVariables: {},
      lastProcessedTick: -1,
      errors: [],
    };
  }
}