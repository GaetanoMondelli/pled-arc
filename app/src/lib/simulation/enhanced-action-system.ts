/**
 * Enhanced Action System
 *
 * This system handles the execution of various action types within the Enhanced FSM,
 * including token emission, event generation, API calls, and feedback loops.
 * It supports conditional execution, output routing, and error handling.
 */

/**
 * Generate a UUID v4 string
 */
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

import {
  EnhancedFSMAction,
  ActionOutput,
  ActionExecutionResult,
  Event,
  Message,
  FeedbackLoop,
} from "./enhanced-fsm-types";

export interface ActionExecutionContext {
  nodeId: string;
  stateName: string;
  variables: Record<string, any>;
  stateVariables: Record<string, any>;
  trigger?: string;
  inputEvent?: Event;
  inputMessage?: Message;
  timestamp: number;
}

export interface ActionSystemConfig {
  debugMode: boolean;
  enableFeedback: boolean;
  maxRetries: number;
  defaultTimeout: number;
  apiBaseUrl?: string;
  emailConfig?: {
    smtpHost: string;
    smtpPort: number;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export class EnhancedActionSystem {
  private config: ActionSystemConfig;
  private feedbackLoops: Map<string, FeedbackLoop> = new Map();
  private pendingActions: Map<string, any> = new Map();
  private outputCallbacks: Map<string, ActionOutputCallback> = new Map();

  constructor(config: ActionSystemConfig) {
    this.config = config;
  }

  /**
   * Register a callback for handling specific output types
   */
  registerOutputCallback(outputType: string, callback: ActionOutputCallback): void {
    this.outputCallbacks.set(outputType, callback);
  }

  /**
   * Execute an action with the given context
   */
  async executeAction(
    action: EnhancedFSMAction,
    context: ActionExecutionContext
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    const actionResult: ActionExecutionResult = {
      actionId: action.id,
      success: false,
      outputs: [],
      executionTime: 0,
    };

    if (!action.enabled) {
      actionResult.success = true;
      actionResult.executionTime = Date.now() - startTime;
      return actionResult;
    }

    try {
      // Execute each output in the action
      for (const output of action.outputs) {
        try {
          // Check output condition if specified
          if (output.condition && !this.evaluateCondition(output.condition, context)) {
            if (this.config.debugMode) {
              console.log(`Skipping output ${output.id} - condition not met: ${output.condition}`);
            }
            continue;
          }

          // Apply delay if specified
          if (output.delay && output.delay > 0) {
            await this.delay(output.delay);
          }

          // Execute the output
          const outputResult = await this.executeOutput(output, context);
          actionResult.outputs.push(outputResult);

          if (this.config.debugMode) {
            console.log(`Executed output ${output.id}:`, outputResult);
          }
        } catch (error) {
          const errorMsg = `Output ${output.id} failed: ${error instanceof Error ? error.message : String(error)}`;
          actionResult.outputs.push({
            type: output.type.outputType,
            data: null,
            error: errorMsg,
          });

          if (this.config.debugMode) {
            console.error(errorMsg);
          }

          // Handle error based on action configuration
          if (action.onError === "stop") {
            throw new Error(errorMsg);
          }
          // Continue with next output for "continue" mode
        }
      }

      actionResult.success = true;
    } catch (error) {
      actionResult.error = error instanceof Error ? error.message : String(error);

      // Handle retries if configured
      if (action.retryCount > 0) {
        // Implement retry logic here
        // For now, just log the retry attempt
        if (this.config.debugMode) {
          console.log(`Action ${action.id} failed, retries remaining: ${action.retryCount}`);
        }
      }
    }

    actionResult.executionTime = Date.now() - startTime;
    return actionResult;
  }

  /**
   * Execute a specific output
   */
  private async executeOutput(
    output: ActionOutput,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any; error?: string }> {
    const outputType = output.type.outputType;

    switch (outputType) {
      case "event":
        return this.executeEventOutput(output.type as any, context);

      case "message":
        return this.executeMessageOutput(output.type as any, context);

      case "token":
        return this.executeTokenOutput(output.type as any, context);

      case "api_call":
        return this.executeApiCallOutput(output.type as any, context);

      case "log":
        return this.executeLogOutput(output.type as any, context);

      case "email":
        return this.executeEmailOutput(output.type as any, context);

      case "variable":
        return this.executeVariableOutput(output.type as any, context);

      default:
        throw new Error(`Unknown output type: ${outputType}`);
    }
  }

  /**
   * Execute event output (for feedback loops)
   */
  private async executeEventOutput(
    output: Extract<ActionOutput["type"], { outputType: "event" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const event: Event = {
      id: this.generateId("evt"),
      type: output.eventType,
      timestamp: Date.now(),
      rawData: this.substituteVariables(output.data, context),
      sourceType: "feedback",
      metadata: {
        sourceNodeId: context.nodeId,
        sourceState: context.stateName,
        generatedBy: "action",
      },
    };

    // Handle routing
    if (output.targetStream === "self" && this.config.enableFeedback) {
      // Route back to the same node
      const callback = this.outputCallbacks.get("event");
      if (callback) {
        await callback.handleOutput(event, { targetNodeId: context.nodeId });
      }

      // Track feedback loop
      const feedbackLoop: FeedbackLoop = {
        id: this.generateId("fb"),
        sourceNodeId: context.nodeId,
        targetNodeId: context.nodeId,
        outputType: "event",
        createdAt: Date.now(),
        depth: 1, // This would be calculated based on context
      };
      this.feedbackLoops.set(feedbackLoop.id, feedbackLoop);
    } else {
      // Route to external system
      const callback = this.outputCallbacks.get("event");
      if (callback) {
        await callback.handleOutput(event, {});
      }
    }

    return {
      type: "event",
      data: event,
    };
  }

  /**
   * Execute message output (for feedback loops)
   */
  private async executeMessageOutput(
    output: Extract<ActionOutput["type"], { outputType: "message" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const message: Message = {
      id: this.generateId("msg"),
      type: output.messageType,
      timestamp: Date.now(),
      payload: this.substituteVariables(output.payload, context),
    };

    // Handle routing
    const targetNodeId = output.targetNodeId || context.nodeId;
    const callback = this.outputCallbacks.get("message");
    if (callback) {
      await callback.handleOutput(message, { targetNodeId });
    }

    // Track feedback loop if routing to self
    if (targetNodeId === context.nodeId && this.config.enableFeedback) {
      const feedbackLoop: FeedbackLoop = {
        id: this.generateId("fb"),
        sourceNodeId: context.nodeId,
        targetNodeId: targetNodeId,
        outputType: "message",
        createdAt: Date.now(),
        depth: 1,
      };
      this.feedbackLoops.set(feedbackLoop.id, feedbackLoop);
    }

    return {
      type: "message",
      data: message,
    };
  }

  /**
   * Execute token output (traditional behavior)
   */
  private async executeTokenOutput(
    output: Extract<ActionOutput["type"], { outputType: "token" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    // Evaluate the formula to get the token value
    const value = this.evaluateFormula(output.formula, context);

    const token = {
      id: this.generateId("tok"),
      value,
      createdAt: Date.now(),
      originNodeId: context.nodeId,
      history: [], // Would be populated by the simulation engine
    };

    // Route to destination
    const callback = this.outputCallbacks.get("token");
    if (callback) {
      await callback.handleOutput(token, {
        targetNodeId: output.destinationNodeId,
        targetInputName: output.destinationInputName,
      });
    }

    return {
      type: "token",
      data: token,
    };
  }

  /**
   * Execute API call output
   */
  private async executeApiCallOutput(
    output: Extract<ActionOutput["type"], { outputType: "api_call" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const url = this.substituteVariables(output.url, context);
    const headers = output.headers ? this.substituteVariables(output.headers, context) : {};
    const body = output.body ? this.substituteVariables(output.body, context) : undefined;

    try {
      const response = await fetch(url, {
        method: output.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseData = await response.json();

      // Apply response mapping if specified
      let mappedResponse = responseData;
      if (output.responseMapping) {
        mappedResponse = {};
        for (const [targetVar, sourcePath] of Object.entries(output.responseMapping)) {
          mappedResponse[targetVar] = this.getNestedProperty(responseData, sourcePath);
        }

        // Update context variables with mapped response
        Object.assign(context.variables, mappedResponse);
      }

      return {
        type: "api_call",
        data: {
          request: { url, method: output.method, headers, body },
          response: responseData,
          mapped: mappedResponse,
          status: response.status,
        },
      };
    } catch (error) {
      throw new Error(`API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute log output
   */
  private async executeLogOutput(
    output: Extract<ActionOutput["type"], { outputType: "log" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const message = this.substituteVariables(output.message, context);
    const logEntry = {
      level: output.level,
      message,
      timestamp: Date.now(),
      nodeId: context.nodeId,
      state: context.stateName,
    };

    // Log to console based on level
    switch (output.level) {
      case "debug":
        console.debug(`[${context.nodeId}:${context.stateName}] ${message}`);
        break;
      case "info":
        console.info(`[${context.nodeId}:${context.stateName}] ${message}`);
        break;
      case "warn":
        console.warn(`[${context.nodeId}:${context.stateName}] ${message}`);
        break;
      case "error":
        console.error(`[${context.nodeId}:${context.stateName}] ${message}`);
        break;
    }

    // Send to callback for external logging systems
    const callback = this.outputCallbacks.get("log");
    if (callback) {
      await callback.handleOutput(logEntry, {});
    }

    return {
      type: "log",
      data: logEntry,
    };
  }

  /**
   * Execute email output
   */
  private async executeEmailOutput(
    output: Extract<ActionOutput["type"], { outputType: "email" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const emailData = {
      to: this.substituteVariables(output.to, context),
      subject: this.substituteVariables(output.subject, context),
      body: this.substituteVariables(output.body, context),
      attachments: output.attachments || [],
      sentAt: Date.now(),
    };

    // In a real implementation, you'd integrate with an email service
    if (this.config.debugMode) {
      console.log("Email would be sent:", emailData);
    }

    // Send to callback for actual email delivery
    const callback = this.outputCallbacks.get("email");
    if (callback) {
      await callback.handleOutput(emailData, {});
    }

    return {
      type: "email",
      data: emailData,
    };
  }

  /**
   * Execute variable update output
   */
  private async executeVariableOutput(
    output: Extract<ActionOutput["type"], { outputType: "variable" }>,
    context: ActionExecutionContext
  ): Promise<{ type: string; data: any }> {
    const variableName = output.variableName;
    const newValue = this.substituteVariables(output.value, context);

    // Determine target variable store (state vs global)
    const targetStore = variableName.startsWith("state.")
      ? context.stateVariables
      : context.variables;

    const actualVarName = variableName.startsWith("state.")
      ? variableName.substring(6)
      : variableName;

    // Apply operation
    switch (output.operation) {
      case "set":
        targetStore[actualVarName] = newValue;
        break;
      case "increment":
        targetStore[actualVarName] = (targetStore[actualVarName] || 0) + (Number(newValue) || 1);
        break;
      case "append":
        if (!Array.isArray(targetStore[actualVarName])) {
          targetStore[actualVarName] = [];
        }
        targetStore[actualVarName].push(newValue);
        break;
    }

    return {
      type: "variable",
      data: {
        variableName: actualVarName,
        operation: output.operation,
        newValue: targetStore[actualVarName],
      },
    };
  }

  /**
   * Evaluate a condition formula
   */
  private evaluateCondition(condition: string, context: ActionExecutionContext): boolean {
    try {
      const result = this.evaluateFormula(condition, context);
      return Boolean(result);
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(`Condition evaluation failed: ${condition}`, error);
      }
      return false;
    }
  }

  /**
   * Evaluate a formula with the given context
   */
  private evaluateFormula(formula: string, context: ActionExecutionContext): any {
    // Create evaluation context
    const evalContext = {
      variables: context.variables,
      state: context.stateVariables,
      input: context.inputMessage?.payload || context.inputEvent?.rawData || {},
      timestamp: context.timestamp,
      nodeId: context.nodeId,
      stateName: context.stateName,
      trigger: context.trigger,
      // Utility functions
      now: () => Date.now(),
      random: () => Math.random(),
      uuid: () => this.generateId("uuid"),
    };

    try {
      // In production, use a safer expression evaluator
      const func = new Function("context", `with(context) { return ${formula}; }`);
      return func(evalContext);
    } catch (error) {
      throw new Error(`Formula evaluation error: ${error}`);
    }
  }

  /**
   * Substitute variables in a template string or object
   */
  private substituteVariables(template: any, context: ActionExecutionContext): any {
    if (typeof template === "string") {
      return template
        .replace(/\{\{variables\.([^}]+)\}\}/g, (_, varName) => context.variables[varName] || "")
        .replace(/\{\{state\.([^}]+)\}\}/g, (_, varName) => context.stateVariables[varName] || "")
        .replace(/\{\{input\.([^}]+)\}\}/g, (_, path) => {
          const inputData = context.inputMessage?.payload || context.inputEvent?.rawData || {};
          return this.getNestedProperty(inputData, path) || "";
        })
        .replace(/\{\{nodeId\}\}/g, context.nodeId)
        .replace(/\{\{stateName\}\}/g, context.stateName)
        .replace(/\{\{timestamp\}\}/g, String(context.timestamp));
    } else if (Array.isArray(template)) {
      return template.map(item => this.substituteVariables(item, context));
    } else if (typeof template === "object" && template !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.substituteVariables(value, context);
      }
      return result;
    }
    return template;
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return generateGuid();
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get feedback loops for a node
   */
  getFeedbackLoops(nodeId?: string): FeedbackLoop[] {
    const loops = Array.from(this.feedbackLoops.values());
    return nodeId ? loops.filter(loop => loop.sourceNodeId === nodeId || loop.targetNodeId === nodeId) : loops;
  }

  /**
   * Clear old feedback loops
   */
  clearOldFeedbackLoops(maxAge: number = 3600000): void { // Default 1 hour
    const cutoff = Date.now() - maxAge;
    for (const [id, loop] of this.feedbackLoops.entries()) {
      if (loop.createdAt < cutoff) {
        this.feedbackLoops.delete(id);
      }
    }
  }
}

/**
 * Callback interface for handling action outputs
 */
export interface ActionOutputCallback {
  handleOutput(output: any, routing: { targetNodeId?: string; targetInputName?: string }): Promise<void>;
}

/**
 * Factory for creating common action configurations
 */
export class ActionFactory {
  /**
   * Create a simple token emission action
   */
  static createTokenEmissionAction(formula: string, destinationNodeId: string): EnhancedFSMAction {
    return {
      id: generateGuid(),
      name: "Emit Token",
      description: "Emit a token with calculated value",
      enabled: true,
      trigger: "onEntry",
      outputs: [{
        id: "token_output",
        type: {
          outputType: "token",
          formula,
          destinationNodeId,
        },
      }],
      onError: "continue",
      retryCount: 0,
      timeout: 5000,
    };
  }

  /**
   * Create a logging action
   */
  static createLoggingAction(message: string, level: "debug" | "info" | "warn" | "error" = "info"): EnhancedFSMAction {
    return {
      id: generateGuid(),
      name: "Log Message",
      description: "Log a message",
      enabled: true,
      trigger: "onEntry",
      outputs: [{
        id: "log_output",
        type: {
          outputType: "log",
          level,
          message,
        },
      }],
      onError: "continue",
      retryCount: 0,
      timeout: 1000,
    };
  }

  /**
   * Create an API call action
   */
  static createApiCallAction(
    url: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: any,
    responseMapping?: Record<string, string>
  ): EnhancedFSMAction {
    return {
      id: generateGuid(),
      name: "API Call",
      description: `${method} request to ${url}`,
      enabled: true,
      trigger: "onEntry",
      outputs: [{
        id: "api_output",
        type: {
          outputType: "api_call",
          method,
          url,
          body,
          responseMapping,
        },
      }],
      onError: "continue",
      retryCount: 1,
      timeout: 10000,
    };
  }

  /**
   * Create a feedback loop action
   */
  static createFeedbackAction(eventType: string, data: any): EnhancedFSMAction {
    return {
      id: generateGuid(),
      name: "Generate Feedback Event",
      description: "Generate an event for feedback processing",
      enabled: true,
      trigger: "onEntry",
      outputs: [{
        id: "feedback_output",
        type: {
          outputType: "event",
          eventType,
          data,
          targetStream: "self",
        },
      }],
      onError: "continue",
      retryCount: 0,
      timeout: 5000,
    };
  }
}