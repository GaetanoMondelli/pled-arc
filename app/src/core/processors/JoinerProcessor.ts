/**
 * Joiner Processor - Waits for multiple inputs before proceeding
 *
 * In business workflows, some activities require multiple inputs to be ready
 * before processing can begin. For example:
 * - Order processing needs both payment confirmation AND inventory check
 * - Document approval needs signatures from BOTH manager AND legal
 * - Data analysis needs BOTH customer data AND transaction history
 *
 * The Joiner processor waits until it receives tokens from ALL specified
 * input sources before releasing the combined result.
 */

import {
  EventData,
  ActivityEntry,
  NodeConfig,
  NodeInternalState,
  ProcessorResult,
  Token,
  TokenType,
  TokenMetadata,
  TokenLineageStep,
  NodeType,
} from '../types';
import { BaseProcessor } from './BaseProcessor';

interface JoinerConfig {
  // Sources we need to wait for
  requiredSources: string[];
  // How long to wait before timing out (in ticks)
  timeoutTicks?: number;
  // Whether to combine payloads or just pass the first one
  combinePayloads?: boolean;
  // Custom combination strategy
  combinationStrategy?: 'merge' | 'array' | 'first' | 'last';
}

interface WaitingToken {
  token: Token;
  receivedAt: number;
  sourceNodeId: string;
}

interface JoinerState extends NodeInternalState {
  // Tokens waiting for their partners
  waitingTokens: Record<string, WaitingToken[]>; // grouped by correlation ID
  // Track which sources we've seen for each correlation
  receivedSources: Record<string, Set<string>>;
  // Timeout tracking
  timeouts: Record<string, number>; // correlation ID -> timeout tick
}

export class JoinerProcessor extends BaseProcessor {
  readonly nodeType: NodeType = 'Joiner';

