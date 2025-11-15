/**
 * Firebase Storage Claims Storage
 *
 * Uses Firebase Storage (like templates/executions) instead of Firestore
 * Saves claims as JSON files in gs://quantmondelli.appspot.com/pled/claims/
 */

import { ClaimsStorage } from "./claimsService";
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
import { bucket } from '../firebase-storage';

export class FirebaseStorageClaimsStorage implements ClaimsStorage {
  private userId: string;
  private basePath: string;

  constructor(userId: string) {
    this.userId = this.sanitizeUserId(userId);
    this.basePath = `pled/claims/${this.userId}`;
  }

  private sanitizeUserId(userId: string): string {
    // Extract just the username part before @ symbol (gmondelli@example.com -> gmondelli)
    const username = userId.split('@')[0];
    return username.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private generateClaimId(): string {
    return `claim-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private getClaimPath(claimId: string): string {
    return `${this.basePath}/claims/${claimId}.json`;
  }

  private getAuditPath(claimId: string): string {
    return `${this.basePath}/audit/${claimId}.json`;
  }

  private getEvaluationPath(claimId: string): string {
    return `${this.basePath}/evaluations/${claimId}.json`;
  }

  async createClaim(claimData: Partial<Claim>): Promise<Claim> {
    const claimId = this.generateClaimId();
    const now = new Date().toISOString();

    const claim: Claim = {
      id: claimId,
      title: claimData.title || 'Untitled Claim',
      description: claimData.description || '',
      formula: claimData.formula || { type: 'AND', sinks: [] },
      aggregationFormula: claimData.aggregationFormula,
      templateId: claimData.templateId,
      executionId: claimData.executionId,
      status: claimData.status || 'pending',
      owner: claimData.owner,
      createdBy: claimData.createdBy || this.userId,
      tags: claimData.tags || [],
      resources: claimData.resources || [],
      references: claimData.references || [],
      createdAt: now,
      lastUpdated: now,
    };

    // Save to Firebase Storage
    const file = bucket.file(this.getClaimPath(claimId));
    await file.save(JSON.stringify(claim, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });

    console.log(`✅ Claim saved to Firebase Storage: ${this.getClaimPath(claimId)}`);
    return claim;
  }

  async getClaim(id: string): Promise<Claim | null> {
    try {
      const file = bucket.file(this.getClaimPath(id));
      const [exists] = await file.exists();

      if (!exists) {
        return null;
      }

      const [buffer] = await file.download();
      const claim = JSON.parse(buffer.toString()) as Claim;

      console.log(`📋 Claim loaded from Firebase Storage: ${id}`);
      return claim;
    } catch (error) {
      console.error(`❌ Error getting claim ${id}:`, error);
      return null;
    }
  }

  async getAllClaims(): Promise<Claim[]> {
    try {
      const [files] = await bucket.getFiles({
        prefix: `${this.basePath}/claims/`,
      });

      const claims: Claim[] = [];

      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const [buffer] = await file.download();
            const claim = JSON.parse(buffer.toString()) as Claim;
            claims.push(claim);
          } catch (error) {
            console.error(`❌ Error parsing claim file ${file.name}:`, error);
          }
        }
      }

      // Sort by lastUpdated descending
      claims.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

      console.log(`📋 Loaded ${claims.length} claims from Firebase Storage`);
      return claims;
    } catch (error) {
      console.error('❌ Error loading claims:', error);
      return [];
    }
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim | null> {
    const existingClaim = await this.getClaim(id);
    if (!existingClaim) {
      return null;
    }

    const updatedClaim: Claim = {
      ...existingClaim,
      ...updates,
      id: existingClaim.id, // Don't allow ID changes
      createdAt: existingClaim.createdAt, // Don't allow creation time changes
      lastUpdated: new Date().toISOString(),
    };

    const file = bucket.file(this.getClaimPath(id));
    await file.save(JSON.stringify(updatedClaim, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });

    console.log(`✅ Claim updated in Firebase Storage: ${id}`);
    return updatedClaim;
  }

  async deleteClaim(id: string): Promise<boolean> {
    try {
      const claimFile = bucket.file(this.getClaimPath(id));
      const [exists] = await claimFile.exists();

      if (!exists) {
        return false;
      }

      await claimFile.delete();

      // Also delete associated audit and evaluation files if they exist
      try {
        const auditFile = bucket.file(this.getAuditPath(id));
        const [auditExists] = await auditFile.exists();
        if (auditExists) {
          await auditFile.delete();
        }

        const evaluationFile = bucket.file(this.getEvaluationPath(id));
        const [evalExists] = await evaluationFile.exists();
        if (evalExists) {
          await evaluationFile.delete();
        }
      } catch (error) {
        console.warn(`⚠️ Error cleaning up associated files for claim ${id}:`, error);
      }

      console.log(`✅ Claim deleted from Firebase Storage: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting claim ${id}:`, error);
      return false;
    }
  }

  async searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult> {
    const allClaims = await this.getAllClaims();

    // Simple filtering for now - can be enhanced later
    let filteredClaims = allClaims;

    if (criteria.status) {
      filteredClaims = filteredClaims.filter(claim => claim.status === criteria.status);
    }

    if (criteria.owner) {
      filteredClaims = filteredClaims.filter(claim => claim.owner === criteria.owner);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      filteredClaims = filteredClaims.filter(claim =>
        criteria.tags!.some(tag => claim.tags.includes(tag))
      );
    }

    if (criteria.templateId) {
      filteredClaims = filteredClaims.filter(claim => claim.templateId === criteria.templateId);
    }

    if (criteria.executionId) {
      filteredClaims = filteredClaims.filter(claim => claim.executionId === criteria.executionId);
    }

    // Apply pagination
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;
    const paginatedClaims = filteredClaims.slice(offset, offset + limit);

    return {
      claims: paginatedClaims,
      total: filteredClaims.length,
      hasMore: offset + limit < filteredClaims.length,
    };
  }

  // Placeholder implementations for other methods
  async evaluateClaim(id: string): Promise<ClaimEvaluationResult | null> {
    throw new Error("Claim evaluation not implemented yet");
  }

  async getClaimAuditHistory(id: string): Promise<ClaimAuditEntry[]> {
    return [];
  }

  async getClaimEvaluationHistory(id: string): Promise<ClaimEvaluationHistory[]> {
    return [];
  }

  async createClaimTemplate(template: Omit<ClaimTemplate, 'id' | 'createdAt' | 'lastUpdated'>): Promise<ClaimTemplate> {
    throw new Error("Claim templates not implemented yet");
  }

  async getClaimTemplate(id: string): Promise<ClaimTemplate | null> {
    return null;
  }

  async getAllClaimTemplates(): Promise<ClaimTemplate[]> {
    return [];
  }

  async updateClaimTemplate(id: string, updates: Partial<ClaimTemplate>): Promise<ClaimTemplate | null> {
    return null;
  }

  async deleteClaimTemplate(id: string): Promise<boolean> {
    return false;
  }

  async createClaimFromTemplate(templateId: string, overrides: Partial<Claim>): Promise<Claim> {
    throw new Error("Claim from template creation not implemented yet");
  }

  async createClaimInstance(instance: Omit<ClaimInstance, 'id' | 'createdAt' | 'lastUpdated'>): Promise<ClaimInstance> {
    throw new Error("Claim instances not implemented yet");
  }

  async getClaimInstance(id: string): Promise<ClaimInstance | null> {
    return null;
  }

  async getClaimInstances(claimId: string): Promise<ClaimInstance[]> {
    return [];
  }

  async updateClaimInstance(id: string, updates: Partial<ClaimInstance>): Promise<ClaimInstance | null> {
    return null;
  }

  async deleteClaimInstance(id: string): Promise<boolean> {
    return false;
  }
}