/**
 * Claims System Types
 *
 * Defines the structure for compliance tracking, audit trails, and evidence aggregation
 * across workflow instances and sink data.
 */

// ============================================================================
// CORE CLAIM TYPES
// ============================================================================

/**
 * Core claim structure for tracking compliance and evidence
 */
export interface Claim {
  id: string;                        // Hierarchical ID: "1.3.1", "1.3.1.7"
  title: string;                     // "Foundation Safety Compliance"
  description: string;               // Human-readable explanation
  owner?: string;                    // User responsible for this claim
  resources: string[];               // Links to docs, templates, procedures
  references: string[];              // External standards, regulations
  formula: ClaimFormula;             // How the claim is calculated/validated
  childClaimIds?: string[];          // ["1.3.1.1", "1.3.1.2"] for aggregates
  parentClaimId?: string;            // "1.3" for hierarchical structure
  status: ClaimStatus;               // Current state
  lastUpdated: Date;
  createdAt: Date;
  createdBy: string;
  modifiedBy?: string;
  tags?: string[];                   // For categorization and filtering
  metadata?: Record<string, any>;    // Additional custom data
  templateId?: string;               // Template ID for sink state monitoring
  executionId?: string;              // Execution ID for sink state monitoring

  // Sink Aggregation Fields
  aggregatedValue?: any;             // Computed value from sink aggregation
  aggregationFormula?: AggregationFormula; // How to aggregate sink data
  lastSinkUpdate?: Date;             // When sink data was last processed
  sinks?: string[];                  // Sink node IDs for this claim

  // Tokenization & Verification Fields
  tokenization?: ClaimTokenization;  // Merkle tree proofs and hashes for on-chain verification
}

/**
 * Formula for evaluating claim compliance
 */
export interface ClaimFormula {
  type: ClaimFormulaType;
  sinks: string[];                   // Required sink IDs from workflow instances
  expression?: string;               // For custom JavaScript/DSL formulas
  threshold?: number;                // For THRESHOLD type
  parameters?: Record<string, any>;  // Template parameters
  timeWindow?: TimeWindow;           // Time-based evaluation window
  consumptionPolicy?: ConsumptionPolicy; // How sinks are consumed
}

/**
 * Supported formula evaluation types
 */
export type ClaimFormulaType =
  | 'AND'                           // All sinks must be satisfied
  | 'OR'                            // Any sink satisfies the claim
  | 'THRESHOLD'                     // N out of M sinks must be satisfied
  | 'CUSTOM'                        // Custom JavaScript expression
  | 'WEIGHTED'                      // Weighted sum with threshold
  | 'TEMPORAL'                      // Time-based sequencing requirements
  | 'MAJORITY';                     // >50% of sinks must be satisfied

/**
 * Configuration for aggregating sink data into a single value
 */
export interface AggregationFormula {
  type: AggregationFormulaType;
  customExpression?: string;        // JavaScript expression for custom aggregation
  filterExpression?: string;        // Filter events before aggregation
  parameters?: Record<string, any>; // Additional parameters for aggregation
}

/**
 * Supported aggregation formula types
 */
export type AggregationFormulaType =
  | 'sum'                           // Sum all numeric values
  | 'count'                         // Count number of events
  | 'average'                       // Average of numeric values
  | 'latest'                        // Most recent value
  | 'earliest'                      // Oldest value
  | 'min'                           // Minimum value
  | 'max'                           // Maximum value
  | 'custom';                       // Custom JavaScript aggregation

/**
 * Current status of a claim
 */
export type ClaimStatus =
  | 'pending'                       // Not yet evaluated or insufficient data
  | 'in_progress'                   // Partially satisfied
  | 'passed'                        // All requirements met
  | 'failed'                        // Requirements not met
  | 'expired'                       // Time-based claim expired
  | 'suspended'                     // Temporarily disabled
  | 'under_review';                 // Requires manual verification

/**
 * Time window configuration for temporal claims
 */
