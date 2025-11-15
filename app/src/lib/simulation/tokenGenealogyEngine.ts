/**
 * TokenGenealogyEngine - Complete Token Lineage Reconstruction
 *
 * This module provides comprehensive token genealogy analysis by building complete
 * lineage trees that trace any token back to its ultimate data source origins
 * through all intermediate aggregations, transformations, and processing steps.
 */
import {
  type AggregationDetails,
  type OperationInfo,
  type SourceTokenDetail,
  TokenGraph,
  type TokenNode,
  buildTokenGraphFromHistory,
  isRootToken,
} from "./tokenGraph";

// Re-export OperationInfo for use by other modules
export type { OperationInfo } from "./tokenGraph";
import type { HistoryEntry, Token } from "./types";

/**
 * Complete token lineage information
 */
export interface TokenLineage {
  targetToken: Token;
  immediateParents: ParentToken[];
  allAncestors: AncestorToken[];
  descendants: DescendantToken[];
  sourceContributions: SourceContribution[];
  generationLevels: GenerationLevel[];
}

/**
 * Information about a parent token (immediate ancestor)
 */
export interface ParentToken {
  id: string;
  value: any;
  createdAt: number;
  originNodeId: string;
  operation?: OperationInfo;
  contributionWeight: number;
}

/**
 * Information about an ancestor token with complete lineage
 */
export interface AncestorToken {
  id: string;
  value: any;
  createdAt: number;
  originNodeId: string;
  generationLevel: number;
  isRoot: boolean; // TRUE only for DataSource tokens (created from nothing)
  operation?: OperationInfo;
  contributionPath: string[];
  completeHistory: HistoryEntry[]; // Full history of this specific token
}

/**
 * Information about a descendant token
 */
export interface DescendantToken {
  id: string;
  value: any;
  createdAt: number;
  originNodeId: string;
  generationLevel: number;
  operation?: OperationInfo;
  derivationPath: string[];
}

/**
 * Source contribution analysis
 */
export interface SourceContribution {
  sourceTokenId: string;
  sourceNodeId: string;
  originalValue: any;
  proportionalContribution: number;
  contributionPath: string[];
}

/**
 * Generation level information
 */
export interface GenerationLevel {
  level: number;
  tokens: AncestorToken[];
  description: string;
}

/**
 * Error types for lineage computation
 */
export interface LineageError {
  type: "circular_reference" | "missing_token" | "incomplete_lineage" | "performance_limit";
  tokenId: string;
  message: string;
  affectedTokens: string[];
  suggestedAction: string;
}

/**
 * Core engine for building complete token genealogy trees
 */
export class TokenGenealogyEngine {
  private graph: TokenGraph;
  private globalLog: HistoryEntry[];
  private tokenHistoryMap: Map<string, HistoryEntry[]> = new Map();
  private tokenCreationMap: Map<string, HistoryEntry> = new Map();

  constructor(globalLog: HistoryEntry[]) {
    this.globalLog = globalLog;
    this.graph = buildTokenGraphFromHistory(globalLog);
    this.buildTokenMaps();
  }

  /**
   * Build internal maps for efficient token lookup
   */
  private buildTokenMaps(): void {
    this.tokenHistoryMap.clear();
    this.tokenCreationMap.clear();

    for (const entry of this.globalLog) {
      // Extract token ID from details (format: "Token {tokenId}")
      const tokenIdMatch = entry.details?.match(/Token (\w+)/);
      if (tokenIdMatch) {
        const tokenId = tokenIdMatch[1];

        // Track token creation events
        const isTokenCreation = entry.action === "CREATED" || entry.action.startsWith("AGGREGATED_");
        if (isTokenCreation) {
          this.tokenCreationMap.set(tokenId, entry);
        }

        // Build complete history for each token
        if (!this.tokenHistoryMap.has(tokenId)) {
          this.tokenHistoryMap.set(tokenId, []);
        }
        this.tokenHistoryMap.get(tokenId)!.push(entry);
      }
    }
  }

  /**
   * Build complete lineage for a target token
   */
  buildCompleteLineage(tokenId: string): TokenLineage {
    if (!this.graph.hasToken(tokenId)) {
      throw new Error(`Token ${tokenId} not found in graph`);
    }

    const targetToken = this.buildTokenFromNode(tokenId);
    const immediateParents = this.buildImmediateParents(tokenId);
    const allAncestors = this.findAllAncestors(tokenId);
    const descendants = this.findAllDescendants(tokenId);
    const sourceContributions = this.calculateSourceContributions(tokenId);
    const generationLevels = this.buildGenerationLevels(tokenId);

    return {
      targetToken,
      immediateParents,
      allAncestors,
      descendants,
      sourceContributions,
      generationLevels,
    };
  }

