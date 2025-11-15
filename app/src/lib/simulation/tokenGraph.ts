/**
 * Core Token Graph Data Structures and Algorithms
 *
 * This module provides the foundational graph data structures and traversal algorithms
 * for building complete token lineage trees. It implements efficient DFS and BFS algorithms
 * with cycle detection for tracing token ancestry back to original data sources.
 */
import type { HistoryEntry, SourceTokenSummary, Token } from "./types";

/**
 * Represents a node in the token dependency graph
 */
export interface TokenNode {
  tokenId: string;
  value: any;
  createdAt: number;
  originNodeId: string;
  operation?: OperationInfo;
}

/**
 * Represents an edge between tokens in the dependency graph
 */
export interface TokenEdge {
  fromTokenId: string; // Source token (parent)
  toTokenId: string; // Derived token (child)
  operation: OperationInfo;
  weight?: number; // For contribution calculations
}

/**
 * Represents a path through the token graph
 */
export interface TokenPath {
  tokens: string[];
  operations: OperationInfo[];
  totalContribution: number;
}

/**
 * Information about the operation that created a token
 */
export interface OperationInfo {
  type: "datasource_creation" | "aggregation" | "transformation";
  method?: string; // sum, average, count, first, last, or formula name
  sourceTokens: SourceTokenDetail[]; // Complete details of ALL input tokens
  formula?: string; // For ProcessNode transformations
  calculation?: string; // Human-readable calculation (e.g., "(5 + 7 + 9) / 3 = 7")
  aggregationDetails?: AggregationDetails;
}

/**
 * Detailed information about a source token used in an operation
 */
export interface SourceTokenDetail {
  tokenId: string;
  value: any;
  originNodeId: string;
  createdAt: number;
  // Note: completeLineage will be populated by TokenGenealogyEngine
}

/**
 * Details about an aggregation operation
 */
export interface AggregationDetails {
  method: "sum" | "average" | "count" | "first" | "last";
  inputTokens: Array<{
    tokenId: string;
    value: any;
    contribution: number; // For average: value/count, for sum: value/total, etc.
  }>;
  calculation: string; // e.g., "avg(5, 7, 9) = (5+7+9)/3 = 21/3 = 7"
  resultValue: any;
}

/**
 * Core token dependency graph with efficient traversal algorithms
 */
export class TokenGraph {
  private nodes: Map<string, TokenNode> = new Map();
  private edges: Map<string, TokenEdge[]> = new Map(); // tokenId -> outgoing edges
  private incomingEdges: Map<string, TokenEdge[]> = new Map(); // tokenId -> incoming edges

  /**
   * Add a token node to the graph
   */
  addNode(node: TokenNode): void {
    this.nodes.set(node.tokenId, node);
    if (!this.edges.has(node.tokenId)) {
      this.edges.set(node.tokenId, []);
    }
    if (!this.incomingEdges.has(node.tokenId)) {
      this.incomingEdges.set(node.tokenId, []);
    }
  }

  /**
   * Add an edge between two tokens
   */
  addEdge(edge: TokenEdge): void {
    // Add to outgoing edges of source token
    const outgoing = this.edges.get(edge.fromTokenId) || [];
    outgoing.push(edge);
    this.edges.set(edge.fromTokenId, outgoing);

    // Add to incoming edges of target token
    const incoming = this.incomingEdges.get(edge.toTokenId) || [];
    incoming.push(edge);
    this.incomingEdges.set(edge.toTokenId, incoming);
  }

  /**
   * Get a token node by ID
   */
  getNode(tokenId: string): TokenNode | undefined {
    return this.nodes.get(tokenId);
  }

  /**
   * Get all outgoing edges from a token
   */
  getOutgoingEdges(tokenId: string): TokenEdge[] {
    return this.edges.get(tokenId) || [];
  }

  /**
   * Get all incoming edges to a token
   */
  getIncomingEdges(tokenId: string): TokenEdge[] {
    return this.incomingEdges.get(tokenId) || [];
  }

  /**
   * Get all parent tokens (immediate ancestors)
   */
  getParents(tokenId: string): string[] {
    return this.getIncomingEdges(tokenId).map(edge => edge.fromTokenId);
  }

  /**
   * Get all child tokens (immediate descendants)
   */
  getChildren(tokenId: string): string[] {
    return this.getOutgoingEdges(tokenId).map(edge => edge.toTokenId);
  }

  /**
   * Check if a token exists in the graph
   */
  hasToken(tokenId: string): boolean {
    return this.nodes.has(tokenId);
  }

