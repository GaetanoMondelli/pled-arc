/**
 * Event Queue - Priority Queue for Event Processing
 *
 * Min-heap priority queue that orders events by tick (discrete time).
 * This is the core data structure for discrete event simulation:
 *
 * - Events are processed in chronological order (earliest tick first)
 * - Supports out-of-order event insertion (e.g., from async sources)
 * - O(log n) enqueue and dequeue operations
 * - Efficient peek at next event without removing it
 * - Tick-based for deterministic simulation and production
 *
 * @module eventQueue
 */

import { StoredEvent } from './eventStore';

// ============================================================================
// MIN-HEAP PRIORITY QUEUE
// ============================================================================

/**
 * Priority queue for events, ordered by tick (min-heap)
 *
 * Example:
 * ```
 * const queue = new EventQueue();
 * queue.enqueue(event1); // timestamp: 5
 * queue.enqueue(event2); // timestamp: 2
 * queue.enqueue(event3); // timestamp: 10
 *
 * queue.dequeue(); // Returns event2 (timestamp: 2)
 * queue.dequeue(); // Returns event1 (timestamp: 5)
 * queue.dequeue(); // Returns event3 (timestamp: 10)
 * ```
 */
export class EventQueue {
  private heap: StoredEvent[] = [];
  
  /**
   * Get the number of events in the queue
   */
  get size(): number {
    return this.heap.length;
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }
  
  /**
   * Add an event to the queue
   * O(log n) complexity
   */
  enqueue(event: StoredEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }
  
  /**
   * Add multiple events to the queue
   * More efficient than calling enqueue multiple times
   */
  enqueueAll(events: StoredEvent[]): void {
    // Add all events to heap
    this.heap.push(...events);
    
    // Heapify from bottom up
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }
  
  /**
   * Remove and return the earliest event (by timestamp)
   * O(log n) complexity
   */
  dequeue(): StoredEvent | undefined {
    if (this.isEmpty()) return undefined;
    
    if (this.heap.length === 1) {
      return this.heap.pop();
    }
    
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    
    return min;
  }
  
  /**
   * View the earliest event without removing it
   * O(1) complexity
   */
  peek(): StoredEvent | undefined {
    return this.heap[0];
  }
  
  /**
   * Clear all events from the queue
   */
  clear(): void {
    this.heap = [];
  }
  
  /**
   * Get all events (unordered - internal heap representation)
   */
  toArray(): StoredEvent[] {
    return [...this.heap];
  }
  
  /**
   * Get all events in sorted order (without modifying queue)
   * O(n log n) complexity - use sparingly
   */
  toSortedArray(): StoredEvent[] {
    return [...this.heap].sort((a, b) => a.tick - b.tick);
  }
  
  // ============================================================================
  // HEAP OPERATIONS (Private)
  // ============================================================================
  
  /**
   * Move element up until heap property is satisfied
   */
  private bubbleUp(index: number): void {
    const element = this.heap[index];
    
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      
      // Min-heap: parent should be <= child
      if (parent.tick <= element.tick) break;
      
      // Swap with parent
      this.heap[index] = parent;
      index = parentIndex;
    }
    
    this.heap[index] = element;
  }
  
  /**
   * Move element down until heap property is satisfied
   */
  private bubbleDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];
    
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let smallestIndex = index;
      
      // Find smallest among node and its children
      if (
        leftChildIndex < length &&
        this.heap[leftChildIndex].tick < this.heap[smallestIndex].tick
      ) {
        smallestIndex = leftChildIndex;
      }

      if (
        rightChildIndex < length &&
        this.heap[rightChildIndex].tick < this.heap[smallestIndex].tick
      ) {
        smallestIndex = rightChildIndex;
      }
      
      // If node is smallest, heap property is satisfied
      if (smallestIndex === index) break;
      
      // Swap with smallest child
      this.heap[index] = this.heap[smallestIndex];
      index = smallestIndex;
    }
    
    this.heap[index] = element;
  }
}

// ============================================================================
// ZUSTAND STORE FOR EVENT QUEUE (Optional - for React integration)
// ============================================================================

import { create } from 'zustand';

interface EventQueueState {
  /** The priority queue instance */
  queue: EventQueue;
  
  /** Is processing currently running? */
  isProcessing: boolean;
  
  /** Statistics */
  stats: {
    totalEnqueued: number;
    totalProcessed: number;
    currentSize: number;
  };
  
  // ============================================================================
  // OPERATIONS
  // ============================================================================
  
  /**
   * Enqueue a single event
   */
  enqueue: (event: StoredEvent) => void;
  
  /**
   * Enqueue multiple events
   */
  enqueueAll: (events: StoredEvent[]) => void;
  
  /**
   * Dequeue the next event
   */
  dequeue: () => StoredEvent | undefined;
  
  /**
   * Peek at the next event
   */
  peek: () => StoredEvent | undefined;
  
