/**
 * Node Processors for Event-Driven Simulation
 * 
 * Each processor handles specific node types and generates cascading events.
 * Consistent with legacy simulation event types and behavior.
 */

import { nanoid } from '@/lib/utils/nanoid';
import type { StoredEvent } from '@/stores/eventStore';
import type { AnyNode, AnyNodeState, Token } from '@/lib/simulation/types';
import { useEventStore } from '@/stores/eventStore';
import { useEventQueue } from '@/stores/eventQueue';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new token
 */
function createToken(value: any, originNodeId: string, timestamp: number, sourceTokens: Token[] = []): Token {
  return {
    id: nanoid(8),
    value,
    createdAt: timestamp,
    originNodeId,
    history: [],
  };
}

/**
 * Find downstream nodes connected to an output
 */
function getDownstreamNodes(node: AnyNode, outputName: string = 'default'): Array<{ nodeId: string; inputName: string }> {
  const downstream: Array<{ nodeId: string; inputName: string }> = [];
  
  // Check node outputs for connections
  if (node.outputs) {
    for (const output of node.outputs) {
      if (output.name === outputName && output.destinationNodeId) {
        downstream.push({
          nodeId: output.destinationNodeId,
          inputName: output.destinationInputName || 'default',
        });
      }
    }
  }
  
  return downstream;
}

/**
 * Create a new event and add it to the queue
 */
function scheduleEvent(
  type: string,
  timestamp: number,
  sourceNodeId: string,
  data: any,
  causedBy?: string
): StoredEvent {
  const eventStore = useEventStore.getState();
  const eventQueue = useEventQueue.getState();
  
  // Add to event store (immutable log) - appendEvent generates the ID
  const newEvent = eventStore.appendEvent({
    type: type as any, // Cast to EventType
    timestamp,
    sourceNodeId,
    data,
    causedBy,
  });
  
  // Add to queue (sorted by timestamp)
  eventQueue.enqueue(newEvent);
  
  console.log(`📅 Scheduled: ${type} @ t=${timestamp.toFixed(3)}s on ${sourceNodeId} ${causedBy ? `(caused by ${causedBy})` : ''}`);
  
  return newEvent;
}

// ============================================================================
// PROCESSOR INTERFACE
// ============================================================================

export interface ProcessResult {
  // State changes to apply
  stateUpdates?: Partial<AnyNodeState>;
  
  // New events generated
  newEvents?: StoredEvent[];
  
  // Tokens created/emitted
  tokensEmitted?: Token[];
  
  // Success or error
  success: boolean;
  error?: string;
}

// ============================================================================
// DATA SOURCE PROCESSOR
// ============================================================================

/**
 * Process SourceEmit events from DataSource nodes
 * 
 * Behavior:
 * 1. Create a token with the emitted value
 * 2. Find downstream nodes
 * 3. Schedule TokenArrival events for each downstream node
 */
export function processSourceEmit(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  const { value } = event.data;
  
  console.log(`🔵 Processing SourceEmit: ${node.displayName} emits ${value}`);
  
  // Create token
  const token = createToken(value, node.nodeId, event.timestamp);
  
  // Add to output buffer (cast to any for type safety)
  const state = nodeState as any;
  const outputBuffer = [...(state.outputBuffer || []), token];
  
  // Find downstream nodes
  const downstream = getDownstreamNodes(node, 'output');
  
  // Schedule TokenArrival events for each downstream node
  const newEvents: StoredEvent[] = [];
  
  for (const { nodeId: targetNodeId, inputName } of downstream) {
    // Calculate travel time (instant for now, could add edge delays)
    const arrivalTime = event.timestamp + 0.001; // 1ms travel time
    
    const arrivalEvent = scheduleEvent(
      'TokenArrival',
      arrivalTime,
      targetNodeId,
      {
        token,
        inputName,
        fromNodeId: node.nodeId,
      },
      event.id // Causality tracking
    );
    
    newEvents.push(arrivalEvent);
  }
  
  return {
    stateUpdates: {
      outputBuffer,
      tokensEmitted: (state.tokensEmitted || 0) + 1,
    },
    newEvents,
    tokensEmitted: [token],
    success: true,
  };
}

