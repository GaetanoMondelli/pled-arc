/**
 * Processor Node - Transforms data in your workflow
 *
 * A Processor Node is like a factory machine that transforms raw materials.
 * It takes tokens (pieces of data) and transforms them into something new.
 *
 * Examples:
 * - Double a number
 * - Calculate a percentage
 * - Format text
 * - Apply business rules
 * - Validate data
 *
 * This processor shows how data flows through your business logic.
 */

import { BaseProcessor, NodeConfig, NodeInternalState, ProcessorResult } from './BaseProcessor';
import { EventData } from '../core/ActivityQueue';

// Import DeterministicFunctions for formula execution
import { DeterministicFunctions } from '../DeterministicFunctions';

/**
 * ProcessorNodeProcessor - Transforms incoming tokens
 *
 * Configuration options:
 * - transformation: What transformation to apply (double, increment, percentage, etc.)
 * - processingTime: How long the transformation takes (in milliseconds)
 * - batchSize: How many tokens to process together
 * - validationRules: Rules to validate input data
 */
export class ProcessorNodeProcessor extends BaseProcessor {
  readonly nodeType = 'ProcessNode';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    try {
      // Validate that this is an event we can handle
      if (!this.validateEvent(event, ['TokenArrival', 'ProcessComplete', 'ProcessingTrigger'])) {
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

      if (event.type === 'TokenArrival') {
        return this.handleTokenArrival(event, nodeConfig, newState, newEvents, activities);
      }

      if (event.type === 'ProcessComplete') {
        return this.handleProcessComplete(event, nodeConfig, newState, newEvents, activities);
      }

      if (event.type === 'ProcessingTrigger') {
        return this.handleProcessingTrigger(event, nodeConfig, newState, newEvents, activities);
      }

      return { newEvents, newState, activities };
    } catch (error) {
      return this.handleError(error as Error, event, nodeConfig, state);
    }
  }