  /**
   * DFS-based recursive ancestry traversal - STOPS at DataSource tokens (true roots)
   */
  findAllAncestors(tokenId: string, visited: Set<string> = new Set()): AncestorToken[] {
    const allAncestors: AncestorToken[] = [];
    const ancestorMap = new Map<string, AncestorToken>();

    this.findAllAncestorsRecursive(tokenId, visited, allAncestors, ancestorMap, 0);

    // Return unique ancestors
    return Array.from(ancestorMap.values());
  }

  /**
   * Recursive helper for findAllAncestors that avoids duplicates
   */
  private findAllAncestorsRecursive(
    tokenId: string,
    visited: Set<string>,
    allAncestors: AncestorToken[],
    ancestorMap: Map<string, AncestorToken>,
    generationLevel: number,
  ): void {
    if (visited.has(tokenId)) {
      // Cycle detected - return to avoid infinite recursion
      return;
    }

    if (!this.graph.hasToken(tokenId)) {
      return;
    }

    visited.add(tokenId);
    const node = this.graph.getNode(tokenId)!;

    // Create or update ancestor token for current node
    if (!ancestorMap.has(tokenId)) {
      const ancestorToken: AncestorToken = {
        id: tokenId,
        value: node.value,
        createdAt: node.createdAt,
        originNodeId: node.originNodeId,
        generationLevel,
        isRoot: isRootToken(tokenId, this.graph),
        operation: node.operation,
        contributionPath: [tokenId],
        completeHistory: this.tokenHistoryMap.get(tokenId) || [],
      };
      ancestorMap.set(tokenId, ancestorToken);
    } else {
      // Update generation level if this path is shorter
      const existing = ancestorMap.get(tokenId)!;
      if (generationLevel < existing.generationLevel) {
        existing.generationLevel = generationLevel;
      }
    }

    const currentAncestor = ancestorMap.get(tokenId)!;

    // If this is a root token (DataSource), stop traversal
    if (currentAncestor.isRoot) {
      visited.delete(tokenId);
      return;
    }

    // Recursively traverse all parent tokens
    const parents = this.graph.getParents(tokenId);
    for (const parentId of parents) {
      this.findAllAncestorsRecursive(parentId, new Set(visited), allAncestors, ancestorMap, generationLevel + 1);
    }

    visited.delete(tokenId);
  }

