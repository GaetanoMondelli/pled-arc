/**
 * Static Deterministic Function Library
 *
 * All functions are pure/static for event sourcing determinism
 */

export class DeterministicFunctions {
  /**
   * Carbon emission calculations
   */
  static carbonAvoidanceCalculation(energyData: number, conversionFactor: number = 0.4, simulationTime: string | null = null) {
    const carbonAvoidedKg = energyData * conversionFactor;
    return {
      carbonAvoidedKg,
      energyData,
      conversionFactor,
      processedAt: simulationTime || new Date().toISOString()
    };
  }

  /**
   * Audit trail generation
   */
  static generateAuditTrail(inputData: any, operation: string, simulationTime: string | null = null) {
    return {
      timestamp: simulationTime || new Date().toISOString(),
      operation,
      inputHash: Buffer.from(JSON.stringify(inputData)).toString('base64')
    };
  }

  /**
   * Financial calculations
   */
  static calculateTotalWithTax(price: number, taxRate: number = 0.1, simulationTime: string | null = null) {
    return {
      subtotal: price,
      tax: price * taxRate,
      total: price * (1 + taxRate),
      calculatedAt: simulationTime || new Date().toISOString()
    };
  }

  /**
   * PE (Project Emissions) calculation for carbon credits
   */
  static calculateProjectEmissions(peff: number, pehp: number, pebess: number, simulationTime: string | null = null) {
    const totalPE = peff + pehp + pebess;
    return {
      totalPE,
      PE_y: totalPE, // Alias for compatibility
      PE_FF_y: peff,
      PE_HP_y: pehp,
      PE_BESS_y: pebess,
      components: { peff, pehp, pebess },
      calculatedAt: simulationTime || new Date().toISOString()
    };
  }

