/**
 * Enhanced FSM Simulation Engine
 *
 * Integrates Enhanced FSM nodes into the main simulation system, handling:
 * - Dual input streams (Events and Messages)
 * - Event interpretation rules
 * - Enhanced action system
 * - Feedback loop management
 * - Circuit breaker safety controls
 */

import {
  Event,
  Message,
  EnhancedFSMProcessNode,
  EnhancedFSMProcessNodeState,
  EnhancedFSMAction,
  ActionOutput,
  FeedbackLoopConfig,
  InterpretationResult,
  ActionExecutionResult,
  EventInterpretationRule,
} from "./enhanced-fsm-types";
import { EventInterpretationEngine } from "./event-interpretation-engine";
import { EnhancedActionSystem } from "./enhanced-action-system";
import { FeedbackLoopManager } from "./feedback-loop-manager";
import { Token, HistoryEntry } from "./types";
import { nanoid } from "@/lib/nanoid";
import { evaluateFormula } from "./formulaEngine";

export interface EnhancedFSMExecutionContext {
  nodeId: string;
  currentTime: number;
  simulationState: any; // Reference to simulation store state
  createToken: (originNodeId: string, value: any, timestamp: number, sourceTokens?: Token[]) => Token;
  logActivity: (nodeId: string, entry: Omit<HistoryEntry, "timestamp" | "nodeId" | "epochTimestamp" | "sequence" | "state" | "bufferSize" | "outputBufferSize">, timestamp: number) => HistoryEntry;
  routeTokenToNode: (token: Token, destinationNodeId: string, timestamp: number) => void;
  updateNodeState: (nodeId: string, partialState: Partial<any>) => void;
  transitionNodeState: (nodeId: string, newState: string, timestamp: number, trigger?: string) => void;
}

export class EnhancedFSMEngine {
  private interpretationEngine: EventInterpretationEngine;
  private actionSystem: EnhancedActionSystem;
  private feedbackManager: FeedbackLoopManager;
  private activeExecutions: Map<string, string> = new Map(); // nodeId -> executionId

  constructor() {
    // Initialize with default configurations
    const defaultFeedbackConfig: FeedbackLoopConfig = {
      enabled: true,
      maxDepth: 10,
      circuitBreaker: {
        enabled: true,
        threshold: 100,
        timeWindow: 60000,
        cooldownPeriod: 30000,
      },
      routing: {
        allowSelfFeedback: true,
        allowExternalFeedback: true,
        blacklistedNodes: [],
      },
    };

    this.interpretationEngine = new EventInterpretationEngine([]);
    this.actionSystem = new EnhancedActionSystem();
    this.feedbackManager = new FeedbackLoopManager(defaultFeedbackConfig);
  }

  /**
   * Process Enhanced FSM node during simulation tick
   */
  async processEnhancedFSMNode(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext
  ): Promise<void> {
    const { nodeId, currentTime } = context;

    // Get or create execution ID for this node
    let executionId = this.activeExecutions.get(nodeId);
    if (!executionId) {
      executionId = nanoid(12);
      this.activeExecutions.set(nodeId, executionId);
    }

    // Update interpretation engine with current rules
    this.interpretationEngine.updateRules(nodeConfig.fsm.interpretationRules);

    // Process events in event buffers
    await this.processEventBuffers(nodeConfig, nodeState, context, executionId);

    // Process messages in message buffers
    await this.processMessageBuffers(nodeConfig, nodeState, context, executionId);

    // Process token inputs (traditional workflow tokens)
    await this.processTokenInputs(nodeConfig, nodeState, context, executionId);

    // Check for state transitions
    await this.checkStateTransitions(nodeConfig, nodeState, context, executionId);

    // Execute pending actions
    await this.executePendingActions(nodeConfig, nodeState, context, executionId);

    // Update feedback metrics
    this.feedbackManager.recordEvent(nodeId, "event");
  }