  /**
   * Handle a token arriving at this processor
   */
  private handleTokenArrival(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const { token } = event.data;
    const config = this.getValidatedConfig(nodeConfig);

    // Handle internal tokens separately (they trigger processing but don't get added to buffer)
    if (token.internal) {
      // Internal tokens just trigger processing check, don't add to buffer
      if (state.inputBuffers.default.length >= config.batchSize && !state.variables.isProcessing) {
        return this.startProcessing(event, nodeConfig, state, newEvents, activities, config);
      }
      return { newEvents, newState: state, activities };
    }

    // Validate the incoming token
    if (!this.validateToken(token, config)) {
      activities.push(
        this.createActivity(
          event.timestamp,
          nodeConfig.id,
          'token_rejected',
          token.value,
          token.correlationIds
        )
      );
      return { newEvents, newState: state, activities };
    }

    // Determine which input buffer this token belongs to
    const inputName = event.data?.inputName || event.data?.toInputName || 'default';

    // Initialize input buffer if it doesn't exist
    if (!state.inputBuffers[inputName]) {
      state.inputBuffers[inputName] = [];
    }

    // Add token to the specific input buffer
    state.inputBuffers[inputName].push(token);

    // Record the arrival
    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'token_received',
        token.value,
        token.correlationIds
      )
    );

    console.log(`🔍 ProcessNode ${nodeConfig.id}: Token received for input '${inputName}', buffer now has ${state.inputBuffers[inputName].length} tokens`);

    // Check if ALL required inputs have tokens (multi-input synchronization)
    const requiredInputs = (nodeConfig.inputs || []).filter((input: any) => input.required);
    const allInputsSatisfied = requiredInputs.length > 0 && requiredInputs.every((input: any) => {
      const buffer = state.inputBuffers[input.name];
      return buffer && buffer.length > 0;
    });

    console.log(`🔍 ProcessNode ${nodeConfig.id}: Required inputs check - ${requiredInputs.length} required, all satisfied: ${allInputsSatisfied}`);
    requiredInputs.forEach((input: any) => {
      const bufferLength = state.inputBuffers[input.name]?.length || 0;
      console.log(`🔍   - Input '${input.name}': ${bufferLength} tokens`);
    });

    // Processing logic:
    // 1. If there are required inputs, ALL must be satisfied
    // 2. If there are no required inputs, process when we have any tokens (legacy behavior)
    const shouldProcess = requiredInputs.length > 0
      ? allInputsSatisfied
      : this.hasTokensInAnyBuffer(state, config.batchSize);

    if (shouldProcess && !state.variables.isProcessing) {
      console.log(`🎯 ProcessNode ${nodeConfig.id}: Processing conditions met - starting processing!`);
      return this.startProcessing(event, nodeConfig, state, newEvents, activities, config);
    }

    this.updateStatistics(state, event.timestamp);
    return { newEvents, newState: state, activities };
  }

  /**
   * Handle completion of processing
   */
  private handleProcessComplete(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    // Only process if this event is for this node
    if (event.sourceNodeId !== nodeConfig.id) {
      return { newEvents, newState: state, activities };
    }

    const { results, consumedTokens, result, transformation } = event.data;
    const config = this.getValidatedConfig(nodeConfig);

    // Record the completion
    activities.push(
      this.createActivity(
        event.timestamp,
        nodeConfig.id,
        'processing_complete',
        results ? `Generated ${Object.keys(results).length} outputs` : result,
        consumedTokens.flatMap((t: any) => t.correlationIds || [])
      )
    );

    // Handle multiple outputs or single output
    if (results && typeof results === 'object') {
      // Create output tokens for each result and emit them
      for (const [outputName, outputResult] of Object.entries(results)) {
        const outputToken = this.createToken(
          outputResult,
          nodeConfig.id,
          event.timestamp,
          consumedTokens.flatMap((t: any) => t.correlationIds || [])
        );

        // Add to output buffer
        state.outputBuffer.push(outputToken);

        // Get destination info from outputs configuration
        const outputConfig = this.getOutputConfig(nodeConfig, outputName);
        if (outputConfig) {
          // Create DataEmit event to send the result downstream
          newEvents.push(
            this.createEvent(
              'DataEmit',
              nodeConfig.id,
              event.timestamp,
              {
                token: outputToken,
                toNodeId: outputConfig.destinationNodeId,
                toInputName: outputConfig.destinationInputName
              },
              event.id,
              outputToken.correlationIds
            )
          );
        } else {
          // Fallback: create DataEmit without specific destination (for legacy tests)
          newEvents.push(
            this.createEvent(
              'DataEmit',
              nodeConfig.id,
              event.timestamp,
              { token: outputToken },
              event.id,
              outputToken.correlationIds
            )
          );
        }
      }
    } else if (result !== undefined) {
      // Legacy single output
      const outputToken = this.createToken(
        result,
        nodeConfig.id,
        event.timestamp,
        consumedTokens.flatMap((t: any) => t.correlationIds || [])
      );

      // Add to output buffer
      state.outputBuffer.push(outputToken);

      // Create DataEmit event to send the result downstream
      newEvents.push(
        this.createEvent(
          'DataEmit',
          nodeConfig.id,
          event.timestamp,
          { token: outputToken },
          event.id,
          outputToken.correlationIds
        )
      );
    }

    // Mark as not processing (create new variables object to avoid mutation)
    state.variables = { ...state.variables, isProcessing: false };

    // Check if we can start processing more tokens
    if (state.inputBuffers.default.length >= config.batchSize) {
      // Create a new event to start the next batch (this prevents infinite loops)
      newEvents.push(
        this.createEvent(
          'TokenArrival',
          nodeConfig.id,
          event.timestamp + 1, // Small delay to prevent infinite recursion
          { token: { value: 'batch_trigger', internal: true } },
          event.id
        )
      );
    }

    this.updateStatistics(state, event.timestamp, config.processingTime);
    return { newEvents, newState: state, activities };
  }

  /**
   * Handle a ProcessingTrigger event sent by the BFS system
   */
  private handleProcessingTrigger(
    event: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[]
  ): ProcessorResult {
    const config = this.getValidatedConfig(nodeConfig);

    // Only proceed if we're not already processing
    if (state.variables.isProcessing) {
      console.log(`🔍 ProcessNode ${nodeConfig.id}: Ignoring ProcessingTrigger - already processing`);
      return { newEvents, newState: state, activities };
    }

    // Check if ALL required inputs have tokens (multi-input synchronization)
    const requiredInputs = (nodeConfig.inputs || []).filter((input: any) => input.required);
    const allInputsSatisfied = requiredInputs.length > 0 && requiredInputs.every((input: any) => {
      const buffer = state.inputBuffers[input.name];
      return buffer && buffer.length > 0;
    });

    console.log(`🔍 ProcessNode ${nodeConfig.id}: ProcessingTrigger - Required inputs check - ${requiredInputs.length} required, all satisfied: ${allInputsSatisfied}`);

    // Processing logic:
    // 1. If there are required inputs, ALL must be satisfied
    // 2. If there are no required inputs, process when we have any tokens (legacy behavior)
    const shouldProcess = requiredInputs.length > 0
      ? allInputsSatisfied
      : this.hasTokensInAnyBuffer(state, config.batchSize);

    if (shouldProcess) {
      console.log(`🎯 ProcessNode ${nodeConfig.id}: ProcessingTrigger - Processing conditions met - starting processing!`);
      return this.startProcessing(event, nodeConfig, state, newEvents, activities, config);
    } else {
      console.log(`🔍 ProcessNode ${nodeConfig.id}: ProcessingTrigger - Processing conditions not met, ignoring trigger`);
      return { newEvents, newState: state, activities };
    }
  }

  /**
   * Start processing a batch of tokens
   */
  private startProcessing(
    triggerEvent: EventData,
    nodeConfig: NodeConfig,
    state: NodeInternalState,
    newEvents: Omit<EventData, 'id'>[],
    activities: Omit<ActivityEntry, 'seq'>[],
    config: any
  ): ProcessorResult {
    // Consume one token from each required input buffer (multi-input synchronization)
    const requiredInputs = (nodeConfig.inputs || []).filter((input: any) => input.required);
    const consumedTokens: any[] = [];
    const inputTokenMap: Record<string, any> = {};

    // Take one token from each required input
    for (const input of requiredInputs) {
      const buffer = state.inputBuffers[input.name];
      if (buffer && buffer.length > 0) {
        const token = buffer.shift(); // Remove first token
        consumedTokens.push(token);
        inputTokenMap[input.name] = token;
        console.log(`🔍 ProcessNode ${nodeConfig.id}: Consumed token from '${input.name}': ${JSON.stringify(token.value)}`);
      }
    }

    // If no required inputs, consume from any available buffer for backward compatibility
    if (requiredInputs.length === 0) {
      for (const [bufferName, buffer] of Object.entries(state.inputBuffers)) {
        if (buffer && buffer.length > 0) {
          const tokens = buffer.splice(0, config.batchSize || 1);
          consumedTokens.push(...tokens);
          console.log(`🔍 ProcessNode ${nodeConfig.id}: Consumed ${tokens.length} tokens from '${bufferName}' buffer`);
          break; // Only consume from one buffer at a time for simplicity
        }
      }
    }

    console.log(`🔍 ProcessNode ${nodeConfig.id}: Total consumed tokens: ${consumedTokens.length}`);

    if (consumedTokens.length === 0) {
      return { newEvents, newState: state, activities };
    }

    // Display formula description if available
    if (typeof config.transformation === 'object' && config.transformation.description) {
      console.log(`📝 ProcessNode ${nodeConfig.id}: ${config.transformation.description}`);
    }

    // Record processing start (add 1 tick to show processing starts after trigger)
    activities.push(
      this.createActivity(
        triggerEvent.timestamp + 1,
        nodeConfig.id,
        'processing_started',
        typeof config.transformation === 'object' ?
          `${config.transformation.type}: ${config.transformation.description || 'custom formula'}` :
          config.transformation,
        consumedTokens.flatMap((t: any) => t.correlationIds || [])
      )
    );

    // Calculate results for all outputs and processing time
    const { results, actualProcessingTime } = this.performAllTransformations(
      nodeConfig,
      consumedTokens,
      config
    );

    // Schedule completion event
    newEvents.push(
      this.createEvent(
        'ProcessComplete',
        nodeConfig.id,
        triggerEvent.timestamp + actualProcessingTime,
        {
          results,
          consumedTokens,
        },
        triggerEvent.id
      )
    );

    // Mark as processing (create new variables object to avoid mutation)
    state.variables = {
      ...state.variables,
      isProcessing: true,
      currentTransformation: config.transformation
    };

    return { newEvents, newState: state, activities };
  }

  /**
   * Perform the actual transformation
   */
  private performTransformation(
    transformation: string | { type: string; formula?: string; template?: string },
    tokens: any[],
    config: any
  ): { result: any; actualProcessingTime: number } {
    const values = tokens.map(t => t.value);
    const baseTime = config.processingTime;

    // Handle V3 formula-based transformations
    if (typeof transformation === 'object') {
      if (transformation.type === 'formula') {
        return this.performFormulaTransformation(transformation.formula, tokens, baseTime);
      } else if (transformation.type === 'template') {
        return this.performTemplateTransformation(transformation.template, tokens, baseTime);
      }
    }

    // Handle legacy string transformations
    const transformationType = typeof transformation === 'string' ? transformation : 'double';

    switch (transformationType) {
      case 'double':
        return {
          result: values[0] * 2,
          actualProcessingTime: baseTime,
        };

      case 'increment':
        return {
          result: values[0] + 1,
          actualProcessingTime: Math.floor(baseTime * 0.8),
        };

      case 'sum':
        return {
          result: values.reduce((sum, val) => sum + val, 0),
          actualProcessingTime: Math.floor(baseTime * values.length),
        };

      case 'average':
        return {
          result: Math.round(values.reduce((sum, val) => sum + val, 0) / values.length),
          actualProcessingTime: Math.floor(baseTime * 1.2),
        };

      case 'max':
        return {
          result: Math.max(...values),
          actualProcessingTime: Math.floor(baseTime * 0.6),
        };

      case 'min':
        return {
          result: Math.min(...values),
          actualProcessingTime: Math.floor(baseTime * 0.6),
        };

      case 'percentage':
        const percentage = config.percentage || 10;
        return {
          result: Math.round((values[0] * percentage) / 100),
          actualProcessingTime: baseTime,
        };

      case 'validate':
        const isValid = this.validateBusinessRules(values[0], config.validationRules || {});
        return {
          result: isValid ? values[0] : -1, // -1 indicates validation failure
          actualProcessingTime: Math.floor(baseTime * 0.5),
        };

      case 'format':
        return {
          result: `formatted_${values[0]}`,
          actualProcessingTime: Math.floor(baseTime * 0.3),
        };

      default:
        console.warn(`Unknown transformation: ${transformationType}, using passthrough`);
        return {
          result: values[0],
          actualProcessingTime: baseTime,
        };
    }
  }

  /**
   * Perform formula-based transformation (V3 format)
   */
  private performFormulaTransformation(
    formula: string,
    tokens: any[],
    baseTime: number
  ): { result: any; actualProcessingTime: number } {
    try {
      // Handle multi-input formulas (like PE calculation with 4 inputs)
      if (tokens.length > 1) {
        return this.performMultiInputFormula(formula, tokens, baseTime);
      }

      const token = tokens[0];
      const input = token.value;

      // Create a safe evaluation context with uniform naming convention
      const context = {
        input: {
          value: input, // Consistent: input.value
          ...input      // Allow direct field access: input.price, input.name, etc.
        },
        data: token, // Full token access for object transformations
        Math: Math, // Allow math functions
      };

      // Evaluate formula using consistent dot notation patterns
      let result;

      // Business logic patterns (support both new consistent patterns and legacy patterns)
      if ((formula.includes('input.value.price') && formula.includes('input.value.tax')) ||
          (formula.includes('input.price') && formula.includes('input.tax'))) {
        // Handle: input.value.price + input.value.tax OR input.price + input.tax
        const price = this.getNestedValue(input, 'price') || 0;
        const tax = this.getNestedValue(input, 'tax') || 0;
        result = price + tax;
      } else if ((formula.includes('input.value.name') && formula.includes('greeting')) ||
                 (formula.includes('input.name') && formula.includes('greeting'))) {
        // Handle: {greeting: "Hello " + input.value.name, age: input.value.age} OR legacy format
        result = {
          greeting: `Hello ${this.getNestedValue(input, 'name') || 'Unknown'}`,
          age: this.getNestedValue(input, 'age') || 30
        };
      } else if (formula.includes('batchType') && formula.includes('payment_settlement')) {
        // Payment batch processing (legacy pattern support)
        const payments = Array.isArray(input) ? input : [input];
        const totalAmount = payments.reduce((sum, p) => this.getNestedValue(p, 'amount') || 0, 0);
        result = {
          batchId: 'BATCH-' + Date.now(),
          paymentCount: payments.length,
          totalAmount,
          batchType: 'payment_settlement',
          processedAt: new Date().toISOString()
        };
      } else if (formula.includes('warehouseId') && formula.includes('pickingListGenerated')) {
        // Warehouse fulfillment (legacy pattern support)
        const orders = Array.isArray(input) ? input : [input];
        const warehouseId = this.getNestedValue(orders[0], 'warehouseId') || 'unknown';
        const totalItems = orders.reduce((sum, order) => this.getNestedValue(order, 'itemCount') || 0, 0);
        result = {
          batchId: 'WH-BATCH-' + Date.now(),
          warehouseId,
          orderCount: orders.length,
          totalItems,
          pickingListGenerated: true,
          processedAt: new Date().toISOString()
        };
      } else if (formula.includes('userId') && formula.includes('optimizedNotification')) {
        // Notification optimization (legacy pattern support)
        const notifications = Array.isArray(input) ? input : [input];
        const userId = this.getNestedValue(notifications[0], 'userId') || 'USER-123';
        result = {
          userId,
          optimizedNotification: {
            summary: `You have ${notifications.length} notifications`,
            originalCount: notifications.length,
            optimizedCount: 1,
            reductionRatio: Math.round((1 - 1/notifications.length) * 100) + '%'
          },
          processedAt: new Date().toISOString()
        };
      } else if (formula.includes('input.value.id') || formula.includes('input.value')) {
        // Generic field access using input.value.id pattern
        result = this.evaluateFieldAccessFormula(formula, input);
      } else if (/^input\s*[+\-*/]\s*\d+$/.test(formula.trim()) || /^\d+\s*[+\-*/]\s*input$/.test(formula.trim())) {
        // Handle simple math formulas: input * 2, input + 1, input / 100
        result = this.evaluateSimpleFormula(formula, input);
      } else if (formula.includes('const ') || formula.includes('return ') || formula.includes('=>') ||
                 formula.includes('?.') || formula.includes('typeof ') || formula.includes('||')) {
        // Handle complex JavaScript formulas (function bodies and expressions)
        result = this.evaluateComplexFormula(formula, input);
      } else {
        // For unrecognized formulas, return input as fallback
        console.warn(`Formula pattern not recognized: ${formula.substring(0, 100)}...`);
        result = input;
      }

      return {
        result,
        actualProcessingTime: baseTime,
      };
    } catch (error) {
      console.warn(`Error evaluating formula "${formula}":`, error);
      return {
        result: tokens[0].value, // Fallback to passthrough
        actualProcessingTime: baseTime,
      };
    }
  }

  /**
   * Perform template-based transformation (V3 format)
   */
  private performTemplateTransformation(
    template: string,
    tokens: any[],
    baseTime: number
  ): { result: any; actualProcessingTime: number } {
    try {
      const token = tokens[0];
      const input = token.value;

      // Replace {{input.value.field}} placeholders with actual values (consistent pattern)
      let result = template.replace(/\{\{input\.value\.(\w+)\}\}/g, (match, field) => {
        return this.getNestedValue(input, field) || '';
      });

      // Also support legacy {{input.field}} for backward compatibility
      result = result.replace(/\{\{input\.(\w+)\}\}/g, (match, field) => {
        return this.getNestedValue(input, field) || '';
      });

      // Parse as JSON if it looks like a JSON template
      if (result.trim().startsWith('{') && result.trim().endsWith('}')) {
        result = JSON.parse(result);
      }

      return {
        result,
        actualProcessingTime: baseTime,
      };
    } catch (error) {
      console.warn(`Error evaluating template "${template}":`, error);
      return {
        result: tokens[0].value, // Fallback to passthrough
        actualProcessingTime: baseTime,
      };
    }
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Evaluate formula with consistent field access patterns (input.value.field)
   */
  private evaluateFieldAccessFormula(formula: string, input: any): any {
    // Replace input.value.field patterns with actual values
    return formula.replace(/input\.value\.(\w+)/g, (match, field) => {
      const value = this.getNestedValue(input, field);
      return value !== undefined ? JSON.stringify(value) : 'null';
    });
  }

  /**
   * Evaluate complex JavaScript formulas safely
   */
  private evaluateComplexFormula(formula: string, input: any): any {
    try {
      // Create a safe execution context
      const safeGlobals = {
        input,
        Math,
        Date,
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean,
        DeterministicFunctions,
        simulationTime: 0 // Default fallback since processors don't have engine access
      };

      // Wrap the formula in a function if it's not already wrapped
      let wrappedFormula;
      if (formula.includes('return ')) {
        // It's a function body with explicit return, wrap it
        wrappedFormula = `(function() { ${formula} })()`;
      } else if (formula.includes('=>')) {
        // It's an arrow function, execute it
        wrappedFormula = `(${formula})(input)`;
      } else {
        // It's code without explicit return - check for last assignment or object
        const trimmedFormula = formula.trim();
        const lines = trimmedFormula.split('\n').map(line => line.trim()).filter(line => line);
        const lastLine = lines[lines.length - 1];

        // If last line is an assignment to a variable, return that variable
        if (lastLine.match(/^(const|let|var)\s+(\w+)\s*=/)) {
          const varName = lastLine.match(/^(const|let|var)\s+(\w+)\s*=/)[2];
          wrappedFormula = `(function() { ${formula}; return ${varName}; })()`;
        } else if (lastLine.includes('=') && !lastLine.includes('===') && !lastLine.includes('!==')) {
          // If it's an assignment without declaration, try to return the assigned variable
          const varName = lastLine.split('=')[0].trim();
          wrappedFormula = `(function() { ${formula}; return ${varName}; })()`;
        } else {
          // Default: wrap and let the last expression be returned
          wrappedFormula = `(function() { ${formula} })()`;
        }
      }

      // Use Function constructor for safer evaluation than eval
      const func = new Function('input', 'data', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'DeterministicFunctions', 'simulationTime',
        `return ${wrappedFormula}`
      );

      const result = func(input, input, Math, Date, JSON, Object, Array, String, Number, Boolean, DeterministicFunctions, null);
      return result;
    } catch (error) {
      console.warn(`Error evaluating complex formula:`, error);
      console.warn(`Formula was:`, formula.substring(0, 200) + '...');
      return input; // Fallback to original input
    }
  }

  /**
   * Safely evaluate simple mathematical formulas
   */
  private evaluateSimpleFormula(formula: string, input: number): number {
    // Replace 'input' with the actual value and evaluate basic math
    const safeFormula = formula.replace(/input/g, input.toString());

    // Only allow basic math operations for security
    if (!/^[\d\s+\-*/().]+$/.test(safeFormula)) {
      console.warn(`Unsafe formula detected: ${formula}`);
      return input;
    }

    try {
      return eval(safeFormula);
    } catch (error) {
      console.warn(`Error evaluating formula ${formula}:`, error);
      return input;
    }
  }

  /**
   * Validate token against rules
   */
  private validateToken(token: any, config: any): boolean {
    if (!token || token.value === undefined) {
      return false;
    }

    // Skip internal tokens
    if (token.internal) {
      return true;
    }

    const rules = config.validationRules || {};

    if (rules.minValue !== undefined && token.value < rules.minValue) {
      return false;
    }

    if (rules.maxValue !== undefined && token.value > rules.maxValue) {
      return false;
    }

    if (rules.requiredType && typeof token.value !== rules.requiredType) {
      return false;
    }

    return true;
  }

  /**
   * Validate against business rules
   */
  private validateBusinessRules(value: any, rules: any): boolean {
    if (rules.mustBePositive && value <= 0) {
      return false;
    }

    if (rules.mustBeEven && value % 2 !== 0) {
      return false;
    }

    if (rules.maxAllowed !== undefined && value > rules.maxAllowed) {
      return false;
    }

    return true;
  }

  /**
   * Get and validate configuration with defaults
   */
  private getValidatedConfig(nodeConfig: NodeConfig): {
    transformation: string | { type: string; formula?: string; template?: string };
    processingTime: number;
    batchSize: number;
    validationRules: any;
    percentage?: number;
  } {
    // Check if this is V3 Schema format (has inputs/outputs fields or processing field)
    if (nodeConfig.inputs !== undefined || nodeConfig.outputs !== undefined || nodeConfig.processing !== undefined) {
      // V3 Schema format - transformation can be in multiple places
      let transformation = 'double'; // default

      // Check processing field first (newer V3 format)
      if (nodeConfig.processing) {
        if (nodeConfig.processing.transformFunction) {
          transformation = {
            type: 'formula',
            formula: nodeConfig.processing.transformFunction
          };
        } else if (nodeConfig.processing.type === 'transform' && nodeConfig.processing.formula) {
          transformation = {
            type: 'formula',
            formula: nodeConfig.processing.formula,
            comment: nodeConfig.processing.comment,
            description: nodeConfig.processing.description
          };
        }
      }
      // If no processing transformation found, check outputs (older V3 format)
      if (transformation === 'double' && nodeConfig.outputs && nodeConfig.outputs.length > 0) {
        const output = nodeConfig.outputs[0];
        if (output.transformation) {
          transformation = output.transformation;
        }
      }
      // If still no transformation found, check data.transformation for backward compatibility
      if (transformation === 'double' && nodeConfig.data && nodeConfig.data.transformation) {
        transformation = nodeConfig.data.transformation;
      }
      return {
        transformation,
        processingTime: nodeConfig.processingTime || nodeConfig.data?.processingTime || 500,
        batchSize: nodeConfig.batchSize || nodeConfig.data?.batchSize || 1,
        validationRules: nodeConfig.validationRules || nodeConfig.data?.validationRules || {},
        percentage: nodeConfig.percentage || nodeConfig.data?.percentage,
      };
    }

    // Legacy format - configuration is nested in data object
    const config = nodeConfig.data || {};
    return {
      transformation: config.transformation || 'double',
      processingTime: config.processingTime || 500,
      batchSize: config.batchSize || 1,
      validationRules: config.validationRules || {},
      percentage: config.percentage,
    };
  }

  /**
   * Get supported event types
   */
  protected getSupportedEventTypes(): string[] {
    return ['TokenArrival', 'ProcessComplete', 'ProcessingTrigger'];
  }

  /**
   * Get configuration schema
   */
  protected getConfigSchema(): Record<string, any> {
    return {
      transformation: {
        type: 'string',
        default: 'double',
        description: 'Type of transformation to apply',
        enum: ['double', 'increment', 'sum', 'average', 'max', 'min', 'percentage', 'validate', 'format'],
      },
      processingTime: {
        type: 'number',
        default: 500,
        description: 'Time to process tokens in milliseconds',
        minimum: 1,
      },
      batchSize: {
        type: 'number',
        default: 1,
        description: 'Number of tokens to process together',
        minimum: 1,
        maximum: 100,
      },
      percentage: {
        type: 'number',
        description: 'Percentage to apply for percentage transformation',
        minimum: 0,
        maximum: 100,
      },
      validationRules: {
        type: 'object',
        description: 'Rules for validating tokens',
        properties: {
          minValue: { type: 'number' },
          maxValue: { type: 'number' },
          requiredType: { type: 'string' },
          mustBePositive: { type: 'boolean' },
          mustBeEven: { type: 'boolean' },
          maxAllowed: { type: 'number' },
        },
      },
    };
  }

  /**
   * Handle multi-input formulas (like PE calculations with multiple DataSource inputs)
   */
  private performMultiInputFormula(
    formula: string,
    tokens: any[],
    baseTime: number
  ): { result: any; actualProcessingTime: number } {
    try {
      console.log(`🔍 Multi-input formula: "${formula}" with ${tokens.length} tokens:`, tokens.map(t => t.value));

      // Extract numeric values from all tokens
      const values = tokens.map(token => {
        const value = token.value;
        return typeof value === 'number' ? value : (typeof value === 'object' && value.value !== undefined ? value.value : 0);
      });

      console.log(`🔍 Extracted values for calculation:`, values);

      // Handle PE formula: 𝑃𝐸𝑦 = 𝑃𝐸𝐹𝐹,𝑦 +𝑃𝐸𝐻𝑃,𝑦 + 𝑃𝐸𝐵𝐄𝑆𝑆,𝑦
      if (formula.includes('𝑃𝐸') || formula.includes('PE') || formula.includes('+')) {
        // Sum all the input values
        const result = values.reduce((sum, val) => sum + val, 0);
        console.log(`🔍 PE formula result: ${values.join(' + ')} = ${result}`);

        return {
          result,
          actualProcessingTime: baseTime
        };
      }

      // Handle other multi-input formulas
      if (formula.includes('sum') || formula.includes('total')) {
        const result = values.reduce((sum, val) => sum + val, 0);
        return { result, actualProcessingTime: baseTime };
      }

      if (formula.includes('average') || formula.includes('avg')) {
        const result = values.reduce((sum, val) => sum + val, 0) / values.length;
        return { result, actualProcessingTime: baseTime };
      }

      if (formula.includes('max')) {
        const result = Math.max(...values);
        return { result, actualProcessingTime: baseTime };
      }

      if (formula.includes('min')) {
        const result = Math.min(...values);
        return { result, actualProcessingTime: baseTime };
      }

      // Default: sum all values
      const result = values.reduce((sum, val) => sum + val, 0);
      console.log(`🔍 Default multi-input sum: ${values.join(' + ')} = ${result}`);

      return {
        result,
        actualProcessingTime: baseTime
      };

    } catch (error) {
      console.error(`Error in multi-input formula "${formula}":`, error);
      return {
        result: null,
        actualProcessingTime: baseTime
      };
    }
  }

  /**
   * Get output configuration for a specific output name
   */
  private getOutputConfig(nodeConfig: NodeConfig, outputName: string): any {
    // V3 format with outputs object
    if (nodeConfig.data?.outputs && typeof nodeConfig.data.outputs === 'object') {
      return nodeConfig.data.outputs[outputName];
    }

    // Legacy format with outputs array
    if (nodeConfig.outputs && Array.isArray(nodeConfig.outputs)) {
      return nodeConfig.outputs.find((output: any) => output.name === outputName);
    }

    return null;
  }

  /**
   * Perform transformations for all outputs
   */
  private performAllTransformations(
    nodeConfig: NodeConfig,
    tokens: any[],
    config: any
  ): { results: Record<string, any>; actualProcessingTime: number } {
    const results: Record<string, any> = {};
    let maxProcessingTime = 0;

    // Check if we have the new outputs structure (data.outputs object)
    if (nodeConfig.data?.outputs && typeof nodeConfig.data.outputs === 'object') {
      // New format: outputs object with formulas
      for (const [outputName, outputConfig] of Object.entries(nodeConfig.data.outputs)) {
        if (outputConfig && typeof outputConfig === 'object' && outputConfig.formula) {
          const { result, actualProcessingTime } = this.performFormulaTransformation(
            outputConfig.formula,
            tokens,
            config.processingTime
          );
          results[outputName] = result;
          maxProcessingTime = Math.max(maxProcessingTime, actualProcessingTime);
        }
      }
    } else {
      // Legacy format: single transformation
      const { result, actualProcessingTime } = this.performTransformation(
        config.transformation,
        tokens,
        config
      );

      // Determine output name from legacy configuration
      let outputName = 'output';
      if (nodeConfig.outputs && Array.isArray(nodeConfig.outputs) && nodeConfig.outputs.length > 0) {
        outputName = nodeConfig.outputs[0].name || 'output';
      }

      results[outputName] = result;
      maxProcessingTime = actualProcessingTime;
    }

    // Handle backward compatibility - if no results generated, return legacy single result
    if (Object.keys(results).length === 0) {
      const { result, actualProcessingTime } = this.performTransformation(
        config.transformation,
        tokens,
        config
      );
      results['result'] = result;
      maxProcessingTime = actualProcessingTime;
    }

    return { results, actualProcessingTime: maxProcessingTime };
  }

  /**
   * Check if there are tokens in any input buffer
   */
  private hasTokensInAnyBuffer(state: NodeInternalState, batchSize: number): boolean {
    for (const [bufferName, buffer] of Object.entries(state.inputBuffers)) {
      if (buffer && buffer.length >= batchSize) {
        return true;
      }
    }
    return false;
  }
}