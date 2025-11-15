/**
 * Simulation Engine - The heart of the workflow execution
 *
 * The Simulation Engine is like the conductor of an orchestra.
 * It coordinates all the components to make your workflow run smoothly:
 *
 * - Takes your scenario (the workflow blueprint)
 * - Manages the activity queue (what happens when)
 * - Records everything in the activity ledger (what actually happened)
 * - Routes data between nodes (how information flows)
 *
 * This is the main class you'll use to run your workflows.
 */

import { Scenario } from './Scenario';
import { ActivityQueue, EventData } from './ActivityQueue';
import { ActivityLedger } from './ActivityLedger';
import { BaseProcessor } from '../processors/BaseProcessor';
import { DataSourceProcessor } from '../processors/DataSourceProcessor';
import { ProcessorNodeProcessor } from '../processors/ProcessorNodeProcessor';
import { SinkProcessor } from '../processors/SinkProcessor';
import { MultiplexerProcessor } from '../processors/MultiplexerProcessor';
import { BatcherProcessor } from '../processors/BatcherProcessor';
import { FSMProcessor } from '../processors/FSMProcessor';
import { FSMProcessNodeProcessor } from '../processors/FSMProcessNodeProcessor';
import { QueueProcessor } from '../processors/QueueProcessor';
import { JoinerProcessor } from '../processors/JoinerProcessor';
import { ScenarioConfig } from '../types';

export interface EngineConfig {
  maxSteps?: number;
  maxTicks?: number;
  realTimeMode?: boolean;
  realTimeSpeed?: number;
  debugMode?: boolean;
  deterministicTime?: number; // For testing: use fixed timestamp instead of Date.now()
}

export interface EngineStats {
  totalSteps: number;
  totalEvents: number;
  totalActivities: number;
  processingTime: number;
  averageStepsPerSecond: number;
  queueEfficiency: number;
  currentTick: number;
  isRunning: boolean;
}

/**
 * SimulationEngine - Orchestrates workflow execution
 *
 * This engine provides a complete solution for running event-driven workflows.
 * It's designed to be easy to understand and use, even for non-technical users.
 */
export class SimulationEngine {
  private scenario: Scenario | null = null;
  private queue: ActivityQueue;
  private ledger: ActivityLedger;
  private processors: Map<string, BaseProcessor> = new Map();
  private nodeStates: Map<string, any> = new Map();
  private currentTimestamp: number = 0;
  private stepCount: number = 0;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor() {
    this.queue = new ActivityQueue();
    this.ledger = new ActivityLedger();
    this.registerDefaultProcessors();
  }

  /**
   * Initialize the engine with a scenario
   * This sets up your workflow and prepares it for execution
   */
  initialize(scenarioConfig: ScenarioConfig): void {
    console.log(`🔧 Initializing Simulation Engine with: ${scenarioConfig.name}`);

    // Create scenario and validate it
    this.scenario = new Scenario(scenarioConfig);

    // Clear previous state
    this.reset();

    // Set up node types for queue debugging
    const nodeTypes = new Map<string, string>();
    this.scenario.getNodes().forEach(node => {
      nodeTypes.set(node.id, node.type);
    });
    this.queue.setNodeTypes(nodeTypes);

    // Initialize node states
    this.initializeNodeStates();

    // Create initial events for data sources
    this.generateInitialEvents();

    // Take initial snapshot
    this.queue.takeSnapshot(0, this.currentTimestamp);

    const stats = this.scenario.getStats();
    console.log(`✅ Initialized: ${stats.totalNodes} nodes, ${stats.totalEdges} connections`);
    console.log(`📊 Starting nodes: ${stats.startingNodes.join(', ')}`);
    console.log(`🎯 Ending nodes: ${stats.endingNodes.join(', ')}`);
    console.log(`📋 Initial queue size: ${this.queue.size()} events\\n`);
  }

  /**
   * Alias for initialize() - for backward compatibility with tests
   */
  loadScenario(scenarioConfig: ScenarioConfig): void {
    this.initialize(scenarioConfig);
  }

  /**
   * Execute simulation up to a specific timestamp - for backward compatibility with tests
   */
  async executeToTick(maxTick: number): Promise<EngineStats> {
    return await this.run({ maxTicks: maxTick });
  }

  /**
   * Get all activities - for backward compatibility with tests
   */
  getActivities(): any[] {
    return this.ledger.getActivities();
  }

  /**
   * Run the simulation step by step
   * Each step processes one event from the queue
   */
  async step(): Promise<EventData | null> {
    if (!this.scenario) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    if (this.queue.isEmpty()) {
      console.log('✅ No more events to process');
      return null;
    }

    // Get next event
    const event = this.queue.dequeue();
    if (!event) return null;

    // Update current time
    this.currentTimestamp = Math.max(this.currentTimestamp, event.timestamp);
    this.stepCount++;

    console.log(`⏰ Step ${this.stepCount}: Processing ${event.type} at timestamp ${event.timestamp} from ${event.sourceNodeId}`);

    // Process the event
    await this.processEvent(event);

    // CRITICAL: After processing, check which nodes are now eligible to fire (BFS traversal)
    await this.checkNodeEligibility();

    // Take snapshot after processing
    this.queue.takeSnapshot(this.stepCount, this.currentTimestamp);

    console.log(`📊 Queue state: ${this.queue.getProcessedCount()}/${this.queue.getTotalCount()} (${this.queue.size()} pending)`);

    return event;
  }

