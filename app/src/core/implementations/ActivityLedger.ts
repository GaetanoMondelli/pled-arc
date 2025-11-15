/**
 * Activity Ledger - Records what actually happened
 *
 * The Activity Ledger is like a business journal that records:
 * - What actions were taken (token emitted, processing started, etc.)
 * - When they happened (timestamp)
 * - Who did them (which node)
 * - What the results were (values, outcomes)
 *
 * Think of it like a detailed log of your business process execution.
 * This is separate from the queue management - it only tracks actual business events.
 */

import { ActivityStorageAdapter, MemoryActivityStorage } from './ActivityStorageAdapter';
import { ActivityEntry as CoreActivityEntry } from '../types';

export interface ActivityEntry {
  seq: number;
  timestamp: number;
  nodeId: string;
  nodeType: string;
  action: string;
  value: any;
  correlationIds?: string[];  // CHANGED: Now supports multiple correlation IDs for full provenance
  metadata?: any;
}

export interface ActivitySummary {
  totalActivities: number;
  activitiesByType: Record<string, number>;
  activitiesByNode: Record<string, number>;
  activitiesByAction: Record<string, number>;
  timespan: { start: number; end: number; duration: number };
  correlationGroups: Record<string, ActivityEntry[]>;
}

/**
 * ActivityLedger class - Records business events
 *
 * This ledger helps you:
 * - Track what actually happened in your workflow
 * - See the sequence of business events
 * - Analyze workflow performance
 * - Debug issues by tracing token flow
 */
export class ActivityLedger {
  private entries: ActivityEntry[] = [];
  private sequenceCounter = 0;

  /**
   * Record a new activity in the ledger
   */
  log(activity: Omit<ActivityEntry, 'seq'>): void {
    this.sequenceCounter++;

    const entry: ActivityEntry = {
      seq: this.sequenceCounter,
      ...activity,
    };

    this.entries.push(entry);
  }

  /**
   * Log multiple activities at once
   */
  logBatch(activities: Omit<ActivityEntry, 'seq'>[]): void {
    activities.forEach(activity => this.log(activity));
  }

  /**
   * Get all activities in chronological order
   */
  getActivities(): ActivityEntry[] {
    return [...this.entries].sort((a, b) => {
      // Primary sort: by timestamp time
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // Secondary sort: by sequence number
      return a.seq - b.seq;
    });
  }

  /**
   * Get activities for a specific node
   */
  getActivitiesByNode(nodeId: string): ActivityEntry[] {
    return this.entries
      .filter(entry => entry.nodeId === nodeId)
      .sort((a, b) => a.timestamp - b.timestamp || a.seq - b.seq);
  }

  /**
   * Get activities of a specific type
   */
  getActivitiesByAction(action: string): ActivityEntry[] {
    return this.entries
      .filter(entry => entry.action === action)
      .sort((a, b) => a.timestamp - b.timestamp || a.seq - b.seq);
  }

  /**
   * Get activities within a time range
   */
  getActivitiesInTimeRange(startTick: number, endTick: number): ActivityEntry[] {
    return this.entries
      .filter(entry => entry.timestamp >= startTick && entry.timestamp <= endTick)
      .sort((a, b) => a.timestamp - b.timestamp || a.seq - b.seq);
  }

  /**
   * Get activities by correlation ID (trace a token's journey)
   */
  getActivitiesByCorrelation(correlationId: string): ActivityEntry[] {
    return this.entries
      .filter(entry => entry.correlationIds?.includes(correlationId))
      .sort((a, b) => a.timestamp - b.timestamp || a.seq - b.seq);
  }

  /**
   * Get comprehensive summary of all activities
   */
  getSummary(): ActivitySummary {
    const activitiesByType: Record<string, number> = {};
    const activitiesByNode: Record<string, number> = {};
    const activitiesByAction: Record<string, number> = {};
    const correlationGroups: Record<string, ActivityEntry[]> = {};

    let minTick = Number.MAX_SAFE_INTEGER;
    let maxTick = Number.MIN_SAFE_INTEGER;

    this.entries.forEach(entry => {
      // Count by node type
      activitiesByType[entry.nodeType] = (activitiesByType[entry.nodeType] || 0) + 1;

      // Count by node ID
      activitiesByNode[entry.nodeId] = (activitiesByNode[entry.nodeId] || 0) + 1;

      // Count by action
      activitiesByAction[entry.action] = (activitiesByAction[entry.action] || 0) + 1;

      // Group by correlation ID
      if (entry.correlationId) {
        if (!correlationGroups[entry.correlationId]) {
          correlationGroups[entry.correlationId] = [];
        }
        correlationGroups[entry.correlationId].push(entry);
      }

      // Track time range
      minTick = Math.min(minTick, entry.timestamp);
      maxTick = Math.max(maxTick, entry.timestamp);
    });

    return {
      totalActivities: this.entries.length,
      activitiesByType,
      activitiesByNode,
      activitiesByAction,
      timespan: {
        start: minTick === Number.MAX_SAFE_INTEGER ? 0 : minTick,
        end: maxTick === Number.MIN_SAFE_INTEGER ? 0 : maxTick,
        duration: maxTick === Number.MIN_SAFE_INTEGER ? 0 : maxTick - minTick,
      },
      correlationGroups,
    };
  }

