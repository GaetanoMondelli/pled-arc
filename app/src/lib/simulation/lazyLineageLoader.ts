/**
 * LazyLineageLoader - Progressive Disclosure for Large Token Lineage Trees
 *
 * This module provides lazy loading and progressive disclosure capabilities
 * for large token lineage trees, enabling efficient rendering and navigation
 * of complex genealogies without overwhelming the UI or blocking the main thread.
 */
import type { AncestorToken, DescendantToken, GenerationLevel, TokenLineage } from "./tokenGenealogyEngine";
import type { TokenGraph } from "./tokenGraph";

/**
 * Lazy loading configuration
 */
export interface LazyLoadConfig {
  initialDepth: number; // Initial depth to load
  batchSize: number; // Number of tokens to load per batch
  maxConcurrentLoads: number; // Maximum concurrent loading operations
  preloadThreshold: number; // Distance from viewport to start preloading
  enableVirtualization: boolean; // Enable virtual scrolling
  debounceMs: number; // Debounce time for load requests
}

/**
 * Default lazy loading configuration
 */
const DEFAULT_LAZY_CONFIG: LazyLoadConfig = {
  initialDepth: 3,
  batchSize: 20,
  maxConcurrentLoads: 3,
  preloadThreshold: 2,
  enableVirtualization: true,
  debounceMs: 100,
};

/**
 * Represents a lazily loaded lineage node
 */
export interface LazyLineageNode {
  tokenId: string;
  value: any;
  createdAt: number;
  originNodeId: string;
  depth: number;
  isLoaded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  children: LazyLineageNode[];
  parent?: LazyLineageNode;
  operation?: any;
  loadError?: string;
}

/**
 * Loading state for a batch of nodes
 */
export interface LoadingBatch {
  id: string;
  tokenIds: string[];
  depth: number;
  startTime: number;
  promise: Promise<LazyLineageNode[]>;
}

/**
 * Viewport information for virtual scrolling
 */
export interface ViewportInfo {
  startIndex: number;
  endIndex: number;
  scrollTop: number;
  containerHeight: number;
  itemHeight: number;
}

/**
 * Lazy loading manager for token lineage trees
 */
export class LazyLineageLoader {
  private config: LazyLoadConfig;
  private loadingBatches = new Map<string, LoadingBatch>();
  private loadQueue: string[] = [];
  private activeLoads = 0;
  private debounceTimer?: NodeJS.Timeout;
  private observers = new Set<(nodes: LazyLineageNode[]) => void>();

  constructor(config: Partial<LazyLoadConfig> = {}) {
    this.config = { ...DEFAULT_LAZY_CONFIG, ...config };
  }

  /**
   * Create initial lazy lineage tree with limited depth
   */
  createLazyTree(fullLineage: TokenLineage, graph: TokenGraph): LazyLineageNode {
    const rootNode = this.createLazyNode(
      fullLineage.targetToken.id,
      fullLineage.targetToken.value,
      fullLineage.targetToken.createdAt,
      fullLineage.targetToken.originNodeId,
      0,
    );

    // Load initial depth
    this.loadInitialDepth(rootNode, fullLineage, graph);

    return rootNode;
  }

  /**
   * Load children for a specific node
   */
  async loadChildren(node: LazyLineageNode, graph: TokenGraph): Promise<LazyLineageNode[]> {
    if (node.isLoading || node.isLoaded) {
      return node.children;
    }

    node.isLoading = true;
    this.notifyObservers([node]);

    try {
      const parentIds = graph.getParents(node.tokenId);
      const children: LazyLineageNode[] = [];

      for (const parentId of parentIds) {
        const parentNode = graph.getNode(parentId);
        if (parentNode) {
          const childNode = this.createLazyNode(
            parentId,
            parentNode.value,
            parentNode.createdAt,
            parentNode.originNodeId,
            node.depth + 1,
            node,
          );

          // Check if this child has its own children
          childNode.hasChildren = graph.getParents(parentId).length > 0;
          children.push(childNode);
        }
      }

      node.children = children;
      node.isLoaded = true;
      node.isLoading = false;

      this.notifyObservers([node, ...children]);
      return children;
    } catch (error) {
      node.isLoading = false;
      node.loadError = error instanceof Error ? error.message : String(error);
      this.notifyObservers([node]);
      throw error;
    }
  }