  /**
   * Run the complete simulation automatically
   * This processes all events until the queue is empty or limits are reached
   */
  async run(config: EngineConfig = {}): Promise<EngineStats> {
    if (!this.scenario) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    this.isRunning = true;
    this.startTime = config.deterministicTime || Date.now();

    const maxSteps = config.maxSteps || 1000;
    const maxTicks = config.maxTicks || 100000;
    const realTimeMode = config.realTimeMode || false;
    const realTimeSpeed = config.realTimeSpeed || 1;

    console.log(`🚀 Running simulation (max ${maxSteps} steps, ${maxTicks} timestamps)\\n`);

    try {
      while (this.isRunning && !this.queue.isEmpty() && this.stepCount < maxSteps && this.currentTimestamp < maxTicks) {
        await this.step();

        // Real-time delay
        if (realTimeMode) {
          await new Promise(resolve => setTimeout(resolve, 10 / realTimeSpeed));
        }

        // Yield to browser/Node.js event loop
        if (this.stepCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      console.log(`\\n✅ Simulation completed after ${this.stepCount} steps`);
    } catch (error) {
      console.error('❌ Simulation error:', error);
      this.isRunning = false;
      throw error;
    } finally {
      this.isRunning = false;
    }

    return this.getStats();
  }

  /**
   * Get comprehensive statistics about the simulation
   */
  getStats(): EngineStats {
    const processingTime = Date.now() - this.startTime;
    const queueStats = this.queue.getStats();

    return {
      totalSteps: this.stepCount,
      totalEvents: queueStats.totalEvents,
      totalActivities: this.ledger.getCount(),
      processingTime,
      averageStepsPerSecond: processingTime > 0 ? (this.stepCount / (processingTime / 1000)) : 0,
      queueEfficiency: queueStats.queueEfficiency,
      currentTick: this.currentTimestamp,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get the current scenario
   */
  getScenario(): Scenario | null {
    return this.scenario;
  }

  /**
   * Get the activity queue (for debugging)
   */
  getQueue(): ActivityQueue {
    return this.queue;
  }

  /**
   * Get the activity ledger (for debugging)
   */
  getLedger(): ActivityLedger {
    return this.ledger;
  }

  /**
   * Get the current simulation timestamp
   */
  getCurrentTimestamp(): number {
    return this.currentTimestamp;
  }

  /**
   * Get node state (for debugging)
   */
  getNodeState(nodeId: string): any {
    return this.nodeStates.get(nodeId);
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.isRunning = false;
    console.log('⏹️ Simulation stopped');
  }

  /**
   * Reset the engine to initial state
   */
  reset(): void {
    this.queue.clear();
    this.ledger.clear();
    this.nodeStates.clear();
    this.currentTimestamp = 0;
    this.stepCount = 0;
    this.isRunning = false;
    this.startTime = 0;
  }

  /**
   * Print a comprehensive report of the simulation
   */
  printReport(): void {
    if (!this.scenario) {
      console.log('❌ No scenario loaded');
      return;
    }

    const stats = this.getStats();
    const queueSnapshots = this.queue.getSnapshots();
    const activities = this.ledger.getActivities();

    console.log(`\\n${'='.repeat(80)}`);
    console.log(`📊 SIMULATION REPORT: ${this.scenario.getConfig().name}`);
    console.log(`${'='.repeat(80)}\\n`);

    // Overall statistics
    console.log(`📈 Overall Statistics:`);
    console.log(`   Total Steps: ${stats.totalSteps}`);
    console.log(`   Total Events: ${stats.totalEvents}`);
    console.log(`   Total Activities: ${stats.totalActivities}`);
    console.log(`   Processing Time: ${stats.processingTime}ms`);
    console.log(`   Average Speed: ${stats.averageStepsPerSecond.toFixed(2)} steps/second`);
    console.log(`   Queue Efficiency: ${stats.queueEfficiency.toFixed(1)}%`);
    console.log(`   Final Tick: ${stats.currentTick}`);

    // Queue progression
    console.log(`\\n📈 Queue Progression:`);
    queueSnapshots.forEach(snapshot => {
      const progress = `${snapshot.processed}/${snapshot.total}`;
      console.log(`   Step ${snapshot.step.toString().padStart(2)}: ${progress.padEnd(8)} | Tick: ${snapshot.currentTick}`);
    });

    // Activity summary
    console.log(`\\n📋 Activity Summary:`);
    const ledgerSummary = this.ledger.getSummary();
    Object.entries(ledgerSummary.activitiesByAction).forEach(([action, count]) => {
      console.log(`   ${action.padEnd(20)}: ${count}`);
    });

    // Node statistics
    console.log(`\\n🏛️ Node Statistics:`);
    Object.entries(ledgerSummary.activitiesByNode).forEach(([nodeId, count]) => {
      const nodeType = this.scenario!.getNode(nodeId)?.type || 'unknown';
      console.log(`   ${nodeId.padEnd(15)} (${nodeType.padEnd(12)}): ${count} activities`);
    });

    console.log(`\\n${'='.repeat(80)}`);
  }

  /**
   * Print the activity ledger in a readable format
   */
  printActivityLedger(): void {
    this.ledger.printLedger();
  }

  /**
   * Print the queue progression
   */
  printQueueProgression(): void {
    this.queue.printProgression();
  }

  /**
   * 🔍 INSPECTION API - Get runtime information about scenario, nodes, tokens, and events
   * Uses lazy evaluation for performance with thousands of tokens
   */

  /**
   * Direct node access proxy - enables engine.nodes.order_fsm syntax
   */
  get nodes(): any {
    if (!this.scenario) return {};

    const engine = this;
    const nodeProxy: any = {};

    // Create direct access properties for each node
    this.scenario.getNodes().forEach(node => {
      Object.defineProperty(nodeProxy, node.id, {
        get() {
          return engine.getNodeInfo(node.id);
        },
        enumerable: true
      });
    });

    return nodeProxy;
  }

  /**
   * Get current state of a node by replaying activities
   */
  getCurrentNodeState(nodeId: string): any {
    const activities = this.ledger.getActivities()
      .filter(a => a.nodeId === nodeId)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (activities.length === 0) {
      return { nodeId, state: 'idle', lastActivity: null, activityCount: 0 };
    }

    const lastActivity = activities[activities.length - 1];
    const actionCounts = activities.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // For FSM nodes, determine current state from state transitions
    if (this.scenario?.getNode(nodeId)?.type === 'FSM') {
      const stateTransitions = activities.filter(a => a.action === 'fsm_transition');
      const currentFSMState = stateTransitions.length > 0
        ? stateTransitions[stateTransitions.length - 1].value?.to
        : 'pending';

      return {
        nodeId,
        state: 'active',
        fsmState: currentFSMState,
        lastActivity,
        activityCount: activities.length,
        actionCounts,
        stateTransitions: stateTransitions.length
      };
    }

    return {
      nodeId,
      state: lastActivity.timestamp < this.currentTimestamp - 1000 ? 'idle' : 'active',
      lastActivity,
      activityCount: activities.length,
      actionCounts
    };
  }

  /**
   * Get comprehensive node information
   */
  getNodeInfo(nodeId: string): any {
    if (!this.scenario) return null;

    const node = this.scenario.getNode(nodeId);
    if (!node) return null;

    const state = this.nodeStates.get(nodeId);
    const processor = this.processors.get(node.type);
    const engine = this;

    return {
      id: nodeId,
      type: node.type,
      config: node,
      connections: this.getNodeConnections(nodeId),
      state: state ? this.serializeNodeState(state) : null,
      processorType: processor?.constructor.name || 'Unknown',
      // Lazy evaluation getters
      get events() { return engine.getNodeEvents(nodeId); },
      get activities() { return engine.getNodeActivities(nodeId); },
      get currentState() { return engine.getCurrentNodeState(nodeId); },
      // FSM-specific info (if applicable)
      ...(node.type === 'FSM' || node.type === 'FSMProcessNode' ? {
        get fsmInfo() { return engine.getFSMInfo(nodeId); }
      } : {})
    };
  }

  /**
   * Get all nodes with optional filtering
   */
  getNodes(filter?: { type?: string; hasOutputs?: boolean; hasInputs?: boolean }): any[] {
    if (!this.scenario) return [];

    return this.scenario.getNodes()
      .filter(node => {
        if (filter?.type && node.type !== filter.type) return false;
        if (filter?.hasOutputs !== undefined) {
          const hasOutputs = node.outputs && node.outputs.length > 0;
          if (filter.hasOutputs !== hasOutputs) return false;
        }
        if (filter?.hasInputs !== undefined) {
          const hasInputs = node.inputs && node.inputs.length > 0;
          if (filter.hasInputs !== hasInputs) return false;
        }
        return true;
      })
      .map(node => this.getNodeInfo(node.id));
  }

  /**
   * Get connections for a specific node
   */
  getNodeConnections(nodeId: string): { incoming: any[], outgoing: any[] } {
    if (!this.scenario) return { incoming: [], outgoing: [] };

    const connections = this.scenario.getEdges();
    return {
      incoming: connections.filter(conn => conn.targetNodeId === nodeId || conn.to === nodeId),
      outgoing: connections.filter(conn => conn.sourceNodeId === nodeId || conn.from === nodeId)
    };
  }

  /**
   * Get events related to a specific node (lazy evaluation)
   */
  getNodeEvents(nodeId: string): any[] {
    const events = this.queue.getSnapshots()
      .filter(snapshot =>
        snapshot.sourceNodeId === nodeId ||
        snapshot.targetNodeId === nodeId
      );

    return events.map(event => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      sourceNodeId: event.sourceNodeId,
      targetNodeId: event.targetNodeId,
      data: event.data,
      status: event.processed ? 'processed' : 'pending'
    }));
  }

  /**
   * Get activities for a specific node (lazy evaluation)
   */
  getNodeActivities(nodeId: string): any[] {
    return this.ledger.getActivities()
      .filter(activity => activity.nodeId === nodeId)
      .map(activity => ({
        seq: activity.seq,
        timestamp: activity.timestamp,
        nodeId: activity.nodeId, // Include nodeId for consistency
        action: activity.action,
        value: activity.value,
        correlationIds: activity.correlationIds,
        timestamp: activity.timestamp
      }));
  }

  /**
   * Get FSM-specific information - focuses on FSM node state by replaying activities
   */
  getFSMInfo(nodeId: string): any {
    const nodeState = this.nodeStates.get(nodeId);
    if (!nodeState || !nodeState.fsmConfig) return null;

    // Get FSM node activities to determine current state
    const fsmActivities = this.ledger.getActivities()
      .filter(a => a.nodeId === nodeId)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Find current FSM state by replaying state transitions
    const stateTransitions = fsmActivities.filter(a => a.action === 'fsm_transition');
    const currentFSMState = stateTransitions.length > 0
      ? stateTransitions[stateTransitions.length - 1].value?.to
      : nodeState.fsmConfig.states.find(s => s.isInitial)?.id || 'pending';

    // Count transitions by state
    const stateTransitionCounts = stateTransitions.reduce((acc, t) => {
      const toState = t.value?.to;
      if (toState) {
        acc[toState] = (acc[toState] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // FSM processing statistics
    const processedTokens = fsmActivities.filter(a => a.action === 'token_processed').length;
    const emittedTokens = fsmActivities.filter(a => a.action === 'token_emitted').length;

    // Find tokens that have passed through this FSM node
    const fsmTokens = this.findTokens({ nodeId });
    const tokenCount = fsmTokens.length;

    return {
      // FSM Configuration
      config: nodeState.fsmConfig,
      globalVariables: nodeState.globalVariables || {},

      // Current FSM State (determined by activity replay)
      currentState: currentFSMState,

      // FSM Activity Statistics
      totalTransitions: stateTransitions.length,
      stateTransitionCounts,
      processedTokens,
      emittedTokens,
      totalActivities: fsmActivities.length,

      // Token tracking
      tokenCount,
      tokens: fsmTokens,

      // Recent FSM activity
      lastTransition: stateTransitions[stateTransitions.length - 1] || null,
      recentActivities: fsmActivities.slice(-5), // Last 5 activities

      // Get all activities for this FSM node
      getAllActivities: () => fsmActivities,

      // Get transitions to specific state
      getTransitionsToState: (stateId: string) =>
        stateTransitions.filter(t => t.value?.to === stateId),

      // Get FSM state changes that occurred while processing this token
      // NOTE: This is NOT "token state" (tokens don't have states!)
      // This shows what state transitions the FSM node went through when processing this specific token
      getTokenHistory: (tokenId: string) => {
        // Get the complete token journey across all nodes
        const tokenInfo = this.getTokenInfo(tokenId);
        if (!tokenInfo) return null;

        // Return the complete token lineage, not just FSM-specific activities
        return {
          tokenId,
          correlationIds: tokenInfo.correlationIds,
          // Complete journey across all nodes that this token visited
          journey: tokenInfo.journey,
          // All activities for this token across the entire system
          activities: tokenInfo.activities,
          // Token's path through different nodes
          nodesSeen: tokenInfo.nodesSeen,
          // For FSM context, also provide current FSM state if available
          currentFSMState: (() => {
            const fsmTransitions = tokenInfo.activities
              .filter(a => a.nodeId === nodeId && a.action === 'fsm_transition');
            return fsmTransitions.length > 0
              ? fsmTransitions[fsmTransitions.length - 1].value?.to
              : 'pending';
          })(),
          // State changes specifically at this FSM node
          stateHistory: (() => {
            const transitions = tokenInfo.activities
              .filter(a => a.nodeId === nodeId && a.action === 'fsm_transition');

            const stateHistory = [];

            // Add initial state if there are transitions
            if (transitions.length > 0) {
              const firstTransition = transitions[0];
              if (firstTransition.value?.from) {
                stateHistory.push({
                  state: firstTransition.value.from,
                  enteredAt: firstTransition.timestamp - 1,
                  transitionEvent: null
                });
              }
            }

            // Add all transitions
            transitions.forEach(a => {
              stateHistory.push({
                state: a.value?.to,
                from: a.value?.from,
                enteredAt: a.timestamp,
                transitionEvent: a
              });
            });

            return stateHistory;
          })(),

          // Current state property for compatibility
          get currentState() {
            return this.currentFSMState;
          }
        };
      }
    };
  }

  /**
   * Get token journey - step by step transformations and events
   */
  getTokenJourney(tokenId: string): any[] {
    const activities = this.getTokenActivities(tokenId);

    return activities.map((activity, index) => ({
      step: index + 1,
      timestamp: activity.timestamp,
      nodeId: activity.nodeId,
      nodeType: this.scenario?.getNode(activity.nodeId)?.type,
      action: activity.action,
      value: activity.value,
      transformation: this.describeTransformation(activity),
      correlationIds: activity.correlationIds,
      // Token identification info
      tokenId: this.extractTokenIdFromActivity(activity),
      generation: this.extractGenerationFromTokenId(tokenId),
      parentTokens: this.extractParentTokenIds(activity)
    }));
  }

  /**
   * Extract token ID from activity value
   */
  private extractTokenIdFromActivity(activity: any): string | null {
    return activity.value?.token?.id || activity.value?.id || null;
  }

  /**
   * Extract generation from deterministic token ID
   */
  private extractGenerationFromTokenId(tokenId: string): number {
    const match = tokenId.match(/_g(\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extract parent token IDs from activity
   */
  private extractParentTokenIds(activity: any): string[] {
    // For aggregations, joins, etc. - would need to be populated by processors
    return activity.value?.parentTokenIds || [];
  }

  /**
   * Describe what transformation happened in an activity
   */
  private describeTransformation(activity: any): string {
    switch (activity.action) {
      case 'token_emitted':
        return `Token created with value: ${JSON.stringify(activity.value)}`;
      case 'fsm_transition':
        return `FSM state changed: ${activity.value?.from} → ${activity.value?.to}`;
      case 'token_routed':
        return `Token routed to: ${activity.value?.targetNodes || activity.value}`;
      case 'token_processed':
        return `Token processed and transformed`;
      case 'token_consumed':
        return `Token consumed at sink`;
      default:
        return `Action: ${activity.action}`;
    }
  }

  /**
   * Get comprehensive token information with event history
   */
  getTokenInfo(tokenId: string): any {
    // Use findTokens to get the token with the given correlation ID
    const tokens = this.findTokens({ correlationId: tokenId });
    if (tokens.length === 0) return null;

    // Return the first matching token (there should only be one for a specific correlation ID)
    const token = tokens[0];

    return {
      tokenId: token.tokenId,
      correlationIds: token.correlationIds,
      firstSeen: token.firstSeen,
      lastSeen: token.lastSeen,
      nodesSeen: token.nodesSeen,
      activities: token.activities,
      // Lazy evaluation for journey
      get journey() { return token.journey; },
      // Query methods
      getActivitiesByAction: (action: string) => token.getActivitiesByAction(action),
      getActivitiesByNode: (nodeId: string) => token.getActivitiesByNode(nodeId)
    };
  }

  /**
   * Get all activities for a specific token (lazy evaluation)
   */
  getTokenActivities(tokenId: string): any[] {
    return this.ledger.getActivities()
      .filter(activity =>
        activity.correlationIds?.some(id => id.includes(tokenId)) ||
        activity.value?.tokenId === tokenId ||
        activity.value?.id === tokenId
      );
  }

  /**
   * Get token journey through the system
   */
  getTokenJourney(tokenId: string): any[] {
    const activities = this.getTokenActivities(tokenId);

    return activities
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(activity => ({
        timestamp: activity.timestamp,
        nodeId: activity.nodeId,
        nodeType: this.scenario?.getNode(activity.nodeId)?.type,
        action: activity.action,
        value: activity.value,
        correlationIds: activity.correlationIds
      }));
  }

  /**
   * Search tokens by correlation IDs (uses correlation IDs as primary identifiers)
   */
  findTokens(query: {
    correlationId?: string;
    nodeId?: string;
    state?: string;
    hasActivity?: string;
  }): any[] {
    // Get all activities from the ledger
    const allActivities = this.ledger.getActivities();

    // Group activities by correlation ID (since that's our primary identifier)
    const tokenMap = new Map<string, any>();

    allActivities.forEach(activity => {
      // Use correlation IDs as token identifiers
      if (activity.correlationIds && activity.correlationIds.length > 0) {
        activity.correlationIds.forEach(correlationId => {
          if (!tokenMap.has(correlationId)) {
            tokenMap.set(correlationId, {
              tokenId: correlationId, // Use correlation ID as token ID
              correlationIds: [correlationId],
              firstSeen: activity.timestamp,
              lastSeen: activity.timestamp,
              nodesSeen: new Set([activity.nodeId]),
              activities: []
            });
          }

          const token = tokenMap.get(correlationId)!;
          token.lastSeen = Math.max(token.lastSeen, activity.timestamp);
          token.nodesSeen.add(activity.nodeId);
          token.activities.push(activity);

          // Merge other correlation IDs from this activity
          activity.correlationIds.forEach(cid => {
            if (!token.correlationIds.includes(cid)) {
              token.correlationIds.push(cid);
            }
          });
        });
      }
    });

    // Convert to array and filter
    const engine = this;
    const allTokens = Array.from(tokenMap.values()).map(token => ({
      ...token,
      nodesSeen: Array.from(token.nodesSeen),
      // Add lazy getters for journey
      get journey() {
        return token.activities.map((activity: any, index: number) => ({
          step: index + 1,
          timestamp: activity.timestamp,
          nodeId: activity.nodeId,
          nodeType: engine.scenario?.getNode(activity.nodeId)?.type,
          action: activity.action,
          value: activity.value,
          transformation: engine.describeTransformation(activity),
          correlationIds: activity.correlationIds
        }));
      },
      // Add activity filtering methods
      getActivitiesByAction: (actionType: string) => {
        return token.activities.filter((activity: any) => activity.action === actionType);
      },
      getActivitiesByNode: (nodeId: string) => {
        return token.activities.filter((activity: any) => activity.nodeId === nodeId);
      }
    }));

    return allTokens.filter(token => {
      if (query.correlationId && !token.correlationIds?.includes(query.correlationId)) return false;
      if (query.nodeId && !token.nodesSeen.includes(query.nodeId)) return false;
      if (query.hasActivity) {
        return token.activities.some((a: any) => a.action === query.hasActivity);
      }
      if (query.state) {
        // Check if token has FSM transition to the specified state
        return token.activities.some((a: any) =>
          a.action === 'fsm_transition' && a.value?.to === query.state
        );
      }
      return true;
    });
  }

  /**
   * Get scenario overview with lazy evaluation
   */
  getScenarioInfo(): any {
    if (!this.scenario) return null;

    const config = this.scenario.getConfig();
    const scenario = this.scenario;
    const engine = this;

    return {
      id: config.id,
      name: config.name,
      nodeCount: scenario.getNodes().length,
      connectionCount: scenario.getEdges().length,
      // Lazy evaluation getters
      get nodes() { return engine.getNodes(); },
      get stats() { return engine.getStats(); },
      get summary() {
        const nodes = scenario.getNodes();
        const nodesByType = nodes.reduce((acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          totalNodes: nodes.length,
          nodesByType,
          totalActivities: engine.ledger.getActivities().length,
          currentTick: engine.currentTick,
          stepCount: engine.stepCount
        };
      }
    };
  }

  /**
   * Helper to serialize node state (remove circular references)
   */
  private serializeNodeState(state: any): any {
    const serialized: any = {};

    for (const [key, value] of Object.entries(state)) {
      if (key === 'tokenStates' && value instanceof Map) {
        serialized[key] = `Map(${value.size} tokens)`;
      } else if (typeof value === 'object' && value !== null) {
        serialized[key] = JSON.parse(JSON.stringify(value));
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Register default processors
   */
  private registerDefaultProcessors(): void {
    const defaultProcessors = [
      new DataSourceProcessor(),
      new ProcessorNodeProcessor(),
      new SinkProcessor(),
      new MultiplexerProcessor(),
      new BatcherProcessor(),
      new FSMProcessor(),
      new FSMProcessNodeProcessor(),
      new QueueProcessor(),
      new JoinerProcessor(),
    ];

    defaultProcessors.forEach( (processor: any) => {
      this.processors.set(processor.nodeType, processor);
    });

    console.log(`✅ Registered ${defaultProcessors.length} processors: ${defaultProcessors.map(p => p.nodeType).join(', ')}`);
  }

  /**
   * Register a custom processor
   */
  registerProcessor(processor: BaseProcessor): void {
    this.processors.set(processor.nodeType, processor);
    console.log(`📝 Registered processor: ${processor.nodeType}`);
  }

  /**
   * Initialize states for all nodes
   */
  private initializeNodeStates(): void {
    if (!this.scenario) return;

    this.scenario.getNodes().forEach(node => {
      const processor = this.processors.get(node.type);
      if (processor) {
        const state = processor.initializeState(node);
        this.nodeStates.set(node.id, state);
      } else {
        console.warn(`⚠️ No processor found for node type: ${node.type}`);
      }
    });

    console.log(`📦 Initialized ${this.nodeStates.size} node states`);
  }

  /**
   * Generate initial events for nodes that need initialization
   */
  private generateInitialEvents(): void {
    if (!this.scenario) return;

    // Node types that need SimulationStart events for initialization
    // DataSource nodes are now purely external event driven - NO SimulationStart needed!
    // Queue nodes are passive and don't need initialization events
    const nodeTypesThatNeedInit = ['FSM'];

    let totalEvents = 0;
    nodeTypesThatNeedInit.forEach(nodeType => {
      const nodes = this.scenario!.getNodesByType(nodeType);

      nodes.forEach(node => {
        const startEvent = this.queue.enqueue({
          timestamp: 0,
          type: 'SimulationStart',
          sourceNodeId: node.id,
          targetNodeId: node.id,
          data: { scenario: this.scenario!.getConfig().id },
          metadata: { initialEvent: true },
        });

        console.log(`🎬 Created SimulationStart event for ${nodeType} node: ${node.id}`);
        totalEvents++;
      });
    });

    console.log(`✅ Generated ${totalEvents} initial events for node initialization`);
  }

  /**
   * Process a single event
   */
  private async processEvent(event: EventData): Promise<void> {
    if (!this.scenario) return;

    // Special handling for DataEmit events - process them first, then route
    if (event.type === 'DataEmit') {
      // First, let the source processor handle the DataEmit event to log activities
      await this.processDataEmitEvent(event);
      // Then route the token to target nodes
      this.routeDataEmitEvent(event);
      return;
    }

    // Find the target node
    const targetNode = this.scenario.getNode(event.sourceNodeId);
    if (!targetNode) {
      console.warn(`⚠️ Node not found: ${event.sourceNodeId}`);
      return;
    }

    // Get the processor for this node type
    const processor = this.processors.get(targetNode.type);
    if (!processor) {
      console.warn(`⚠️ No processor for node type: ${targetNode.type}`);
      return;
    }

    // Get current node state
    let nodeState = this.nodeStates.get(targetNode.id);
    if (!nodeState) {
      nodeState = processor.initializeState(targetNode);
      this.nodeStates.set(targetNode.id, nodeState);
    }

    try {
      // Process the event
      const result = processor.process(event as any, targetNode, nodeState);

      // Update node state
      this.nodeStates.set(targetNode.id, result.newState);

      // Log activities
      result.activities.forEach((activity: any) => {
        this.ledger.log(activity);
      });

      // Enqueue new events (DataEmit events will be handled in the main processing loop)
      result.newEvents.forEach((newEventData: any) => {
        this.queue.enqueue(newEventData);
      });

    } catch (error) {
      console.error(`❌ Error processing event ${event.id}:`, error);

      // Log error activity
      this.ledger.log({
        timestamp: event.timestamp,
        nodeId: targetNode.id,
        nodeType: targetNode.type,
        action: 'error_occurred',
        value: error instanceof Error ? error.message : 'Unknown error',
        details: `Error processing ${event.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Process DataEmit event by the source processor (for activity logging)
   */
  private async processDataEmitEvent(event: any): Promise<void> {
    if (!this.scenario) return;

    // Find the source node
    const sourceNode = this.scenario.getNode(event.sourceNodeId);
    if (!sourceNode) {
      console.warn(`⚠️ Source node not found: ${event.sourceNodeId}`);
      return;
    }

    // Only process DataEmit events for DataSource nodes
    // Other node types should not handle DataEmit events
    if (sourceNode.type !== 'DataSource') {
      // For non-DataSource nodes, DataEmit events are just routing events
      // They don't need to be processed by the source processor
      return;
    }

    // Get the processor for this node type
    const processor = this.processors.get(sourceNode.type);
    if (!processor) {
      console.warn(`⚠️ No processor for node type: ${sourceNode.type}`);
      return;
    }

    // Get current node state
    let nodeState = this.nodeStates.get(sourceNode.id);
    if (!nodeState) {
      nodeState = processor.initializeState(sourceNode);
      this.nodeStates.set(sourceNode.id, nodeState);
    }

    try {
      // Process the DataEmit event to allow the source to log activities
      const result = processor.process(event, sourceNode, nodeState);

      // Update node state
      this.nodeStates.set(sourceNode.id, result.newState);

      // Log activities from the source processor
      result.activities.forEach((activity: any) => {
        this.ledger.log(activity);
      });

      // Enqueue new events (if any)
      result.newEvents.forEach((newEvent: any) => {
        this.queue.enqueue(newEvent);
      });

    } catch (error) {
      console.error(`❌ Error processing DataEmit event ${event.id}:`, error);
    }
  }

  /**
   * Route DataEmit events to connected nodes
   */
  private routeDataEmitEvent(dataEmitEvent: EventData): void {
    if (!this.scenario || dataEmitEvent.type !== 'DataEmit') return;

    const sourceNodeId = dataEmitEvent.sourceNodeId;
    const token = dataEmitEvent.data?.token;
    const outputName = dataEmitEvent.data?.outputName;

    if (!token) {
      console.warn(`⚠️ DataEmit event without token from ${sourceNodeId}`);
      return;
    }

    // Determine target nodes based on node type and output selection
    const sourceNode = this.scenario.getNode(sourceNodeId);
    let targetNodeIds: string[] = [];

    if (sourceNode?.type === 'Multiplexer' && outputName) {
      // For multiplexers, route to the specific output destination only
      const outputs = sourceNode.outputs || [];
      const selectedOutput = outputs.find(output => output.name === outputName);

      if (selectedOutput && selectedOutput.destinationNodeId) {
        targetNodeIds = [selectedOutput.destinationNodeId];
        console.log(`🎯 Multiplexer routing: ${sourceNodeId} → ${outputName} → ${selectedOutput.destinationNodeId}`);
      } else {
        console.warn(`⚠️ Multiplexer output not found: ${outputName} in ${sourceNodeId}`);
        // Fallback to default routing
        targetNodeIds = this.scenario.getTargets(sourceNodeId);
      }
    } else {
      // For all other node types, use default routing
      targetNodeIds = this.scenario.getTargets(sourceNodeId);
    }

    if (targetNodeIds.length === 0) {
      console.log(`📍 No targets for ${sourceNodeId} - token ends here`);
      return;
    }

    console.log(`🔀 Routing token from ${sourceNodeId} to: ${targetNodeIds.join(', ')}`);

    // Create TokenArrival events for each target
    // Use dataEmit.timestamp + 1 to avoid conflicts, but preserve relative timing
    const routingTimestamp = dataEmitEvent.timestamp + 1;

    targetNodeIds.forEach(targetNodeId => {
      // Find the specific input name from source node outputs
      let inputName = 'default';
      const sourceNode = this.scenario?.getNode(sourceNodeId);
      if (sourceNode?.outputs) {
        const matchingOutput = sourceNode.outputs.find((output: any) =>
          output.destinationNodeId === targetNodeId
        );
        if (matchingOutput?.destinationInputName) {
          inputName = matchingOutput.destinationInputName;
          console.log(`🔗 Routing: ${sourceNodeId} → ${targetNodeId} (input: ${inputName})`);
        }
      }

      const tokenArrivalEvent = {
        timestamp: routingTimestamp, // Later timestamp to avoid conflicts
        type: 'TokenArrival',
        sourceNodeId: targetNodeId, // CRITICAL: Use targetNodeId as sourceNodeId
        targetNodeId: targetNodeId,
        data: {
          token,
          fromNodeId: sourceNodeId,
          inputName: inputName, // CRITICAL: Include the destination input name
        },
        causedBy: dataEmitEvent.id,
        correlationIds: token.correlationIds,
        metadata: {
          routing: true,
          originalSource: sourceNodeId,
          selectedOutput: outputName, // Include selected output for debugging
          destinationInput: inputName, // For debugging
        },
      };
      this.queue.enqueue(tokenArrivalEvent);
    });
  }

  /**
   * Validate engine state
   */
  validateState(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate queue
    const queueValidation = this.queue.validateQueue();
    if (!queueValidation.isValid) {
      errors.push(...queueValidation.errors);
    }

    // Validate ledger
    const ledgerValidation = this.ledger.validateLedger();
    if (!ledgerValidation.isValid) {
      errors.push(...ledgerValidation.errors);
    }

    // Validate scenario
    if (!this.scenario) {
      errors.push('No scenario loaded');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check which nodes are eligible to fire after state changes (BFS traversal)
   * This is the critical missing piece - after each event, we need to check
   * which nodes now have all their inputs satisfied and can fire
   */
  private async checkNodeEligibility(): Promise<void> {
    if (!this.scenario) return;

    console.log(`🔍 BFS: Checking node eligibility after timestamp ${this.currentTimestamp}`);

    // Get all nodes that could potentially fire
    const allNodes = this.scenario.getNodes();
    console.log(`🔍 BFS: Found ${allNodes.length} total nodes to check`);

    let eligibleCount = 0;

    for (const node of allNodes) {
      // Skip DataSource nodes - they only fire on external events
      if (node.type === 'DataSource') {
        console.log(`🔍 BFS: Skipping DataSource node ${node.id}`);
        continue;
      }

      console.log(`🔍 BFS: Checking node ${node.id} (${node.type})`);

      // Check if this node is eligible to fire
      const isEligible = await this.isNodeEligibleToFire(node);

      if (isEligible) {
        eligibleCount++;

        // FSM nodes don't need ProcessingTrigger events - they process immediately when TokenArrival events arrive
        if (node.type === 'FSM' || node.type === 'FSMProcessNode') {
          console.log(`🎯 BFS: FSM Node ${node.id} (${node.type}) is eligible but doesn't need ProcessingTrigger - tokens will be processed directly`);
        } else {
          console.log(`🎯 BFS: Node ${node.id} (${node.type}) is eligible to fire - creating ProcessingTrigger event`);

          // Create a ProcessingTrigger event for this node
          this.queue.enqueue({
            timestamp: this.currentTimestamp + 1, // Fire in next timestamp
            type: 'ProcessingTrigger',
            sourceNodeId: node.id,
            targetNodeId: node.id,
            data: { triggeredByEligibilityCheck: true },
            metadata: {
              eligibilityTriggered: true,
              checkedAt: this.currentTimestamp
            }
          });
        }
      } else {
        console.log(`🔍 BFS: Node ${node.id} (${node.type}) is NOT eligible`);
      }
    }

    console.log(`🔍 BFS: Found ${eligibleCount} eligible nodes, queue size now: ${this.queue.size()}`);
  }

  /**
   * Check if a node is eligible to fire based on its input requirements
   */
  private async isNodeEligibleToFire(node: any): Promise<boolean> {
    // Get current node state
    const nodeState = this.nodeStates.get(node.id);
    if (!nodeState) {
      console.log(`🔍 BFS: Node ${node.id} has no state`);
      return false;
    }

    // Get the processor for this node type
    const processor = this.processors.get(node.type);
    if (!processor) {
      console.log(`🔍 BFS: Node ${node.id} has no processor for type ${node.type}`);
      return false;
    }

    // Check if node has required inputs and they are all satisfied
    const inputs = node.inputs || [];
    const requiredInputs = inputs.filter((input: any) => input.required);

    console.log(`🔍 BFS: Node ${node.id} has ${requiredInputs.length} required inputs:`, requiredInputs.map(i => i.name));

    if (requiredInputs.length === 0) {
      // FSM nodes should be eligible even with no required inputs if they have tokens in any buffer OR pending TokenArrival events
      if (node.type === 'FSM' || node.type === 'FSMProcessNode') {
        const anyTokensAvailable = Object.values(nodeState.inputBuffers || {})
          .some((buffer: any) => buffer && buffer.length > 0);

        // Also check if there are pending TokenArrival events for this node
        const pendingTokenArrivals = this.queue.getEventsByType('TokenArrival')
          .filter(e => e.sourceNodeId === node.id);

        if (anyTokensAvailable || pendingTokenArrivals.length > 0) {
          console.log(`🔍 BFS: FSM Node ${node.id} has ${anyTokensAvailable ? 'tokens in buffers' : ''} ${anyTokensAvailable && pendingTokenArrivals.length > 0 ? 'and' : ''} ${pendingTokenArrivals.length > 0 ? `${pendingTokenArrivals.length} pending TokenArrival events` : ''} - eligible`);
          return true;
        }
      }

      console.log(`🔍 BFS: Node ${node.id} has no required inputs - not eligible`);
      return false; // For now, only fire when inputs arrive
    }

    // Check if all required inputs have tokens available
    for (const input of requiredInputs) {
      const inputBuffer = nodeState.inputBuffers?.[input.name];
      const bufferLength = inputBuffer?.length || 0;
      console.log(`🔍 BFS: Node ${node.id} input '${input.name}' has ${bufferLength} tokens`);

      if (!inputBuffer || inputBuffer.length === 0) {
        console.log(`🔍 BFS: Node ${node.id} missing required input '${input.name}'`);
        return false; // Missing required input
      }
    }

    // All required inputs are satisfied!
    console.log(`🔍 BFS: Node ${node.id} has ALL required inputs satisfied!`);
    return true;
  }
}