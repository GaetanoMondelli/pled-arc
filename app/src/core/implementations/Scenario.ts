/**
 * Scenario - Defines the workflow structure
 *
 * A scenario is like a blueprint for your workflow. It contains:
 * - Nodes: The different steps/components (like "Generate Data", "Process Data", "Save Results")
 * - Edges: The connections showing how data flows between steps
 *
 * Think of it like a flowchart that describes your business process.
 */

// Import interfaces from core types instead of redefining them
import { NodeConfig, EdgeConfig, ScenarioConfig } from '../types';

/**
 * Scenario class - Manages the workflow structure
 *
 * This class helps you:
 * - Define your workflow steps
 * - Set up connections between steps
 * - Validate that your workflow makes sense
 */
export class Scenario {
  private config: ScenarioConfig;
  private connectionMap: Map<string, string[]> = new Map();

  constructor(config: ScenarioConfig) {
    this.config = config;
    this.buildConnectionMap();
    this.validateScenario();
  }

  /**
   * Helper to get node ID, supporting both V3 (nodeId) and legacy (id) formats
   */
  private getNodeId(node: any): string {
    return node.nodeId || node.id;
  }

  /**
   * Get the scenario configuration
   */
  getConfig(): ScenarioConfig {
    return { ...this.config };
  }

  /**
   * Get all nodes in the scenario
   */
  getNodes(): NodeConfig[] {
    return this.config.nodes.map(node => this.normalizeNode(node));
  }

  /**
   * Get all edges (connections) in the scenario
   * LEGACY: Only returns explicit edges array for backward compatibility
   */
  getEdges(): EdgeConfig[] {
    return [...(this.config.edges || [])];
  }

  /**
   * Get all edges including both explicit edges and V3 embedded outputs
   * Use this for V3 scenarios that embed connections in node outputs
   */
  getAllEdges(): EdgeConfig[] {
    const edges: EdgeConfig[] = [];
    const edgeSet = new Set<string>(); // Track unique edges to avoid duplicates
    let edgeIndex = 0;

    // Add explicit edges from edges array (if any)
    if (this.config.edges && Array.isArray(this.config.edges)) {
      this.config.edges.forEach(edge => {
        const edgeKey = `${edge.sourceNodeId}->${edge.targetNodeId}`;
        if (!edgeSet.has(edgeKey)) {
          edges.push(edge);
          edgeSet.add(edgeKey);
        }
      });
      edgeIndex = this.config.edges.length;
    }

    // Generate edges from V3 node outputs (only if not already in explicit edges)
    this.config.nodes.forEach(node => {
      const nodeId = this.getNodeId(node);
      const outputs = node.outputs || [];

      outputs.forEach((output: any) => {
        if (output.destinationNodeId) {
          const edgeKey = `${nodeId}->${output.destinationNodeId}`;

          // Only add if this connection doesn't already exist
          if (!edgeSet.has(edgeKey)) {
            edges.push({
              id: `edge_${edgeIndex++}`,
              sourceNodeId: nodeId,
              targetNodeId: output.destinationNodeId,
              name: output.name || 'output',
              metadata: {
                sourcePort: output.name || 'output',
                targetPort: output.destinationInputName || 'input',
                interface: output.interface
              }
            });
            edgeSet.add(edgeKey);
          }
        }
      });
    });

    return edges;
  }

  /**
   * Get a specific node by ID
   */
  getNode(nodeId: string): NodeConfig | undefined {
    const node = this.config.nodes.find(node => this.getNodeId(node) === nodeId);
    return node ? this.normalizeNode(node) : undefined;
  }

  /**
   * Get all nodes that this node connects to
   */
  getTargets(sourceNodeId: string): string[] {
    return this.connectionMap.get(sourceNodeId) || [];
  }

  /**
   * Get all nodes of a specific type (e.g., all "DataSource" nodes)
   */
  getNodesByType(nodeType: string): NodeConfig[] {
    return this.config.nodes
      .filter(node => node.type === nodeType)
      .map(node => this.normalizeNode(node));
  }

  /**
   * Get scenario info in the format expected by legacy components
   * This maintains compatibility with EventQueueModal and other legacy code
   */
  getScenarioInfo(): any {
    return {
      id: this.config.id,
      name: this.config.name,
      version: this.config.version,
      nodes: this.getNodes(),
      edges: this.getEdges(),
      nodeCount: this.config.nodes.length,
      edgeCount: this.getEdges().length
    };
  }

