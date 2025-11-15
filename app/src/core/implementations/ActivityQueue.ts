/**
 * Activity Queue - Manages events in chronological order
 *
 * The Activity Queue is like a smart to-do list that:
 * - Keeps events sorted by when they should happen
 * - Always processes the next event in time order
 * - Tracks how many events have been processed vs pending
 *
 * Think of it like an appointment scheduler that always knows what's next.
 */

/**
 * Generate a deterministic event ID based on event content
 * This ensures consistent event IDs across runs for the same inputs
 */
function generateEventId(eventData: any, sourceNodeId: string, timestamp: number): string {
  // Create deterministic hash from event content + source + timestamp
  const input = JSON.stringify({
    type: eventData.type,
    sourceNodeId: sourceNodeId,
    targetNodeId: eventData.targetNodeId,
    timestamp: timestamp,
    data: eventData.data
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

  // Format as event ID with prefix for clarity
  return `evt_${hexHash}_${timestamp}`;
}

export interface EventData {
  id: string;
  timestamp: number;
  type: string;
  sourceNodeId: string;
  targetNodeId?: string;
  data: any;
  correlationIds?: string[];
  causedBy?: string;
  metadata?: any;
}

export interface QueueSnapshot {
  step: number;
  processed: number;
  pending: number;
  total: number;
  currentTimestamp: number;
  events: Array<{
    timestamp: number;
    type: string;
    nodeId: string;
    nodeType: string;
    details: string;
  }>;
}

/**
 * ActivityQueue class - Manages event processing order
 *
 * This queue ensures that:
 * - Events are processed in chronological order (earliest first)
 * - We can track progress through the queue
 * - We can see what's coming next
 */
export class ActivityQueue {
  private queue: EventData[] = [];
  private eventStore: EventData[] = [];
  private processedCount = 0;
  private snapshots: QueueSnapshot[] = [];
  private nodeTypeMap: Map<string, string> = new Map();

  /**
   * Set the node types for better debugging output
   */
  setNodeTypes(nodeTypes: Map<string, string>): void {
    this.nodeTypeMap = new Map(nodeTypes);
  }

  /**
   * Add a new event to the queue
   * Events are automatically sorted by timestamp
   */
  enqueue(eventData: Omit<EventData, 'id'>): EventData {
    const event: EventData = {
      id: generateEventId(eventData, eventData.sourceNodeId, eventData.timestamp),
      ...eventData,
    };

    // Store the event for history
    this.eventStore.push(event);

    // Add to queue and keep sorted by timestamp
    this.queue.push(event);
    this.queue.sort((a, b) => {
      // Primary sort: by timestamp
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // Secondary sort: by event ID for consistency
      return a.id.localeCompare(b.id);
    });

    return event;
  }

  /**
   * Get the next event to process (earliest time)
   * This removes the event from the queue
   */
  dequeue(): EventData | null {
    if (this.queue.length === 0) {
      return null;
    }

    const event = this.queue.shift()!;
    this.processedCount++;
    return event;
  }

  /**
   * Look at the next event without removing it
   */
  peek(): EventData | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Get current queue size (events waiting)
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get total events processed so far
   */
  getProcessedCount(): number {
    return this.processedCount;
  }

  /**
   * Get total events (processed + pending)
   */
  getTotalCount(): number {
    return this.processedCount + this.queue.length;
  }

  /**
   * Get all events that have been processed
   */
  getEventHistory(): EventData[] {
    return [...this.eventStore];
  }

  /**
   * Take a snapshot of current queue state
   * This is useful for tracking progress over time
   */
  takeSnapshot(step: number, currentTimestamp: number = 0): QueueSnapshot {
    const snapshot: QueueSnapshot = {
      step,
      processed: this.processedCount,
      pending: this.queue.length,
      total: this.getTotalCount(),
      currentTimestamp,
      events: this.queue.slice(0, 5).map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        nodeId: event.sourceNodeId,
        nodeType: this.nodeTypeMap.get(event.sourceNodeId) || 'unknown',
        details: this.formatEventDetails(event),
      })),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get all snapshots taken so far
   */
  getSnapshots(): QueueSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the current state as a snapshot (without saving it)
   */
  getCurrentState(currentTimestamp: number = 0): QueueSnapshot {
    return {
      step: this.snapshots.length,
      processed: this.processedCount,
      pending: this.queue.length,
      total: this.getTotalCount(),
      currentTimestamp,
      events: this.queue.slice(0, 5).map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        nodeId: event.sourceNodeId,
        nodeType: this.nodeTypeMap.get(event.sourceNodeId) || 'unknown',
        details: this.formatEventDetails(event),
      })),
    };
  }

  /**
   * Clear the entire queue and reset counters
   */
  clear(): void {
    this.queue = [];
    this.eventStore = [];
    this.processedCount = 0;
    this.snapshots = [];
  }

  /**
   * Get events by type (useful for debugging)
   */
  getEventsByType(eventType: string): EventData[] {
    return this.eventStore.filter(event => event.type === eventType);
  }

  /**
   * Get events by node (useful for debugging)
   */
  getEventsByNode(nodeId: string): EventData[] {
    return this.eventStore.filter(event => event.sourceNodeId === nodeId);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalEvents: number;
    processedEvents: number;
    pendingEvents: number;
    eventsByType: Record<string, number>;
    eventsByNode: Record<string, number>;
    averageProcessingRate: number;
    queueEfficiency: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByNode: Record<string, number> = {};

    this.eventStore.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByNode[event.sourceNodeId] = (eventsByNode[event.sourceNodeId] || 0) + 1;
    });

    const totalSteps = this.snapshots.length;
    const averageProcessingRate = totalSteps > 0 ? this.processedCount / totalSteps : 0;
    const queueEfficiency = this.getTotalCount() > 0 ? (this.processedCount / this.getTotalCount()) * 100 : 0;

    return {
      totalEvents: this.eventStore.length,
      processedEvents: this.processedCount,
      pendingEvents: this.queue.length,
      eventsByType,
      eventsByNode,
      averageProcessingRate,
      queueEfficiency,
    };
  }

  /**
   * Format event details for display
   */
  private formatEventDetails(event: EventData): string {
    switch (event.type) {
      case 'DataEmit':
        const token = event.data?.token;
        return token ? `value: ${token.value}` : 'emitting';
      case 'TokenArrival':
        const arrivalToken = event.data?.token;
        return arrivalToken ? `receiving: ${arrivalToken.value}` : 'arrival';
      case 'ProcessComplete':
        return `result: ${event.data?.result || 'complete'}`;
      case 'SimulationStart':
        return 'starting simulation';
      default:
        return event.type.toLowerCase();
    }
  }

  /**
   * Print queue progression for debugging
   */
  printProgression(): void {
    console.log(`\\n📈 Queue Progression:`);
    this.snapshots.forEach(snapshot => {
      const progress = `${snapshot.processed}/${snapshot.total}`;
      const events = snapshot.events.map(e => `${e.type}@${e.timestamp}`).join(', ');
      console.log(`   Step ${snapshot.step.toString().padStart(2)}: ${progress.padEnd(8)} | Next: ${events}`);
    });
  }

  /**
   * Validate queue consistency (for debugging)
   */
  validateQueue(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that queue is sorted by timestamp
    for (let i = 1; i < this.queue.length; i++) {
      if (this.queue[i].timestamp < this.queue[i - 1].timestamp) {
        errors.push(`Queue not sorted: event ${this.queue[i].id} at timestamp ${this.queue[i].timestamp} comes after event ${this.queue[i - 1].id} at timestamp ${this.queue[i - 1].timestamp}`);
      }
    }

    // Check for duplicate event IDs
    const eventIds = new Set<string>();
    for (const event of this.queue) {
      if (eventIds.has(event.id)) {
        errors.push(`Duplicate event ID in queue: ${event.id}`);
      }
      eventIds.add(event.id);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}