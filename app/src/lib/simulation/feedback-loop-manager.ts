/**
 * Feedback Loop Manager
 *
 * This system manages feedback loops in the Enhanced FSM system, providing
 * circuit breaker functionality, depth tracking, and loop detection to prevent
 * infinite recursion and system overload.
 */

/**
 * Generate a UUID v4 string
 */
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

import {
  FeedbackLoopConfig,
  FeedbackLoop,
  Event,
  Message,
} from "./enhanced-fsm-types";

export interface FeedbackMetrics {
  totalLoops: number;
  activeLoops: number;
  circuitBreakerTrips: number;
  averageDepth: number;
  maxDepthReached: number;
  eventsPerSecond: number;
  messagesPerSecond: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  eventCount: number;
  windowStartTime: number;
  lastTriggerTime?: number;
  tripCount: number;
}

export interface LoopDetectionResult {
  hasLoop: boolean;
  loopNodes: string[];
  loopDepth: number;
  pathDescription: string;
}

export class FeedbackLoopManager {
  private config: FeedbackLoopConfig;
  private activeFeedbackLoops: Map<string, FeedbackLoop> = new Map();
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  private eventCounts: Map<string, number[]> = new Map(); // nodeId -> timestamps
  private messageCounts: Map<string, number[]> = new Map();
  private depthTracker: Map<string, number> = new Map(); // executionId -> current depth
  private loopPaths: Map<string, string[]> = new Map(); // Track paths for loop detection
  private metrics: FeedbackMetrics;
  private debugMode: boolean = false;