  /**
   * Normalize a node to ensure it has both id and nodeId fields
   */
  private normalizeNode(node: any): NodeConfig {
    const nodeId = this.getNodeId(node);
    const displayName = node.displayName || node.name;

    return {
      ...node,
      id: nodeId,        // Ensure legacy id field exists
      nodeId: nodeId,    // Ensure V3 nodeId field exists
      name: displayName, // Ensure legacy name field exists
      displayName: displayName, // Ensure V3 displayName field exists
    };
  }

  /**
   * Check if two nodes are connected
   */
  areConnected(sourceId: string, targetId: string): boolean {
    const targets = this.getTargets(sourceId);
    return targets.includes(targetId);
  }

  /**
   * Get scenario statistics
   */
  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    startingNodes: string[];
    endingNodes: string[];
  } {
    const nodesByType: Record<string, number> = {};
    const allTargets = new Set<string>();
    const allSources = new Set<string>();

    // Count nodes by type
    this.config.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    // Find sources and targets from explicit edges (if any)
    if (this.config.edges && Array.isArray(this.config.edges)) {
      this.config.edges.forEach(edge => {
        allSources.add(edge.sourceNodeId);
        allTargets.add(edge.targetNodeId);
      });
    }

    // Starting nodes: have no incoming edges (sources but not targets)
    const startingNodes = this.config.nodes
      .filter(node => allSources.has(this.getNodeId(node)) && !allTargets.has(this.getNodeId(node)))
      .map(node => this.getNodeId(node));

    // Ending nodes: have no outgoing edges (targets but not sources)
    const endingNodes = this.config.nodes
      .filter(node => allTargets.has(this.getNodeId(node)) && !allSources.has(this.getNodeId(node)))
      .map(node => this.getNodeId(node));

    return {
      totalNodes: this.config.nodes.length,
      totalEdges: this.config.edges?.length || 0,
      nodesByType,
      startingNodes,
      endingNodes,
    };
  }

  /**
   * Build the connection map for fast lookups
   * Supports both explicit edges and V3 embedded outputs with deduplication
   */
  private buildConnectionMap(): void {
    this.connectionMap.clear();
    const processedConnections = new Set<string>(); // Track to avoid duplicates

    // Process explicit edges array (ReactFlow format)
    if (this.config.edges && Array.isArray(this.config.edges)) {
      this.config.edges.forEach(edge => {
        const connectionKey = `${edge.sourceNodeId}->${edge.targetNodeId}`;
        if (!processedConnections.has(connectionKey)) {
          if (!this.connectionMap.has(edge.sourceNodeId)) {
            this.connectionMap.set(edge.sourceNodeId, []);
          }
          this.connectionMap.get(edge.sourceNodeId)!.push(edge.targetNodeId);
          processedConnections.add(connectionKey);
        }
      });
    }

    // CRITICAL FIX: Also parse connections from node outputs (V3 format)
    // Only add if not already processed from explicit edges
    this.config.nodes.forEach(node => {
      const nodeId = this.getNodeId(node);
      const outputs = node.outputs || [];

      outputs.forEach((output: any) => {
        if (output.destinationNodeId) {
          const connectionKey = `${nodeId}->${output.destinationNodeId}`;
          if (!processedConnections.has(connectionKey)) {
            if (!this.connectionMap.has(nodeId)) {
              this.connectionMap.set(nodeId, []);
            }
            this.connectionMap.get(nodeId)!.push(output.destinationNodeId);
            processedConnections.add(connectionKey);
            // console.log(`🔗 Found connection: ${nodeId} → ${output.destinationNodeId} (via output '${output.name}')`);
          }
        }
      });
    });

    // console.log(`🔗 Built connection map with ${this.connectionMap.size} source nodes:`,
    //            Array.from(this.connectionMap.entries()));
  }

  /**
   * Validate that the scenario is well-formed
   */
  private validateScenario(): void {
    const errors: string[] = [];

    // Check for duplicate node IDs (support both V3 nodeId and legacy id)
    const nodeIds = this.config.nodes.map(node => this.getNodeId(node));
    const uniqueNodeIds = new Set(nodeIds);
    if (nodeIds.length !== uniqueNodeIds.size) {
      errors.push('Duplicate node IDs found');
    }

    // Check for duplicate edge IDs (only if edges exist)
    if (this.config.edges && Array.isArray(this.config.edges)) {
      const edgeIds = this.config.edges.map(edge => edge.id);
      const uniqueEdgeIds = new Set(edgeIds);
      if (edgeIds.length !== uniqueEdgeIds.size) {
        errors.push('Duplicate edge IDs found');
      }
    }

    // Check that all edges reference valid nodes (only if edges exist)
    if (this.config.edges && Array.isArray(this.config.edges)) {
      this.config.edges.forEach(edge => {
        if (!uniqueNodeIds.has(edge.sourceNodeId)) {
          errors.push(`Edge ${edge.id} references unknown source node: ${edge.sourceNodeId}`);
        }
        if (!uniqueNodeIds.has(edge.targetNodeId)) {
          errors.push(`Edge ${edge.id} references unknown target node: ${edge.targetNodeId}`);
        }
      });
    }

    // Check for cycles (optional warning)
    if (this.hasCycles()) {
      console.warn('⚠️ Scenario contains cycles - this may cause infinite loops');
    }

    if (errors.length > 0) {
      throw new Error(`Scenario validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Detect if the scenario has cycles
   */
  private hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const targets = this.getTargets(nodeId);
      for (const target of targets) {
        if (!visited.has(target)) {
          if (hasCycleDFS(target)) {
            return true;
          }
        } else if (recursionStack.has(target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.config.nodes) {
      const nodeId = this.getNodeId(node);
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Create a simple linear scenario for testing
   */
  static createSimplePipeline(name: string = 'Simple Pipeline'): Scenario {
    return new Scenario({
      id: 'simple_pipeline',
      name,
      description: 'A simple data processing pipeline: Source → Processor → Sink',
      nodes: [
        {
          id: 'source',
          type: 'DataSource',
          name: 'Data Source',
          config: { maxEmissions: 3, rate: 1000, valueType: 'sequential' }
        },
        {
          id: 'processor',
          type: 'Processor',
          name: 'Data Processor',
          config: { processingTime: 500, transformation: 'double' }
        },
        {
          id: 'sink',
          type: 'Sink',
          name: 'Data Sink',
          config: {}
        }
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'source', targetNodeId: 'processor' },
        { id: 'e2', sourceNodeId: 'processor', targetNodeId: 'sink' }
      ]
    });
  }

  /**
   * Create a complex multi-branch scenario for testing
   */
  static createComplexScenario(name: string = 'Complex Pipeline'): Scenario {
    return new Scenario({
      id: 'complex_pipeline',
      name,
      description: 'A complex pipeline with multiple sources and processors',
      nodes: [
        {
          id: 'source1',
          type: 'DataSource',
          name: 'Source 1',
          config: { maxEmissions: 2, rate: 1000, valueType: 'sequential' }
        },
        {
          id: 'source2',
          type: 'DataSource',
          name: 'Source 2',
          config: { maxEmissions: 2, rate: 1500, valueType: 'fibonacci' }
        },
        {
          id: 'processor1',
          type: 'Processor',
          name: 'Processor 1',
          config: { processingTime: 300, transformation: 'double' }
        },
        {
          id: 'processor2',
          type: 'Processor',
          name: 'Processor 2',
          config: { processingTime: 400, transformation: 'increment' }
        },
        {
          id: 'router',
          type: 'Multiplexer',
          name: 'Smart Router',
          config: {
            rules: [
              { condition: 'value > 5', target: 'high_priority_sink' },
              { condition: 'value <= 5', target: 'normal_sink' }
            ]
          }
        },
        {
          id: 'high_priority_sink',
          type: 'Sink',
          name: 'High Priority Sink',
          config: { priority: 'high' }
        },
        {
          id: 'normal_sink',
          type: 'Sink',
          name: 'Normal Sink',
          config: { priority: 'normal' }
        }
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'source1', targetNodeId: 'processor1' },
        { id: 'e2', sourceNodeId: 'source2', targetNodeId: 'processor2' },
        { id: 'e3', sourceNodeId: 'processor1', targetNodeId: 'router' },
        { id: 'e4', sourceNodeId: 'processor2', targetNodeId: 'router' },
        { id: 'e5', sourceNodeId: 'router', targetNodeId: 'high_priority_sink', condition: { type: 'expression', expression: 'value > 5' } },
        { id: 'e6', sourceNodeId: 'router', targetNodeId: 'normal_sink', condition: { type: 'expression', expression: 'value <= 5' } }
      ]
    });
  }
}