export interface TimeWindow {
  startOffset?: number;             // Milliseconds before evaluation time
  endOffset?: number;               // Milliseconds after evaluation time
  duration?: number;                // Fixed duration window
  type: 'sliding' | 'fixed' | 'calendar';
  calendar?: CalendarWindow;        // For calendar-based windows
}

/**
 * Calendar-based time window (e.g., "monthly", "quarterly")
 */
export interface CalendarWindow {
  unit: 'day' | 'week' | 'month' | 'quarter' | 'year';
  offset?: number;                  // Offset from current period
  timezone?: string;                // For timezone-aware calculations
}

/**
 * How sink data is consumed by claims
 */
export type ConsumptionPolicy =
  | 'multi-read'                    // Multiple claims can read the same sink data
  | 'single-use'                    // Sink data can only be used once
  | 'burn-after-read';              // Sink data is deleted after claim evaluation

// ============================================================================
// CLAIM TEMPLATES AND INSTANCES
// ============================================================================

/**
 * Reusable claim template (Claims as Code)
 */
export interface ClaimTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  parameters: ClaimParameter[];
  claimDefinitions: ClaimDefinition[];
  metadata: {
    author: string;
    created: Date;
    tags: string[];
    category: string;
  };
}

/**
 * Template parameter definition
 */
export interface ClaimParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  enumValues?: string[];
  validation?: string;              // Validation expression
}

/**
 * Claim definition within a template
 */
export interface ClaimDefinition {
  id: string;
  title: string;
  description: string;
  formula: ClaimFormula;
  visualization?: VisualizationConfig;
  dependencies?: string[];          // Other claim IDs this depends on
}

/**
 * Instantiated claim from a template
 */
export interface ClaimInstance {
  id: string;
  templateId: string;
  templateVersion: string;
  parameterValues: Record<string, any>;
  claims: Claim[];
  status: ClaimInstanceStatus;
  createdAt: Date;
  createdBy: string;
  project?: string;
  environment?: string;
}

/**
 * Status of a claim instance
 */
export type ClaimInstanceStatus =
  | 'active'
  | 'completed'
  | 'failed'
  | 'archived';

// ============================================================================
// VISUALIZATION AND DASHBOARD TYPES
// ============================================================================

/**
 * Configuration for how a claim should be visualized
 */
export interface VisualizationConfig {
  type: VisualizationType;
  title?: string;
  description?: string;
  config: Record<string, any>;      // Type-specific configuration
  refreshInterval?: number;         // Auto-refresh in milliseconds
  alertThresholds?: AlertThreshold[];
}

/**
 * Supported visualization types for claims
 */
export type VisualizationType =
  | 'checklist'                     // Simple pass/fail checklist
  | 'gauge'                         // Circular gauge with threshold
  | 'progress-bar'                  // Linear progress indicator
  | 'time-series'                   // Line chart over time
  | 'bar-chart'                     // Bar chart for comparisons
  | 'pie-chart'                     // Pie chart for distributions
  | 'table'                         // Tabular data display
  | 'timeline'                      // Gantt-style timeline
  | 'heatmap'                       // Grid-based heat map
  | 'status-indicator'              // Simple status badge
  | 'error-dashboard';              // Error count and breakdown

/**
 * Alert threshold configuration
 */
export interface AlertThreshold {
  level: 'info' | 'warning' | 'error' | 'critical';
  condition: string;                // Expression to evaluate
  message: string;
  actions?: AlertAction[];
}

/**
 * Actions to take when alert is triggered
 */
export interface AlertAction {
  type: 'email' | 'webhook' | 'notification' | 'escalation';
  config: Record<string, any>;
}

/**
 * Dashboard configuration
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  claimWidgets: ClaimWidget[];
  textBlocks: TextBlock[];
  permissions?: DashboardPermissions;
  metadata: {
    author: string;
    created: Date;
    lastModified: Date;
    tags: string[];
  };
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  type: 'grid' | 'flow' | 'custom';
  columns?: number;
  gap?: number;
  responsive?: boolean;
}

/**
 * Widget displaying claim information
 */
