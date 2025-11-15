/**
 * Simple Token Tracer - BFS/DFS approach to trace token history
 * Goes backwards through the activity log to find all events that led to a token
 */

import type { HistoryEntry } from "./types";

export interface TokenEvent {
  timestamp: number;
  nodeId: string;
  nodeName?: string;
  action: string;
  value?: any;
  details?: string;
  depth: number;  // How many hops from the target token
  sourceTokenIds?: string[];  // Parent tokens
  eventType?: 'creation' | 'input' | 'consumption' | 'other';
}

export interface TokenTrace {
  tokenId: string;
  events: TokenEvent[];  // All events related to this token
  parentTokens: Set<string>;  // All parent token IDs found
  rootEvents: TokenEvent[];  // Events with no parent tokens (sources)
  creationChain: TokenEvent[];  // Chain of creation events
}

export class SimpleTokenTracer {
  private activityLog: HistoryEntry[];
  private nodeNames: Map<string, string>;

  constructor(activityLog: HistoryEntry[], nodesConfig?: any) {
    this.activityLog = activityLog;
    this.nodeNames = new Map();

    if (nodesConfig) {
      Object.entries(nodesConfig).forEach(([nodeId, config]: [string, any]) => {
        this.nodeNames.set(nodeId, config.displayName || nodeId);
      });
    }
  }