// ============================================================================
// PROCESS NODE PROCESSOR
// ============================================================================

/**
 * Process TokenArrival events at ProcessNode
 * 
 * Behavior:
 * 1. Token arrives at node input
 * 2. Add to input buffer
 * 3. If node is idle, start processing immediately
 * 4. Schedule ProcessComplete event
 */
export function processTokenArrival(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  const { token, inputName } = event.data;
  const state = nodeState as any;
  
  console.log(`📥 Token ${token.id} arrives at ${node.displayName}`);
  
  // Add token to input buffer
  const inputBuffer = [...(state.inputBuffer || []), token];
  
  const newEvents: StoredEvent[] = [];
  
  // Check if node can start processing
  const isIdle = nodeState.currentState === 'idle' || !nodeState.currentState;
  
  if (isIdle && node.type === 'ProcessNode') {
    // Start processing immediately
    const processingTime = (node as any).config?.processingTime || 1.0;
    const completionTime = event.timestamp + processingTime;
    
    // Schedule ProcessComplete event
    const completeEvent = scheduleEvent(
      'ProcessComplete',
      completionTime,
      node.nodeId,
      {
        inputToken: token,
        processingTime,
      },
      event.id
    );
    
    newEvents.push(completeEvent);
    
    return {
      stateUpdates: {
        inputBuffer,
        currentState: 'processing',
        tokensProcessed: (state.tokensProcessed || 0) + 1,
      },
      newEvents,
      success: true,
    };
  }
  
  // Node is busy, just buffer the token
  return {
    stateUpdates: {
      inputBuffer,
    },
    success: true,
  };
}

/**
 * Process ProcessComplete events
 * 
 * Behavior:
 * 1. Remove token from input buffer
 * 2. Apply transformation (formula evaluation)
 * 3. Create output token
 * 4. Schedule TokenArrival for downstream nodes
 * 5. If more tokens in buffer, start next processing
 */
export function processProcessComplete(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  const { inputToken } = event.data;
  const state = nodeState as any;
  
  console.log(`✅ Processing complete at ${node.displayName}`);
  
  // Remove processed token from buffer
  const inputBuffer = (state.inputBuffer || []).filter((t: any) => t.id === inputToken.id);
  
  // Apply transformation (simple passthrough for now, can add formula evaluation)
  const outputValue = inputToken.value;
  const outputToken = createToken(outputValue, node.nodeId, event.timestamp, [inputToken]);
  
  // Add to output buffer
  const outputBuffer = [...(state.outputBuffer || []), outputToken];
  
  // Find downstream nodes and schedule arrivals
  const downstream = getDownstreamNodes(node, 'output');
  const newEvents: StoredEvent[] = [];
  
  for (const { nodeId: targetNodeId, inputName } of downstream) {
    const arrivalTime = event.timestamp + 0.001;
    
    const arrivalEvent = scheduleEvent(
      'TokenArrival',
      arrivalTime,
      targetNodeId,
      {
        token: outputToken,
        inputName,
        fromNodeId: node.nodeId,
      },
      event.id
    );
    
    newEvents.push(arrivalEvent);
  }
  
  // Check if more tokens to process
  let nextState: string = 'idle';
  
  if (inputBuffer.length > 0 && node.type === 'ProcessNode') {
    // Start processing next token
    const nextToken = inputBuffer[0];
    const processingTime = (node as any).config?.processingTime || 1.0;
    const completionTime = event.timestamp + processingTime;
    
    const nextCompleteEvent = scheduleEvent(
      'ProcessComplete',
      completionTime,
      node.nodeId,
      {
        inputToken: nextToken,
        processingTime,
      },
      event.id
    );
    
    newEvents.push(nextCompleteEvent);
    nextState = 'processing';
  }
  
  return {
    stateUpdates: {
      inputBuffer,
      outputBuffer,
      currentState: nextState,
      tokensEmitted: (state.tokensEmitted || 0) + 1,
    },
    newEvents,
    tokensEmitted: [outputToken],
    success: true,
  };
}