  constructor(config: FeedbackLoopConfig, debugMode: boolean = false) {
    this.config = config;
    this.debugMode = debugMode;
    this.metrics = {
      totalLoops: 0,
      activeLoops: 0,
      circuitBreakerTrips: 0,
      averageDepth: 0,
      maxDepthReached: 0,
      eventsPerSecond: 0,
      messagesPerSecond: 0,
    };

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  /**
   * Check if feedback is allowed for a specific node and execution
   */
  canCreateFeedback(
    sourceNodeId: string,
    targetNodeId: string,
    executionId: string,
    outputType: "event" | "message"
  ): { allowed: boolean; reason?: string } {
    // Check if feedback is globally enabled
    if (!this.config.enabled) {
      return { allowed: false, reason: "Feedback loops disabled" };
    }

    // Check if target node is blacklisted
    if (this.config.routing.blacklistedNodes.includes(targetNodeId)) {
      return { allowed: false, reason: `Target node ${targetNodeId} is blacklisted` };
    }

    // Check self-feedback permission
    if (sourceNodeId === targetNodeId && !this.config.routing.allowSelfFeedback) {
      return { allowed: false, reason: "Self-feedback not allowed" };
    }

    // Check external feedback permission
    if (sourceNodeId !== targetNodeId && !this.config.routing.allowExternalFeedback) {
      return { allowed: false, reason: "External feedback not allowed" };
    }

    // Check circuit breaker
    const circuitBreakerCheck = this.checkCircuitBreaker(targetNodeId);
    if (!circuitBreakerCheck.allowed) {
      return circuitBreakerCheck;
    }

    // Check maximum depth
    const currentDepth = this.depthTracker.get(executionId) || 0;
    if (currentDepth >= this.config.maxDepth) {
      return { allowed: false, reason: `Maximum depth ${this.config.maxDepth} reached` };
    }

    // Check for infinite loops
    const loopDetection = this.detectInfiniteLoop(sourceNodeId, targetNodeId, executionId);
    if (loopDetection.hasLoop) {
      return {
        allowed: false,
        reason: `Infinite loop detected: ${loopDetection.pathDescription}`
      };
    }

    return { allowed: true };
  }

  /**
   * Register a new feedback loop
   */
  registerFeedbackLoop(
    sourceNodeId: string,
    targetNodeId: string,
    outputType: "event" | "message",
    executionId: string
  ): string {
    const currentDepth = this.depthTracker.get(executionId) || 0;
    const newDepth = currentDepth + 1;

    const feedbackLoop: FeedbackLoop = {
      id: this.generateId("loop"),
      sourceNodeId,
      targetNodeId,
      outputType,
      createdAt: Date.now(),
      depth: newDepth,
    };

    this.activeFeedbackLoops.set(feedbackLoop.id, feedbackLoop);
    this.depthTracker.set(executionId, newDepth);

    // Update path tracking
    const currentPath = this.loopPaths.get(executionId) || [];
    this.loopPaths.set(executionId, [...currentPath, sourceNodeId]);

    // Update metrics
    this.metrics.totalLoops++;
    this.metrics.activeLoops = this.activeFeedbackLoops.size;
    this.metrics.maxDepthReached = Math.max(this.metrics.maxDepthReached, newDepth);

    if (this.debugMode) {
      console.log(`Registered feedback loop: ${sourceNodeId} -> ${targetNodeId} (depth: ${newDepth})`);
    }

    return feedbackLoop.id;
  }

  /**
   * Record an event for circuit breaker monitoring
   */
  recordEvent(nodeId: string, type: "event" | "message"): void {
    const now = Date.now();
    const counts = type === "event" ? this.eventCounts : this.messageCounts;

    if (!counts.has(nodeId)) {
      counts.set(nodeId, []);
    }

    const nodeCounts = counts.get(nodeId)!;
    nodeCounts.push(now);

    // Update circuit breaker state
    this.updateCircuitBreakerState(nodeId, now);

    // Update metrics
    this.updateMetrics();
  }

  /**
   * Check circuit breaker state for a node
   */
  private checkCircuitBreaker(nodeId: string): { allowed: boolean; reason?: string } {
    if (!this.config.circuitBreaker.enabled) {
      return { allowed: true };
    }

    const state = this.circuitBreakerStates.get(nodeId);
    if (!state) {
      return { allowed: true };
    }

    const now = Date.now();

    // Check if circuit breaker is open
    if (state.isOpen) {
      // Check if cooldown period has passed
      if (state.lastTriggerTime &&
          (now - state.lastTriggerTime) >= this.config.circuitBreaker.cooldownPeriod) {
        // Reset circuit breaker
        state.isOpen = false;
        state.eventCount = 0;
        state.windowStartTime = now;

        if (this.debugMode) {
          console.log(`Circuit breaker reset for node ${nodeId}`);
        }

        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `Circuit breaker open for node ${nodeId} (cooldown active)`
      };
    }

    return { allowed: true };
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreakerState(nodeId: string, timestamp: number): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    let state = this.circuitBreakerStates.get(nodeId);
    if (!state) {
      state = {
        isOpen: false,
        eventCount: 0,
        windowStartTime: timestamp,
        tripCount: 0,
      };
      this.circuitBreakerStates.set(nodeId, state);
    }

    // Check if we need to reset the time window
    if (timestamp - state.windowStartTime >= this.config.circuitBreaker.timeWindow) {
      state.eventCount = 0;
      state.windowStartTime = timestamp;
    }

    state.eventCount++;

    // Check if threshold is exceeded
    if (state.eventCount >= this.config.circuitBreaker.threshold) {
      state.isOpen = true;
      state.lastTriggerTime = timestamp;
      state.tripCount++;
      this.metrics.circuitBreakerTrips++;

      if (this.debugMode) {
        console.warn(`Circuit breaker tripped for node ${nodeId} (${state.eventCount} events in window)`);
      }
    }
  }

  /**
   * Detect infinite loops in feedback paths
   */
  private detectInfiniteLoop(
    sourceNodeId: string,
    targetNodeId: string,
    executionId: string
  ): LoopDetectionResult {
    const currentPath = this.loopPaths.get(executionId) || [];

    // Check if we're creating a cycle
    const targetIndex = currentPath.indexOf(targetNodeId);
    if (targetIndex !== -1) {
      // Found a cycle
      const loopNodes = currentPath.slice(targetIndex);
      return {
        hasLoop: true,
        loopNodes,
        loopDepth: loopNodes.length,
        pathDescription: `${loopNodes.join(" -> ")} -> ${targetNodeId}`,
      };
    }

    // Check if path is getting too long (potential infinite loop)
    if (currentPath.length > this.config.maxDepth * 2) {
      return {
        hasLoop: true,
        loopNodes: currentPath.slice(-10), // Last 10 nodes
        loopDepth: currentPath.length,
        pathDescription: `Excessive path length: ${currentPath.length} nodes`,
      };
    }

    return {
      hasLoop: false,
      loopNodes: [],
      loopDepth: 0,
      pathDescription: "",
    };
  }

  /**
   * Complete a feedback execution (reduces depth)
   */
  completeFeedbackExecution(executionId: string, loopId: string): void {
    // Remove the feedback loop
    this.activeFeedbackLoops.delete(loopId);

    // Reduce depth
    const currentDepth = this.depthTracker.get(executionId) || 0;
    if (currentDepth > 0) {
      this.depthTracker.set(executionId, currentDepth - 1);
    }

    // Update path tracking
    const currentPath = this.loopPaths.get(executionId) || [];
    if (currentPath.length > 0) {
      this.loopPaths.set(executionId, currentPath.slice(0, -1));
    }

    // Update metrics
    this.metrics.activeLoops = this.activeFeedbackLoops.size;

    if (this.debugMode) {
      console.log(`Completed feedback execution: ${executionId} (remaining depth: ${currentDepth - 1})`);
    }
  }

  /**
   * Force close a feedback execution (emergency stop)
   */
  forceCloseFeedbackExecution(executionId: string): void {
    // Remove all feedback loops for this execution
    const loopsToRemove: string[] = [];
    for (const [loopId, loop] of this.activeFeedbackLoops.entries()) {
      // This is a simplified check - in practice, you'd track execution IDs more carefully
      loopsToRemove.push(loopId);
    }

    loopsToRemove.forEach(loopId => this.activeFeedbackLoops.delete(loopId));

    // Reset depth and path
    this.depthTracker.delete(executionId);
    this.loopPaths.delete(executionId);

    // Update metrics
    this.metrics.activeLoops = this.activeFeedbackLoops.size;

    if (this.debugMode) {
      console.warn(`Force closed feedback execution: ${executionId}`);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeWindow = 1000; // 1 second

    // Calculate events per second
    let totalEvents = 0;
    let totalMessages = 0;

    for (const timestamps of this.eventCounts.values()) {
      totalEvents += timestamps.filter(t => (now - t) <= timeWindow).length;
    }

    for (const timestamps of this.messageCounts.values()) {
      totalMessages += timestamps.filter(t => (now - t) <= timeWindow).length;
    }

    this.metrics.eventsPerSecond = totalEvents;
    this.metrics.messagesPerSecond = totalMessages;

    // Calculate average depth
    const depths = Array.from(this.depthTracker.values());
    this.metrics.averageDepth = depths.length > 0
      ? depths.reduce((sum, depth) => sum + depth, 0) / depths.length
      : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): FeedbackMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakerStates);
  }