  /**
   * Trace a token's COMPLETE history using BFS
   * Key insight: Find where token was CREATED and what INPUTS created it
   */
  traceToken(tokenId: string): TokenTrace {
    console.log(`🔍 [TRACER] Starting trace for token: ${tokenId}`);

    const visited = new Set<string>();
    const events: TokenEvent[] = [];
    const parentTokens = new Set<string>();
    const creationChain: TokenEvent[] = [];
    const queue: { tokenId: string; depth: number }[] = [{ tokenId, depth: 0 }];

    visited.add(tokenId);

    while (queue.length > 0) {
      const { tokenId: currentTokenId, depth } = queue.shift()!;
      console.log(`🔍 [TRACER] Processing token ${currentTokenId} at depth ${depth}`);

      // Strategy: Look for where this token appears in "output" context
      // This means looking for events that show this token being created/emitted

      // Find creation event - where this token was OUTPUT from a node
      let creationEvent: HistoryEntry | undefined;
      let creatorNode: string | undefined;

      // Look for events that mention this token
      for (const log of this.activityLog) {
        if (log.details?.includes(`Token ${currentTokenId}`)) {
          // CRITICAL: If the details say "from X output", then X is the creator!
          const fromOutputMatch = log.details.match(/from (.+?) output/);
          if (fromOutputMatch) {
            const creatorNodeName = fromOutputMatch[1];
            console.log(`🔍 [TRACER] Token ${currentTokenId} was created by "${creatorNodeName}" (found in consumption log)`);

            // Find the actual creation event from the creator node
            // First, find the node ID for this creator name
            let creatorNodeId: string | undefined;
            for (const [nodeId, nodeName] of this.nodeNames) {
              if (nodeName === creatorNodeName) {
                creatorNodeId = nodeId;
                break;
              }
            }

            if (creatorNodeId) {
              // Look for creation event from this node
              for (const createLog of this.activityLog) {
                if (createLog.nodeId === creatorNodeId &&
                    createLog.details?.includes(`Token ${currentTokenId}`) &&
                    (createLog.action === 'token_emitted' ||
                     createLog.action === 'firing' ||
                     createLog.action === 'processing' ||
                     createLog.details?.includes('→'))) {
                  creationEvent = createLog;
                  creatorNode = creatorNodeId;
                  console.log(`🔍 [TRACER] Found actual creation event at ${creatorNodeName}`);
                  break;
                }
              }

              // If we didn't find the exact event, create a synthetic one
              if (!creationEvent) {
                console.log(`🔍 [TRACER] Creating synthetic creation event for ${currentTokenId} from ${creatorNodeName}`);
                creatorNode = creatorNodeId;
                // We'll handle this below
              }
            }
            break;
          }

          // Otherwise check if this is an emission/creation event
          if (log.action === 'token_emitted' ||
              (log.details.includes('→') && !log.details.includes('←')) ||
              (log.action === 'firing' && !log.details.includes('consumed')) ||
              (log.action === 'processing' && !log.details.includes('consumed'))) {

            // This is likely the creation event
            creationEvent = log;
            creatorNode = log.nodeId;
            console.log(`🔍 [TRACER] Found creation event for ${currentTokenId} at node ${this.nodeNames.get(creatorNode) || creatorNode}`);
            break;
          }
        }
      }

      if (creatorNode) {
        // Add creation event (real or synthetic)
        const creationTokenEvent: TokenEvent = {
          timestamp: creationEvent ? creationEvent.timestamp : 0,
          nodeId: creatorNode,
          nodeName: this.nodeNames.get(creatorNode) || creatorNode,
          // Keep 'processing' action if it contains formula, otherwise use 'CREATED'
          action: (creationEvent?.action === 'processing' && creationEvent?.details?.includes('='))
                  ? 'processing'
                  : 'CREATED',
          value: creationEvent ? creationEvent.value : undefined,
          // Keep original details if they contain formula info, otherwise use generic message
          details: creationEvent?.details || `Token ${currentTokenId} created here`,
          depth,
          sourceTokenIds: creationEvent ? creationEvent.sourceTokenIds : [],
          eventType: 'creation'
        };
        events.push(creationTokenEvent);
        creationChain.push(creationTokenEvent);

        // Now find what INPUTS this node used to create our token
        // Look for events from the SAME NODE at or just before creation
        const creationTime = creationEvent ? creationEvent.timestamp :
                             // If no creation event, look near consumption time
                             this.activityLog.find(l => l.details?.includes(`Token ${currentTokenId}`))?.timestamp || 0;

        const inputCandidates = this.activityLog.filter(log => {
          if (log.nodeId !== creatorNode) return false;
          if (log.timestamp > creationTime) return false;
          if (log.timestamp < creationTime - 10) return false; // 10 second window

          // Look for input-related actions
          return log.action === 'token_consumed' ||
                 log.action === 'token_received' ||
                 log.action === 'consuming' ||
                 log.action === 'accumulating' ||
                 (log.action === 'processing' && log.sourceTokenIds && log.sourceTokenIds.length > 0) ||
                 (log.action === 'firing' && log !== creationEvent);
        });

        console.log(`🔍 [TRACER] Found ${inputCandidates.length} input candidates for ${creatorNode}`);

        // Process input events
        for (const inputEvent of inputCandidates) {
          // Skip if this is about our current token being consumed
          if (inputEvent.details?.includes(`Token ${currentTokenId}`)) continue;

          // Add as input event
          events.push({
            timestamp: inputEvent.timestamp,
            nodeId: inputEvent.nodeId,
            nodeName: this.nodeNames.get(inputEvent.nodeId) || inputEvent.nodeId,
            action: `INPUT_${inputEvent.action}`,
            value: inputEvent.value,
            details: inputEvent.details,
            depth,
            sourceTokenIds: inputEvent.sourceTokenIds,
            eventType: 'input'
          });

          // Extract parent tokens from details
          const tokenMatches = Array.from(inputEvent.details?.matchAll(/Token ([A-Za-z0-9]{8})/g) || []);
          for (const match of tokenMatches) {
            const inputTokenId = match[1];
            if (inputTokenId !== currentTokenId && !visited.has(inputTokenId)) {
              console.log(`🔍 [TRACER] Found input token: ${inputTokenId}`);
              parentTokens.add(inputTokenId);
              visited.add(inputTokenId);
              queue.push({ tokenId: inputTokenId, depth: depth + 1 });
            }
          }

          // Also check sourceTokenIds
          if (inputEvent.sourceTokenIds) {
            for (const sourceId of inputEvent.sourceTokenIds) {
              if (!visited.has(sourceId)) {
                console.log(`🔍 [TRACER] Found source token: ${sourceId}`);
                parentTokens.add(sourceId);
                visited.add(sourceId);
                queue.push({ tokenId: sourceId, depth: depth + 1 });
              }
            }
          }
        }

        // Special case: If this is a processor/queue that does aggregation
        // Look for the "firing" or "processing" event that shows consumed tokens
        const firingEvent = inputCandidates.find(e =>
          (e.action === 'firing' || e.action === 'processing') &&
          e.sourceTokenIds &&
          e.sourceTokenIds.length > 0
        );

        if (firingEvent && firingEvent.sourceTokenIds) {
          console.log(`🔍 [TRACER] Found firing/processing event with ${firingEvent.sourceTokenIds.length} source tokens`);
          for (const sourceId of firingEvent.sourceTokenIds) {
            if (!visited.has(sourceId)) {
              parentTokens.add(sourceId);
              visited.add(sourceId);
              queue.push({ tokenId: sourceId, depth: depth + 1 });
            }
          }
        }
      }

      // Also add consumption events (where this token was consumed)
      const consumptionEvents = this.activityLog.filter(log =>
        log.details?.includes(`Token ${currentTokenId}`) &&
        (log.action === 'token_consumed' ||
         log.action === 'consuming' ||
         log.details?.includes('consumed'))
      );

      for (const event of consumptionEvents) {
        events.push({
          timestamp: event.timestamp,
          nodeId: event.nodeId,
          nodeName: this.nodeNames.get(event.nodeId) || event.nodeId,
          action: event.action,
          value: event.value,
          details: event.details,
          depth,
          sourceTokenIds: event.sourceTokenIds,
          eventType: 'consumption'
        });
      }
    }

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    // Find root events
    const rootEvents = events.filter(e =>
      e.eventType === 'creation' &&
      (!e.sourceTokenIds || e.sourceTokenIds.length === 0)
    );

    console.log(`🔍 [TRACER] Trace complete. Found ${events.length} events, ${parentTokens.size} parent tokens`);

    return {
      tokenId,
      events,
      parentTokens,
      rootEvents,
      creationChain
    };
  }

