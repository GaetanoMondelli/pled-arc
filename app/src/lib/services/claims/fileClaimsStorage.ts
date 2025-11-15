/**
 * File-based Claims Storage
 *
 * Implements the ClaimsStorage interface using JSON files on disk.
 * Each claim is stored as a separate JSON file for easy inspection.
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  ClaimsStorage,
} from "./claimsService";
import {
  Claim,
  ClaimSearchCriteria,
  ClaimSearchResult,
  ClaimEvaluationResult,
  ClaimTemplate,
  ClaimInstance,
  ClaimAuditEntry,
  ClaimEvaluationHistory,
} from "../../core/types/claims";

export class FileClaimsStorage implements ClaimsStorage {
  private baseDir: string;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.baseDir = path.join(process.cwd(), 'data', 'claims', this.sanitizeUserId(userId));
  }

  private sanitizeUserId(userId: string): string {
    return userId.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);

      // Convert date strings back to Date objects
      if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
      if (parsed.lastUpdated) parsed.lastUpdated = new Date(parsed.lastUpdated);
      if (parsed.timestamp) parsed.timestamp = new Date(parsed.timestamp);
      if (parsed.evaluatedAt) parsed.evaluatedAt = new Date(parsed.evaluatedAt);

      return parsed as T;
    } catch {
      return null;
    }
  }

  private getClaimFilePath(id: string): string {
    return path.join(this.baseDir, 'claims', `${id}.json`);
  }

  private getEvaluationFilePath(claimId: string, evaluationId: string): string {
    return path.join(this.baseDir, 'evaluations', claimId, `${evaluationId}.json`);
  }

  private getAuditFilePath(claimId: string, auditId: string): string {
    return path.join(this.baseDir, 'audit', claimId, `${auditId}.json`);
  }

  private getTemplateFilePath(id: string): string {
    return path.join(this.baseDir, 'templates', `${id}.json`);
  }

  private getInstanceFilePath(id: string): string {
    return path.join(this.baseDir, 'instances', `${id}.json`);
  }

  async getClaim(id: string): Promise<Claim | null> {
    return await this.readJsonFile<Claim>(this.getClaimFilePath(id));
  }

  async getAllClaims(): Promise<Claim[]> {
    const claimsDir = path.join(this.baseDir, 'claims');

    try {
      await this.ensureDirectoryExists(claimsDir);
      const files = await fs.readdir(claimsDir);
      const claims: Claim[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const claim = await this.readJsonFile<Claim>(path.join(claimsDir, file));
          if (claim) {
            claims.push(claim);
          }
        }
      }

      // Sort by lastUpdated descending
      return claims.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    } catch {
      return [];
    }
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

    await this.writeJsonFile(this.getClaimFilePath(id), claim);

    // Add audit entry
    await this.addAuditEntry({
      claimId: id,
      action: 'created',
      userId: claim.createdBy,
      reason: 'New claim created',
    });

    return claim;
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim> {
    const existing = await this.getClaim(id);
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

    await this.writeJsonFile(this.getClaimFilePath(id), updated);

    // Add audit entry
    await this.addAuditEntry({
      claimId: id,
      action: 'updated',
      userId: updates.modifiedBy || 'system',
      changes: this.computeChanges(existing, updated),
    });

    return updated;
  }

  async deleteClaim(id: string): Promise<void> {
    const claim = await this.getClaim(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    try {
      await fs.unlink(this.getClaimFilePath(id));
    } catch (error) {
      throw new Error(`Failed to delete claim file: ${error}`);
    }

    // Add audit entry
    await this.addAuditEntry({
      claimId: id,
      action: 'deleted',
      userId: 'system',
    });
  }

  async searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult> {
    let claims = await this.getAllClaims();

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
    const evaluationId = `${result.claimId}-${result.evaluatedAt.getTime()}`;
    await this.writeJsonFile(this.getEvaluationFilePath(result.claimId, evaluationId), result);

    // Update claim status based on evaluation
    const claim = await this.getClaim(result.claimId);
    if (claim && claim.status !== result.status) {
      await this.updateClaim(result.claimId, {
        status: result.status,
        modifiedBy: 'system',
      });
    }
  }

  async getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory> {
    const evaluationsDir = path.join(this.baseDir, 'evaluations', claimId);
    const evaluations: ClaimEvaluationResult[] = [];

    try {
      await this.ensureDirectoryExists(evaluationsDir);
      const files = await fs.readdir(evaluationsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const evaluation = await this.readJsonFile<ClaimEvaluationResult>(path.join(evaluationsDir, file));
          if (evaluation) {
            evaluations.push(evaluation);
          }
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }

    // Sort by evaluation date descending
    evaluations.sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());

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
        lastEvaluation: evaluations.length > 0 ? evaluations[0].evaluatedAt : undefined,
        trendDirection: this.calculateTrend(evaluations),
      },
    };
  }

  async addAuditEntry(entryData: Omit<ClaimAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: ClaimAuditEntry = {
      ...entryData,
      id: auditId,
      timestamp: new Date(),
    };

    await this.writeJsonFile(this.getAuditFilePath(entryData.claimId, auditId), entry);
  }

  async getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]> {
    const auditDir = path.join(this.baseDir, 'audit', claimId);
    const auditEntries: ClaimAuditEntry[] = [];

    try {
      await this.ensureDirectoryExists(auditDir);
      const files = await fs.readdir(auditDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const entry = await this.readJsonFile<ClaimAuditEntry>(path.join(auditDir, file));
          if (entry) {
            auditEntries.push(entry);
          }
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }

    // Sort by timestamp descending
    return auditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async saveTemplate(template: ClaimTemplate): Promise<void> {
    await this.writeJsonFile(this.getTemplateFilePath(template.id), template);
  }

  async getTemplate(id: string): Promise<ClaimTemplate | null> {
    return await this.readJsonFile<ClaimTemplate>(this.getTemplateFilePath(id));
  }

  async createInstance(instanceData: Omit<ClaimInstance, 'id' | 'createdAt'>): Promise<ClaimInstance> {
    const id = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const instance: ClaimInstance = {
      ...instanceData,
      id,
      createdAt: new Date(),
    };

    await this.writeJsonFile(this.getInstanceFilePath(id), instance);
    return instance;
  }

  // Helper method to get the file path for a claim (for UI inspection)
  getClaimJsonPath(claimId: string): string {
    return this.getClaimFilePath(claimId);
  }

  // Helper methods
  private generateClaimId(parentId?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);

    if (!parentId) {
      // Generate simple sequential ID for top-level claims
      return `claim-${timestamp}-${random}`;
    }

    return `${parentId}.${timestamp}-${random}`;
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

    const recent = evaluations.slice(0, 5); // Last 5 evaluations (already sorted desc)
    const passCount = recent.filter(e => e.status === 'passed').length;
    const totalRecent = recent.length;

    const older = evaluations.slice(5, 10); // Previous 5 evaluations
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