export interface ClaimWidget {
  id: string;
  claimId: string;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  size: WidgetSize;
  title?: string;
  showTitle?: boolean;
}

/**
 * Static text block in dashboard
 */
export interface TextBlock {
  id: string;
  content: string;                  // Markdown content
  position: WidgetPosition;
  size: WidgetSize;
  style?: TextBlockStyle;
}

/**
 * Widget positioning
 */
export interface WidgetPosition {
  row: number;
  column: number;
  zIndex?: number;
}

/**
 * Widget sizing
 */
export interface WidgetSize {
  width: number;                    // Grid units or pixels
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Text block styling
 */
export interface TextBlockStyle {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  padding?: string;
  margin?: string;
  border?: string;
  borderRadius?: string;
}

/**
 * Dashboard access permissions
 */
export interface DashboardPermissions {
  public: boolean;
  allowedUsers?: string[];
  allowedRoles?: string[];
  editPermissions?: string[];
}

// ============================================================================
// EVALUATION AND MONITORING TYPES
// ============================================================================

/**
 * Result of claim evaluation
 */
export interface ClaimEvaluationResult {
  claimId: string;
  status: ClaimStatus;
  score?: number;                   // 0-1 or custom scoring
  evidence: Evidence[];
  evaluatedAt: Date;
  evaluationDuration: number;       // Milliseconds
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Evidence supporting or contradicting a claim
 */
export interface Evidence {
  id: string;
  sinkId: string;
  workflowInstanceId: string;
  tokenId: string;
  value: any;
  timestamp: Date;
  weight?: number;                  // For weighted evaluations
  confidence?: number;              // 0-1 confidence score
  metadata?: Record<string, any>;
}

/**
 * Claim monitoring configuration
 */
export interface ClaimMonitorConfig {
  claimId: string;
  enabled: boolean;
  evaluationInterval: number;       // Milliseconds
  alertConfig?: AlertConfig;
  retentionDays?: number;           // How long to keep evaluation history
  webhooks?: WebhookConfig[];
}

/**
 * Alert configuration for claims
 */
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  escalationPolicy?: EscalationPolicy;
  quietHours?: QuietHours;
}

/**
 * Alert delivery channel
 */
export interface AlertChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'sms';
  config: Record<string, any>;
  targets: string[];                // Email addresses, webhooks, etc.
}

/**
 * Alert escalation policy
 */
export interface EscalationPolicy {
  levels: EscalationLevel[];
}

/**
 * Individual escalation level
 */
export interface EscalationLevel {
  delayMinutes: number;
  channels: AlertChannel[];
  condition?: string;               // Only escalate if condition is met
}

/**
 * Quiet hours for alert suppression
 */
export interface QuietHours {
  enabled: boolean;
  timezone: string;
  start: string;                    // HH:MM format
  end: string;                      // HH:MM format
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
}

/**
 * Webhook configuration for external integrations
 */
export interface WebhookConfig {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  payload?: string;                 // Template for payload
  retryConfig?: WebhookRetryConfig;
}

/**
 * Webhook retry configuration
 */
export interface WebhookRetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

// ============================================================================
// AUDIT AND HISTORY TYPES
// ============================================================================

/**
 * Audit trail entry for claim changes
 */
