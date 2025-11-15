/**
 * Semantic Positioning Library
 *
 * Provides intelligent node positioning for workflow diagrams using semantic grouping
 * and virtual column/row layouts. Designed to be reusable across different workflow agents.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  nodeId: string;
  type: string;
  displayName?: string;
  position?: Position;
}

export interface Edge {
  from?: string;
  sourceNodeId?: string;
  to?: string;
  targetNodeId?: string;
  destinationNodeId?: string;
}

export interface LayoutConfig {
  // Virtual column settings
  columnWidth: number;           // Width between columns
  columnPadding: number;         // Extra space around columns

  // Virtual row settings
  rowHeight: number;             // Height between rows in same column
  rowGroupSpacing: number;       // Extra space between different node type groups

  // Canvas bounds
  canvasWidth: number;
  canvasHeight: number;
  startX: number;
  startY: number;

  // Node type priorities (for column ordering)
  nodeTypePriority: Record<string, number>;

  // Special positioning rules
  commentOffsetY: number;        // How far above to place comments
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columnWidth: 180,      // Much tighter - about 2-3x node width instead of 250
  columnPadding: 30,     // Reduced padding
  rowHeight: 110,        // Slightly tighter vertical spacing
  rowGroupSpacing: 40,   // Less space between node type groups
  canvasWidth: 1200,
  canvasHeight: 800,
  startX: 50,
  startY: 100,
  nodeTypePriority: {
    'DataSource': 1,
    'Queue': 2,
    'ProcessNode': 3,
    'Multiplexer': 4,
    'FSM': 5,
    'Sink': 6,
    'MarkdownComment': 0  // Special case - positioned separately
  },
  commentOffsetY: 150    // Closer to flow nodes
};

/**
 * Semantic node grouping and flow analysis
 */
export class FlowAnalyzer {
  private nodes: Node[];
  private edges: Edge[];
  private adjacency: Map<string, string[]>;
  private inDegree: Map<string, number>;
  private outDegree: Map<string, number>;

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.adjacency = new Map();
    this.inDegree = new Map();
    this.outDegree = new Map();
    this.buildGraph();
  }

  private buildGraph(): void {
    // Initialize all nodes
    this.nodes.forEach(node => {
      this.adjacency.set(node.nodeId, []);
      this.inDegree.set(node.nodeId, 0);
      this.outDegree.set(node.nodeId, 0);
    });

    // Build adjacency and degree maps
    this.edges.forEach(edge => {
      const from = edge.from || edge.sourceNodeId;
      const to = edge.to || edge.targetNodeId || edge.destinationNodeId;

      if (from && to && this.adjacency.has(from) && this.adjacency.has(to)) {
        this.adjacency.get(from)!.push(to);
        this.inDegree.set(to, (this.inDegree.get(to) || 0) + 1);
        this.outDegree.set(from, (this.outDegree.get(from) || 0) + 1);
      }
    });
  }

  /**
   * Group nodes by semantic flow layers (columns)
   */
  getFlowLayers(config: LayoutConfig): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();
    const tempInDegree = new Map(this.inDegree);

    // Exclude comments from flow analysis
    const flowNodes = this.nodes.filter(node => node.type !== 'MarkdownComment');

    // Find source nodes (no incoming edges)
    let currentLayer = flowNodes
      .filter(node => tempInDegree.get(node.nodeId) === 0)
      .map(node => node.nodeId);

    // If no sources found, start with highest priority nodes
    if (currentLayer.length === 0) {
      const sortedByPriority = flowNodes.sort((a, b) =>
        (config.nodeTypePriority[a.type] || 999) - (config.nodeTypePriority[b.type] || 999)
      );
      if (sortedByPriority.length > 0) {
        currentLayer = [sortedByPriority[0].nodeId];
      }
    }

    // Build layers using topological sort
    while (currentLayer.length > 0) {
      layers.push([...currentLayer]);
      currentLayer.forEach(nodeId => visited.add(nodeId));

      const nextLayer: string[] = [];
      currentLayer.forEach(nodeId => {
        this.adjacency.get(nodeId)?.forEach(targetId => {
          if (!visited.has(targetId)) {
            tempInDegree.set(targetId, tempInDegree.get(targetId)! - 1);
            if (tempInDegree.get(targetId) === 0 && !nextLayer.includes(targetId)) {
              nextLayer.push(targetId);
            }
          }
        });
      });

      currentLayer = nextLayer;
    }

    // Add any remaining nodes (cycles or disconnected)
    const unvisited = flowNodes
      .filter(node => !visited.has(node.nodeId))
      .map(node => node.nodeId);
    if (unvisited.length > 0) {
      layers.push(unvisited);
    }

    return layers;
  }

  /**
   * Group nodes within a layer by type for better vertical organization
   */
  groupNodesByType(layerNodeIds: string[], config: LayoutConfig): string[][] {
    const nodeById = new Map(this.nodes.map(n => [n.nodeId, n]));
    const typeGroups = new Map<string, string[]>();

    // Group by type
    layerNodeIds.forEach(nodeId => {
      const node = nodeById.get(nodeId);
      if (node && node.type !== 'MarkdownComment') {
        if (!typeGroups.has(node.type)) {
          typeGroups.set(node.type, []);
        }
        typeGroups.get(node.type)!.push(nodeId);
      }
    });

    // Sort groups by priority and convert to array
    const sortedGroups = Array.from(typeGroups.entries())
      .sort(([typeA], [typeB]) =>
        (config.nodeTypePriority[typeA] || 999) - (config.nodeTypePriority[typeB] || 999)
      )
      .map(([_, nodeIds]) => nodeIds);

    return sortedGroups;
  }
}

