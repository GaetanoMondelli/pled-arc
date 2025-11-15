/**
 * Comprehensive Token Lineage Tracking System
 * Tracks complete token history from source to sink with full genealogy
 */

import type { Token, HistoryEntry } from "./types";

export interface TokenLineageNode {
  tokenId: string;
  value: any;
  nodeId: string;
  nodeName: string;
  timestamp: number;
  action: string;
  parentTokens: string[]; // Token IDs this token was derived from
  childTokens: string[];  // Token IDs derived from this token
  depth: number;          // How many hops from original source
  lineageType: 'source' | 'transformed' | 'aggregated' | 'split' | 'consumed';
}

export interface TokenLineageTree {
  tokenId: string;
  ancestors: TokenLineageNode[];  // Full path back to source(s)
  descendants: TokenLineageNode[]; // All tokens derived from this one
  siblings: TokenLineageNode[];    // Other tokens created in same operation
  fullPath: TokenLineageNode[];    // Complete journey through nodes
}

export class TokenLineageTracker {
  private static lineageMap = new Map<string, TokenLineageNode>();
  private static parentChildMap = new Map<string, Set<string>>(); // parent -> children
  private static childParentMap = new Map<string, Set<string>>(); // child -> parents

  /**
   * Register a new token in the lineage system
   */
  static registerToken(
    token: Token,
    nodeId: string,
    nodeName: string,
    timestamp: number,
    parentTokens: Token[] = [],
    action: string = 'created'
  ): void {
    const lineageType = this.determineLineageType(action, parentTokens.length);

    const lineageNode: TokenLineageNode = {
      tokenId: token.id,
      value: token.value,
      nodeId,
      nodeName,
      timestamp,
      action,
      parentTokens: parentTokens.map(t => t.id),
      childTokens: [],
      depth: parentTokens.length > 0 ? Math.max(...parentTokens.map(p => this.getDepth(p.id))) + 1 : 0,
      lineageType
    };

    // Store in lineage map
    this.lineageMap.set(token.id, lineageNode);

    // Update parent-child relationships
    for (const parentToken of parentTokens) {
      // Add this token as child of parent
      if (!this.parentChildMap.has(parentToken.id)) {
        this.parentChildMap.set(parentToken.id, new Set());
      }
      this.parentChildMap.get(parentToken.id)!.add(token.id);

      // Add parent as parent of this token
      if (!this.childParentMap.has(token.id)) {
        this.childParentMap.set(token.id, new Set());
      }
      this.childParentMap.get(token.id)!.add(parentToken.id);

      // Update parent's children list
      const parentNode = this.lineageMap.get(parentToken.id);
      if (parentNode) {
        parentNode.childTokens.push(token.id);
      }
    }

    console.log(`🔍 [TOKEN LINEAGE] Registered token ${token.id} (depth: ${lineageNode.depth}, type: ${lineageType})`);
  }

  /**
   * Update token location when it moves to a new node
   */
  static updateTokenLocation(
    tokenId: string,
    nodeId: string,
    nodeName: string,
    timestamp: number,
    action: string
  ): void {
    const node = this.lineageMap.get(tokenId);
    if (node) {
      // Create a movement record but keep the original lineage info
      node.nodeId = nodeId;
      node.nodeName = nodeName;
      node.timestamp = timestamp;
      node.action = action;
    }
  }

  /**
   * Get complete lineage tree for a token
   */
  static getTokenLineage(tokenId: string): TokenLineageTree | null {
    const node = this.lineageMap.get(tokenId);
    if (!node) return null;

    return {
      tokenId,
      ancestors: this.getAncestors(tokenId),
      descendants: this.getDescendants(tokenId),
      siblings: this.getSiblings(tokenId),
      fullPath: this.getFullPath(tokenId)
    };
  }

  /**
   * Get all ancestor tokens (recursive back to sources)
   */
  static getAncestors(tokenId: string): TokenLineageNode[] {
    const ancestors: TokenLineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentTokenId: string) => {
      if (visited.has(currentTokenId)) return;
      visited.add(currentTokenId);

      const parents = this.childParentMap.get(currentTokenId);
      if (parents) {
        for (const parentId of parents) {
          const parentNode = this.lineageMap.get(parentId);
          if (parentNode) {
            ancestors.push(parentNode);
            traverse(parentId); // Recursive
          }
        }
      }
    };