  process(event: EventData, nodeConfig: NodeConfig, state: NodeInternalState): ProcessorResult {
    const joinerState = state as JoinerState;
    const config = nodeConfig.config as JoinerConfig;
    const token = event.token;

    // Initialize joiner-specific state if needed
    if (!joinerState.waitingTokens) {
      joinerState.waitingTokens = {};
      joinerState.receivedSources = {};
      joinerState.timeouts = {};
    }

    const activities: Omit<ActivityEntry, 'seq'>[] = [];
    const newEvents: Omit<EventData, 'id'>[] = [];

    try {
      // Get correlation ID for grouping related tokens
      const correlationId = token?.correlationIds?.[0] || token?.id || `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sourceNodeId = event.sourceNodeId;

      // Initialize tracking for this correlation if needed
      if (!joinerState.waitingTokens[correlationId]) {
        joinerState.waitingTokens[correlationId] = [];
        joinerState.receivedSources[correlationId] = new Set();

        // Set timeout if configured
        if (config.timeoutTicks) {
          joinerState.timeouts[correlationId] = event.timestamp + config.timeoutTicks;
        }
      }

      // Add this token to waiting list
      joinerState.waitingTokens[correlationId].push({
        token,
        receivedAt: event.timestamp,
        sourceNodeId
      });

      // Mark this source as received
      joinerState.receivedSources[correlationId].add(sourceNodeId);

      activities.push({
        timestamp: event.timestamp,
        nodeId: nodeConfig.id,
        action: 'token_received',
        details: `Received token from ${sourceNodeId}, waiting for: ${config.requiredSources.filter(src => !joinerState.receivedSources[correlationId].has(src)).join(', ')}`,
        value: token?.data || null,
        correlationId
      });

      // Check if we have all required sources
      const hasAllSources = config.requiredSources.every(
        source => joinerState.receivedSources[correlationId].has(source)
      );

      if (hasAllSources) {
        // Create combined token
        const waitingTokens = joinerState.waitingTokens[correlationId];
        const combinedToken = this.combineTokens(waitingTokens, config, correlationId);

        // Clean up waiting state
        delete joinerState.waitingTokens[correlationId];
        delete joinerState.receivedSources[correlationId];
        delete joinerState.timeouts[correlationId];

        // Create output event
        const outputEvent = this.createEvent(
          event.timestamp + 1,
          event.targetNodeId,
          combinedToken
        );

        newEvents.push(outputEvent);

        activities.push({
          timestamp: event.timestamp,
          nodeId: nodeConfig.id,
          action: 'tokens_joined',
          details: `Successfully joined ${waitingTokens.length} tokens from sources: ${config.requiredSources.join(', ')}`,
          value: combinedToken?.data || null,
          correlationId
        });

        // Update statistics
        joinerState.statistics.eventsProcessed++;
      }

      // Check for timeouts
      this.checkTimeouts(joinerState, event.timestamp, config, activities, newEvents);

    } catch (error) {
      console.error('Error in Joiner processor:', error);
      activities.push({
        timestamp: event.timestamp,
        nodeId: nodeConfig.id,
        action: 'error',
        details: `Joiner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: { error: String(error) }
      });
    }

    return {
      newEvents,
      newState: joinerState,
      activities
    };
  }

  private combineTokens(
    waitingTokens: WaitingToken[],
    config: JoinerConfig,
    correlationId: string
  ): Token {
    const strategy = config.combinationStrategy || 'merge';
    let combinedData: any;

    switch (strategy) {
      case 'merge':
        combinedData = {};
        waitingTokens.forEach(wt => {
          if (typeof wt.token.data === 'object' && wt.token.data !== null) {
            Object.assign(combinedData, wt.token.data);
          }
        });
        break;

      case 'array':
        combinedData = waitingTokens.map(wt => ({
          source: wt.sourceNodeId,
          data: wt.token.data,
          receivedAt: wt.receivedAt
        }));
        break;

      case 'first':
        combinedData = waitingTokens[0].token.data;
        break;

      case 'last':
        combinedData = waitingTokens[waitingTokens.length - 1].token.data;
        break;

      default:
        combinedData = waitingTokens.map(wt => wt.token.data);
    }

    // Combine correlation IDs
    const allCorrelationIds = new Set<string>();
    waitingTokens.forEach(wt => {
      if (wt.token.correlationIds) {
        wt.token.correlationIds.forEach(id => allCorrelationIds.add(id));
      }
    });

    return {
      id: this.generateTokenId(),
      type: 'data' as TokenType,
      data: combinedData,
      correlationIds: Array.from(allCorrelationIds),
      lineage: waitingTokens.flatMap(wt => wt.token.lineage),
      metadata: {
        createdAt: Date.now(),
        joinedTokens: waitingTokens.length,
        strategy: config.combinationStrategy || 'merge'
      }
    };
  }

  private checkTimeouts(
    state: JoinerState,
    currentTick: number,
    config: JoinerConfig,
    activities: Omit<ActivityEntry, 'seq'>[],
    newEvents: Omit<EventData, 'id'>[]
  ): void {
    if (!config.timeoutTicks) return;

    Object.keys(state.timeouts).forEach(correlationId => {
      const timeoutTick = state.timeouts[correlationId];

      if (currentTick >= timeoutTick) {
        // Handle timeout
        const waitingTokens = state.waitingTokens[correlationId] || [];
        const receivedSources = Array.from(state.receivedSources[correlationId] || []);
        const missingSources = config.requiredSources.filter(
          source => !receivedSources.includes(source)
        );

        activities.push({
          timestamp: currentTick,
          nodeId: '', // Will be filled by caller
          action: 'timeout',
          details: `Timeout waiting for sources: ${missingSources.join(', ')}. Received: ${receivedSources.join(', ')}`,
          value: {
            waitingTokens: waitingTokens.length,
            missingSources,
            receivedSources
          },
          correlationId
        });

        // Clean up timed-out tokens
        delete state.waitingTokens[correlationId];
        delete state.receivedSources[correlationId];
        delete state.timeouts[correlationId];

        // Optionally, could emit a timeout event or partial result
        // For now, we just log and clean up
      }
    });
  }

  private generateTokenId(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}