export interface ClaimAuditEntry {
  id: string;
  claimId: string;
  action: ClaimAuditAction;
  timestamp: Date;
  userId: string;
  changes?: Record<string, { before: any; after: any }>;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Types of auditable actions on claims
 */
export type ClaimAuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'evaluated'
  | 'status_changed'
  | 'formula_modified'
  | 'owner_assigned'
  | 'owner_removed'
  | 'archived'
  | 'restored';

/**
 * Historical evaluation record
 */
export interface ClaimEvaluationHistory {
  claimId: string;
  evaluations: ClaimEvaluationResult[];
  summary: {
    totalEvaluations: number;
    passRate: number;               // Percentage of passed evaluations
    failRate: number;
    averageScore?: number;
    lastEvaluation?: Date;
    trendDirection: 'improving' | 'declining' | 'stable';
  };
}

// ============================================================================
// SEARCH AND FILTERING TYPES
// ============================================================================

/**
 * Search criteria for claims
 */
export interface ClaimSearchCriteria {
  query?: string;                   // Text search in title/description
  status?: ClaimStatus[];
  owner?: string[];
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  lastUpdatedAfter?: Date;
  lastUpdatedBefore?: Date;
  formulaType?: ClaimFormulaType[];
  hasChildren?: boolean;
  hasParent?: boolean;
  sortBy?: ClaimSortField;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Sortable fields for claims
 */
export type ClaimSortField =
  | 'title'
  | 'status'
  | 'createdAt'
  | 'lastUpdated'
  | 'owner'
  | 'id';

/**
 * Search result with pagination
 */
export interface ClaimSearchResult {
  claims: Claim[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets?: ClaimSearchFacets;
}

/**
 * Search facets for filtering
 */
export interface ClaimSearchFacets {
  status: Record<ClaimStatus, number>;
  formulaType: Record<ClaimFormulaType, number>;
  tags: Record<string, number>;
  owners: Record<string, number>;
}

// ============================================================================
// TOKENIZATION AND VERIFICATION TYPES
// ============================================================================

/**
 * Tokenization data for converting claims into verifiable, on-chain assets
 */
export interface ClaimTokenization {
  // Full Execution Ledger Merkle Tree
  fullLedgerMerkleRoot: string;      // Root hash of ALL execution events
  fullLedgerEventCount: number;      // Total number of events in full ledger

  // Sink-Specific Merkle Tree
  sinkMerkleRoot: string;            // Root hash of ONLY this sink's events
  sinkEventCount: number;            // Number of events in this sink
  sinkEventHashes: string[];         // Individual event hashes for this sink

  // Inclusion Proofs (proves sink events are subset of full ledger)
  inclusionProofs?: MerkleProof[];   // Proof that each sink event exists in full ledger

  // NFT-like Metadata for Tokenization
  tokenMetadata: ClaimTokenMetadata;

  // On-chain Information (if minted)
  onChain?: OnChainClaimData;

  // Verification Status
  verified: boolean;                 // Whether the claim has been cryptographically verified
  verifiedAt?: Date;                 // When verification occurred
  verificationMethod?: 'local' | 'on-chain' | 'oracle';
}

/**
 * Merkle proof for proving event inclusion
 */
export interface MerkleProof {
  eventHash: string;                 // Hash of the event being proven
  proof: string[];                   // Array of sibling hashes to reconstruct root
  path: number[];                    // Binary path (0=left, 1=right) up the tree
  root: string;                      // Expected root hash
  verified?: boolean;                // Verification result
}

/**
 * NFT-like metadata for tokenized claims
 */
export interface ClaimTokenMetadata {
  // Standard NFT Fields
  name: string;                      // e.g., "Foundation Safety Compliance Claim #123"
  description: string;               // Human-readable claim description
  image?: string;                    // IPFS/URL to visual representation
  externalUrl?: string;              // Link to claim details page

  // Claim-Specific Attributes
  attributes: ClaimAttribute[];      // Key-value pairs like NFT traits

  // Provenance
  issuer: string;                    // Who issued/created this claim
  issuedAt: Date;                    // Timestamp of issuance
  expiresAt?: Date;                  // Optional expiration

  // Verification Data
  aggregateValue: any;               // The computed/aggregated claim value
  workflowId: string;                // Template/workflow that generated this
  executionId: string;               // Specific execution instance
  sinkIds: string[];                 // Sink node IDs involved