  /**
   * Process events in event input buffers
   */
  private async processEventBuffers(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    const eventsToProcess = [...nodeState.eventBuffer];
    if (eventsToProcess.length === 0) return;

    // Process each event through interpretation rules
    for (const event of eventsToProcess) {
      try {
        const interpretationResult = await this.interpretationEngine.interpretEvent(event);

        if (interpretationResult.error) {
          context.logActivity(context.nodeId, {
            action: "interpretation_error",
            value: 0,
            details: `Event interpretation failed: ${interpretationResult.error}`,
          }, context.currentTime);
          continue;
        }

        // Add interpreted messages to message buffer
        interpretationResult.messages.forEach(message => {
          nodeState.messageBuffer.push(message);
        });

        context.logActivity(context.nodeId, {
          action: "event_interpreted",
          value: interpretationResult.messages.length,
          details: `Event ${event.id} → ${interpretationResult.messages.length} messages`,
        }, context.currentTime);

      } catch (error) {
        context.logActivity(context.nodeId, {
          action: "processing_error",
          value: 0,
          details: `Event processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }, context.currentTime);
      }
    }

    // Clear processed events
    nodeState.eventBuffer = [];
    nodeState.processedEventCount += eventsToProcess.length;
  }

  /**
   * Process messages in message input buffers
   */
  private async processMessageBuffers(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    const messagesToProcess = [...nodeState.messageBuffer];
    if (messagesToProcess.length === 0) return;

    // Check for message-triggered transitions
    for (const message of messagesToProcess) {
      const matchingTransitions = nodeConfig.fsm.transitions.filter(t =>
        t.trigger.type === "message" &&
        t.trigger.messageType === message.type &&
        t.from === nodeState.currentState
      );

      for (const transition of matchingTransitions) {
        // Check guard condition if present
        if (transition.guard) {
          const guardContext = this.buildGuardContext(nodeState, message);
          const { value: guardResult } = evaluateFormula(transition.guard, guardContext);
          if (!guardResult) continue;
        }

        // Execute transition
        await this.executeTransition(nodeConfig, nodeState, transition, context, executionId, {
          triggerMessage: message
        });
        break; // Only execute one transition per message
      }
    }

    // Clear processed messages
    nodeState.messageBuffer = [];
    nodeState.processedMessageCount += messagesToProcess.length;
  }

  /**
   * Process traditional token inputs
   */
  private async processTokenInputs(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    // Convert tokens to events for unified processing
    Object.entries(nodeState.tokenBuffers).forEach(([inputName, tokens]) => {
      tokens.forEach(token => {
        const event: Event = {
          id: nanoid(8),
          type: "token_received",
          timestamp: context.currentTime,
          rawData: {
            token,
            inputName,
            value: token.value,
            originNodeId: token.originNodeId
          },
          sourceType: "external",
          metadata: {
            inputName,
            tokenId: token.id,
            originNodeId: token.originNodeId
          }
        };

        nodeState.eventBuffer.push(event);
      });

      // Clear processed tokens
      nodeState.tokenBuffers[inputName] = [];
    });
  }

  /**
   * Check for condition and timer-based state transitions
   */
  private async checkStateTransitions(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    const currentTime = context.currentTime;

    // Check condition-based transitions
    const conditionTransitions = nodeConfig.fsm.transitions.filter(t =>
      t.trigger.type === "condition" && t.from === nodeState.currentState
    );

    for (const transition of conditionTransitions) {
      const conditionContext = this.buildConditionContext(nodeState);
      const { value: conditionResult } = evaluateFormula(transition.trigger.condition, conditionContext);

      if (conditionResult) {
        await this.executeTransition(nodeConfig, nodeState, transition, context, executionId);
        break; // Only execute one transition per tick
      }
    }

    // Check timer-based transitions
    const timerTransitions = nodeConfig.fsm.transitions.filter(t =>
      t.trigger.type === "timer" && t.from === nodeState.currentState
    );

    for (const transition of timerTransitions) {
      const timeInState = currentTime - nodeState.stateChangedAt;
      if (timeInState >= transition.trigger.timeout) {
        await this.executeTransition(nodeConfig, nodeState, transition, context, executionId);
        break;
      }
    }
  }

  /**
   * Execute a state transition
   */
  private async executeTransition(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    transition: any,
    context: EnhancedFSMExecutionContext,
    executionId: string,
    triggerData?: any
  ): Promise<void> {
    const oldState = nodeState.currentState;
    const newState = transition.to;

    // Log transition
    context.logActivity(context.nodeId, {
      action: "state_transition",
      value: 0,
      details: `${oldState} → ${newState} (${transition.trigger.type})`,
    }, context.currentTime);

    // Update transition history
    nodeState.transitionHistory.push({
      from: oldState,
      to: newState,
      timestamp: context.currentTime,
      trigger: transition.trigger.type,
      messageId: triggerData?.triggerMessage?.id,
      eventId: triggerData?.triggerEvent?.id,
    });

    // Update current state
    nodeState.previousState = oldState;
    nodeState.currentState = newState;
    nodeState.stateChangedAt = context.currentTime;

    // Update state machine tracking in simulation
    context.transitionNodeState(context.nodeId, newState, context.currentTime, transition.trigger.type);

    // Execute transition actions
    if (transition.actions) {
      for (const action of transition.actions) {
        await this.scheduleAction(action, context, executionId);
      }
    }

    // Execute exit actions for old state
    const oldStateConfig = nodeConfig.fsm.states.find(s => s.id === oldState);
    if (oldStateConfig?.actions) {
      const exitActions = oldStateConfig.actions.filter(a => a.trigger === "onExit");
      for (const action of exitActions) {
        await this.scheduleAction(action, context, executionId);
      }
    }

    // Execute entry actions for new state
    const newStateConfig = nodeConfig.fsm.states.find(s => s.id === newState);
    if (newStateConfig?.actions) {
      const entryActions = newStateConfig.actions.filter(a => a.trigger === "onEntry");
      for (const action of entryActions) {
        await this.scheduleAction(action, context, executionId);
      }
    }
  }

  /**
   * Schedule an action for execution
   */
  private async scheduleAction(
    action: EnhancedFSMAction,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    const executeAt = context.currentTime + (action.delay || 0);

    const pendingAction = {
      actionId: action.id,
      scheduledAt: context.currentTime,
      executeAt,
      context: {
        action,
        executionId,
        nodeId: context.nodeId
      }
    };

    // Get current node state to add to pending actions
    const currentState = context.simulationState.nodeStates[context.nodeId] as EnhancedFSMProcessNodeState;
    currentState.pendingActions.push(pendingAction);
  }

  /**
   * Execute pending actions that are due
   */
  private async executePendingActions(
    nodeConfig: EnhancedFSMProcessNode,
    nodeState: EnhancedFSMProcessNodeState,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    const currentTime = context.currentTime;
    const dueActions = nodeState.pendingActions.filter(pa => pa.executeAt <= currentTime);

    for (const pendingAction of dueActions) {
      try {
        const actionContext = {
          nodeId: context.nodeId,
          currentTime,
          variables: nodeState.variables,
          stateVariables: nodeState.stateVariables,
          eventBuffer: nodeState.eventBuffer,
          messageBuffer: nodeState.messageBuffer,
          tokenBuffers: nodeState.tokenBuffers,
        };

        const result = await this.actionSystem.executeAction(
          pendingAction.context.action,
          actionContext
        );

        // Process action outputs
        for (const output of result.outputs) {
          await this.processActionOutput(output, context, executionId);
        }

        // Log action execution
        nodeState.actionHistory.push({
          actionId: pendingAction.actionId,
          executedAt: currentTime,
          result: result.success ? "success" : "error",
          output: result.outputs,
          error: result.error
        });

        context.logActivity(context.nodeId, {
          action: "action_executed",
          value: result.outputs.length,
          details: `Action ${pendingAction.actionId}: ${result.success ? 'success' : 'error'}`,
        }, currentTime);

      } catch (error) {
        // Log action error
        nodeState.errors.push({
          timestamp: currentTime,
          type: "action_error",
          message: error instanceof Error ? error.message : "Unknown action error",
          context: { actionId: pendingAction.actionId }
        });

        context.logActivity(context.nodeId, {
          action: "action_error",
          value: 0,
          details: `Action ${pendingAction.actionId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }, currentTime);
      }
    }

    // Remove executed actions
    nodeState.pendingActions = nodeState.pendingActions.filter(pa => pa.executeAt > currentTime);
  }

  /**
   * Process action output (token emission, feedback, etc.)
   */
  private async processActionOutput(
    output: any,
    context: EnhancedFSMExecutionContext,
    executionId: string
  ): Promise<void> {
    switch (output.type) {
      case "token":
        // Create and route token
        const token = context.createToken(
          context.nodeId,
          output.data.value,
          context.currentTime
        );

        if (output.data.destinationNodeId) {
          context.routeTokenToNode(token, output.data.destinationNodeId, context.currentTime);
        }
        break;

      case "event":
        // Create feedback event
        const feedbackAllowed = this.feedbackManager.canCreateFeedback(
          context.nodeId,
          output.data.targetNodeId || context.nodeId,
          executionId,
          "event"
        );

        if (feedbackAllowed.allowed) {
          const event: Event = {
            id: nanoid(8),
            type: output.data.eventType,
            timestamp: context.currentTime,
            rawData: output.data.data,
            sourceType: "feedback",
            metadata: {
              sourceNodeId: context.nodeId,
              executionId,
              feedbackDepth: this.feedbackManager.getFeedbackPath(executionId).length
            }
          };

          // Route to target node or self
          const targetNodeId = output.data.targetNodeId || context.nodeId;
          const targetNodeState = context.simulationState.nodeStates[targetNodeId] as EnhancedFSMProcessNodeState;
          if (targetNodeState && targetNodeState.eventBuffer) {
            targetNodeState.eventBuffer.push(event);

            // Register feedback loop
            this.feedbackManager.registerFeedbackLoop(
              context.nodeId,
              targetNodeId,
              "event",
              executionId
            );
          }
        } else {
          context.logActivity(context.nodeId, {
            action: "feedback_blocked",
            value: 0,
            details: `Feedback blocked: ${feedbackAllowed.reason}`,
          }, context.currentTime);
        }
        break;

      case "message":
        // Create feedback message
        const messageFeedbackAllowed = this.feedbackManager.canCreateFeedback(
          context.nodeId,
          output.data.targetNodeId || context.nodeId,
          executionId,
          "message"
        );

        if (messageFeedbackAllowed.allowed) {
          const message: Message = {
            id: nanoid(8),
            type: output.data.messageType,
            timestamp: context.currentTime,
            payload: output.data.payload,
            sourceEventId: undefined,
            interpretationRuleId: undefined,
            confidence: 1.0
          };

          // Route to target node
          const targetNodeId = output.data.targetNodeId || context.nodeId;
          const targetNodeState = context.simulationState.nodeStates[targetNodeId] as EnhancedFSMProcessNodeState;
          if (targetNodeState && targetNodeState.messageBuffer) {
            targetNodeState.messageBuffer.push(message);

            // Register feedback loop
            this.feedbackManager.registerFeedbackLoop(
              context.nodeId,
              targetNodeId,
              "message",
              executionId
            );
          }
        }
        break;

      case "log":
        context.logActivity(context.nodeId, {
          action: "fsm_log",
          value: 0,
          details: output.data.message,
        }, context.currentTime);
        break;

      case "variable":
        // Update variable
        const currentState = context.simulationState.nodeStates[context.nodeId] as EnhancedFSMProcessNodeState;
        if (output.data.operation === "set") {
          currentState.variables[output.data.variableName] = output.data.value;
        } else if (output.data.operation === "increment") {
          currentState.variables[output.data.variableName] =
            (currentState.variables[output.data.variableName] || 0) + output.data.value;
        } else if (output.data.operation === "append") {
          if (!Array.isArray(currentState.variables[output.data.variableName])) {
            currentState.variables[output.data.variableName] = [];
          }
          currentState.variables[output.data.variableName].push(output.data.value);
        }
        break;
    }
  }

  /**
   * Build context for guard condition evaluation
   */
  private buildGuardContext(nodeState: EnhancedFSMProcessNodeState, message?: Message): Record<string, any> {
    return {
      variables: nodeState.variables,
      stateVariables: nodeState.stateVariables,
      currentState: nodeState.currentState,
      previousState: nodeState.previousState,
      message: message ? {
        type: message.type,
        payload: message.payload,
        confidence: message.confidence
      } : undefined,
      bufferSizes: {
        events: nodeState.eventBuffer.length,
        messages: nodeState.messageBuffer.length,
        tokens: Object.fromEntries(
          Object.entries(nodeState.tokenBuffers).map(([key, tokens]) => [key, tokens.length])
        )
      }
    };
  }

  /**
   * Build context for condition evaluation
   */
  private buildConditionContext(nodeState: EnhancedFSMProcessNodeState): Record<string, any> {
    return {
      variables: nodeState.variables,
      stateVariables: nodeState.stateVariables,
      currentState: nodeState.currentState,
      previousState: nodeState.previousState,
      timeInState: Date.now() - nodeState.stateChangedAt,
      eventCount: nodeState.processedEventCount,
      messageCount: nodeState.processedMessageCount,
      bufferSizes: {
        events: nodeState.eventBuffer.length,
        messages: nodeState.messageBuffer.length,
        tokens: Object.fromEntries(
          Object.entries(nodeState.tokenBuffers).map(([key, tokens]) => [key, tokens.length])
        )
      }
    };
  }

  /**
   * Initialize Enhanced FSM node state
   */
  initializeNodeState(nodeConfig: EnhancedFSMProcessNode): EnhancedFSMProcessNodeState {
    const initialState = nodeConfig.fsm.initialState ||
      nodeConfig.fsm.states.find(s => s.type === "initial")?.id ||
      nodeConfig.fsm.states[0]?.id ||
      "idle";

    return {
      currentState: initialState,
      previousState: undefined,
      stateChangedAt: 0,
      variables: { ...nodeConfig.fsm.variables } || {},
      stateVariables: {},
      eventBuffer: [],
      messageBuffer: [],
      tokenBuffers: {},
      lastProcessedTime: 0,
      processedEventCount: 0,
      processedMessageCount: 0,
      feedbackDepth: 0,
      circuitBreakerState: {
        isOpen: false,
        eventCount: 0,
        windowStartTime: 0,
      },
      stateHistory: [{
        state: initialState,
        enteredAt: 0,
      }],
      transitionHistory: [],
      pendingActions: [],
      actionHistory: [],
      errors: []
    };
  }

  /**
   * Get feedback metrics for a node
   */
  getFeedbackMetrics(): any {
    return this.feedbackManager.getMetrics();
  }

  /**
   * Reset circuit breaker for a node
   */
  resetCircuitBreaker(nodeId: string): boolean {
    return this.feedbackManager.resetCircuitBreaker(nodeId);
  }

  /**
   * Update feedback configuration
   */
  updateFeedbackConfig(config: Partial<FeedbackLoopConfig>): void {
    this.feedbackManager.updateConfig(config);
  }

  /**
   * Clean up execution tracking
   */
  cleanupExecution(nodeId: string): void {
    const executionId = this.activeExecutions.get(nodeId);
    if (executionId) {
      this.feedbackManager.forceCloseFeedbackExecution(executionId);
      this.activeExecutions.delete(nodeId);
    }
  }
}

// Global instance
export const enhancedFSMEngine = new EnhancedFSMEngine();