  /**
   * Clear all activities
   */
  clear(): void {
    this.entries = [];
    this.sequenceCounter = 0;
  }

  /**
   * Get the latest activity
   */
  getLatestActivity(): ActivityEntry | null {
    if (this.entries.length === 0) return null;
    return this.entries[this.entries.length - 1];
  }

  /**
   * Get activities count
   */
  getCount(): number {
    return this.entries.length;
  }

  /**
   * Check if ledger is empty
   */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Find activities matching criteria
   */
  find(criteria: Partial<ActivityEntry>): ActivityEntry[] {
    return this.entries.filter(entry => {
      return Object.entries(criteria).every(([key, value]) => {
        if (key === 'seq' || key === 'timestamp') {
          return entry[key as keyof ActivityEntry] === value;
        }
        return (entry[key as keyof ActivityEntry] as any) === value;
      });
    });
  }

  /**
   * Trace the complete journey of a token through the system
   */
  traceToken(correlationId: string): {
    journey: ActivityEntry[];
    summary: {
      totalSteps: number;
      duration: number;
      nodesVisited: string[];
      transformations: Array<{ from: any; to: any; node: string; action: string }>;
    };
  } {
    const journey = this.getActivitiesByCorrelation(correlationId);

    const nodesVisited = [...new Set(journey.map(entry => entry.nodeId))];
    const transformations: Array<{ from: any; to: any; node: string; action: string }> = [];

    // Find transformations (where value changes)
    for (let i = 1; i < journey.length; i++) {
      const prev = journey[i - 1];
      const curr = journey[i];

      if (prev.value !== curr.value && curr.action.includes('complete')) {
        transformations.push({
          from: prev.value,
          to: curr.value,
          node: curr.nodeId,
          action: curr.action,
        });
      }
    }

    const duration = journey.length > 0 ? journey[journey.length - 1].timestamp - journey[0].timestamp : 0;

    return {
      journey,
      summary: {
        totalSteps: journey.length,
        duration,
        nodesVisited,
        transformations,
      },
    };
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 47) + '...' : value;
    }

    if (typeof value === 'object') {
      try {
        const str = JSON.stringify(value);
        return str.length > 50 ? str.substring(0, 47) + '...' : str;
      } catch {
        return '[object]';
      }
    }

    return String(value);
  }

  /**
   * Print the ledger in a readable format
   */
  printLedger(): void {
    const activities = this.getActivities();

    console.log(`\\n📋 Activity Ledger (${activities.length} entries):`);

    if (activities.length === 0) {
      console.log('   (No activities recorded)');
      return;
    }

    activities.forEach((activity) => {
      const nodeInfo = `${activity.nodeId}(${activity.nodeType})`;
      const corrId = activity.correlationId ? ` | cID: ${activity.correlationId.slice(-4)}` : '';
      const formattedValue = this.formatValue(activity.value);
      console.log(`   ${activity.seq.toString().padStart(2)}. t:${activity.timestamp.toString().padStart(4)} | ${nodeInfo.padEnd(22)} | ${activity.action.padEnd(18)} | ${formattedValue}${corrId}`);
    });
  }

  /**
   * Validate ledger consistency
   */
  validateLedger(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check sequence numbers are consecutive
    const sequences = this.entries.map(e => e.seq).sort((a, b) => a - b);
    for (let i = 1; i < sequences.length; i++) {
      if (sequences[i] !== sequences[i - 1] + 1) {
        errors.push(`Non-consecutive sequence numbers: ${sequences[i - 1]} → ${sequences[i]}`);
      }
    }

    // Check for duplicate sequence numbers
    const uniqueSequences = new Set(sequences);
    if (sequences.length !== uniqueSequences.size) {
      errors.push('Duplicate sequence numbers found');
    }

    // Check that timestamp times are reasonable (non-negative)
    const invalidTicks = this.entries.filter(e => e.timestamp < 0);
    if (invalidTicks.length > 0) {
      errors.push(`Found ${invalidTicks.length} activities with negative timestamp times`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export activities to JSON for external analysis
   */
  exportToJSON(): string {
    return JSON.stringify({
      metadata: {
        exportedAt: new Date().toISOString(),
        totalActivities: this.entries.length,
        sequenceCounter: this.sequenceCounter,
      },
      activities: this.getActivities(),
      summary: this.getSummary(),
    }, null, 2);
  }

  /**
   * Import activities from JSON
   */
  importFromJSON(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.entries = data.activities || [];
      this.sequenceCounter = data.metadata?.sequenceCounter || this.entries.length;
    } catch (error) {
      throw new Error(`Failed to import ledger data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}