/**
 * Token Lineage Tracker - DFS-based ancestry reconstruction
 *
 * This module provides comprehensive token lineage tracking and ancestry
 * reconstruction using Depth-First Search (DFS) algorithms.
 *
 * Business Value:
 * - Complete audit trails for compliance
 * - Root cause analysis when issues occur
 * - Performance bottleneck identification
 * - Process optimization insights
 */

import {
  ActivityEntry,
  Token,
  TokenLineageStep,
  TokenMetadata
} from '../types';

export interface TokenAncestry {
  token: Token;
  ancestors: TokenAncestry[];
  descendants: TokenAncestry[];
  depth: number;
  totalDescendants: number;
}

export interface LineageAnalysis {
  rootTokens: Token[];
  leafTokens: Token[];
  longestPath: Token[];
  branchingPoints: Token[];
  convergencePoints: Token[];
  totalTokens: number;
  maxDepth: number;
  avgBranchingFactor: number;
}

export interface TokenJourney {
  correlationId: string;
  path: ActivityEntry[];
  nodes: string[];
  totalProcessingTime: number;
  transformations: string[];
  branchPoints: number;
  convergePoints: number;
}

export class TokenLineageTracker {
  private activities: ActivityEntry[];
  private tokenIndex: Map<string, Token> = new Map();
  private parentIndex: Map<string, string[]> = new Map();
  private childrenIndex: Map<string, string[]> = new Map();
  private correlationIndex: Map<string, ActivityEntry[]> = new Map();

  constructor(activities: ActivityEntry[]) {
    this.activities = activities;
    this.buildIndices();
  }

  /**
   * Build indices for fast lookups
   */
  private buildIndices(): void {
    this.activities.forEach(activity => {
      // Index by correlation ID
      if (activity.correlationId) {
        if (!this.correlationIndex.has(activity.correlationId)) {
          this.correlationIndex.set(activity.correlationId, []);
        }
        this.correlationIndex.get(activity.correlationId)!.push(activity);
      }

      // Build token relationships from activities
      if (activity.action === 'emit' || activity.action === 'create') {
        // This is a token creation/emission
        const tokenData = this.extractTokenFromActivity(activity);
        if (tokenData) {
          this.tokenIndex.set(tokenData.id, tokenData);
        }
      }

      // Build parent-child relationships from lineage
      if (activity.value && activity.value.lineage) {
        const lineageSteps = activity.value.lineage as TokenLineageStep[];
        lineageSteps.forEach(step => {
          if (step.parentTokenId && step.childTokenId) {
            // Add parent relationship
            if (!this.parentIndex.has(step.childTokenId)) {
              this.parentIndex.set(step.childTokenId, []);
            }
            this.parentIndex.get(step.childTokenId)!.push(step.parentTokenId);

            // Add children relationship
            if (!this.childrenIndex.has(step.parentTokenId)) {
              this.childrenIndex.set(step.parentTokenId, []);
            }
            this.childrenIndex.get(step.parentTokenId)!.push(step.childTokenId);
          }
        });
      }
    });
  }

  /**
   * Extract token information from an activity entry
   */
  private extractTokenFromActivity(activity: ActivityEntry): Token | null {
    if (!activity.value) return null;

    // Try to extract token data from different activity types
    if (activity.value.id && activity.value.correlationIds) {
      return {
        id: activity.value.id,
        type: activity.value.type || 'data',
        data: activity.value.data || activity.value,
        correlationIds: activity.value.correlationIds,
        lineage: activity.value.lineage || [],
        metadata: activity.value.metadata || {}
      };
    }

    return null;
  }