  /**
   * Get a simple timeline of events for a token
   */
  getTimeline(tokenId: string): string[] {
    const trace = this.traceToken(tokenId);
    const timeline: string[] = [];

    // Group events by depth
    const eventsByDepth = new Map<number, TokenEvent[]>();
    let maxDepth = 0;

    for (const event of trace.events) {
      if (!eventsByDepth.has(event.depth)) {
        eventsByDepth.set(event.depth, []);
      }
      eventsByDepth.get(event.depth)!.push(event);
      maxDepth = Math.max(maxDepth, event.depth);
    }

    // Build timeline from sources to target
    for (let depth = maxDepth; depth >= 0; depth--) {
      const depthEvents = eventsByDepth.get(depth) || [];
      if (depthEvents.length > 0) {
        timeline.push(`\n=== Depth ${depth} ${depth === 0 ? '(Target)' : depth === maxDepth ? '(Sources)' : ''} ===`);

        for (const event of depthEvents) {
          const prefix = event.eventType === 'creation' ? '🟢' :
                        event.eventType === 'input' ? '🔵' :
                        event.eventType === 'consumption' ? '🟠' : '⚪';

          timeline.push(
            `${prefix} [${event.timestamp}s] ${event.nodeName} | ${event.action}` +
            (event.value !== undefined ? ` | value: ${event.value}` : '') +
            (event.details ? ` | ${event.details}` : '')
          );
        }
      }
    }

    return timeline;
  }

  /**
   * Get correlation chain
   */
  getCorrelationChain(tokenId: string): string {
    const trace = this.traceToken(tokenId);
    return `${tokenId} ← ${Array.from(trace.parentTokens).join(' ← ')}`;
  }
}