/**
 * Main semantic positioning engine
 */
export class SemanticPositioner {
  private config: LayoutConfig;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  }

  /**
   * Position new nodes while preserving existing node positions
   * Similar node types stack vertically in same column, new flows go below existing ones
   */
  positionNewNodes(
    existingNodes: Node[],
    newNodes: Node[],
    allEdges: Edge[]
  ): Node[] {
    if (newNodes.length === 0) {
      return newNodes;
    }

    // Calculate existing bounds
    const existingBounds = this.calculateBounds(existingNodes);

    // Check if we're extending existing flows or creating a new flow
    const isNewCompleteFlow = this.isNewCompleteFlow(existingNodes, newNodes, allEdges);

    // Analyze flow structure of new nodes
    const analyzer = new FlowAnalyzer([...existingNodes, ...newNodes], allEdges);
    const flowLayers = analyzer.getFlowLayers(this.config);

    // Filter layers to only include new nodes
    const newNodeIds = new Set(newNodes.map(n => n.nodeId));
    const newNodeLayers = flowLayers.map(layer =>
      layer.filter(nodeId => newNodeIds.has(nodeId))
    ).filter(layer => layer.length > 0);

    const positionedNodes = new Map<string, Position>();

    if (isNewCompleteFlow && existingNodes.length > 0) {
      // Position new flow below existing flows
      this.positionNewFlowBelow(existingNodes, newNodes, newNodeLayers, analyzer, positionedNodes);
    } else {
      // Extend existing flow or start fresh
      this.positionExtendingFlow(existingBounds, newNodeLayers, analyzer, positionedNodes);
    }

    // Position comment nodes
    const commentNodes = newNodes.filter(node => node.type === 'MarkdownComment');
    commentNodes.forEach(node => {
      // Position comments above the leftmost new flow node
      const flowPositions = Array.from(positionedNodes.values());
      const leftmostX = flowPositions.length > 0 ?
        Math.min(...flowPositions.map(p => p.x)) :
        (existingBounds.minX || this.config.startX);

      const referenceY = flowPositions.length > 0 ?
        Math.min(...flowPositions.map(p => p.y)) :
        (existingBounds.minY || this.config.startY);

      positionedNodes.set(node.nodeId, {
        x: leftmostX,
        y: referenceY - this.config.commentOffsetY
      });
    });

    // Apply positions to nodes
    return newNodes.map(node => ({
      ...node,
      position: positionedNodes.get(node.nodeId) || { x: 0, y: 0 }
    }));
  }

  /**
   * Check if new nodes form a complete independent flow vs extending existing flow
   */
  private isNewCompleteFlow(existingNodes: Node[], newNodes: Node[], allEdges: Edge[]): boolean {
    if (existingNodes.length === 0) return false;

    const newNodeIds = new Set(newNodes.map(n => n.nodeId));
    const existingNodeIds = new Set(existingNodes.map(n => n.nodeId));

    // Check if any new nodes connect to existing nodes
    const hasConnectionToExisting = allEdges.some(edge => {
      const from = edge.from || edge.sourceNodeId;
      const to = edge.to || edge.targetNodeId || edge.destinationNodeId;

      return (newNodeIds.has(from!) && existingNodeIds.has(to!)) ||
             (existingNodeIds.has(from!) && newNodeIds.has(to!));
    });

    // If no connections to existing nodes, it's likely a new independent flow
    return !hasConnectionToExisting;
  }

  /**
   * Position a new complete flow below existing flows
   */
  private positionNewFlowBelow(
    existingNodes: Node[],
    newNodes: Node[],
    newNodeLayers: string[][],
    analyzer: FlowAnalyzer,
    positionedNodes: Map<string, Position>
  ): void {
    const existingBounds = this.calculateBounds(existingNodes);

    // Start new flow below existing with some spacing
    const newFlowStartY = existingBounds.maxY + this.config.rowGroupSpacing * 2;
    const startX = this.config.startX; // Align with original start

    newNodeLayers.forEach((layer, layerIndex) => {
      const columnX = startX + (layerIndex * this.config.columnWidth);
      this.positionLayerNodes(layer, columnX, newFlowStartY, analyzer, positionedNodes);
    });
  }

  /**
   * Position nodes extending existing flow (to the right)
   */
  private positionExtendingFlow(
    existingBounds: any,
    newNodeLayers: string[][],
    analyzer: FlowAnalyzer,
    positionedNodes: Map<string, Position>
  ): void {
    // Position new nodes to the right of existing ones
    const startX = existingBounds.maxX + this.config.columnWidth;
    const startY = existingBounds.centerY || this.config.startY;

    newNodeLayers.forEach((layer, layerIndex) => {
      const columnX = startX + (layerIndex * this.config.columnWidth);
      this.positionLayerNodes(layer, columnX, startY, analyzer, positionedNodes);
    });
  }

  /**
   * Position nodes in a single layer (column), grouping by type and stacking vertically
   */
  private positionLayerNodes(
    layerNodeIds: string[],
    columnX: number,
    baseY: number,
    analyzer: FlowAnalyzer,
    positionedNodes: Map<string, Position>
  ): void {
    // Group nodes by type for vertical stacking
    const typeGroups = analyzer.groupNodesByType(layerNodeIds, this.config);

    // Calculate total height needed for this column
    const totalNodes = typeGroups.reduce((sum, group) => sum + group.length, 0);
    const totalGroupSpacing = (typeGroups.length - 1) * this.config.rowGroupSpacing;
    const totalNodeSpacing = (totalNodes - 1) * this.config.rowHeight;
    const totalHeight = totalNodeSpacing + totalGroupSpacing;

    // Start from center of base position
    let currentY = baseY - (totalHeight / 2);

    typeGroups.forEach((group, groupIndex) => {
      // Position each node in the type group
      group.forEach((nodeId, nodeIndex) => {
        positionedNodes.set(nodeId, {
          x: columnX + (Math.random() - 0.5) * 15, // Small random offset for visual variety
          y: currentY
        });

        // Move to next row position
        if (nodeIndex < group.length - 1) {
          currentY += this.config.rowHeight;
        }
      });

      // Add spacing between different node type groups
      if (groupIndex < typeGroups.length - 1) {
        currentY += this.config.rowGroupSpacing;
      }
    });
  }

  /**
   * Position all nodes from scratch (for new workflows)
   */
  positionAllNodes(nodes: Node[], edges: Edge[]): Node[] {
    if (nodes.length === 0) {
      return nodes;
    }

    const analyzer = new FlowAnalyzer(nodes, edges);
    const flowLayers = analyzer.getFlowLayers(this.config);

    const positionedNodes = new Map<string, Position>();

    // Position flow nodes layer by layer
    flowLayers.forEach((layer, layerIndex) => {
      const columnX = this.config.startX + (layerIndex * this.config.columnWidth);

      // Group nodes in this layer by type
      const typeGroups = analyzer.groupNodesByType(layer, this.config);

      // Calculate total height needed
      const totalGroups = typeGroups.length;
      const totalNodes = typeGroups.reduce((sum, group) => sum + group.length, 0);
      const totalHeight = (totalNodes - 1) * this.config.rowHeight +
                         (totalGroups - 1) * this.config.rowGroupSpacing;

      const startY = this.config.startY + (this.config.canvasHeight - totalHeight) / 2;
      let currentY = startY;

      typeGroups.forEach((group, groupIndex) => {
        group.forEach((nodeId, nodeIndex) => {
          positionedNodes.set(nodeId, {
            x: columnX + (Math.random() - 0.5) * 20, // Small random offset
            y: currentY
          });

          if (nodeIndex < group.length - 1) {
            currentY += this.config.rowHeight;
          }
        });

        if (groupIndex < typeGroups.length - 1) {
          currentY += this.config.rowGroupSpacing;
        }
      });
    });

    // Position comment nodes
    const commentNodes = nodes.filter(node => node.type === 'MarkdownComment');
    commentNodes.forEach(node => {
      const flowPositions = Array.from(positionedNodes.values());
      const leftmostX = flowPositions.length > 0 ?
        Math.min(...flowPositions.map(p => p.x)) : this.config.startX;

      positionedNodes.set(node.nodeId, {
        x: leftmostX,
        y: this.config.startY - this.config.commentOffsetY
      });
    });

    return nodes.map(node => ({
      ...node,
      position: positionedNodes.get(node.nodeId) || { x: 0, y: 0 }
    }));
  }

  private calculateBounds(nodes: Node[]) {
    if (nodes.length === 0) {
      return {
        minX: this.config.startX,
        maxX: this.config.startX,
        minY: this.config.startY,
        maxY: this.config.startY,
        centerY: this.config.startY
      };
    }

    const positions = nodes
      .filter(n => n.position)
      .map(n => n.position!);

    if (positions.length === 0) {
      return {
        minX: this.config.startX,
        maxX: this.config.startX,
        minY: this.config.startY,
        maxY: this.config.startY,
        centerY: this.config.startY
      };
    }

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    return {
      minX,
      maxX,
      minY,
      maxY,
      centerY: (minY + maxY) / 2
    };
  }
}

/**
 * Convenience function for quick positioning
 */
export function positionNodes(
  existingNodes: Node[],
  newNodes: Node[],
  edges: Edge[],
  config?: Partial<LayoutConfig>
): Node[] {
  const positioner = new SemanticPositioner(config);
  return positioner.positionNewNodes(existingNodes, newNodes, edges);
}

/**
 * Position all nodes from scratch
 */
export function positionAllNodes(
  nodes: Node[],
  edges: Edge[],
  config?: Partial<LayoutConfig>
): Node[] {
  const positioner = new SemanticPositioner(config);
  return positioner.positionAllNodes(nodes, edges);
}