  /**
   * Perform DFS to build complete ancestry tree for a token
   */
  buildAncestryTree(tokenId: string, visited: Set<string> = new Set()): TokenAncestry | null {
    if (visited.has(tokenId)) {
      // Cycle detected - return null to break infinite recursion
      return null;
    }

    const token = this.tokenIndex.get(tokenId);
    if (!token) return null;

    visited.add(tokenId);

    // Get all parent tokens using DFS
    const parentIds = this.parentIndex.get(tokenId) || [];
    const ancestors: TokenAncestry[] = [];

    parentIds.forEach(parentId => {
      const parentAncestry = this.buildAncestryTree(parentId, new Set(visited));
      if (parentAncestry) {
        ancestors.push(parentAncestry);
      }
    });

    // Get all descendant tokens using DFS
    const childIds = this.childrenIndex.get(tokenId) || [];
    const descendants: TokenAncestry[] = [];

    childIds.forEach(childId => {
      const childAncestry = this.buildAncestryTree(childId, new Set(visited));
      if (childAncestry) {
        descendants.push(childAncestry);
      }
    });

    visited.delete(tokenId);

    const totalDescendants = descendants.reduce(
      (sum, desc) => sum + 1 + desc.totalDescendants,
      0
    );

    const depth = ancestors.length === 0 ? 0 :
      Math.max(...ancestors.map(anc => anc.depth)) + 1;

    return {
      token,
      ancestors,
      descendants,
      depth,
      totalDescendants
    };
  }

  /**
   * Find all root tokens (tokens with no parents)
   */
  findRootTokens(): Token[] {
    const allTokenIds = Array.from(this.tokenIndex.keys());
    const rootTokens: Token[] = [];

    allTokenIds.forEach(tokenId => {
      const parents = this.parentIndex.get(tokenId) || [];
      if (parents.length === 0) {
        const token = this.tokenIndex.get(tokenId);
        if (token) {
          rootTokens.push(token);
        }
      }
    });

    return rootTokens;
  }

  /**
   * Find all leaf tokens (tokens with no children)
   */
  findLeafTokens(): Token[] {
    const allTokenIds = Array.from(this.tokenIndex.keys());
    const leafTokens: Token[] = [];

    allTokenIds.forEach(tokenId => {
      const children = this.childrenIndex.get(tokenId) || [];
      if (children.length === 0) {
        const token = this.tokenIndex.get(tokenId);
        if (token) {
          leafTokens.push(token);
        }
      }
    });

    return leafTokens;
  }

  /**
   * Find the longest path in the token lineage graph
   */
  findLongestPath(): Token[] {
    const rootTokens = this.findRootTokens();
    let longestPath: Token[] = [];

    rootTokens.forEach(rootToken => {
      const path = this.findLongestPathFromToken(rootToken.id);
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    });

    return longestPath;
  }

  /**
   * DFS to find longest path from a specific token
   */
  private findLongestPathFromToken(
    tokenId: string,
    visited: Set<string> = new Set()
  ): Token[] {
    if (visited.has(tokenId)) return [];

    const token = this.tokenIndex.get(tokenId);
    if (!token) return [];

    visited.add(tokenId);

    const childIds = this.childrenIndex.get(tokenId) || [];
    let longestChildPath: Token[] = [];

    childIds.forEach(childId => {
      const childPath = this.findLongestPathFromToken(childId, new Set(visited));
      if (childPath.length > longestChildPath.length) {
        longestChildPath = childPath;
      }
    });

    visited.delete(tokenId);

    return [token, ...longestChildPath];
  }

  /**
   * Find tokens that have multiple children (branching points)
   */
  findBranchingPoints(): Token[] {
    const branchingTokens: Token[] = [];

    this.childrenIndex.forEach((children, tokenId) => {
      if (children.length > 1) {
        const token = this.tokenIndex.get(tokenId);
        if (token) {
          branchingTokens.push(token);
        }
      }
    });

    return branchingTokens;
  }

  /**
   * Find tokens that have multiple parents (convergence points)
   */
  findConvergencePoints(): Token[] {
    const convergenceTokens: Token[] = [];

    this.parentIndex.forEach((parents, tokenId) => {
      if (parents.length > 1) {
        const token = this.tokenIndex.get(tokenId);
        if (token) {
          convergenceTokens.push(token);
        }
      }
    });

    return convergenceTokens;
  }

