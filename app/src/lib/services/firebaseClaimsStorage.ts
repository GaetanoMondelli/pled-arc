/**
 * Firebase Claims Storage
 *
 * Implements the ClaimsStorage interface using Firebase Firestore
 * with user-specific document organization.
 */

import * as admin from "firebase-admin";
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

// Initialize Firebase Admin if not already done
function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountBuffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || "", "base64");
  const serviceAccount = JSON.parse(serviceAccountBuffer.toString("utf8"));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export class FirebaseClaimsStorage implements ClaimsStorage {
  private db: admin.firestore.Firestore;
  private userId: string;

  constructor(userId: string) {
    this.db = getFirebaseApp().firestore();
    this.userId = userId;
  }

  // Helper method to get user's claims collection reference
  private getUserClaimsCollection() {
    return this.db.collection("users").doc(this.userId).collection("claims");
  }

  // Helper method to get user's evaluation results collection reference
  private getUserEvaluationsCollection() {
    return this.db.collection("users").doc(this.userId).collection("evaluations");
  }

  // Helper method to get user's audit entries collection reference
  private getUserAuditCollection() {
    return this.db.collection("users").doc(this.userId).collection("audit");
  }

  // Helper method to get user's templates collection reference
  private getUserTemplatesCollection() {
    return this.db.collection("users").doc(this.userId).collection("templates");
  }

  // Helper method to get user's instances collection reference
  private getUserInstancesCollection() {
    return this.db.collection("users").doc(this.userId).collection("instances");
  }

  // Convert Firestore timestamp to Date
  private timestampToDate(timestamp: any): Date {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    return new Date(timestamp);
  }

  // Convert Date to Firestore timestamp
  private dateToTimestamp(date: Date): admin.firestore.Timestamp {
    return admin.firestore.Timestamp.fromDate(date);
  }

  // Convert Firestore document to Claim
  private docToClaim(doc: admin.firestore.QueryDocumentSnapshot): Claim {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: this.timestampToDate(data.createdAt),
      lastUpdated: this.timestampToDate(data.lastUpdated),
    } as Claim;
  }

  async getClaim(id: string): Promise<Claim | null> {
    try {
      const doc = await this.getUserClaimsCollection().doc(id).get();

      if (!doc.exists) {
        return null;
      }

      return this.docToClaim(doc as admin.firestore.QueryDocumentSnapshot);
    } catch (error) {
      console.error("Error getting claim:", error);
      throw error;
    }
  }

  async getAllClaims(): Promise<Claim[]> {
    try {
      const snapshot = await this.getUserClaimsCollection()
        .orderBy("lastUpdated", "desc")
        .get();

      return snapshot.docs.map(doc => this.docToClaim(doc));
    } catch (error) {
      console.error("Error getting all claims:", error);
      throw error;
    }
  }

  async createClaim(claimData: Omit<Claim, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Claim> {
    try {
      const now = new Date();
      const id = this.generateClaimId(claimData.parentClaimId);

      const claim: Claim = {
        ...claimData,
        id,
        createdAt: now,
        lastUpdated: now,
      };

      // Convert dates to Firestore timestamps
      const firestoreData = {
        ...claim,
        createdAt: this.dateToTimestamp(claim.createdAt),
        lastUpdated: this.dateToTimestamp(claim.lastUpdated),
      };

      await this.getUserClaimsCollection().doc(id).set(firestoreData);

      // Add audit entry
      await this.addAuditEntry({
        claimId: id,
        action: 'created',
        userId: claim.createdBy,
        reason: 'New claim created',
      });

      return claim;
    } catch (error) {
      console.error("Error creating claim:", error);
      throw error;
    }
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<Claim> {
    try {
      const existing = await this.getClaim(id);
      if (!existing) {
        throw new Error(`Claim ${id} not found`);
      }

      const updatedClaim: Claim = {
        ...existing,
        ...updates,
        id, // Preserve ID
        createdAt: existing.createdAt, // Preserve creation date
        lastUpdated: new Date(),
      };

      // Convert dates to Firestore timestamps
      const firestoreData = {
        ...updatedClaim,
        createdAt: this.dateToTimestamp(updatedClaim.createdAt),
        lastUpdated: this.dateToTimestamp(updatedClaim.lastUpdated),
      };

      await this.getUserClaimsCollection().doc(id).update(firestoreData);

      // Add audit entry
      await this.addAuditEntry({
        claimId: id,
        action: 'updated',
        userId: updates.modifiedBy || 'system',
        changes: this.computeChanges(existing, updatedClaim),
      });

      return updatedClaim;
    } catch (error) {
      console.error("Error updating claim:", error);
      throw error;
    }
  }

  async deleteClaim(id: string): Promise<void> {
    try {
      const claim = await this.getClaim(id);
      if (!claim) {
        throw new Error(`Claim ${id} not found`);
      }

      await this.getUserClaimsCollection().doc(id).delete();

      // Add audit entry
      await this.addAuditEntry({
        claimId: id,
        action: 'deleted',
        userId: 'system', // TODO: Get from context
      });
    } catch (error) {
      console.error("Error deleting claim:", error);
      throw error;
    }
  }

  async searchClaims(criteria: ClaimSearchCriteria): Promise<ClaimSearchResult> {
    try {
      let query: admin.firestore.Query = this.getUserClaimsCollection();

      // Apply Firestore queries (limited compared to in-memory filtering)
      if (criteria.status && criteria.status.length === 1) {
        query = query.where("status", "==", criteria.status[0]);
      }

      if (criteria.formulaType && criteria.formulaType.length === 1) {
        query = query.where("formula.type", "==", criteria.formulaType[0]);
      }

      if (criteria.owner && criteria.owner.length === 1) {
        query = query.where("owner", "==", criteria.owner[0]);
      }

      // Apply sorting
      const sortBy = criteria.sortBy || "lastUpdated";
      const sortOrder = criteria.sortOrder || "desc";
      query = query.orderBy(sortBy, sortOrder);

      // Apply limit
      const limit = criteria.limit || 20;
      query = query.limit(limit);

      const snapshot = await query.get();
      let claims = snapshot.docs.map(doc => this.docToClaim(doc));

      // Apply additional client-side filtering for complex criteria
      if (criteria.query) {
        const searchQuery = criteria.query.toLowerCase();
        claims = claims.filter(claim =>
          claim.title.toLowerCase().includes(searchQuery) ||
          claim.description.toLowerCase().includes(searchQuery) ||
          claim.id.toLowerCase().includes(searchQuery)
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

      // Apply pagination
      const offset = criteria.offset || 0;
      const paginatedClaims = claims.slice(offset, offset + limit);

      return {
        claims: paginatedClaims,
        total: claims.length,
        limit,
        offset,
        hasMore: offset + limit < claims.length,
      };
    } catch (error) {
      console.error("Error searching claims:", error);
      throw error;
    }
  }

  async saveEvaluationResult(result: ClaimEvaluationResult): Promise<void> {
    try {
      const evaluationId = `${result.claimId}-${result.evaluatedAt.getTime()}`;

      const firestoreData = {
        ...result,
        evaluatedAt: this.dateToTimestamp(result.evaluatedAt),
      };

      await this.getUserEvaluationsCollection().doc(evaluationId).set(firestoreData);

      // Update claim status based on evaluation
      const claim = await this.getClaim(result.claimId);
      if (claim && claim.status !== result.status) {
        await this.updateClaim(result.claimId, {
          status: result.status,
          modifiedBy: 'system',
        });
      }
    } catch (error) {
      console.error("Error saving evaluation result:", error);
      throw error;
    }
  }

  async getEvaluationHistory(claimId: string): Promise<ClaimEvaluationHistory> {
    try {
      const snapshot = await this.getUserEvaluationsCollection()
        .where("claimId", "==", claimId)
        .orderBy("evaluatedAt", "desc")
        .get();

      const evaluations = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          evaluatedAt: this.timestampToDate(data.evaluatedAt),
        } as ClaimEvaluationResult;
      });

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
    } catch (error) {
      console.error("Error getting evaluation history:", error);
      throw error;
    }
  }

  async addAuditEntry(entryData: Omit<ClaimAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const entry: ClaimAuditEntry = {
        ...entryData,
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      const firestoreData = {
        ...entry,
        timestamp: this.dateToTimestamp(entry.timestamp),
      };

      await this.getUserAuditCollection().doc(entry.id).set(firestoreData);
    } catch (error) {
      console.error("Error adding audit entry:", error);
      throw error;
    }
  }

  async getAuditTrail(claimId: string): Promise<ClaimAuditEntry[]> {
    try {
      const snapshot = await this.getUserAuditCollection()
        .where("claimId", "==", claimId)
        .orderBy("timestamp", "desc")
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: this.timestampToDate(data.timestamp),
        } as ClaimAuditEntry;
      });
    } catch (error) {
      console.error("Error getting audit trail:", error);
      throw error;
    }
  }

  async saveTemplate(template: ClaimTemplate): Promise<void> {
    try {
      const firestoreData = {
        ...template,
        metadata: {
          ...template.metadata,
          created: this.dateToTimestamp(template.metadata.created),
        },
      };

      await this.getUserTemplatesCollection().doc(template.id).set(firestoreData);
    } catch (error) {
      console.error("Error saving template:", error);
      throw error;
    }
  }

  async getTemplate(id: string): Promise<ClaimTemplate | null> {
    try {
      const doc = await this.getUserTemplatesCollection().doc(id).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        ...data,
        metadata: {
          ...data.metadata,
          created: this.timestampToDate(data.metadata.created),
        },
      } as ClaimTemplate;
    } catch (error) {
      console.error("Error getting template:", error);
      throw error;
    }
  }

  async createInstance(instanceData: Omit<ClaimInstance, 'id' | 'createdAt'>): Promise<ClaimInstance> {
    try {
      const id = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const instance: ClaimInstance = {
        ...instanceData,
        id,
        createdAt: new Date(),
      };

      const firestoreData = {
        ...instance,
        createdAt: this.dateToTimestamp(instance.createdAt),
      };

      await this.getUserInstancesCollection().doc(id).set(firestoreData);
      return instance;
    } catch (error) {
      console.error("Error creating instance:", error);
      throw error;
    }
  }

  // Helper methods
  private generateClaimId(parentId?: string): string {
    // For Firebase, we'll use timestamp-based IDs for better distribution
    // but maintain the hierarchical format for display
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);

    if (!parentId) {
      return `${timestamp}-${random}`;
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