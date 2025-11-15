/**
 * Deterministic Token Identification System
 *
 * Solves the problem of uniquely and deterministically identifying tokens
 * across all node types including aggregations, joins, and splits.
 */

export interface DeterministicTokenId {
  // Unique token identifier that's deterministic across runs
  id: string;

  // Generation sequence (increments at each transformation)
  generation: number;

  // Source lineage (ordered list of parent token IDs)
  parentIds: string[];

  // Business correlation IDs (for audit trail)
  correlationIds: string[];

  // Transformation signature (ensures deterministic ID generation)
  transformationHash: string;
}

export class TokenIdGenerator {
  /**
   * Generate deterministic token ID for any transformation
   */
  static generateTokenId(params: {
    nodeId: string;
    nodeType: string;
    timestamp: number;
    parentTokenIds: string[];
    transformationData: any;
    correlationIds: string[];
  }): DeterministicTokenId {

    const { nodeId, nodeType, timestamp, parentTokenIds, transformationData, correlationIds } = params;

    // Sort parent IDs to ensure deterministic ordering
    const sortedParentIds = [...parentTokenIds].sort();

    // Create transformation signature
    const transformationSignature = {
      nodeId,
      nodeType,
      timestamp,
      parentIds: sortedParentIds,
      data: this.normalizeTransformationData(transformationData)
    };

    // Generate deterministic hash
    const transformationHash = this.generateHash(transformationSignature);

    // Determine generation (max parent generation + 1)
    const generation = this.calculateGeneration(parentTokenIds);

    // Create deterministic token ID
    const tokenId = `${nodeId}_g${generation}_${transformationHash}`;

    return {
      id: tokenId,
      generation,
      parentIds: sortedParentIds,
      correlationIds: [...correlationIds],
      transformationHash
    };
  }

  /**
   * Handle different node type patterns
   */
  static generateForNodeType(nodeType: string, params: any): DeterministicTokenId {
    switch (nodeType) {
      case 'DataSource':
        return this.generateForDataSource(params);
      case 'FSM':
        return this.generateForFSM(params);
      case 'Aggregator':
        return this.generateForAggregator(params);
      case 'Joiner':
        return this.generateForJoiner(params);
      case 'Multiplexer':
        return this.generateForMultiplexer(params);
      default:
        return this.generateTokenId(params);
    }
  }

  /**
   * DataSource: Primary token generation
   */
  private static generateForDataSource(params: {
    nodeId: string;
    timestamp: number;
    data: any;
    correlationIds: string[];
  }): DeterministicTokenId {
    return this.generateTokenId({
      nodeId: params.nodeId,
      nodeType: 'DataSource',
      timestamp: params.timestamp,
      parentTokenIds: [], // No parents for source
      transformationData: params.data,
      correlationIds: params.correlationIds
    });
  }

  /**
   * FSM: State transition tokens
   */
  private static generateForFSM(params: {
    nodeId: string;
    timestamp: number;
    parentTokenId: string;
    fromState: string;
    toState: string;
    trigger: string;
    correlationIds: string[];
  }): DeterministicTokenId {
    return this.generateTokenId({
      nodeId: params.nodeId,
      nodeType: 'FSM',
      timestamp: params.timestamp,
      parentTokenIds: [params.parentTokenId],
      transformationData: {
        transition: `${params.fromState}->${params.toState}`,
        trigger: params.trigger
      },
      correlationIds: params.correlationIds
    });
  }

  /**
   * Aggregator: Multiple inputs -> single output
   * Key insight: Sort parent IDs to ensure deterministic aggregation
   */
  private static generateForAggregator(params: {
    nodeId: string;
    timestamp: number;
    parentTokenIds: string[];
    aggregationType: string; // 'sum', 'avg', 'count', etc.
    aggregationValue: any;
    correlationIds: string[];
  }): DeterministicTokenId {
    return this.generateTokenId({
      nodeId: params.nodeId,
      nodeType: 'Aggregator',
      timestamp: params.timestamp,
      parentTokenIds: params.parentTokenIds,
      transformationData: {
        type: params.aggregationType,
        value: params.aggregationValue,
        inputCount: params.parentTokenIds.length
      },
      correlationIds: params.correlationIds
    });
  }