  /**
   * Comprehensive lineage analysis
   */
  analyzeLineage(): LineageAnalysis {
    const rootTokens = this.findRootTokens();
    const leafTokens = this.findLeafTokens();
    const longestPath = this.findLongestPath();
    const branchingPoints = this.findBranchingPoints();
    const convergencePoints = this.findConvergencePoints();
    const totalTokens = this.tokenIndex.size;

    const maxDepth = longestPath.length;

    // Calculate average branching factor
    let totalBranches = 0;
    let branchingNodes = 0;

    this.childrenIndex.forEach(children => {
      if (children.length > 0) {
        totalBranches += children.length;
        branchingNodes++;
      }
    });

    const avgBranchingFactor = branchingNodes > 0 ? totalBranches / branchingNodes : 0;

    return {
      rootTokens,
      leafTokens,
      longestPath,
      branchingPoints,
      convergencePoints,
      totalTokens,
      maxDepth,
      avgBranchingFactor
    };
  }

  /**
   * Trace complete journey for a correlation ID
   */
  traceTokenJourney(correlationId: string): TokenJourney | null {
    const activities = this.correlationIndex.get(correlationId);
    if (!activities || activities.length === 0) return null;

    // Sort activities by timestamp
    const sortedActivities = [...activities].sort((a, b) => a.timestamp - b.timestamp);

    const nodes = Array.from(new Set(sortedActivities.map(a => a.nodeId)));
    const transformations = sortedActivities
      .filter(a => a.action === 'transform' || a.action === 'process')
      .map(a => a.details || a.action);

    const firstTick = sortedActivities[0].timestamp;
    const lastTick = sortedActivities[sortedActivities.length - 1].timestamp;
    const totalProcessingTime = lastTick - firstTick;

    // Count branching and convergence points in this journey
    const branchPoints = sortedActivities.filter(a =>
      a.action === 'split' || a.action === 'route' || a.action === 'emit'
    ).length;

    const convergePoints = sortedActivities.filter(a =>
      a.action === 'join' || a.action === 'merge' || a.action === 'combine'
    ).length;

    return {
      correlationId,
      path: sortedActivities,
      nodes,
      totalProcessingTime,
      transformations,
      branchPoints,
      convergePoints
    };
  }

  /**
   * Get all correlation IDs in the system
   */
  getAllCorrelationIds(): string[] {
    return Array.from(this.correlationIndex.keys());
  }

  /**
   * Generate a comprehensive lineage report
   */
  generateLineageReport(): string {
    const analysis = this.analyzeLineage();

    let report = '🔍 TOKEN LINEAGE ANALYSIS REPORT\\n';
    report += '═'.repeat(50) + '\\n\\n';

    report += `📊 OVERVIEW:\\n`;
    report += `   Total Tokens: ${analysis.totalTokens}\\n`;
    report += `   Root Tokens: ${analysis.rootTokens.length}\\n`;
    report += `   Leaf Tokens: ${analysis.leafTokens.length}\\n`;
    report += `   Max Depth: ${analysis.maxDepth}\\n`;
    report += `   Avg Branching Factor: ${analysis.avgBranchingFactor.toFixed(2)}\\n\\n`;

    report += `🌳 BRANCHING POINTS (${analysis.branchingPoints.length}):\\n`;
    analysis.branchingPoints.forEach(token => {
      const children = this.childrenIndex.get(token.id)?.length || 0;
      report += `   • ${token.id} → ${children} children\\n`;
    });

    report += `\\n🔀 CONVERGENCE POINTS (${analysis.convergencePoints.length}):\\n`;
    analysis.convergencePoints.forEach(token => {
      const parents = this.parentIndex.get(token.id)?.length || 0;
      report += `   • ${token.id} ← ${parents} parents\\n`;
    });

    report += `\\n📏 LONGEST PATH (${analysis.longestPath.length} tokens):\\n`;
    analysis.longestPath.forEach((token, index) => {
      report += `   ${index + 1}. ${token.id}\\n`;
    });

    report += `\\n🔗 CORRELATION JOURNEYS:\\n`;
    this.getAllCorrelationIds().slice(0, 5).forEach(corrId => {
      const journey = this.traceTokenJourney(corrId);
      if (journey) {
        report += `   • ${corrId}: ${journey.nodes.length} nodes, ${journey.totalProcessingTime}ms\\n`;
      }
    });

    return report;
  }
}