  /**
   * Get all token IDs in the graph
   */
  getAllTokenIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Depth-First Search traversal for ancestry (going backwards through dependencies)
   * Returns tokens in DFS order with cycle detection
   */
  dfsAncestryTraversal(startTokenId: string, visited: Set<string> = new Set()): string[] {
    const result: string[] = [];

    if (visited.has(startTokenId)) {
      // Cycle detected - return empty to avoid infinite recursion
      return [];
    }

    if (!this.hasToken(startTokenId)) {
      return [];
    }

    visited.add(startTokenId);
    result.push(startTokenId);

    // Traverse all parent tokens (sources)
    const parents = this.getParents(startTokenId);
    for (const parentId of parents) {
      const parentResults = this.dfsAncestryTraversal(parentId, new Set(visited));
      result.push(...parentResults);
    }

    return result;
  }

  /**
   * Depth-First Search traversal for descendants (going forward through dependencies)
   * Returns tokens in DFS order with cycle detection
   */
  dfsDescendantTraversal(startTokenId: string, visited: Set<string> = new Set()): string[] {
    const result: string[] = [];

    if (visited.has(startTokenId)) {
      // Cycle detected - return empty to avoid infinite recursion
      return [];
    }

    if (!this.hasToken(startTokenId)) {
      return [];
    }

    visited.add(startTokenId);
    result.push(startTokenId);

    // Traverse all child tokens (derived tokens)
    const children = this.getChildren(startTokenId);
    for (const childId of children) {
      const childResults = this.dfsDescendantTraversal(childId, new Set(visited));
      result.push(...childResults);
    }

    return result;
  }