// ============================================================================
// QUEUE PROCESSOR
// ============================================================================

/**
 * Process TokenArrival at Queue node
 * 
 * Behavior:
 * 1. Add token to queue buffer
 * 2. If batch size reached, schedule QueueEmit event
 */
export function processQueueArrival(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  const { token } = event.data;
  const state = nodeState as any;
  
  console.log(`📦 Token ${token.id} queued at ${node.displayName}`);
  
  const inputBuffer = [...(state.inputBuffer || []), token];
  const batchSize = (node as any).config?.batchSize || 1;
  
  const newEvents: StoredEvent[] = [];
  
  // Check if batch size reached
  if (inputBuffer.length >= batchSize) {
    // Schedule immediate emit
    const emitEvent = scheduleEvent(
      'QueueEmit',
      event.timestamp + 0.001,
      node.nodeId,
      {
        batchSize,
      },
      event.id
    );
    
    newEvents.push(emitEvent);
  }
  
  return {
    stateUpdates: {
      inputBuffer,
      currentState: inputBuffer.length >= batchSize ? 'ready' : 'accumulating',
    },
    newEvents,
    success: true,
  };
}

/**
 * Process QueueEmit event
 * 
 * Behavior:
 * 1. Take tokens from queue (batch size or all)
 * 2. Emit them to downstream nodes
 * 3. Schedule TokenArrival events
 */
export function processQueueEmit(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  const { batchSize } = event.data;
  const state = nodeState as any;
  
  const inputBuffer = state.inputBuffer || [];
  const tokensToEmit = inputBuffer.slice(0, batchSize);
  const remainingBuffer = inputBuffer.slice(batchSize);
  
  console.log(`📤 Queue ${node.displayName} emits ${tokensToEmit.length} tokens`);
  
  const downstream = getDownstreamNodes(node, 'output');
  const newEvents: StoredEvent[] = [];
  
  // Schedule arrival for each token to each downstream node
  for (const token of tokensToEmit) {
    for (const { nodeId: targetNodeId, inputName } of downstream) {
      const arrivalTime = event.timestamp + 0.001;
      
      const arrivalEvent = scheduleEvent(
        'TokenArrival',
        arrivalTime,
        targetNodeId,
        {
          token,
          inputName,
          fromNodeId: node.nodeId,
        },
        event.id
      );
      
      newEvents.push(arrivalEvent);
    }
  }
  
  return {
    stateUpdates: {
      inputBuffer: remainingBuffer,
      outputBuffer: [...(state.outputBuffer || []), ...tokensToEmit],
      currentState: remainingBuffer.length > 0 ? 'accumulating' : 'idle',
      tokensEmitted: (state.tokensEmitted || 0) + tokensToEmit.length,
    },
    newEvents,
    tokensEmitted: tokensToEmit,
    success: true,
  };
}

// ============================================================================
// MAIN PROCESSOR DISPATCHER
// ============================================================================

/**
 * Process an event based on its type
 */
export function processEvent(
  event: StoredEvent,
  node: AnyNode,
  nodeState: AnyNodeState,
  context: any
): ProcessResult {
  try {
    switch (event.type) {
      case 'SourceEmit':
        return processSourceEmit(event, node, nodeState, context);
      
      case 'TokenArrival':
        if (node.type === 'Queue') {
          return processQueueArrival(event, node, nodeState, context);
        } else {
          return processTokenArrival(event, node, nodeState, context);
        }
      
      case 'ProcessComplete':
        return processProcessComplete(event, node, nodeState, context);
      
      case 'QueueEmit':
        return processQueueEmit(event, node, nodeState, context);
      
      default:
        console.warn(`⚠️ Unknown event type: ${event.type}`);
        return {
          success: false,
          error: `Unknown event type: ${event.type}`,
        };
    }
  } catch (error) {
    console.error(`❌ Error processing event ${event.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