  // Content Addressing
  metadataIpfsHash?: string;         // IPFS hash of this metadata
  ledgerIpfsHash?: string;           // IPFS hash of full ledger data
}

/**
 * NFT-style attribute (trait) for claim metadata
 */
export interface ClaimAttribute {
  traitType: string;                 // e.g., "Compliance Score", "Risk Level"
  value: any;                        // Trait value
  displayType?: 'number' | 'boost_percentage' | 'boost_number' | 'date' | 'string';
  maxValue?: number;                 // For ranged values
}

/**
 * On-chain data for minted claim tokens
 */
export interface OnChainClaimData {
  contractAddress: string;           // Smart contract address
  tokenId: string;                   // NFT token ID
  blockchain: string;                // e.g., "arc-testnet", "ethereum", "polygon"
  txHash: string;                    // Minting transaction hash
  mintedAt: Date;                    // When minted on-chain
  ownerAddress: string;              // Current owner wallet address
  walletId?: string;                 // Circle wallet ID used for minting (for syncing)

  // Contract Interaction
  standard: 'ERC721' | 'ERC1155' | 'custom';

  // Verification
  merkleRootOnChain: string;         // Merkle root stored in contract
  verificationMethod?: string;       // How to verify (function signature)

  // Sync State (for Incremental Merkle Trees)
  onChainLedgerEventCount: number;   // Number of ledger events stored on-chain
  onChainSinkEventCount: number;     // Number of sink events stored on-chain
  onChainAggregateValue?: string;    // Last known aggregate value on-chain
  lastOnChainUpdate?: Date;          // When appendEvents() was last called
  lastSyncCheck?: Date;              // When we last checked sync status

  // Explorer Links
  blockExplorerUrl?: string;         // Full URL to view token on block explorer
}

/**
 * Service for building Merkle trees from ledger events
 */
export interface MerkleTreeBuilder {
  buildFullLedgerTree(events: any[]): MerkleTree;
  buildSinkTree(sinkEvents: any[]): MerkleTree;
  generateInclusionProof(event: any, fullTree: MerkleTree): MerkleProof;
  verifyProof(proof: MerkleProof): boolean;
}

/**
 * Merkle tree structure
 */
export interface MerkleTree {
  root: string;                      // Root hash
  leaves: string[];                  // Leaf hashes (bottom layer)
  layers: string[][];                // All layers of the tree
  depth: number;                     // Tree depth
  eventCount: number;                // Number of events
}

/**
 * Options for tokenizing a claim
 */
export interface TokenizeClaimOptions {
  includeProofs?: boolean;           // Whether to generate inclusion proofs (expensive)
  uploadToIpfs?: boolean;            // Whether to upload metadata to IPFS
  mintOnChain?: boolean;             // Whether to mint as on-chain NFT
  blockchain?: string;               // Target blockchain for minting
  attributes?: ClaimAttribute[];     // Additional custom attributes
}

/**
 * Result of claim tokenization process
 */
export interface TokenizeClaimResult {
  claim: Claim;                      // Updated claim with tokenization data
  tokenization: ClaimTokenization;   // Generated tokenization data
  ipfsHashes?: {
    metadata: string;
    ledger?: string;
  };
  onChainTx?: {
    txHash: string;
    tokenId: string;
    contractAddress: string;
  };
  verificationUrl?: string;          // URL for off-chain verification
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default values for claims system
 */
export const CLAIM_DEFAULTS = {
  EVALUATION: {
    TIMEOUT_MS: 30000,              // 30 seconds
    RETRY_COUNT: 3,
    BATCH_SIZE: 100,
  },
  MONITORING: {
    DEFAULT_INTERVAL_MS: 300000,    // 5 minutes
    MAX_HISTORY_DAYS: 90,
    ALERT_DEBOUNCE_MS: 60000,       // 1 minute
  },
  VISUALIZATION: {
    REFRESH_INTERVAL_MS: 30000,     // 30 seconds
    CHART_COLORS: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'],
  },
  SEARCH: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

/**
 * Well-known claim categories
 */
export const CLAIM_CATEGORIES = {
  COMPLIANCE: 'compliance',
  QUALITY: 'quality',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  FINANCIAL: 'financial',
  OPERATIONAL: 'operational',
  ENVIRONMENTAL: 'environmental',
  SAFETY: 'safety',
} as const;

export type ClaimCategory = typeof CLAIM_CATEGORIES[keyof typeof CLAIM_CATEGORIES];