/**
 * Simple External Event Queue for existing SimulationEngine
 *
 * This is just a simple event queue that adds external events to the existing
 * simulation queue. It doesn't change any of the existing architecture.
 *
 * Flow: ExternalEvent → EventQueue → (adds to) → Existing SimulationEngine Queue
 */

import { SimulationEngine } from './implementations/SimulationEngine';
import { EventData } from './core/ActivityQueue';

/**
 * Generate a deterministic correlation ID based on event content
 * This ensures consistent correlation IDs across runs for the same inputs
 */
function generateCorrelationId(eventData: any, sourceNodeId: string, timestamp: number): string {
  // Create deterministic hash from event content + source + timestamp
  const input = JSON.stringify({
    data: eventData,
    source: sourceNodeId,
    timestamp: timestamp
  });

  // Simple but effective hash function (consistent across JS environments)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and ensure positive
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');

  // Format as correlation ID with prefix for clarity
  return `corr_${hexHash}_${timestamp}`;
}

/**
 * Generate a deterministic token ID based on event content
 * This ensures consistent token IDs across runs for the same inputs
 */
function generateDeterministicTokenId(eventData: any, sourceNodeId: string): string {
  // Create deterministic hash from event content + source
  const input = JSON.stringify({
    data: eventData,
    source: sourceNodeId,
    type: 'token'
  });

  // Simple but effective hash function (consistent across JS environments)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and ensure positive
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');

  // Format as token ID with prefix for clarity
  return `token_${hexHash}`;
}

export interface ExternalEvent {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  data: any;
  targetDataSourceId?: string;
}

/**
 * Simple External Event Queue - just adds events to existing simulation
 */
export class ExternalEventQueue {
  private eventHistory: ExternalEvent[] = [];
  private simulationEngine: SimulationEngine | null = null;
  private processedCount = 0;

  constructor(engine?: SimulationEngine) {
    if (engine) {
      this.simulationEngine = engine;
    }
  }

  /**
   * Connect to simulation engine
   */
  setSimulationEngine(engine: SimulationEngine): void {
    this.simulationEngine = engine;
  }

  /**
   * Add external event to simulation queue
   */
  addEvent(event: ExternalEvent): void {
    if (!this.simulationEngine) {
      console.warn('⚠️ No SimulationEngine connected');
      return;
    }

    // Store in history
    this.eventHistory.push(event);

    // Create simulation event and add to queue
    // Use a shared token ID based on the business object (e.g., orderId, documentId)
    // This allows the same business object to transition through FSM states
    const tokenId = this.extractBusinessObjectId(event.data) || generateDeterministicTokenId(event.data, event.targetDataSourceId || 'external_source');

    const simulationEvent: Omit<EventData, 'id'> = {
      type: 'DataEmit',
      sourceNodeId: event.targetDataSourceId || 'external_source',
      targetNodeId: event.targetDataSourceId || null,
      timestamp: event.timestamp,
      data: {
        token: {
          id: tokenId,
          value: event.data,
          sourceNodeId: event.targetDataSourceId || 'external_source',
          targetNodeId: null,
          timestamp: event.timestamp,
          correlationIds: [generateCorrelationId(event.data, event.targetDataSourceId || 'external_source', event.timestamp)],
          metadata: { externalEvent: true, externalEventType: event.type }
        },
        emissionIndex: 0,
        totalEmissions: 1,
        externalEvent: true
      },
      parentEventId: null,
      correlationIds: [generateCorrelationId(event.data, event.targetDataSourceId || 'external_source', event.timestamp)]
    };

    this.simulationEngine.getQueue().enqueue(simulationEvent);
    this.processedCount++;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalEvents: this.eventHistory.length,
      processedEvents: this.processedCount,
      connected: this.simulationEngine !== null
    };
  }

  /**
   * Get event history
   */
  getHistory(): ExternalEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear history
   */
  clear(): void {
    this.eventHistory = [];
    this.processedCount = 0;
  }

  /**
   * Extract business object ID from event data for shared token tracking
   * This allows the same business object to move through FSM states
   */
  private extractBusinessObjectId(data: any): string | null {
    // Look for common business object identifiers
    if (data?.documentId) return `doc_${data.documentId}`;
    if (data?.orderId) return `order_${data.orderId}`;
    if (data?.ticketId) return `ticket_${data.ticketId}`;
    if (data?.loanId) return `loan_${data.loanId}`;
    if (data?.userId) return `user_${data.userId}`;
    if (data?.id) return `obj_${data.id}`;

    // No business object ID found
    return null;
  }

  /**
   * Get all events for replay capability
   */
  getAllEvents(): ExternalEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events by business object ID for replay
   */
  getEventsByBusinessObject(businessObjectId: string): ExternalEvent[] {
    return this.eventHistory.filter(event => {
      const objId = this.extractBusinessObjectId(event.data);
      return objId === businessObjectId;
    });
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      totalEvents: this.eventHistory.length,
      processedEvents: this.processedCount,
      pendingEvents: this.eventHistory.length - this.processedCount
    };
  }

  /**
   * Clear event history (for cleanup)
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.processedCount = 0;
  }
}