  /**
   * Generic aggregation functions
   */
  static sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
  }

  static average(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }

  static max(values: number[]): number {
    return Math.max(...values);
  }

  static min(values: number[]): number {
    return Math.min(...values);
  }

  /**
   * Business logic functions
   */
  static validateBusinessRules(value: any, rules: any): boolean {
    if (rules.mustBePositive && value <= 0) return false;
    if (rules.mustBeEven && value % 2 !== 0) return false;
    if (rules.maxAllowed !== undefined && value > rules.maxAllowed) return false;
    return true;
  }

  /**
   * HYBRID AI Integration: Event Sourcing + Cache Fallback
   */
  static async callAI(operation: string, input: any, aiPrompt: any, simulationTime: string | null = null) {
    const cacheKey = this.generateAIKey(operation, input, aiPrompt);

    // STEP 1: Check event store first using AI key (primary approach)
    let eventStoreResponse = this.getEventStoreResponse(cacheKey, simulationTime);
    if (eventStoreResponse) {
      return {
        ...eventStoreResponse,
        source: 'event_store',
        deterministic: true,
        timestamp: simulationTime || eventStoreResponse.timestamp
      };
    }

    // STEP 1b: Try to find using reconstructed HTTP request key
    const httpRequestKey = this.generateHTTPRequestKey(operation, input, aiPrompt);
    eventStoreResponse = this.getEventStoreResponse(httpRequestKey, simulationTime);
    if (eventStoreResponse) {
      return {
        ...eventStoreResponse.response.body,
        source: 'event_store',
        deterministic: true,
        timestamp: simulationTime || eventStoreResponse.timestamp,
        eventId: eventStoreResponse.eventId
      };
    }

    // STEP 2: Fallback to AI cache (secondary approach)
    const cached = this.getAICache(cacheKey);
    if (cached) {
      return {
        ...cached,
        source: 'ai_cache',
        deterministic: true,
        timestamp: simulationTime || new Date().toISOString()
      };
    }

    // STEP 3: If neither available, return deterministic placeholder
    // In production, this would trigger external API call and store as event
    return {
      operation,
      cacheKey,
      timestamp: simulationTime || new Date().toISOString(),
      source: 'fallback',
      deterministic: false,
      message: "AI response not available - would trigger external API call in live mode",
      suggestion: "Pre-populate event store or AI cache for deterministic execution"
    };
  }

  static validateAIResponse(response: any, validationRules: any, simulationTime: string | null = null) {
    return {
      isValid: this.validateSchema(response, validationRules),
      originalResponse: response,
      validationTimestamp: simulationTime || new Date().toISOString(),
      checksumValid: this.validateChecksum(response),
      schemaValid: this.validateSchema(response, validationRules)
    };
  }

  /**
   * Generate deterministic cache key for AI operations
   */
  private static generateAIKey(operation: string, input: any, aiPrompt: any): string {
    const hashData = {
      operation,
      input: JSON.stringify(input),
      prompt: JSON.stringify(aiPrompt),
      // Include AI settings for cache invalidation
      temperature: aiPrompt.deterministicSettings?.temperature || 0.0,
      seed: aiPrompt.deterministicSettings?.seed || 'default'
    };
    return Buffer.from(JSON.stringify(hashData)).toString('base64').substring(0, 32);
  }

  /**
   * Generate HTTP request key from AI operation parameters
   * This allows finding stored HTTP events using AI call parameters
   */
  private static generateHTTPRequestKey(operation: string, input: any, aiPrompt: any): string {
    // Reconstruct a Gemini API request from AI parameters
    const promptText = `${operation}: ${JSON.stringify(input)}`;

    const request = {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      body: {
        contents: [{
          parts: [{
            text: promptText
          }]
        }],
        generationConfig: {
          temperature: aiPrompt.deterministicSettings?.temperature || 0.0,
          topK: 1,
          topP: 1.0,
          maxOutputTokens: 1000,
          seed: aiPrompt.deterministicSettings?.seed || 'default'
        }
      }
    };

    const simulationContext = {
      inputData: input,
      operation: operation
    };

    return this.generateEventKey(request, simulationContext);
  }

  /**
   * Event Store for AI responses (primary storage for event sourcing)
   */
  private static eventStore: Record<string, any> = {};

  private static getEventStoreResponse(key: string, simulationTime: string | null): any | null {
    const events = this.eventStore[key];
    if (!events) return null;

    // If simulationTime provided, find exact match for deterministic replay
    if (simulationTime) {
      return events.find((event: any) => event.timestamp === simulationTime) || events[0];
    }

    // Otherwise return most recent
    return events[events.length - 1] || null;
  }

  static addEventStoreResponse(key: string, response: any, metadata: any = {}): void {
    if (!this.eventStore[key]) {
      this.eventStore[key] = [];
    }

    this.eventStore[key].push({
      ...response,
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString(),
        source: 'external_api'
      }
    });
  }

  /**
   * Store complete HTTP response as external event
   */
  static addHTTPEvent(httpEvent: {
    eventId: string;
    timestamp: string;
    request: any;
    response: any;
    metadata: any;
    audit: any;
    simulationContext: any;
  }): void {
    const key = this.generateEventKey(httpEvent.request, httpEvent.simulationContext);

    if (!this.eventStore[key]) {
      this.eventStore[key] = [];
    }

    // Store complete HTTP event with all details
    this.eventStore[key].push({
      ...httpEvent,
      storedAt: new Date().toISOString(),
      eventType: 'ExternalAPIResponse',
      version: '1.0'
    });
  }

  /**
   * Generate event key for HTTP requests
   */
  private static generateEventKey(request: any, context: any): string {
    const keyData = {
      url: request.url,
      method: request.method,
      body: request.body,
      simulationContext: context,
      deterministicSettings: request.body?.generationConfig || {}
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 32);
  }

  /**
   * AI Cache for deterministic responses (fallback storage)
   */
  private static aiCache: Record<string, any> = {};

  private static getAICache(key: string): any | null {
    return this.aiCache[key] || null;
  }

  static setAICache(key: string, response: any): void {
    this.aiCache[key] = response;
  }

  /**
   * Load event store from external source (for replay scenarios)
   */
  static loadEventStore(eventData: Record<string, any>): void {
    this.eventStore = { ...eventData };
  }

  /**
   * Get current event store state (for debugging/auditing)
   */
  static getEventStoreState(): Record<string, any> {
    return { ...this.eventStore };
  }

  /**
   * Clear event store (for testing)
   */
  static clearEventStore(): void {
    this.eventStore = {};
  }

  /**
   * Clear AI cache (for testing)
   */
  static clearAICache(): void {
    this.aiCache = {};
  }

  /**
   * Validation helpers
   */
  private static validateSchema(data: any, rules: any): boolean {
    // Simple schema validation - could be extended
    if (!rules) return true;
    if (rules.requiredFields) {
      for (const field of rules.requiredFields) {
        if (!(field in data)) return false;
      }
    }
    return true;
  }

  private static validateChecksum(data: any): boolean {
    // Simple checksum validation - could use actual checksums
    return typeof data === 'object' && data !== null;
  }

  /**
   * Safe evaluation context for formulas
   */
  static createSafeContext(input: any, simulationTime: string | null = null) {
    return {
      input,
      data: input,
      Math: Math,
      Date: Date,
      JSON: JSON,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      // Deterministic functions available in formulas
      DeterministicFunctions: this,
      simulationTime,
      // Utility functions
      sum: this.sum,
      average: this.average,
      max: this.max,
      min: this.min,
      // AI functions
      callAI: this.callAI,
      validateAIResponse: this.validateAIResponse
    };
  }
}

// Make it available globally for formula execution
declare global {
  var DeterministicFunctions: typeof DeterministicFunctions;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).DeterministicFunctions = DeterministicFunctions;
}