    traverse(tokenId);
    return ancestors.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all descendant tokens (recursive forward to all derivatives)
   */
  static getDescendants(tokenId: string): TokenLineageNode[] {
    const descendants: TokenLineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentTokenId: string) => {
      if (visited.has(currentTokenId)) return;
      visited.add(currentTokenId);

      const children = this.parentChildMap.get(currentTokenId);
      if (children) {
        for (const childId of children) {
          const childNode = this.lineageMap.get(childId);
          if (childNode) {
            descendants.push(childNode);
            traverse(childId); // Recursive
          }
        }
      }
    };

    traverse(tokenId);
    return descendants.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get sibling tokens (created in same operation)
   */
  static getSiblings(tokenId: string): TokenLineageNode[] {
    const node = this.lineageMap.get(tokenId);
    if (!node) return [];

    const siblings: TokenLineageNode[] = [];

    // Find all tokens with same parents and created at same timestamp
    for (const [id, lineageNode] of this.lineageMap) {
      if (id !== tokenId &&
          lineageNode.timestamp === node.timestamp &&
          this.arraysEqual(lineageNode.parentTokens, node.parentTokens)) {
        siblings.push(lineageNode);
      }
    }

    return siblings;
  }

  /**
   * Get full path through nodes (chronological journey)
   */
  static getFullPath(tokenId: string): TokenLineageNode[] {
    const path: TokenLineageNode[] = [];

    // Start with ancestors
    const ancestors = this.getAncestors(tokenId);
    path.push(...ancestors);

    // Add current token
    const currentNode = this.lineageMap.get(tokenId);
    if (currentNode) {
      path.push(currentNode);
    }

    return path.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get token depth (hops from source)
   */
  private static getDepth(tokenId: string): number {
    const node = this.lineageMap.get(tokenId);
    return node ? node.depth : 0;
  }

  /**
   * Determine lineage type based on creation context
   */
  private static determineLineageType(action: string, parentCount: number): TokenLineageNode['lineageType'] {
    if (parentCount === 0) return 'source';
    if (parentCount === 1) return 'transformed';
    if (parentCount > 1) return 'aggregated';
    if (action.includes('split')) return 'split';
    if (action.includes('consumed')) return 'consumed';
    return 'transformed';
  }

  /**
   * Utility: Compare arrays for equality
   */
  private static arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  /**
   * Get lineage summary for display
   */
  static getLineageSummary(tokenId: string): string {
    const tree = this.getTokenLineage(tokenId);
    if (!tree) return `Token ${tokenId}: No lineage data`;

    const ancestors = tree.ancestors.length;
    const descendants = tree.descendants.length;
    const depth = this.getDepth(tokenId);

    return `Token ${tokenId}: ${ancestors} ancestors, ${descendants} descendants, depth ${depth}`;
  }

  /**
   * Get all source tokens for a given token
   */
  static getSourceTokens(tokenId: string): TokenLineageNode[] {
    const ancestors = this.getAncestors(tokenId);
    return ancestors.filter(node => node.lineageType === 'source');
  }

  /**
   * Get complete lineage chain as string
   */
  static getLineageChain(tokenId: string): string {
    const path = this.getFullPath(tokenId);
    return path.map(node => `${node.nodeName}(${node.tokenId})`).join(' → ');
  }

  /**
   * Clear all lineage data (for reset)
   */
  static clearAllLineage(): void {
    this.lineageMap.clear();
    this.parentChildMap.clear();
    this.childParentMap.clear();
    console.log('🧹 [TOKEN LINEAGE] Cleared all lineage data');
  }

  /**
   * Get debugging info
   */
  static getDebugInfo(): { totalTokens: number, totalRelationships: number } {
    return {
      totalTokens: this.lineageMap.size,
      totalRelationships: this.parentChildMap.size + this.childParentMap.size
    };
  }
}

/**
 * Lineage-aware activity message formatter
 */
export class LineageActivityMessages {
  static tokenEmittedWithLineage(token: Token, source: string, destination: string): string {
    const lineage = TokenLineageTracker.getLineageSummary(token.id);
    return `Token ${token.id} (${token.value}) → ${destination} | ${lineage}`;
  }

  static tokenReceivedWithLineage(token: Token, source: string, destination: string): string {
    const chain = TokenLineageTracker.getLineageChain(token.id);
    return `Token ${token.id} (${token.value}) ← ${source} | Chain: ${chain}`;
  }

  static tokenConsumedWithLineage(token: Token, processor: string): string {
    const sources = TokenLineageTracker.getSourceTokens(token.id);
    const sourceList = sources.map(s => s.nodeName).join(', ');
    return `Token ${token.id} (${token.value}) consumed | Origins: ${sourceList}`;
  }
}