  /**
   * Load multiple nodes in batches
   */
  async loadBatch(tokenIds: string[], depth: number, graph: TokenGraph): Promise<LazyLineageNode[]> {
    const batchId = `batch_${Date.now()}_${Math.random()}`;

    // Limit batch size
    const limitedTokenIds = tokenIds.slice(0, this.config.batchSize);

    const promise = this.loadBatchInternal(limitedTokenIds, depth, graph);

    const batch: LoadingBatch = {
      id: batchId,
      tokenIds: limitedTokenIds,
      depth,
      startTime: Date.now(),
      promise,
    };

    this.loadingBatches.set(batchId, batch);

    try {
      const result = await promise;
      this.loadingBatches.delete(batchId);
      return result;
    } catch (error) {
      this.loadingBatches.delete(batchId);
      throw error;
    }
  }

  /**
   * Queue tokens for lazy loading with debouncing
   */
  queueForLoading(tokenIds: string[]): void {
    // Add to queue
    for (const tokenId of tokenIds) {
      if (!this.loadQueue.includes(tokenId)) {
        this.loadQueue.push(tokenId);
      }
    }

    // Debounce the actual loading
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processLoadQueue();
    }, this.config.debounceMs);
  }

  /**
   * Get visible nodes for virtual scrolling
   */
  getVisibleNodes(rootNode: LazyLineageNode, viewport: ViewportInfo): LazyLineageNode[] {
    const flatNodes = this.flattenTree(rootNode);

    if (!this.config.enableVirtualization) {
      return flatNodes;
    }

    const startIndex = Math.max(0, viewport.startIndex);
    const endIndex = Math.min(flatNodes.length, viewport.endIndex);

    // Preload nodes near the viewport
    this.preloadNearViewport(flatNodes, startIndex, endIndex);

    return flatNodes.slice(startIndex, endIndex);
  }

  /**
   * Expand a node and load its children if needed
   */
  async expandNode(node: LazyLineageNode, graph: TokenGraph): Promise<void> {
    if (!node.hasChildren || node.isLoaded) {
      return;
    }

    await this.loadChildren(node, graph);
  }

  /**
   * Collapse a node and optionally unload its children
   */
  collapseNode(node: LazyLineageNode, unloadChildren: boolean = false): void {
    if (unloadChildren) {
      // Recursively unload children to free memory
      this.unloadNodeChildren(node);
    }
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(observer: (nodes: LazyLineageNode[]) => void): () => void {
    this.observers.add(observer);

    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): {
    activeLoads: number;
    queuedLoads: number;
    totalBatches: number;
    averageLoadTime: number;
  } {
    const batches = Array.from(this.loadingBatches.values());
    const completedBatches = batches.filter(b => Date.now() - b.startTime > 0);
    const averageLoadTime =
      completedBatches.length > 0
        ? completedBatches.reduce((sum, b) => sum + (Date.now() - b.startTime), 0) / completedBatches.length
        : 0;

    return {
      activeLoads: this.activeLoads,
      queuedLoads: this.loadQueue.length,
      totalBatches: this.loadingBatches.size,
      averageLoadTime,
    };
  }

  /**
   * Clear all loading state and queues
   */
  clear(): void {
    this.loadQueue = [];
    this.loadingBatches.clear();
    this.activeLoads = 0;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  // Private helper methods

  private createLazyNode(
    tokenId: string,
    value: any,
    createdAt: number,
    originNodeId: string,
    depth: number,
    parent?: LazyLineageNode,
  ): LazyLineageNode {
    return {
      tokenId,
      value,
      createdAt,
      originNodeId,
      depth,
      isLoaded: false,
      isLoading: false,
      hasChildren: false, // Will be determined when checking for parents
      children: [],
      parent,
    };
  }

  private loadInitialDepth(rootNode: LazyLineageNode, fullLineage: TokenLineage, graph: TokenGraph): void {
    // Load ancestors up to initial depth
    const ancestorsByLevel = new Map<number, AncestorToken[]>();

    for (const ancestor of fullLineage.allAncestors) {
      if (ancestor.generationLevel <= this.config.initialDepth) {
        if (!ancestorsByLevel.has(ancestor.generationLevel)) {
          ancestorsByLevel.set(ancestor.generationLevel, []);
        }
        ancestorsByLevel.get(ancestor.generationLevel)!.push(ancestor);
      }
    }

    // Build tree structure level by level
    this.buildTreeFromAncestors(rootNode, ancestorsByLevel, graph);
  }

  private buildTreeFromAncestors(
    rootNode: LazyLineageNode,
    ancestorsByLevel: Map<number, AncestorToken[]>,
    graph: TokenGraph,
  ): void {
    const nodeMap = new Map<string, LazyLineageNode>();
    nodeMap.set(rootNode.tokenId, rootNode);

    // Process each level
    for (let level = 1; level <= this.config.initialDepth; level++) {
      const ancestors = ancestorsByLevel.get(level) || [];

      for (const ancestor of ancestors) {
        const node = this.createLazyNode(ancestor.id, ancestor.value, ancestor.createdAt, ancestor.originNodeId, level);

        node.isLoaded = true;
        node.hasChildren = graph.getParents(ancestor.id).length > 0;
        nodeMap.set(ancestor.id, node);

        // Find parent and add as child
        const childIds = graph.getChildren(ancestor.id);
        for (const childId of childIds) {
          const parentNode = nodeMap.get(childId);
          if (parentNode) {
            node.parent = parentNode;
            parentNode.children.push(node);
          }
        }
      }
    }
  }

  private async loadBatchInternal(tokenIds: string[], depth: number, graph: TokenGraph): Promise<LazyLineageNode[]> {
    const nodes: LazyLineageNode[] = [];

    for (const tokenId of tokenIds) {
      const graphNode = graph.getNode(tokenId);
      if (graphNode) {
        const lazyNode = this.createLazyNode(
          tokenId,
          graphNode.value,
          graphNode.createdAt,
          graphNode.originNodeId,
          depth,
        );

        lazyNode.hasChildren = graph.getParents(tokenId).length > 0;
        lazyNode.isLoaded = true;
        nodes.push(lazyNode);
      }
    }

    return nodes;
  }

  private async processLoadQueue(): Promise<void> {
    if (this.activeLoads >= this.config.maxConcurrentLoads || this.loadQueue.length === 0) {
      return;
    }

    this.activeLoads++;

    try {
      // Take a batch from the queue
      const batch = this.loadQueue.splice(0, this.config.batchSize);

      // Process the batch (this would integrate with the actual graph loading)
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work

      // Notify observers of completion
      this.notifyObservers([]);
    } finally {
      this.activeLoads--;

      // Process next batch if queue is not empty
      if (this.loadQueue.length > 0) {
        setTimeout(() => this.processLoadQueue(), 0);
      }
    }
  }

  private flattenTree(rootNode: LazyLineageNode): LazyLineageNode[] {
    const result: LazyLineageNode[] = [];

    function traverse(node: LazyLineageNode) {
      result.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(rootNode);
    return result;
  }

  private preloadNearViewport(flatNodes: LazyLineageNode[], startIndex: number, endIndex: number): void {
    const preloadStart = Math.max(0, startIndex - this.config.preloadThreshold);
    const preloadEnd = Math.min(flatNodes.length, endIndex + this.config.preloadThreshold);

    const nodesToPreload: string[] = [];

    for (let i = preloadStart; i < preloadEnd; i++) {
      const node = flatNodes[i];
      if (node.hasChildren && !node.isLoaded && !node.isLoading) {
        nodesToPreload.push(node.tokenId);
      }
    }

    if (nodesToPreload.length > 0) {
      this.queueForLoading(nodesToPreload);
    }
  }

  private unloadNodeChildren(node: LazyLineageNode): void {
    for (const child of node.children) {
      this.unloadNodeChildren(child);
    }

    node.children = [];
    node.isLoaded = false;
  }

  private notifyObservers(nodes: LazyLineageNode[]): void {
    for (const observer of this.observers) {
      try {
        observer(nodes);
      } catch (error) {
        console.error("Error in lazy loading observer:", error);
      }
    }
  }
}

/**
 * Virtual scrolling helper for large lineage tables
 */
export class VirtualScrollHelper {
  private itemHeight: number;
  private containerHeight: number;
  private scrollTop: number = 0;
  private totalItems: number = 0;

  constructor(itemHeight: number, containerHeight: number) {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
  }

  /**
   * Update scroll position and calculate visible range
   */
  updateScroll(scrollTop: number, totalItems: number): ViewportInfo {
    this.scrollTop = scrollTop;
    this.totalItems = totalItems;

    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(startIndex + visibleCount + 1, totalItems);

    return {
      startIndex,
      endIndex,
      scrollTop,
      containerHeight: this.containerHeight,
      itemHeight: this.itemHeight,
    };
  }

  /**
   * Get total scrollable height
   */
  getTotalHeight(): number {
    return this.totalItems * this.itemHeight;
  }

  /**
   * Get offset for visible items
   */
  getOffsetY(startIndex: number): number {
    return startIndex * this.itemHeight;
  }

  /**
   * Update container dimensions
   */
  updateDimensions(itemHeight: number, containerHeight: number): void {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
  }
}

/**
 * Progressive disclosure manager for complex lineage trees
 */
export class ProgressiveDisclosureManager {
  private expandedNodes = new Set<string>();
  private loadingNodes = new Set<string>();
  private maxExpandedNodes: number;

  constructor(maxExpandedNodes: number = 100) {
    this.maxExpandedNodes = maxExpandedNodes;
  }

  /**
   * Check if a node should be expanded
   */
  isExpanded(tokenId: string): boolean {
    return this.expandedNodes.has(tokenId);
  }

  /**
   * Check if a node is currently loading
   */
  isLoading(tokenId: string): boolean {
    return this.loadingNodes.has(tokenId);
  }

  /**
   * Expand a node
   */
  expand(tokenId: string): void {
    // Enforce maximum expanded nodes limit
    if (this.expandedNodes.size >= this.maxExpandedNodes) {
      // Remove oldest expanded node (simple FIFO)
      const oldest = this.expandedNodes.values().next().value;
      if (oldest) {
        this.expandedNodes.delete(oldest);
      }
    }

    this.expandedNodes.add(tokenId);
  }

  /**
   * Collapse a node
   */
  collapse(tokenId: string): void {
    this.expandedNodes.delete(tokenId);
  }

  /**
   * Set loading state for a node
   */
  setLoading(tokenId: string, isLoading: boolean): void {
    if (isLoading) {
      this.loadingNodes.add(tokenId);
    } else {
      this.loadingNodes.delete(tokenId);
    }
  }

  /**
   * Get all expanded nodes
   */
  getExpandedNodes(): string[] {
    return Array.from(this.expandedNodes);
  }

  /**
   * Clear all expansion state
   */
  clear(): void {
    this.expandedNodes.clear();
    this.loadingNodes.clear();
  }

  /**
   * Get expansion statistics
   */
  getStats(): {
    expandedCount: number;
    loadingCount: number;
    maxExpanded: number;
  } {
    return {
      expandedCount: this.expandedNodes.size,
      loadingCount: this.loadingNodes.size,
      maxExpanded: this.maxExpandedNodes,
    };
  }
}

/**
 * Utility function to create a lazy loader with default configuration
 */
export function createLazyLoader(config?: Partial<LazyLoadConfig>): LazyLineageLoader {
  return new LazyLineageLoader(config);
}

/**
 * Utility function to create a virtual scroll helper
 */
export function createVirtualScrollHelper(itemHeight: number, containerHeight: number): VirtualScrollHelper {
  return new VirtualScrollHelper(itemHeight, containerHeight);
}

/**
 * Utility function to create a progressive disclosure manager
 */
export function createProgressiveDisclosureManager(maxExpandedNodes?: number): ProgressiveDisclosureManager {
  return new ProgressiveDisclosureManager(maxExpandedNodes);
}