  /**
   * Get current queue size
   */
  getSize: () => number;
  
  /**
   * Check if queue is empty
   */
  isEmpty: () => boolean;
  
  /**
   * Clear the queue
   */
  clear: () => void;
  
  /**
   * Set processing state
   */
  setProcessing: (isProcessing: boolean) => void;
  
  /**
   * Get queue statistics
   */
  getStats: () => EventQueueState['stats'];
}

export const useEventQueue = create<EventQueueState>((set, get) => ({
  queue: new EventQueue(),
  isProcessing: false,
  stats: {
    totalEnqueued: 0,
    totalProcessed: 0,
    currentSize: 0,
  },
  
  enqueue: (event) => {
    const { queue } = get();
    queue.enqueue(event);
    
    set((state) => ({
      stats: {
        ...state.stats,
        totalEnqueued: state.stats.totalEnqueued + 1,
        currentSize: queue.size,
      },
    }));
  },
  
  enqueueAll: (events) => {
    const { queue } = get();
    queue.enqueueAll(events);
    
    set((state) => ({
      stats: {
        ...state.stats,
        totalEnqueued: state.stats.totalEnqueued + events.length,
        currentSize: queue.size,
      },
    }));
  },
  
  dequeue: () => {
    const { queue } = get();
    const event = queue.dequeue();
    
    if (event) {
      set((state) => ({
        stats: {
          ...state.stats,
          totalProcessed: state.stats.totalProcessed + 1,
          currentSize: queue.size,
        },
      }));
    }
    
    return event;
  },
  
  peek: () => {
    return get().queue.peek();
  },
  
  getSize: () => {
    return get().queue.size;
  },
  
  isEmpty: () => {
    return get().queue.isEmpty();
  },
  
  clear: () => {
    const { queue } = get();
    queue.clear();
    
    set({
      stats: {
        totalEnqueued: 0,
        totalProcessed: 0,
        currentSize: 0,
      },
      isProcessing: false,
    });
  },
  
  setProcessing: (isProcessing) => {
    set({ isProcessing });
  },
  
  getStats: () => {
    return get().stats;
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new event queue pre-filled with events
 */
export function createPrefilledQueue(events: StoredEvent[]): EventQueue {
  const queue = new EventQueue();
  queue.enqueueAll(events);
  return queue;
}

/**
 * Drain queue and return all events in chronological order
 */
export function drainQueue(queue: EventQueue): StoredEvent[] {
  const events: StoredEvent[] = [];
  
  while (!queue.isEmpty()) {
    const event = queue.dequeue();
    if (event) events.push(event);
  }
  
  return events;
}

/**
 * Get events up to a certain tick (without draining queue)
 */
export function getEventsUntilTick(queue: EventQueue, maxTick: number): StoredEvent[] {
  const events: StoredEvent[] = [];

  while (!queue.isEmpty()) {
    const event = queue.peek();
    if (!event || event.timestamp > maxTick) break;

    events.push(queue.dequeue()!);
  }

  return events;
}

/**
 * Get events up to a certain timestamp (legacy support)
 */
export function getEventsUntil(queue: EventQueue, maxTimestamp: number): StoredEvent[] {
  const events: StoredEvent[] = [];

  while (!queue.isEmpty()) {
    const event = queue.peek();
    if (!event || event.simulationTimestamp > maxTimestamp) break;

    events.push(queue.dequeue()!);
  }

  return events;
}

// ============================================================================
// TESTS / EXAMPLES
// ============================================================================

/**
 * Test the event queue with sample events
 */
export function testEventQueue() {
  console.log('🧪 Testing EventQueue...\n');
  
  const queue = new EventQueue();
  
  // Create test events with different timestamps
  const events: StoredEvent[] = [
    { id: '1', timestamp: 5.0, type: 'DataArrival', sourceNodeId: 'node1', data: {} },
    { id: '2', timestamp: 2.0, type: 'DataArrival', sourceNodeId: 'node2', data: {} },
    { id: '3', timestamp: 10.0, type: 'ProcessComplete', sourceNodeId: 'node3', data: {} },
    { id: '4', timestamp: 1.0, type: 'SourceEmit', sourceNodeId: 'node4', data: {} },
    { id: '5', timestamp: 7.5, type: 'FSMTransition', sourceNodeId: 'node5', data: {} },
  ];
  
  console.log('📥 Enqueueing events (out of order):');
  events.forEach(e => {
    console.log(`   Event ${e.id} @ t=${e.timestamp}`);
    queue.enqueue(e);
  });
  
  console.log('\n📤 Dequeuing events (should be in order):');
  while (!queue.isEmpty()) {
    const event = queue.dequeue()!;
    console.log(`   Event ${event.id} @ t=${event.timestamp} ← ${event.type}`);
  }
  
  console.log('\n✅ Test complete!\n');
}

// Uncomment to run test:
// testEventQueue();
