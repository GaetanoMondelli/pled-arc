/**
 * Claims Service
 *
 * Provides CRUD operations and business logic for claims management.
 * Acts as a data access layer and business logic processor for the claims system.
 */

import {
  Claim,
  ClaimSearchCriteria,
  ClaimSearchResult,
  ClaimEvaluationResult,
  ClaimTemplate,
  ClaimInstance,
  Evidence,
  ClaimStatus,
  ClaimAuditEntry,
  ClaimEvaluationHistory,
} from '../../core/types/claims';

// ============================================================================
// DATA STORAGE INTERFACE
// ============================================================================

/**
 * Storage interface for claims persistence
 * Can be implemented with localStorage, IndexedDB, or remote API
 */
export interface ClaimsStorage {
  // Claims CRUD
  getClaim(id: string): Promise<Claim | null>;
  getAllClaims(): Promise<Claim[]>;
  createClaim(claim: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Claim>;
  updateClaim(id: string, updates: Partial<Claim>): Promise<Claim>;
  deleteClaim(id: string): Promise<void>;

  // Search and filtering
  searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult>;

  // Evaluation results
  saveEvaluationResult(result: ClaimEvaluationResult): Promise<void>;
  getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory>;

  // Audit trail
  addAuditEntry(entry: Omit<ClaimAuditEntry, 'id' | 'timestamp'>): Promise<void>;
  getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]>;

  // Templates and instances
  saveTemplate(template: ClaimTemplate): Promise<void>;
  getTemplate(id: string): Promise<ClaimTemplate | null>;
  createInstance(instance: Omit<ClaimInstance, 'id' | 'createdAt'>): Promise<ClaimInstance>;
}

// ============================================================================
// IN-MEMORY STORAGE IMPLEMENTATION
// ============================================================================

/**
 * Simple in-memory storage implementation for development/testing
 */
export class InMemoryClaimsStorage implements ClaimsStorage {
  private claims = new Map<string, Claim>();
  private evaluationResults = new Map<string, ClaimEvaluationResult[]>();
  private auditEntries = new Map<string, ClaimAuditEntry[]>();
  private templates = new Map<string, ClaimTemplate>();
  private instances = new Map<string, ClaimInstance>();

  async getClaim(id: string): Promise<Claim | null> {
    return this.claims.get(id) || null;
  }