  /**
   * Get active feedback loops
   */
  getActiveFeedbackLoops(): FeedbackLoop[] {
    return Array.from(this.activeFeedbackLoops.values());
  }

  /**
   * Get feedback loop path for an execution
   */
  getFeedbackPath(executionId: string): string[] {
    return this.loopPaths.get(executionId) || [];
  }

  /**
   * Reset circuit breaker for a specific node
   */
  resetCircuitBreaker(nodeId: string): boolean {
    const state = this.circuitBreakerStates.get(nodeId);
    if (state) {
      state.isOpen = false;
      state.eventCount = 0;
      state.windowStartTime = Date.now();

      if (this.debugMode) {
        console.log(`Manually reset circuit breaker for node ${nodeId}`);
      }

      return true;
    }
    return false;
  }

  /**
   * Update feedback loop configuration
   */
  updateConfig(newConfig: Partial<FeedbackLoopConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.debugMode) {
      console.log("Updated feedback loop configuration:", this.config);
    }
  }

  /**
   * Clean up old data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean up old event counts
    for (const [nodeId, timestamps] of this.eventCounts.entries()) {
      const recentTimestamps = timestamps.filter(t => (now - t) <= maxAge);
      if (recentTimestamps.length === 0) {
        this.eventCounts.delete(nodeId);
      } else {
        this.eventCounts.set(nodeId, recentTimestamps);
      }
    }

    // Clean up old message counts
    for (const [nodeId, timestamps] of this.messageCounts.entries()) {
      const recentTimestamps = timestamps.filter(t => (now - t) <= maxAge);
      if (recentTimestamps.length === 0) {
        this.messageCounts.delete(nodeId);
      } else {
        this.messageCounts.set(nodeId, recentTimestamps);
      }
    }

    // Clean up old feedback loops
    const oldLoops: string[] = [];
    for (const [loopId, loop] of this.activeFeedbackLoops.entries()) {
      if ((now - loop.createdAt) > maxAge) {
        oldLoops.push(loopId);
      }
    }
    oldLoops.forEach(loopId => this.activeFeedbackLoops.delete(loopId));

    if (this.debugMode && oldLoops.length > 0) {
      console.log(`Cleaned up ${oldLoops.length} old feedback loops`);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return generateGuid();
  }
}

/**
 * Factory for creating common feedback loop configurations
 */
export class FeedbackConfigFactory {
  /**
   * Create a conservative feedback configuration (safe defaults)
   */
  static createConservativeConfig(): FeedbackLoopConfig {
    return {
      enabled: true,
      maxDepth: 5,
      circuitBreaker: {
        enabled: true,
        threshold: 50,
        timeWindow: 60000, // 1 minute
        cooldownPeriod: 30000, // 30 seconds
      },
      routing: {
        allowSelfFeedback: true,
        allowExternalFeedback: true,
        blacklistedNodes: [],
      },
    };
  }

  /**
   * Create a permissive feedback configuration (higher limits)
   */
  static createPermissiveConfig(): FeedbackLoopConfig {
    return {
      enabled: true,
      maxDepth: 20,
      circuitBreaker: {
        enabled: true,
        threshold: 200,
        timeWindow: 60000,
        cooldownPeriod: 15000,
      },
      routing: {
        allowSelfFeedback: true,
        allowExternalFeedback: true,
        blacklistedNodes: [],
      },
    };
  }

  /**
   * Create a restrictive feedback configuration (limited loops)
   */
  static createRestrictiveConfig(): FeedbackLoopConfig {
    return {
      enabled: true,
      maxDepth: 3,
      circuitBreaker: {
        enabled: true,
        threshold: 20,
        timeWindow: 60000,
        cooldownPeriod: 60000, // 1 minute
      },
      routing: {
        allowSelfFeedback: false, // No self-feedback
        allowExternalFeedback: true,
        blacklistedNodes: [],
      },
    };
  }

  /**
   * Create a disabled feedback configuration
   */
  static createDisabledConfig(): FeedbackLoopConfig {
    return {
      enabled: false,
      maxDepth: 0,
      circuitBreaker: {
        enabled: false,
        threshold: 0,
        timeWindow: 0,
        cooldownPeriod: 0,
      },
      routing: {
        allowSelfFeedback: false,
        allowExternalFeedback: false,
        blacklistedNodes: [],
      },
    };
  }
}