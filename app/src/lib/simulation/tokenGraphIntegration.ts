/**
 * Integration utilities for TokenGraph with the simulation store
 *
 * This module provides helper functions to integrate the TokenGraph system
 * with the existing simulation store and history tracking.
 */
import { TokenGraph, buildTokenGraphFromHistory, isRootToken } from "./tokenGraph";
import type { HistoryEntry } from "./types";

/**
 * Build a token graph from the simulation store's global activity log
 */
export function buildTokenGraphFromSimulation(globalActivityLog: HistoryEntry[]): TokenGraph {
  return buildTokenGraphFromHistory(globalActivityLog);
}

/**
 * Get complete ancestry for a token from the simulation
 */
export function getTokenAncestry(
  tokenId: string,
  globalActivityLog: HistoryEntry[],
): {
  graph: TokenGraph;
  ancestors: string[];
  generations: Map<number, string[]>;
  roots: string[];
} {
  const graph = buildTokenGraphFromHistory(globalActivityLog);

  if (!graph.hasToken(tokenId)) {
    return {
      graph,
      ancestors: [],
      generations: new Map(),
      roots: [],
    };
  }

  const ancestors = graph.dfsAncestryTraversal(tokenId);
  const generations = graph.bfsAncestryByGeneration(tokenId);
  const roots = ancestors.filter(ancestorId => isRootToken(ancestorId, graph));

  return {
    graph,
    ancestors,
    generations,
    roots,
  };
}

/**
 * Get complete descendant tree for a token from the simulation
 */
export function getTokenDescendants(
  tokenId: string,
  globalActivityLog: HistoryEntry[],
): {
  graph: TokenGraph;
  descendants: string[];
  generations: Map<number, string[]>;
  leaves: string[];
} {
  const graph = buildTokenGraphFromHistory(globalActivityLog);

  if (!graph.hasToken(tokenId)) {
    return {
      graph,
      descendants: [],
      generations: new Map(),
      leaves: [],
    };
  }

  const descendants = graph.dfsDescendantTraversal(tokenId);
  const generations = graph.bfsDescendantByGeneration(tokenId);
  const allLeaves = graph.findLeafTokens();
  const leaves = descendants.filter(descendantId => allLeaves.includes(descendantId));

  return {
    graph,
    descendants,
    generations,
    leaves,
  };
}

/**
 * Analyze token lineage statistics from the simulation
 */
export function analyzeTokenLineage(globalActivityLog: HistoryEntry[]): {
  totalTokens: number;
  rootTokens: number;
  leafTokens: number;
  maxDepth: number;
  averageDepth: number;
  hasCycles: boolean;
  cycleCount: number;
} {
  const graph = buildTokenGraphFromHistory(globalActivityLog);
  const stats = graph.getGraphStats();

  // Calculate average depth
  const roots = graph.findRootTokens();
  let totalDepth = 0;
  let depthCount = 0;

  for (const rootId of roots) {
    const generations = graph.bfsDescendantByGeneration(rootId);
    const maxDepthFromRoot = Math.max(...generations.keys());
    totalDepth += maxDepthFromRoot;
    depthCount++;
  }

  const averageDepth = depthCount > 0 ? totalDepth / depthCount : 0;
  const cycles = graph.detectCycles();

  return {
    totalTokens: stats.nodeCount,
    rootTokens: stats.rootCount,
    leafTokens: stats.leafCount,
    maxDepth: stats.maxDepth,
    averageDepth,
    hasCycles: stats.hasCycles,
    cycleCount: cycles.length,
  };
}

/**
 * Find all tokens that contributed to a specific token's value
 */
export function findTokenContributors(
  tokenId: string,
  globalActivityLog: HistoryEntry[],
): Array<{
  tokenId: string;
  value: any;
  originNodeId: string;
  createdAt: number;
  contributionPath: string[];
  isDirectParent: boolean;
  isRoot: boolean;
}> {
  const graph = buildTokenGraphFromHistory(globalActivityLog);

  if (!graph.hasToken(tokenId)) {
    return [];
  }

  const ancestors = graph.dfsAncestryTraversal(tokenId);
  const directParents = graph.getParents(tokenId);
  const contributors: Array<{
    tokenId: string;
    value: any;
    originNodeId: string;
    createdAt: number;
    contributionPath: string[];
    isDirectParent: boolean;
    isRoot: boolean;
  }> = [];

  for (const ancestorId of ancestors) {
    if (ancestorId === tokenId) continue; // Skip the target token itself

    const node = graph.getNode(ancestorId);
    if (!node) continue;

    // Find path from ancestor to target
    const paths = graph.findAllPaths(ancestorId, tokenId);
    const contributionPath = paths.length > 0 ? paths[0].tokens : [];

    contributors.push({
      tokenId: ancestorId,
      value: node.value,
      originNodeId: node.originNodeId,
      createdAt: node.createdAt,
      contributionPath,
      isDirectParent: directParents.includes(ancestorId),
      isRoot: isRootToken(ancestorId, graph),
    });
  }

  // Sort by creation time (oldest first)
  contributors.sort((a, b) => a.createdAt - b.createdAt);

  return contributors;
}

/**
 * Validate token graph integrity
 */
export function validateTokenGraphIntegrity(globalActivityLog: HistoryEntry[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const graph = buildTokenGraphFromHistory(globalActivityLog);

    // Check for cycles
    const cycles = graph.detectCycles();
    if (cycles.length > 0) {
      errors.push(`Found ${cycles.length} cycles in token graph`);
      cycles.forEach((cycle, index) => {
        errors.push(`Cycle ${index + 1}: ${cycle.join(" -> ")}`);
      });
    }

    // Check for orphaned tokens (tokens with source references that don't exist)
    // We need to check the original history entries, not just the graph edges
    const tokenCreationMap = new Map<string, HistoryEntry>();

    // Build map of all token creation events
    for (const entry of globalActivityLog) {
      const isTokenCreation = entry.action === "CREATED" || entry.action.startsWith("AGGREGATED_");
      if (isTokenCreation) {
        const tokenIdMatch = entry.details?.match(/Token (\w+)/);
        if (tokenIdMatch) {
          tokenCreationMap.set(tokenIdMatch[1], entry);
        }
      }
    }

    // Check for missing source token references
    for (const [tokenId, entry] of tokenCreationMap) {
      if (entry.sourceTokenIds && entry.sourceTokenIds.length > 0) {
        for (const sourceTokenId of entry.sourceTokenIds) {
          if (!tokenCreationMap.has(sourceTokenId)) {
            errors.push(`Token ${tokenId} references non-existent parent ${sourceTokenId}`);
          }
        }
      }
    }

    // Check for tokens without proper root ancestry
    const roots = graph.findRootTokens();
    const allTokenIds = graph.getAllTokenIds();
    if (roots.length === 0 && allTokenIds.length > 0) {
      warnings.push("No root tokens found - all tokens may be part of cycles");
    }

    // Check for very deep lineages (potential performance issue)
    const stats = graph.getGraphStats();
    if (stats.maxDepth > 20) {
      warnings.push(`Very deep token lineage detected (depth: ${stats.maxDepth})`);
    }
  } catch (error) {
    errors.push(`Failed to build token graph: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