  async getAllClaims(): Promise<Claim[]> {
    return Array.from(this.claims.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  async createClaim(claimData: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Claim> {
    const id = this.generateClaimId(claimData.parentClaimId);
    const now = new Date();

    const claim: Claim = {
      ...claimData,
      id,
      createdAt: now,
      lastUpdated: now,
    };

    this.claims.set(id, claim);

    await this.addAuditEntry({
      claimId: id,
      action: 'created',
      userId: claim.createdBy,
      reason: 'New claim created',
    });

    return claim;
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim> {
    const existing = this.claims.get(id);
    if (!existing) {
      throw new Error(`Claim ${id} not found`);
    }

    const updated: Claim = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation date
      lastUpdated: new Date(),
    };

    this.claims.set(id, updated);

    await this.addAuditEntry({
      claimId: id,
      action: 'updated',
      userId: updates.modifiedBy || 'system',
      changes: this.computeChanges(existing, updated),
    });

    return updated;
  }

  async deleteClaim(id: string): Promise<void> {
    const claim = this.claims.get(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    this.claims.delete(id);

    await this.addAuditEntry({
      claimId: id,
      action: 'deleted',
      userId: 'system', // TODO: Get from context
    });
  }

  async searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult> {
    let claims = Array.from(this.claims.values());

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      claims = claims.filter(claim =>
        claim.title.toLowerCase().includes(query) ||
        claim.description.toLowerCase().includes(query) ||
        claim.id.toLowerCase().includes(query)
      );
    }

    if (criteria.status && criteria.status.length > 0) {
      claims = claims.filter(claim => criteria.status!.includes(claim.status));
    }

    if (criteria.owner && criteria.owner.length > 0) {
      claims = claims.filter(claim =>
        claim.owner && criteria.owner!.includes(claim.owner)
      );
    }

    if (criteria.tags && criteria.tags.length > 0) {
      claims = claims.filter(claim =>
        claim.tags && criteria.tags!.some(tag => claim.tags!.includes(tag))
      );
    }

    if (criteria.createdAfter) {
      claims = claims.filter(claim => claim.createdAt >= criteria.createdAfter!);
    }

    if (criteria.createdBefore) {
      claims = claims.filter(claim => claim.createdAt <= criteria.createdBefore!);
    }

    if (criteria.formulaType && criteria.formulaType.length > 0) {
      claims = claims.filter(claim =>
        criteria.formulaType!.includes(claim.formula.type)
      );
    }

    if (criteria.hasChildren !== undefined) {
      claims = claims.filter(claim =>
        (claim.childClaimIds && claim.childClaimIds.length > 0) === criteria.hasChildren
      );
    }

    if (criteria.hasParent !== undefined) {
      claims = claims.filter(claim =>
        !!claim.parentClaimId === criteria.hasParent
      );
    }

    // Apply sorting
    if (criteria.sortBy) {
      claims.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (criteria.sortBy) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'createdAt':
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case 'lastUpdated':
            aValue = a.lastUpdated;
            bValue = b.lastUpdated;
            break;
          case 'owner':
            aValue = a.owner || '';
            bValue = b.owner || '';
            break;
          case 'id':
          default:
            aValue = a.id;
            bValue = b.id;
            break;
        }

        if (aValue < bValue) return criteria.sortOrder === 'desc' ? 1 : -1;
        if (aValue > bValue) return criteria.sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // Apply pagination
    const total = claims.length;
    const limit = criteria.limit || 20;
    const offset = criteria.offset || 0;
    const paginatedClaims = claims.slice(offset, offset + limit);

    return {
      claims: paginatedClaims,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async saveEvaluationResult(result: ClaimEvaluationResult): Promise<void> {
    if (!this.evaluationResults.has(result.claimId)) {
      this.evaluationResults.set(result.claimId, []);
    }

    this.evaluationResults.get(result.claimId)!.push(result);

    // Update claim status based on evaluation
    const claim = this.claims.get(result.claimId);
    if (claim && claim.status !== result.status) {
      await this.updateClaim(result.claimId, {
        status: result.status,
        modifiedBy: 'system',
      });

      await this.addAuditEntry({
        claimId: result.claimId,
        action: 'status_changed',
        userId: 'system',
        metadata: {
          newStatus: result.status,
          evaluationId: result.claimId + '-' + result.evaluatedAt.getTime(),
        },
      });
    }
  }

  async getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory> {
    const evaluations = this.evaluationResults.get(claimId) || [];

    const passCount = evaluations.filter(e => e.status === 'passed').length;
    const failCount = evaluations.filter(e => e.status === 'failed').length;
    const total = evaluations.length;

    return {
      claimId,
      evaluations,
      summary: {
        totalEvaluations: total,
        passRate: total > 0 ? (passCount / total) * 100 : 0,
        failRate: total > 0 ? (failCount / total) * 100 : 0,
        lastEvaluation: evaluations.length > 0 ?
          evaluations[evaluations.length - 1].evaluatedAt : undefined,
        trendDirection: this.calculateTrend(evaluations),
      },
    };
  }

  async addAuditEntry(entryData: Omit<ClaimAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const entry: ClaimAuditEntry = {
      ...entryData,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    if (!this.auditEntries.has(entryData.claimId)) {
      this.auditEntries.set(entryData.claimId, []);
    }

    this.auditEntries.get(entryData.claimId)!.push(entry);
  }

  async getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]> {
    return this.auditEntries.get(claimId) || [];
  }

  async saveTemplate(template: ClaimTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async getTemplate(id: string): Promise<ClaimTemplate | null> {
    return this.templates.get(id) || null;
  }

  async createInstance(instanceData: Omit<ClaimInstance, 'id' | 'createdAt'>): Promise<ClaimInstance> {
    const id = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const instance: ClaimInstance = {
      ...instanceData,
      id,
      createdAt: new Date(),
    };

    this.instances.set(id, instance);
    return instance;
  }

  // Helper methods
  private generateClaimId(parentId?: string): string {
    if (!parentId) {
      // Generate top-level claim ID
      const existingIds = Array.from(this.claims.keys())
        .filter(id => !id.includes('.'))
        .map(id => parseInt(id))
        .filter(num => !isNaN(num));

      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      return nextId.toString();
    }

    // Generate child claim ID
    const parentClaims = Array.from(this.claims.keys())
      .filter(id => id.startsWith(parentId + '.'))
      .map(id => {
        const parts = id.split('.');
        return parseInt(parts[parts.length - 1]);
      })
      .filter(num => !isNaN(num));

    const nextChildId = parentClaims.length > 0 ? Math.max(...parentClaims) + 1 : 1;
    return `${parentId}.${nextChildId}`;
  }

  private computeChanges(before: Claim, after: Claim): Record<string, { before: any; after: any }> {
    const changes: Record<string, { before: any; after: any }> = {};

    // Compare key fields
    const fieldsToTrack: (keyof Claim)[] = [
      'title', 'description', 'status', 'owner', 'formula', 'resources', 'references', 'tags'
    ];

    for (const field of fieldsToTrack) {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
        changes[field] = {
          before: before[field],
          after: after[field],
        };
      }
    }

    return changes;
  }

  private calculateTrend(evaluations: ClaimEvaluationResult[]): 'improving' | 'declining' | 'stable' {
    if (evaluations.length < 2) return 'stable';

    const recent = evaluations.slice(-5); // Look at last 5 evaluations
    const passCount = recent.filter(e => e.status === 'passed').length;
    const totalRecent = recent.length;

    const older = evaluations.slice(-10, -5); // Previous 5 evaluations
    if (older.length === 0) return 'stable';

    const olderPassCount = older.filter(e => e.status === 'passed').length;
    const totalOlder = older.length;

    const recentPassRate = passCount / totalRecent;
    const olderPassRate = olderPassCount / totalOlder;

    const threshold = 0.1; // 10% change threshold

    if (recentPassRate > olderPassRate + threshold) return 'improving';
    if (recentPassRate < olderPassRate - threshold) return 'declining';
    return 'stable';
  }
}

// ============================================================================
// CLAIMS SERVICE
// ============================================================================

/**
 * Main claims service providing business logic and data operations
 */
export class ClaimsService {
  private storage: ClaimsStorage;
  private currentUser: string = 'anonymous'; // TODO: Get from auth context

  constructor(storage: ClaimsStorage = new InMemoryClaimsStorage()) {
    this.storage = storage;
  }

  setCurrentUser(userId: string): void {
    this.currentUser = userId;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async createClaim(claimData: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated' | 'createdBy'>): Promise<Claim> {
    // Validate claim data
    this.validateClaimData(claimData);

    return await this.storage.createClaim({
      ...claimData,
      createdBy: this.currentUser,
    });
  }

  async getClaim(id: string): Promise<Claim | null> {
    return await this.storage.getClaim(id);
  }

  async updateClaim(id: string, updates: Partial<Omit<Claim, 'id' | 'createdAt' | 'createdBy'>>): Promise<Claim> {
    const existing = await this.storage.getClaim(id);
    if (!existing) {
      throw new Error(`Claim ${id} not found`);
    }

    // Add modification metadata
    const updatesWithMetadata = {
      ...updates,
      modifiedBy: this.currentUser,
    };

    return await this.storage.updateClaim(id, updatesWithMetadata);
  }

  async deleteClaim(id: string): Promise<void> {
    const claim = await this.storage.getClaim(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    // Check if claim has children
    if (claim.childClaimIds && claim.childClaimIds.length > 0) {
      throw new Error(`Cannot delete claim ${id} - it has child claims. Delete children first.`);
    }

    await this.storage.deleteClaim(id);
  }

  async searchClaims(criteria: ClaimSearchCriteria = {}): Promise<ClaimSearchResult> {
    return await this.storage.searchClaims(criteria);
  }

  async getAllClaims(): Promise<Claim[]> {
    return await this.storage.getAllClaims();
  }

  // ============================================================================
  // CLAIM HIERARCHY OPERATIONS
  // ============================================================================

  async getClaimHierarchy(): Promise<ClaimHierarchyNode[]> {
    const allClaims = await this.getAllClaims();
    return this.buildHierarchy(allClaims);
  }

  async getClaimChildren(parentId: string): Promise<Claim[]> {
    const parent = await this.getClaim(parentId);
    if (!parent || !parent.childClaimIds) {
      return [];
    }

    const children: Claim[] = [];
    for (const childId of parent.childClaimIds) {
      const child = await this.getClaim(childId);
      if (child) {
        children.push(child);
      }
    }

    return children.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getClaimAncestors(claimId: string): Promise<Claim[]> {
    const ancestors: Claim[] = [];
    let current = await this.getClaim(claimId);

    while (current && current.parentClaimId) {
      const parent = await this.getClaim(current.parentClaimId);
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  // ============================================================================
  // EVALUATION OPERATIONS
  // ============================================================================

  async evaluateClaim(claimId: string): Promise<ClaimEvaluationResult> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const startTime = Date.now();

    try {
      // TODO: Implement actual claim evaluation logic
      // This would integrate with the sink processors and workflow engine
      const mockResult: ClaimEvaluationResult = {
        claimId,
        status: 'pending', // Default status for now
        evidence: [],
        evaluatedAt: new Date(),
        evaluationDuration: Date.now() - startTime,
      };

      await this.storage.saveEvaluationResult(mockResult);
      return mockResult;
    } catch (error) {
      const errorResult: ClaimEvaluationResult = {
        claimId,
        status: 'failed',
        evidence: [],
        evaluatedAt: new Date(),
        evaluationDuration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
      };

      await this.storage.saveEvaluationResult(errorResult);
      return errorResult;
    }
  }

  async getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory> {
    return await this.storage.getEvaluationHistory(claimId);
  }

  // ============================================================================
  // AUDIT OPERATIONS
  // ============================================================================

  async getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]> {
    return await this.storage.getAuditTrail(claimId);
  }

  // ============================================================================
  // VALIDATION AND HELPERS
  // ============================================================================

  private validateClaimData(claimData: any): void {
    if (!claimData.title || claimData.title.trim().length === 0) {
      throw new Error('Claim title is required');
    }

    if (!claimData.formula) {
      throw new Error('Claim formula is required');
    }

    if (!claimData.formula.type) {
      throw new Error('Claim formula type is required');
    }

    if (!Array.isArray(claimData.formula.sinks)) {
      throw new Error('Claim formula must specify sinks array');
    }

    // Validate hierarchical ID format if parent is specified
    if (claimData.parentClaimId && !/^\d+(\.\d+)*$/.test(claimData.parentClaimId)) {
      throw new Error('Invalid parent claim ID format. Must be hierarchical (e.g., "1.3.2")');
    }
  }

  private buildHierarchy(claims: Claim[]): ClaimHierarchyNode[] {
    const nodeMap = new Map<string, ClaimHierarchyNode>();

    // Create nodes for all claims
    for (const claim of claims) {
      nodeMap.set(claim.id, {
        claim,
        children: [],
      });
    }

    // Build parent-child relationships
    const roots: ClaimHierarchyNode[] = [];
    for (const claim of claims) {
      const node = nodeMap.get(claim.id)!;

      if (claim.parentClaimId) {
        const parent = nodeMap.get(claim.parentClaimId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphaned claim (parent not found) - treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    // Sort children by ID
    for (const node of nodeMap.values()) {
      node.children.sort((a, b) => a.claim.id.localeCompare(b.claim.id));
    }

    // Sort roots by ID
    roots.sort((a, b) => a.claim.id.localeCompare(b.claim.id));

    return roots;
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface ClaimHierarchyNode {
  claim: Claim;
  children: ClaimHierarchyNode[];
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a claims service with appropriate storage based on environment
 */
export function createClaimsService(userId?: string): ClaimsService {
  if (userId && typeof window === 'undefined') {
    // Server-side with user ID - use Firebase
    try {
      const { FirebaseClaimsStorage } = require('./firebaseClaimsStorage');
      return new ClaimsService(new FirebaseClaimsStorage(userId));
    } catch (error) {
      console.warn('Firebase not available, falling back to in-memory storage:', error);
      return new ClaimsService(new InMemoryClaimsStorage());
    }
  }

  // Client-side or no user - use in-memory storage
  return new ClaimsService(new InMemoryClaimsStorage());
}

/**
 * Create a claims service for a specific user (API-based storage)
 */
export function createUserClaimsService(userId: string): ClaimsService {
  // Use API-based storage for client-side operations
  const { ApiClaimsStorage } = require('./apiClaimsStorage');
  const service = new ClaimsService(new ApiClaimsStorage(userId));
  service.setCurrentUser(userId);
  return service;
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

// Export a default instance for immediate use (in-memory)
export const claimsService = new ClaimsService();

// Export the storage interface for custom implementations
export type { ClaimsStorage };