  /**
   * Breadth-First Search traversal for ancestry by generation levels
   * Returns a map of generation level -> token IDs at that level
   */
  bfsAncestryByGeneration(startTokenId: string): Map<number, string[]> {
    const result = new Map<number, string[]>();
    const visited = new Set<string>();
    const queue: Array<{ tokenId: string; level: number }> = [];

    if (!this.hasToken(startTokenId)) {
      return result;
    }

    queue.push({ tokenId: startTokenId, level: 0 });
    visited.add(startTokenId);

    while (queue.length > 0) {
      const { tokenId, level } = queue.shift()!;

      // Add to result at this level
      if (!result.has(level)) {
        result.set(level, []);
      }
      result.get(level)!.push(tokenId);

      // Add all parents to queue for next level
      const parents = this.getParents(tokenId);
      for (const parentId of parents) {
        if (!visited.has(parentId) && this.hasToken(parentId)) {
          visited.add(parentId);
          queue.push({ tokenId: parentId, level: level + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Breadth-First Search traversal for descendants by generation levels
   * Returns a map of generation level -> token IDs at that level
   */
  bfsDescendantByGeneration(startTokenId: string): Map<number, string[]> {
    const result = new Map<number, string[]>();
    const visited = new Set<string>();
    const queue: Array<{ tokenId: string; level: number }> = [];

    if (!this.hasToken(startTokenId)) {
      return result;
    }

    queue.push({ tokenId: startTokenId, level: 0 });
    visited.add(startTokenId);

    while (queue.length > 0) {
      const { tokenId, level } = queue.shift()!;

      // Add to result at this level
      if (!result.has(level)) {
        result.set(level, []);
      }
      result.get(level)!.push(tokenId);

      // Add all children to queue for next level
      const children = this.getChildren(tokenId);
      for (const childId of children) {
        if (!visited.has(childId) && this.hasToken(childId)) {
          visited.add(childId);
          queue.push({ tokenId: childId, level: level + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Find all paths from one token to another
   * Uses DFS with path tracking and cycle detection
   */
  findAllPaths(fromTokenId: string, toTokenId: string): TokenPath[] {
    const paths: TokenPath[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];
    const currentOperations: OperationInfo[] = [];

    this.findPathsDFS(fromTokenId, toTokenId, visited, currentPath, currentOperations, paths);
    return paths;
  }

  private findPathsDFS(
    currentTokenId: string,
    targetTokenId: string,
    visited: Set<string>,
    currentPath: string[],
    currentOperations: OperationInfo[],
    allPaths: TokenPath[],
  ): void {
    if (visited.has(currentTokenId)) {
      return; // Cycle detected
    }

    visited.add(currentTokenId);
    currentPath.push(currentTokenId);

    if (currentTokenId === targetTokenId) {
      // Found a path - add it to results
      allPaths.push({
        tokens: [...currentPath],
        operations: [...currentOperations],
        totalContribution: 1.0, // TODO: Calculate actual contribution
      });
    } else {
      // Continue searching through children
      const children = this.getChildren(currentTokenId);
      for (const childId of children) {
        const edges = this.getOutgoingEdges(currentTokenId);
        const edge = edges.find(e => e.toTokenId === childId);
        if (edge) {
          currentOperations.push(edge.operation);
          this.findPathsDFS(childId, targetTokenId, new Set(visited), currentPath, currentOperations, allPaths);
          currentOperations.pop();
        }
      }
    }

    currentPath.pop();
    visited.delete(currentTokenId);
  }

  /**
   * Detect if there are any cycles in the graph
   * Returns the tokens involved in cycles, if any
   */
  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    for (const tokenId of this.getAllTokenIds()) {
      if (!visited.has(tokenId)) {
        const currentPath: string[] = [];
        this.detectCyclesDFS(tokenId, visited, recursionStack, currentPath, cycles);
      }
    }

    return cycles;
  }

  private detectCyclesDFS(
    tokenId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[],
    cycles: string[][],
  ): void {
    visited.add(tokenId);
    recursionStack.add(tokenId);
    currentPath.push(tokenId);

    const children = this.getChildren(tokenId);
    for (const childId of children) {
      if (!visited.has(childId)) {
        this.detectCyclesDFS(childId, visited, recursionStack, currentPath, cycles);
      } else if (recursionStack.has(childId)) {
        // Found a cycle - extract the cycle path
        const cycleStartIndex = currentPath.indexOf(childId);
        if (cycleStartIndex >= 0) {
          const cycle = currentPath.slice(cycleStartIndex);
          cycle.push(childId); // Complete the cycle
          cycles.push(cycle);
        }
      }
    }

    currentPath.pop();
    recursionStack.delete(tokenId);
  }

  /**
   * Find all root tokens (tokens with no incoming edges)
   * These represent original data source tokens
   */
  findRootTokens(): string[] {
    const roots: string[] = [];

    for (const tokenId of this.getAllTokenIds()) {
      const incomingEdges = this.getIncomingEdges(tokenId);
      if (incomingEdges.length === 0) {
        roots.push(tokenId);
      }
    }

    return roots;
  }

  /**
   * Find all leaf tokens (tokens with no outgoing edges)
   * These represent final output tokens
   */
  findLeafTokens(): string[] {
    const leaves: string[] = [];

    for (const tokenId of this.getAllTokenIds()) {
      const outgoingEdges = this.getOutgoingEdges(tokenId);
      if (outgoingEdges.length === 0) {
        leaves.push(tokenId);
      }
    }

    return leaves;
  }

  /**
   * Get statistics about the graph
   */
  getGraphStats(): {
    nodeCount: number;
    edgeCount: number;
    rootCount: number;
    leafCount: number;
    maxDepth: number;
    hasCycles: boolean;
  } {
    const nodeCount = this.nodes.size;
    let edgeCount = 0;
    for (const edges of this.edges.values()) {
      edgeCount += edges.length;
    }

    const roots = this.findRootTokens();
    const leaves = this.findLeafTokens();
    const cycles = this.detectCycles();

    // Calculate max depth from any root
    let maxDepth = 0;
    for (const rootId of roots) {
      const generations = this.bfsDescendantByGeneration(rootId);
      const depth = Math.max(...generations.keys());
      maxDepth = Math.max(maxDepth, depth);
    }

    return {
      nodeCount,
      edgeCount,
      rootCount: roots.length,
      leafCount: leaves.length,
      maxDepth,
      hasCycles: cycles.length > 0,
    };
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.incomingEdges.clear();
  }
}

/**
 * Build a TokenGraph from the global activity log
 * This analyzes all history entries to reconstruct token dependencies
 */
export function buildTokenGraphFromHistory(globalLog: HistoryEntry[]): TokenGraph {
  const graph = new TokenGraph();
  const tokenCreationMap = new Map<string, HistoryEntry>(); // tokenId -> creation entry

  // First pass: identify all token creation events and build nodes
  for (const entry of globalLog) {
    // Look for token creation events (CREATED) or aggregation events that create tokens
    const isTokenCreation = entry.action === "CREATED" || entry.action.startsWith("AGGREGATED_");

    if (isTokenCreation) {
      // Extract token ID from details (format: "Token {tokenId}")
      const tokenIdMatch = entry.details?.match(/Token (\w+)/);
      if (tokenIdMatch) {
        const tokenId = tokenIdMatch[1];
        tokenCreationMap.set(tokenId, entry);

        // Determine operation type based on action and source tokens
        let operationType: OperationInfo["type"] = "datasource_creation";
        if (entry.action.startsWith("AGGREGATED_")) {
          operationType = "aggregation";
        } else if (entry.sourceTokenIds && entry.sourceTokenIds.length > 0) {
          // Check if this is from a ProcessNode (transformation) or Queue (aggregation)
          if (entry.nodeId.includes("Queue")) {
            operationType = "aggregation";
          } else {
            operationType = "transformation";
          }
        }

        // Create operation info
        const operation: OperationInfo = {
          type: operationType,
          sourceTokens: (entry.sourceTokenSummaries || []).map(summary => ({
            tokenId: summary.id,
            value: summary.originalValue,
            originNodeId: summary.originNodeId,
            createdAt: summary.createdAt,
          })),
        };

        // Add aggregation details if this is an aggregation
        if (operationType === "aggregation") {
          const method = extractAggregationMethod(entry);
          if (method) {
            operation.method = method;
            operation.aggregationDetails = {
              method,
              inputTokens: (entry.sourceTokenSummaries || []).map(summary => ({
                tokenId: summary.id,
                value: summary.originalValue,
                contribution: calculateContribution(summary.originalValue, entry.value, method),
              })),
              calculation: generateCalculationString(entry.sourceTokenSummaries || [], entry.value, method),
              resultValue: entry.value,
            };
          }
        }

        // Create token node
        const tokenNode: TokenNode = {
          tokenId,
          value: entry.value,
          createdAt: entry.timestamp,
          originNodeId: entry.nodeId,
          operation,
        };

        graph.addNode(tokenNode);
      }
    }
  }

  // Second pass: create edges based on source token relationships
  for (const [tokenId, creationEntry] of tokenCreationMap) {
    if (creationEntry.sourceTokenIds && creationEntry.sourceTokenIds.length > 0) {
      // This token was derived from other tokens - create edges
      for (const sourceTokenId of creationEntry.sourceTokenIds) {
        if (graph.hasToken(sourceTokenId)) {
          const sourceNode = graph.getNode(sourceTokenId)!;
          const targetNode = graph.getNode(tokenId)!;

          const edge: TokenEdge = {
            fromTokenId: sourceTokenId,
            toTokenId: tokenId,
            operation: targetNode.operation!,
            weight: calculateEdgeWeight(sourceNode, targetNode),
          };

          graph.addEdge(edge);
        }
      }
    }
  }

  return graph;
}

/**
 * Extract aggregation method from history entry action
 */
function extractAggregationMethod(entry: HistoryEntry): AggregationDetails["method"] | undefined {
  const action = entry.action.toUpperCase();
  if (action.includes("SUM")) return "sum";
  if (action.includes("AVERAGE")) return "average";
  if (action.includes("COUNT")) return "count";
  if (action.includes("FIRST")) return "first";
  if (action.includes("LAST")) return "last";
  return undefined;
}

/**
 * Calculate contribution of a source token to the result
 */
function calculateContribution(sourceValue: any, resultValue: any, method: AggregationDetails["method"]): number {
  const sourceNum = Number(sourceValue) || 0;
  const resultNum = Number(resultValue) || 0;

  switch (method) {
    case "sum":
      return resultNum !== 0 ? sourceNum / resultNum : 0;
    case "average":
      return 1; // Each token contributes equally to average
    case "count":
      return 1; // Each token contributes 1 to count
    case "first":
    case "last":
      return 1; // Single token contributes fully
    default:
      return 0;
  }
}

/**
 * Generate human-readable calculation string
 */
function generateCalculationString(
  sources: SourceTokenSummary[],
  result: any,
  method: AggregationDetails["method"],
): string {
  const values = sources.map(s => Number(s.originalValue) || 0);
  const resultNum = Number(result) || 0;

  switch (method) {
    case "sum":
      return `sum(${values.join(", ")}) = ${values.reduce((a, b) => a + b, 0)}`;
    case "average":
      const sum = values.reduce((a, b) => a + b, 0);
      return `avg(${values.join(", ")}) = ${sum}/${values.length} = ${resultNum}`;
    case "count":
      return `count(${values.length} tokens) = ${values.length}`;
    case "first":
      return `first(${values.join(", ")}) = ${values[0] || 0}`;
    case "last":
      return `last(${values.join(", ")}) = ${values[values.length - 1] || 0}`;
    default:
      return `${method}(${values.join(", ")}) = ${resultNum}`;
  }
}

/**
 * Calculate edge weight for contribution analysis
 */
function calculateEdgeWeight(sourceNode: TokenNode, targetNode: TokenNode): number {
  // Default weight - can be enhanced based on operation type
  return 1.0;
}

/**
 * Utility function to check if a token is a root token (DataSource creation)
 * A root token has no source tokens and was created by a DataSource node
 */
export function isRootToken(tokenId: string, graph: TokenGraph): boolean {
  const node = graph.getNode(tokenId);
  if (!node) return false;

  // Check if it has no incoming edges (no parent tokens)
  const incomingEdges = graph.getIncomingEdges(tokenId);
  if (incomingEdges.length > 0) return false;

  // Check if the operation type is datasource_creation
  return node.operation?.type === "datasource_creation";
}
