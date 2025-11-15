/**
 * API-based Claims Storage
 *
 * Implements the ClaimsStorage interface using Next.js API routes
 * for server-side Firebase operations.
 */

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

export class ApiClaimsStorage implements ClaimsStorage {
  private baseUrl: string;
  private userId: string;

  constructor(userId: string, baseUrl: string = '/api/claims') {
    this.userId = userId;
    this.baseUrl = baseUrl;
  }

  private async apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': this.userId,
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getClaim(id: string): Promise<Claim | null> {
    try {
      return await this.apiRequest<Claim>(`/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getAllClaims(): Promise<Claim[]> {
    return await this.apiRequest<Claim[]>('/');
  }

  async createClaim(claimData: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Claim> {
    return await this.apiRequest<Claim>('/', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim> {
    return await this.apiRequest<Claim>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClaim(id: string): Promise<void> {
    await this.apiRequest<void>(`/${id}`, {
      method: 'DELETE',
    });
  }

  async searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult> {
    const queryParams = new URLSearchParams();

    if (criteria.query) queryParams.append('query', criteria.query);
    if (criteria.status) queryParams.append('status', criteria.status.join(','));
    if (criteria.formulaType) queryParams.append('formulaType', criteria.formulaType.join(','));
    if (criteria.owner) queryParams.append('owner', criteria.owner.join(','));
    if (criteria.tags) queryParams.append('tags', criteria.tags.join(','));
    if (criteria.sortBy) queryParams.append('sortBy', criteria.sortBy);
    if (criteria.sortOrder) queryParams.append('sortOrder', criteria.sortOrder);
    if (criteria.limit) queryParams.append('limit', criteria.limit.toString());
    if (criteria.offset) queryParams.append('offset', criteria.offset.toString());

    return await this.apiRequest<ClaimSearchResult>(`/search?${queryParams}`);
  }

  async saveEvaluationResult(result: ClaimEvaluationResult): Promise<void> {
    await this.apiRequest<void>(`/${result.claimId}/evaluations`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }

  async getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory> {
    return await this.apiRequest<ClaimEvaluationHistory>(`/${claimId}/evaluations`);
  }

  async addAuditEntry(entryData: Omit<ClaimAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    await this.apiRequest<void>(`/${entryData.claimId}/audit`, {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  }

  async getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]> {
    return await this.apiRequest<ClaimAuditEntry[]>(`/${claimId}/audit`);
  }

  async saveTemplate(template: ClaimTemplate): Promise<void> {
    await this.apiRequest<void>('/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async getTemplate(id: string): Promise<ClaimTemplate | null> {
    try {
      return await this.apiRequest<ClaimTemplate>(`/templates/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async createInstance(instanceData: Omit<ClaimInstance, 'id' | 'createdAt'>): Promise<ClaimInstance> {
    return await this.apiRequest<ClaimInstance>('/instances', {
      method: 'POST',
      body: JSON.stringify(instanceData),
    });
  }
}