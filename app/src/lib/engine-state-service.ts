/**
 * Engine State Service
 *
 * Provides convenient access to the Engine State API with pagination
 * for step-by-step debugging and state retrieval.
 */

export interface EngineState {
  step: number;
  timestamp: number;
  nodeStates: any;
  queues: {
    processing: number;
    external: number;
  };
  activityLog: any[];
  isComplete?: boolean;
}

export interface StateSession {
  sessionId: string;
  batchSize: number;
  totalStates: number;
  isComplete: boolean;
  currentPage: number;
}

export interface BatchStatesResponse {
  success: boolean;
  sessionId: string;
  page: number;
  batchSize: number;
  states: EngineState[];
  totalStates: number;
  hasMorePages: boolean;
  isComplete: boolean;
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class EngineStateService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/engine/states') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize a new batch state session
   */
  async initializeSession(
    templateId: string,
    executionId: string,
    batchSize: number = 100
  ): Promise<{ sessionId: string; externalEventsCount: number }> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'initialize',
        templateId,
        executionId,
        batchSize
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize session: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to initialize session');
    }

    return {
      sessionId: data.sessionId,
      externalEventsCount: data.externalEventsCount
    };
  }

  /**
   * Get a batch of states with pagination
   */
  async getBatchStates(
    sessionId: string,
    page: number = 0,
    batchSize?: number
  ): Promise<BatchStatesResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getStates',
        sessionId,
        page,
        batchSize
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get batch states: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get batch states');
    }

    return data;
  }

  /**
   * Get all states (use with caution for large simulations)
   */
  async getAllStates(sessionId: string): Promise<EngineState[]> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getAllStates',
        sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get all states: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get all states');
    }

    return data.states;
  }

  /**
   * Get states within a specific range
   */
  async getStateRange(
    sessionId: string,
    startStep: number,
    endStep: number
  ): Promise<EngineState[]> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getStateRange',
        sessionId,
        startStep,
        endStep
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get state range: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get state range');
    }

    return data.states;
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string): Promise<StateSession> {
    const response = await fetch(`${this.baseUrl}?sessionId=${sessionId}`);

    if (!response.ok) {
      throw new Error(`Failed to get session info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get paginated states with automatic pagination handling
   */
  async *getPaginatedStates(
    sessionId: string,
    batchSize: number = 50
  ): AsyncGenerator<EngineState[], void, unknown> {
    let page = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const batch = await this.getBatchStates(sessionId, page, batchSize);

      if (batch.states.length > 0) {
        yield batch.states;
      }

      hasMorePages = batch.hasMorePages;
      page++;

      // Safety break to prevent infinite loops
      if (page > 1000) {
        console.warn('⚠️ Pagination safety break at page 1000');
        break;
      }
    }
  }

  /**
   * Convenient method to get states for Enhanced Sink State Viewer
   */
  async getStatesForViewer(
    templateId: string,
    executionId: string,
    maxStates: number = 200
  ): Promise<{
    states: EngineState[];
    sessionId: string;
    externalEventsCount: number;
    isComplete: boolean;
  }> {
    // Initialize session
    const { sessionId, externalEventsCount } = await this.initializeSession(
      templateId,
      executionId,
      Math.min(maxStates, 100)
    );

    // Get first batch of states
    const batch = await this.getBatchStates(sessionId, 0, maxStates);

    return {
      states: batch.states,
      sessionId,
      externalEventsCount,
      isComplete: batch.isComplete
    };
  }
}

// Create a default instance
export const engineStateService = new EngineStateService();