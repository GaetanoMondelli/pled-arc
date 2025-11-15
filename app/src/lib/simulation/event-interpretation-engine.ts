/**
 * Event Interpretation Engine
 *
 * This engine handles the transformation of raw events into structured messages
 * that can be processed by the Enhanced FSM system. It supports multiple
 * interpretation methods including pattern matching, formulas, AI/LLM, and custom scripts.
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
  Event,
  Message,
  EventInterpretationRule,
  InterpretationResult,
} from "./enhanced-fsm-types";

export class EventInterpretationEngine {
  private rules: Map<string, EventInterpretationRule> = new Map();
  private aiClient?: AIClient; // For AI-powered interpretation
  private debugMode: boolean = false;

  constructor(options: { debugMode?: boolean; aiClient?: AIClient } = {}) {
    this.debugMode = options.debugMode || false;
    this.aiClient = options.aiClient;
  }

  /**
   * Add an interpretation rule to the engine
   */
  addRule(rule: EventInterpretationRule): void {
    this.rules.set(rule.id, rule);
    if (this.debugMode) {
      console.log(`Added interpretation rule: ${rule.name} (${rule.id})`);
    }
  }

  /**
   * Remove an interpretation rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (this.debugMode && removed) {
      console.log(`Removed interpretation rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Update an existing rule
   */
  updateRule(rule: EventInterpretationRule): boolean {
    if (this.rules.has(rule.id)) {
      this.rules.set(rule.id, rule);
      if (this.debugMode) {
        console.log(`Updated interpretation rule: ${rule.name} (${rule.id})`);
      }
      return true;
    }
    return false;
  }

  /**
   * Get all rules sorted by priority
   */
  getRules(): EventInterpretationRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Interpret an event into messages using all matching rules
   */
  async interpretEvent(event: Event): Promise<InterpretationResult> {
    const startTime = Date.now();
    const messages: Message[] = [];
    const errors: string[] = [];

    try {
      // Find matching rules
      const matchingRules = this.findMatchingRules(event);

      if (this.debugMode) {
        console.log(`Found ${matchingRules.length} matching rules for event ${event.id}`);
      }

      // Apply each matching rule
      for (const rule of matchingRules) {
        try {
          const ruleMessages = await this.applyRule(rule, event);
          messages.push(...ruleMessages);

          if (this.debugMode) {
            console.log(`Rule ${rule.name} generated ${ruleMessages.length} messages`);
          }
        } catch (error) {
          const errorMsg = `Rule ${rule.name} failed: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);

          if (this.debugMode) {
            console.error(errorMsg);
          }
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        messages,
        processingTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error) {
      return {
        messages: [],
        processingTime: Date.now() - startTime,
        error: `Interpretation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Find rules that match the given event
   */
  private findMatchingRules(event: Event): EventInterpretationRule[] {
    return this.getRules().filter(rule => {
      if (!rule.enabled) return false;

      const conditions = rule.conditions;

      // Check event types
      if (conditions.eventTypes && !conditions.eventTypes.includes(event.type)) {
        return false;
      }

      // Check source types
      if (conditions.sourceTypes && !conditions.sourceTypes.includes(event.sourceType)) {
        return false;
      }

      // Check event pattern
      if (conditions.eventPattern) {
        const pattern = new RegExp(conditions.eventPattern, "i");
        const eventText = this.getEventText(event);
        if (!pattern.test(eventText)) {
          return false;
        }
      }

      // Check metadata conditions
      if (conditions.metadata) {
        for (const [key, expectedValue] of Object.entries(conditions.metadata)) {
          if (event.metadata?.[key] !== expectedValue) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Apply a specific rule to an event
   */
  private async applyRule(rule: EventInterpretationRule, event: Event): Promise<Message[]> {
    const method = rule.method;

    switch (method.type) {
      case "pattern":
        return this.applyPatternRule(method, event, rule);

      case "formula":
        return this.applyFormulaRule(method, event, rule);

      case "ai":
        return this.applyAIRule(method, event, rule);

      case "script":
        return this.applyScriptRule(method, event, rule);

      case "passthrough":
        return this.applyPassthroughRule(method, event, rule);

      default:
        throw new Error(`Unknown interpretation method: ${(method as any).type}`);
    }
  }

  /**
   * Apply pattern-based rule
   */
  private applyPatternRule(
    method: Extract<EventInterpretationRule["method"], { type: "pattern" }>,
    event: Event,
    rule: EventInterpretationRule
  ): Message[] {
    const messages: Message[] = [];
    const eventText = this.getEventText(event);

    for (const patternConfig of method.patterns) {
      const pattern = new RegExp(patternConfig.pattern, "gi");
      const matches = Array.from(eventText.matchAll(pattern));

      for (const match of matches) {
        const payload: Record<string, any> = { originalEvent: event.rawData };

        // Extract fields using capture groups or named groups
        if (patternConfig.extractFields) {
          for (const [fieldName, captureRef] of Object.entries(patternConfig.extractFields)) {
            if (captureRef.startsWith("$")) {
              // Capture group reference (e.g., "$1", "$2")
              const groupIndex = parseInt(captureRef.substring(1));
              if (match[groupIndex] !== undefined) {
                payload[fieldName] = match[groupIndex];
              }
            } else if (match.groups && match.groups[captureRef]) {
              // Named group reference
              payload[fieldName] = match.groups[captureRef];
            }
          }
        }

        messages.push({
          id: this.generateMessageId(),
          type: patternConfig.messageType,
          timestamp: Date.now(),
          payload,
          sourceEventId: event.id,
          interpretationRuleId: rule.id,
        });
      }
    }

    return messages;
  }

  /**
   * Apply formula-based rule
   */
  private applyFormulaRule(
    method: Extract<EventInterpretationRule["method"], { type: "formula" }>,
    event: Event,
    rule: EventInterpretationRule
  ): Message[] {
    try {
      // Create a safe evaluation context
      const context = {
        event: event.rawData,
        metadata: event.metadata || {},
        timestamp: event.timestamp,
        type: event.type,
        sourceType: event.sourceType,
      };

      // Evaluate the formula (in a real implementation, you'd want a safer eval)
      const result = this.evaluateFormula(method.formula, context);

      if (result !== null && result !== undefined) {
        return [{
          id: this.generateMessageId(),
          type: method.messageType,
          timestamp: Date.now(),
          payload: typeof result === "object" ? result : { value: result },
          sourceEventId: event.id,
          interpretationRuleId: rule.id,
        }];
      }

      return [];
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply AI-powered rule
   */
  private async applyAIRule(
    method: Extract<EventInterpretationRule["method"], { type: "ai" }>,
    event: Event,
    rule: EventInterpretationRule
  ): Promise<Message[]> {
    if (!this.aiClient) {
      throw new Error("AI client not configured");
    }

    const prompt = this.substitutePromptVariables(method.prompt, event);

    try {
      const response = await this.aiClient.interpret({
        prompt,
        event,
        possibleMessageTypes: method.messageTypes,
        model: method.model,
      });

      // Only include results above confidence threshold
      const filteredResults = response.interpretations.filter(
        interp => interp.confidence >= method.confidenceThreshold
      );

      return filteredResults.map(interp => ({
        id: this.generateMessageId(),
        type: interp.messageType,
        timestamp: Date.now(),
        payload: interp.payload,
        sourceEventId: event.id,
        interpretationRuleId: rule.id,
        confidence: interp.confidence,
      }));
    } catch (error) {
      throw new Error(`AI interpretation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply custom script rule
   */
  private applyScriptRule(
    method: Extract<EventInterpretationRule["method"], { type: "script" }>,
    event: Event,
    rule: EventInterpretationRule
  ): Message[] {
    try {
      // Create execution context
      const context = {
        event,
        utils: {
          generateId: () => this.generateMessageId(),
          now: () => Date.now(),
          log: this.debugMode ? console.log : () => {},
        },
      };

      // Execute the script (in a real implementation, you'd want sandboxing)
      const result = this.executeScript(method.script, context);

      if (Array.isArray(result)) {
        // Script returned multiple messages
        return result.map(r => ({
          id: this.generateMessageId(),
          type: method.messageType,
          timestamp: Date.now(),
          payload: r,
          sourceEventId: event.id,
          interpretationRuleId: rule.id,
        }));
      } else if (result !== null && result !== undefined) {
        // Script returned single result
        return [{
          id: this.generateMessageId(),
          type: method.messageType,
          timestamp: Date.now(),
          payload: typeof result === "object" ? result : { value: result },
          sourceEventId: event.id,
          interpretationRuleId: rule.id,
        }];
      }

      return [];
    } catch (error) {
      throw new Error(`Script execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply passthrough rule
   */
  private applyPassthroughRule(
    method: Extract<EventInterpretationRule["method"], { type: "passthrough" }>,
    event: Event,
    rule: EventInterpretationRule
  ): Message[] {
    let payload = event.rawData;

    // Apply field mapping if specified
    if (method.fieldMapping) {
      payload = {};
      for (const [targetField, sourceField] of Object.entries(method.fieldMapping)) {
        if (this.hasNestedProperty(event.rawData, sourceField)) {
          payload[targetField] = this.getNestedProperty(event.rawData, sourceField);
        }
      }
    }

    return [{
      id: this.generateMessageId(),
      type: method.messageType,
      timestamp: Date.now(),
      payload,
      sourceEventId: event.id,
      interpretationRuleId: rule.id,
    }];
  }

  /**
   * Get text representation of event for pattern matching
   */
  private getEventText(event: Event): string {
    if (typeof event.rawData === "string") {
      return event.rawData;
    } else if (typeof event.rawData === "object") {
      return JSON.stringify(event.rawData);
    }
    return String(event.rawData);
  }

  /**
   * Substitute variables in AI prompt
   */
  private substitutePromptVariables(prompt: string, event: Event): string {
    return prompt
      .replace(/\{\{event\.type\}\}/g, event.type)
      .replace(/\{\{event\.data\}\}/g, this.getEventText(event))
      .replace(/\{\{event\.timestamp\}\}/g, new Date(event.timestamp).toISOString());
  }

  /**
   * Evaluate a formula in a safe context
   * In production, you'd want to use a proper expression evaluator
   */
  private evaluateFormula(formula: string, context: any): any {
    // This is a simplified implementation
    // In production, use a safe expression evaluator like expr-eval
    try {
      const func = new Function("context", `with(context) { return ${formula}; }`);
      return func(context);
    } catch (error) {
      throw new Error(`Formula evaluation error: ${error}`);
    }
  }

  /**
   * Execute a script in a controlled context
   * In production, you'd want proper sandboxing
   */
  private executeScript(script: string, context: any): any {
    try {
      const func = new Function("context", script);
      return func(context);
    } catch (error) {
      throw new Error(`Script execution error: ${error}`);
    }
  }

  /**
   * Check if object has nested property
   */
  private hasNestedProperty(obj: any, path: string): boolean {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return true;
  }

  /**
   * Get nested property value
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
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return generateGuid();
  }
}

/**
 * AI Client interface for AI-powered interpretation
 */
export interface AIClient {
  interpret(request: {
    prompt: string;
    event: Event;
    possibleMessageTypes: string[];
    model?: string;
  }): Promise<{
    interpretations: Array<{
      messageType: string;
      payload: Record<string, any>;
      confidence: number;
    }>;
  }>;
}

/**
 * Example rule factory functions for common use cases
 */
export class RuleFactory {
  /**
   * Create an email processing rule
   */
  static createEmailRule(): EventInterpretationRule {
    return {
      id: "email_processor",
      name: "Email Processor",
      description: "Processes email events and extracts key information",
      enabled: true,
      priority: 100,
      conditions: {
        eventTypes: ["email"],
      },
      method: {
        type: "pattern",
        patterns: [
          {
            pattern: /subject:\s*(.+)/i,
            messageType: "email_received",
            extractFields: {
              subject: "$1",
            },
          },
          {
            pattern: /signature\s+requested/i,
            messageType: "signature_requested",
            extractFields: {},
          },
          {
            pattern: /document\s+signed/i,
            messageType: "document_signed",
            extractFields: {},
          },
        ],
      },
    };
  }

  /**
   * Create a sensor data rule
   */
  static createSensorDataRule(): EventInterpretationRule {
    return {
      id: "sensor_data_processor",
      name: "Sensor Data Processor",
      description: "Processes IoT sensor readings",
      enabled: true,
      priority: 100,
      conditions: {
        eventTypes: ["sensor_reading"],
      },
      method: {
        type: "formula",
        formula: `
          const reading = event.value;
          if (reading > 100) {
            return { level: "high", value: reading, alert: true };
          } else if (reading < 10) {
            return { level: "low", value: reading, alert: true };
          } else {
            return { level: "normal", value: reading, alert: false };
          }
        `,
        messageType: "sensor_reading_processed",
      },
    };
  }

  /**
   * Create an AI-powered document analysis rule
   */
  static createDocumentAnalysisRule(): EventInterpretationRule {
    return {
      id: "ai_document_analyzer",
      name: "AI Document Analyzer",
      description: "Uses AI to analyze document content and extract intents",
      enabled: true,
      priority: 90,
      conditions: {
        eventTypes: ["document", "pdf", "contract"],
      },
      method: {
        type: "ai",
        model: "gpt-4",
        prompt: `
          Analyze this document and determine what type of business process it represents.
          Document content: {{event.data}}

          Possible interpretations:
          - contract_negotiation: If it's a contract being negotiated
          - payment_request: If it's requesting payment
          - service_completion: If it indicates work is done
          - compliance_check: If it requires compliance verification
        `,
        messageTypes: ["contract_negotiation", "payment_request", "service_completion", "compliance_check"],
        confidenceThreshold: 0.7,
      },
    };
  }
}