  /**
   * Joiner: Multiple inputs -> single output with join logic
   */
  private static generateForJoiner(params: {
    nodeId: string;
    timestamp: number;
    parentTokenIds: string[];
    joinKey: string;
    joinType: string;
    correlationIds: string[];
  }): DeterministicTokenId {
    return this.generateTokenId({
      nodeId: params.nodeId,
      nodeType: 'Joiner',
      timestamp: params.timestamp,
      parentTokenIds: params.parentTokenIds,
      transformationData: {
        joinKey: params.joinKey,
        joinType: params.joinType,
        inputCount: params.parentTokenIds.length
      },
      correlationIds: params.correlationIds
    });
  }

  /**
   * Multiplexer: Single input -> multiple outputs
   */
  private static generateForMultiplexer(params: {
    nodeId: string;
    timestamp: number;
    parentTokenId: string;
    routingDecision: string;
    outputIndex: number;
    correlationIds: string[];
  }): DeterministicTokenId {
    return this.generateTokenId({
      nodeId: params.nodeId,
      nodeType: 'Multiplexer',
      timestamp: params.timestamp,
      parentTokenIds: [params.parentTokenId],
      transformationData: {
        routing: params.routingDecision,
        outputIndex: params.outputIndex
      },
      correlationIds: params.correlationIds
    });
  }

  /**
   * Calculate generation from parent tokens
   */
  private static calculateGeneration(parentTokenIds: string[]): number {
    if (parentTokenIds.length === 0) return 0; // Source tokens

    // Extract generation from parent IDs (assumes format: nodeId_gN_hash)
    const parentGenerations = parentTokenIds.map(id => {
      const match = id.match(/_g(\d+)_/);
      return match ? parseInt(match[1], 10) : 0;
    });

    return Math.max(...parentGenerations) + 1;
  }

  /**
   * Normalize transformation data for consistent hashing
   */
  private static normalizeTransformationData(data: any): any {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;

    // Sort object keys to ensure consistent ordering
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeTransformationData(item));
    }

    const normalized: any = {};
    Object.keys(data).sort().forEach(key => {
      normalized[key] = this.normalizeTransformationData(data[key]);
    });

    return normalized;
  }

  /**
   * Generate deterministic hash from object
   */
  private static generateHash(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Usage Examples:
 */

// DataSource token
const sourceToken = TokenIdGenerator.generateForDataSource({
  nodeId: 'order_source',
  timestamp: 1000,
  data: { orderId: 'ORD-001', action: 'approve' },
  correlationIds: ['corr_12345_1000']
});
// Result: order_source_g0_a1b2c3d4

// FSM transition token
const fsmToken = TokenIdGenerator.generateForFSM({
  nodeId: 'order_fsm',
  timestamp: 1001,
  parentTokenId: 'order_source_g0_a1b2c3d4',
  fromState: 'pending',
  toState: 'approved',
  trigger: 'approve',
  correlationIds: ['corr_12345_1000']
});
// Result: order_fsm_g1_b2c3d4e5

// Aggregator token (deterministic regardless of input order)
const aggToken = TokenIdGenerator.generateForAggregator({
  nodeId: 'order_aggregator',
  timestamp: 1005,
  parentTokenIds: ['ta_g1_hash1', 'tb_g1_hash2', 'tc_g1_hash3'], // Sorted internally
  aggregationType: 'average',
  aggregationValue: 42.5,
  correlationIds: ['corr_12345_1000', 'corr_67890_1001']
});
// Result: order_aggregator_g2_c3d4e5f6 (same regardless of input order)