  /**
   * DFS for forward traversal to find descendants
   */
  findAllDescendants(tokenId: string, visited: Set<string> = new Set()): DescendantToken[] {
    const descendants: DescendantToken[] = [];

    if (visited.has(tokenId)) {
      return []; // Cycle detected
    }

    if (!this.graph.hasToken(tokenId)) {
      return [];
    }

    visited.add(tokenId);
    const node = this.graph.getNode(tokenId)!;

    // Create descendant token for current node
    const descendantToken: DescendantToken = {
      id: tokenId,
      value: node.value,
      createdAt: node.createdAt,
      originNodeId: node.originNodeId,
      generationLevel: 0, // Will be updated later
      operation: node.operation,
      derivationPath: [tokenId],
    };

    descendants.push(descendantToken);

    // Recursively traverse all child tokens
    const children = this.graph.getChildren(tokenId);
    for (const childId of children) {
      const childDescendants = this.findAllDescendants(childId, new Set(visited));

      // Update derivation paths and generation levels
      for (const childDescendant of childDescendants) {
        childDescendant.derivationPath = [tokenId, ...childDescendant.derivationPath];
        childDescendant.generationLevel += 1;
      }

      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Determine if a token is a TRUE root (created by DataSource, not derived from other tokens)
   */
  isRootToken(tokenId: string): boolean {
    return isRootToken(tokenId, this.graph);
  }

  /**
   * Build complete operation details including all source token histories
   */
  buildOperationDetails(tokenId: string): OperationInfo | undefined {
    const node = this.graph.getNode(tokenId);
    if (!node || !node.operation) {
      return undefined;
    }

    const operation = { ...node.operation };

    // Enhance source tokens with complete lineage
    if (operation.sourceTokens && operation.sourceTokens.length > 0) {
      const enhancedSourceTokens: SourceTokenDetail[] = [];

      for (const sourceToken of operation.sourceTokens) {
        const enhancedSourceToken: SourceTokenDetail = {
          ...sourceToken,
          // Note: completeLineage would be populated recursively if needed
          // For now, we include the basic information
        };
        enhancedSourceTokens.push(enhancedSourceToken);
      }

      operation.sourceTokens = enhancedSourceTokens;
    }

    return operation;
  }

  /**
   * Calculate proportional contributions from all source paths
   */
  calculateSourceContributions(tokenId: string): SourceContribution[] {
    const contributions: SourceContribution[] = [];
    const ancestors = this.findAllAncestors(tokenId);

    // Find all root tokens (ultimate sources)
    const rootTokens = ancestors.filter(ancestor => ancestor.isRoot);

    for (const rootToken of rootTokens) {
      // Calculate proportional contribution
      const contribution = this.calculateProportionalContribution(rootToken.id, tokenId, rootToken.value);

      // Build contribution path from source to target
      const paths = this.graph.findAllPaths(rootToken.id, tokenId);
      const contributionPath = paths.length > 0 ? paths[0].tokens : [rootToken.id, tokenId];

      contributions.push({
        sourceTokenId: rootToken.id,
        sourceNodeId: rootToken.originNodeId,
        originalValue: rootToken.value,
        proportionalContribution: contribution,
        contributionPath,
      });
    }

    return contributions;
  }

  /**
   * Calculate proportional contribution of a source token to the target
   */
  private calculateProportionalContribution(sourceTokenId: string, targetTokenId: string, sourceValue: any): number {
    // Find all paths from source to target
    const paths = this.graph.findAllPaths(sourceTokenId, targetTokenId);

    if (paths.length === 0) {
      return 0;
    }

    // For now, use simple equal weighting
    // In a more sophisticated implementation, this would analyze
    // the aggregation methods and calculate actual proportional contributions
    const sourceNum = Number(sourceValue) || 0;
    const targetNode = this.graph.getNode(targetTokenId);
    const targetNum = Number(targetNode?.value) || 0;

    if (targetNum === 0) {
      return 0;
    }

    // Simple proportional calculation
    // This is a placeholder - real implementation would trace through
    // all aggregation operations to calculate exact contributions
    return Math.min(1.0, Math.abs(sourceNum / targetNum));
  }

  /**
   * Build generation levels for ancestry visualization
   */
  private buildGenerationLevels(tokenId: string): GenerationLevel[] {
    const generationMap = this.graph.bfsAncestryByGeneration(tokenId);
    const levels: GenerationLevel[] = [];

    for (const [level, tokenIds] of generationMap) {
      const tokens: AncestorToken[] = [];

      for (const ancestorId of tokenIds) {
        const node = this.graph.getNode(ancestorId);
        if (node) {
          tokens.push({
            id: ancestorId,
            value: node.value,
            createdAt: node.createdAt,
            originNodeId: node.originNodeId,
            generationLevel: level,
            isRoot: isRootToken(ancestorId, this.graph),
            operation: node.operation,
            contributionPath: [ancestorId], // Simplified for generation view
            completeHistory: this.tokenHistoryMap.get(ancestorId) || [],
          });
        }
      }

      levels.push({
        level,
        tokens,
        description: this.generateLevelDescription(level, tokens),
      });
    }

    return levels.sort((a, b) => a.level - b.level);
  }

  /**
   * Generate description for a generation level
   */
  private generateLevelDescription(level: number, tokens: AncestorToken[]): string {
    if (level === 0) {
      return "Target Token";
    }

    const rootCount = tokens.filter(t => t.isRoot).length;
    const aggregationCount = tokens.filter(t => t.operation?.type === "aggregation").length;
    const transformationCount = tokens.filter(t => t.operation?.type === "transformation").length;

    if (rootCount > 0) {
      return `Generation ${level}: ${rootCount} Data Source${rootCount > 1 ? "s" : ""}`;
    } else if (aggregationCount > 0) {
      return `Generation ${level}: ${aggregationCount} Aggregation${aggregationCount > 1 ? "s" : ""}`;
    } else if (transformationCount > 0) {
      return `Generation ${level}: ${transformationCount} Transformation${transformationCount > 1 ? "s" : ""}`;
    } else {
      return `Generation ${level}: ${tokens.length} Token${tokens.length > 1 ? "s" : ""}`;
    }
  }

  /**
   * Build immediate parent tokens
   */
  private buildImmediateParents(tokenId: string): ParentToken[] {
    const parents: ParentToken[] = [];
    const parentIds = this.graph.getParents(tokenId);

    for (const parentId of parentIds) {
      const node = this.graph.getNode(parentId);
      if (node) {
        parents.push({
          id: parentId,
          value: node.value,
          createdAt: node.createdAt,
          originNodeId: node.originNodeId,
          operation: node.operation,
          contributionWeight: this.calculateParentContribution(parentId, tokenId),
        });
      }
    }

    return parents;
  }

  /**
   * Calculate contribution weight of a parent token
   */
  private calculateParentContribution(parentId: string, childId: string): number {
    const edges = this.graph.getIncomingEdges(childId);
    const parentEdge = edges.find(edge => edge.fromTokenId === parentId);

    if (!parentEdge) {
      return 0;
    }

    // Use edge weight if available, otherwise calculate based on operation
    if (parentEdge.weight !== undefined) {
      return parentEdge.weight;
    }

    // Default equal weighting among all parents
    const totalParents = this.graph.getParents(childId).length;
    return totalParents > 0 ? 1.0 / totalParents : 1.0;
  }

  /**
   * Build a Token object from a graph node
   */
  private buildTokenFromNode(tokenId: string): Token {
    const node = this.graph.getNode(tokenId);
    if (!node) {
      throw new Error(`Token ${tokenId} not found in graph`);
    }

    return {
      id: tokenId,
      value: node.value,
      createdAt: node.createdAt,
      history: this.tokenHistoryMap.get(tokenId) || [],
      originNodeId: node.originNodeId,
    };
  }

  /**
   * Validate lineage computation for potential issues
   */
  validateLineage(tokenId: string): {
    isValid: boolean;
    errors: LineageError[];
    warnings: string[];
  } {
    const errors: LineageError[] = [];
    const warnings: string[] = [];

    try {
      // Check if token exists
      if (!this.graph.hasToken(tokenId)) {
        errors.push({
          type: "missing_token",
          tokenId,
          message: `Token ${tokenId} not found in graph`,
          affectedTokens: [tokenId],
          suggestedAction: "Verify token ID exists in the simulation history",
        });
        return { isValid: false, errors, warnings };
      }

      // Check for cycles in ancestry
      const cycles = this.graph.detectCycles();
      const tokenCycles = cycles.filter(cycle => cycle.includes(tokenId));
      if (tokenCycles.length > 0) {
        errors.push({
          type: "circular_reference",
          tokenId,
          message: `Circular reference detected involving token ${tokenId}`,
          affectedTokens: tokenCycles.flat(),
          suggestedAction: "Review token creation logic to eliminate circular dependencies",
        });
      }

      // Check for very deep lineage (performance warning)
      const generations = this.graph.bfsAncestryByGeneration(tokenId);
      const maxDepth = Math.max(...generations.keys());
      if (maxDepth > 20) {
        warnings.push(`Very deep lineage detected (${maxDepth} generations) - may impact performance`);
      }

      // Check for missing source token references
      const ancestors = this.findAllAncestors(tokenId);
      for (const ancestor of ancestors) {
        if (ancestor.operation?.sourceTokens) {
          for (const sourceToken of ancestor.operation.sourceTokens) {
            if (!this.graph.hasToken(sourceToken.tokenId)) {
              errors.push({
                type: "incomplete_lineage",
                tokenId: ancestor.id,
                message: `Token ${ancestor.id} references missing source token ${sourceToken.tokenId}`,
                affectedTokens: [ancestor.id, sourceToken.tokenId],
                suggestedAction: "Verify all source tokens exist in the simulation history",
              });
            }
          }
        }
      }
    } catch (error) {
      errors.push({
        type: "performance_limit",
        tokenId,
        message: `Failed to validate lineage: ${error instanceof Error ? error.message : String(error)}`,
        affectedTokens: [tokenId],
        suggestedAction: "Check for circular references or very large lineage trees",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get graph statistics
   */
  getGraphStats() {
    return this.graph.getGraphStats();
  }

  /**
   * Clear internal caches and rebuild from updated history
   */
  refresh(newGlobalLog?: HistoryEntry[]): void {
    if (newGlobalLog) {
      this.globalLog = newGlobalLog;
    }

    this.graph = buildTokenGraphFromHistory(this.globalLog);
    this.buildTokenMaps();
  }
}

/**
 * Utility function to create a TokenGenealogyEngine from simulation history
 */
export function createTokenGenealogyEngine(globalLog: HistoryEntry[]): TokenGenealogyEngine {
  return new TokenGenealogyEngine(globalLog);
}

/**
 * Utility function to build complete lineage for a token
 */
export function buildTokenLineage(tokenId: string, globalLog: HistoryEntry[]): TokenLineage {
  const engine = new TokenGenealogyEngine(globalLog);
  return engine.buildCompleteLineage(tokenId);
}

/**
 * Utility function to find all source contributions for a token
 */
export function findSourceContributions(tokenId: string, globalLog: HistoryEntry[]): SourceContribution[] {
  const engine = new TokenGenealogyEngine(globalLog);
  return engine.calculateSourceContributions(tokenId);
}

/**
 * Utility function to validate token lineage
 */
export function validateTokenLineage(
  tokenId: string,
  globalLog: HistoryEntry[],
): {
  isValid: boolean;
  errors: LineageError[];
  warnings: string[];
} {
  const engine = new TokenGenealogyEngine(globalLog);
  return engine.validateLineage(tokenId);
}
