/**
 * PLED Firebase Storage Service
 *
 * This service manages PLED (Procedural Legal Entity Documents) templates
 * using Firebase Storage with a proper folder structure inside the "arcpled/" folder.
 * Templates are stored as JSON files in the storage bucket.
 */

import { bucket } from "@/lib/firebase-storage";
import { nanoid } from "@/lib/utils/nanoid";
import { TemplateSync, initializeSyncData } from "@/lib/utils/sync";

export interface PledTemplate {
  id: string;
  name: string;
  description?: string;
  scenario: any;
  version: string;
  schemaVersion?: string; // '3.1' for new sync-enabled templates
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  tags?: string[];
  referenceDoc?: string;
  resources?: any[];
  metadata?: Record<string, any>;
  sync?: TemplateSync;
  // Migration tracking
  migratedAt?: number;
  migratedFrom?: string;
}

export interface PledExecution {
  id: string;
  templateId: string;
  name: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  currentState: any;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  events: any[];
  messages: any[];
  metadata?: Record<string, any>;
}

export interface PledManifest {
  version: string;
  lastUpdated: number;
  templates: Array<{
    id: string;
    name: string;
    description?: string;
    version: string;
    isDefault?: boolean;
    createdAt: number;
    updatedAt: number;
    filePath: string;
  }>;
  executions: Array<{
    id: string;
    templateId: string;
    name: string;
    status: string;
    startedAt: number;
    filePath: string;
  }>;
}

export class PledStorageService {
  private readonly PLED_FOLDER = 'arcpled';
  private readonly TEMPLATES_FOLDER = 'arcpled/templates';
  private readonly EXECUTIONS_FOLDER = 'arcpled/executions';
  private readonly MANIFEST_FILE = 'arcpled/manifest.json';

  // In-memory cache for manifest (5 second TTL)
  private manifestCache: { data: PledManifest; timestamp: number } | null = null;
  private readonly MANIFEST_CACHE_TTL = 5000; // 5 seconds

  constructor() {
    console.log('PledStorageService initialized - using Firebase Storage');
  }

  private ensureBucket() {
    if (!bucket) {
      throw new Error('Firebase storage bucket is not initialized. Check FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.');
    }
    return bucket;
  }

  // ============================================================================
  // Manifest Management
  // ============================================================================

  private async getManifest(): Promise<PledManifest> {
    try {
      // Check cache first
      if (this.manifestCache && (Date.now() - this.manifestCache.timestamp) < this.MANIFEST_CACHE_TTL) {
        console.log('📦 Manifest cache hit');
        return this.manifestCache.data;
      }

      console.log('📥 Fetching manifest from Firebase Storage...');
      const startTime = Date.now();

      const file = this.ensureBucket().file(this.MANIFEST_FILE);
      const [exists] = await file.exists();

      if (!exists) {
        // Create default manifest
        const defaultManifest: PledManifest = {
          version: '1.0',
          lastUpdated: Date.now(),
          templates: [],
          executions: []
        };
        await this.saveManifest(defaultManifest);
        return defaultManifest;
      }

      const [contents] = await file.download();
      const manifest = JSON.parse(contents.toString('utf8'));

      // Cache the result
      this.manifestCache = {
        data: manifest,
        timestamp: Date.now()
      };

      const duration = Date.now() - startTime;
      console.log(`✅ Manifest fetched from Firebase Storage in ${duration}ms`);

      return manifest;
    } catch (error) {
      console.error('Error getting PLED manifest:', error);
      throw new Error(`Failed to get manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveManifest(manifest: PledManifest): Promise<void> {
    try {
      const file = this.ensureBucket().file(this.MANIFEST_FILE);
      await file.save(JSON.stringify(manifest, null, 2), {
        contentType: 'application/json',
        metadata: {
          updated: new Date().toISOString()
        }
      });

      // Invalidate cache after save
      this.manifestCache = null;
    } catch (error) {
      console.error('Error saving PLED manifest:', error);
      throw new Error(`Failed to save manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  async createTemplate(templateData: Omit<PledTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = nanoid();
      const now = Date.now();

      const template: PledTemplate = {
        ...templateData,
        id,
        schemaVersion: '3.1', // New templates get latest schema
        createdAt: now,
        updatedAt: now,
      };

      // Initialize sync data for new templates
      if (template.scenario || template.referenceDoc) {
        template.sync = initializeSyncData(template);
      }

      // Save template file
      const templatePath = `${this.TEMPLATES_FOLDER}/${id}.json`;
      const templateFile = this.ensureBucket().file(templatePath);
      await templateFile.save(JSON.stringify(template, null, 2), {
        contentType: 'application/json',
        metadata: {
          templateId: id,
          templateName: template.name,
          created: new Date(now).toISOString()
        }
      });

      // Update manifest
      const manifest = await this.getManifest();
      manifest.templates.push({
        id: template.id,
        name: template.name,
        description: template.description,
        version: template.version,
        isDefault: template.isDefault,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        filePath: templatePath
      });
      manifest.lastUpdated = now;
      await this.saveManifest(manifest);

      console.log(`PLED template created in storage: ${id} at ${templatePath}`);
      return id;
    } catch (error) {
      console.error('Error creating PLED template:', error);
      throw new Error(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTemplate(templateId: string): Promise<PledTemplate | null> {
    try {
      const templatePath = `${this.TEMPLATES_FOLDER}/${templateId}.json`;
      const templateFile = this.ensureBucket().file(templatePath);

      const [exists] = await templateFile.exists();
      if (!exists) {
        return null;
      }

      const [contents] = await templateFile.download();
      const template = JSON.parse(contents.toString('utf8'));

      // Initialize sync data for backwards compatibility if missing
      if (!template.sync && (template.scenario || template.referenceDoc)) {
        template.sync = initializeSyncData(template);
        console.log('🔄 Auto-initialized sync data for legacy template:', templateId);
      }

      console.log('🗄️ Retrieved template:', templateId, 'has referenceDoc:', template.referenceDoc ? `${template.referenceDoc.length} characters` : 'NOT PRESENT');
      return template;
    } catch (error) {
      console.error('Error getting PLED template:', error);
      throw new Error(`Failed to get template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listTemplates(): Promise<PledTemplate[]> {
    try {
      const manifest = await this.getManifest();
      const templates: PledTemplate[] = [];

      // Load each template from storage
      for (const templateInfo of manifest.templates) {
        try {
          const template = await this.getTemplate(templateInfo.id);
          if (template) {
            templates.push(template);
          }
        } catch (error) {
          console.warn(`Failed to load template ${templateInfo.id}:`, error);
          // Continue with other templates
        }
      }

      // Sort by creation date (newest first)
      return templates.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error listing PLED templates:', error);
      throw new Error(`Failed to list templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTemplate(templateId: string, updates: Partial<PledTemplate>): Promise<void> {
    try {
      console.log('🗄️ PLED updateTemplate called for:', templateId);
      console.log('🗄️ Updates:', JSON.stringify(updates, null, 2));
      console.log('🗄️ ReferenceDoc in updates:', updates.referenceDoc ? `${updates.referenceDoc.length} characters` : 'NOT PRESENT');

      const existingTemplate = await this.getTemplate(templateId);
      if (!existingTemplate) {
        throw new Error(`Template ${templateId} not found`);
      }
      console.log('🗄️ Existing template found, has referenceDoc:', existingTemplate.referenceDoc ? `${existingTemplate.referenceDoc.length} characters` : 'NOT PRESENT');

      const now = Date.now();

      // Filter out undefined values from updates to prevent overwriting existing fields
      const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      const updatedTemplate: PledTemplate = {
        ...existingTemplate,
        ...cleanedUpdates,
        id: templateId, // Ensure ID doesn't change
        updatedAt: now,
      };

      // Initialize simple sync data
      updatedTemplate.sync = {
        taggedVersions: existingTemplate.sync?.taggedVersions || []
      };
      console.log('🗄️ Updated template prepared, has referenceDoc:', updatedTemplate.referenceDoc ? `${updatedTemplate.referenceDoc.length} characters` : 'NOT PRESENT');

      // Save updated template
      const templatePath = `${this.TEMPLATES_FOLDER}/${templateId}.json`;
      const templateFile = this.ensureBucket().file(templatePath);
      console.log('🗄️ Saving to Firebase Storage at:', templatePath);
      await templateFile.save(JSON.stringify(updatedTemplate, null, 2), {
        contentType: 'application/json',
        metadata: {
          templateId,
          templateName: updatedTemplate.name,
          updated: new Date(updatedTemplate.updatedAt).toISOString()
        }
      });
      console.log('🗄️ Template saved to Firebase Storage successfully');

      // Update manifest
      const manifest = await this.getManifest();
      const templateIndex = manifest.templates.findIndex(t => t.id === templateId);
      if (templateIndex >= 0) {
        manifest.templates[templateIndex] = {
          id: updatedTemplate.id,
          name: updatedTemplate.name,
          description: updatedTemplate.description,
          version: updatedTemplate.version,
          isDefault: updatedTemplate.isDefault,
          createdAt: updatedTemplate.createdAt,
          updatedAt: updatedTemplate.updatedAt,
          filePath: templatePath
        };
        manifest.lastUpdated = Date.now();
        await this.saveManifest(manifest);
      }

      console.log(`PLED template updated in storage: ${templateId}`);
    } catch (error) {
      console.error('Error updating PLED template:', error);
      throw new Error(`Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Delete template file
      const templatePath = `${this.TEMPLATES_FOLDER}/${templateId}.json`;
      const templateFile = this.ensureBucket().file(templatePath);

      const [exists] = await templateFile.exists();
      if (exists) {
        await templateFile.delete();
      }

      // Update manifest
      const manifest = await this.getManifest();
      manifest.templates = manifest.templates.filter(t => t.id !== templateId);
      manifest.lastUpdated = Date.now();
      await this.saveManifest(manifest);

      console.log(`PLED template deleted from storage: ${templateId}`);
    } catch (error) {
      console.error('Error deleting PLED template:', error);
      throw new Error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Execution Management
  // ============================================================================

  async createExecution(executionData: Omit<PledExecution, 'id' | 'startedAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = nanoid();
      const now = Date.now();

      const execution: PledExecution = {
        ...executionData,
        id,
        startedAt: now,
        updatedAt: now,
      };

      // Save execution file
      const executionPath = `${this.EXECUTIONS_FOLDER}/${id}.json`;
      const executionFile = this.ensureBucket().file(executionPath);
      await executionFile.save(JSON.stringify(execution, null, 2), {
        contentType: 'application/json',
        metadata: {
          executionId: id,
          templateId: execution.templateId,
          started: new Date(now).toISOString()
        }
      });

      // Update manifest
      const manifest = await this.getManifest();
      manifest.executions.push({
        id: execution.id,
        templateId: execution.templateId,
        name: execution.name,
        status: execution.status,
        startedAt: execution.startedAt,
        filePath: executionPath,
        totalExternalEvents: (execution as any).totalExternalEvents || (execution as any).externalEvents?.length || 0,
        eventTypes: (execution as any).eventTypes || []
      });
      manifest.lastUpdated = now;
      await this.saveManifest(manifest);

      console.log(`PLED execution created in storage: ${id} at ${executionPath}`);
      return id;
    } catch (error) {
      console.error('Error creating PLED execution:', error);
      throw new Error(`Failed to create execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getExecution(executionId: string): Promise<PledExecution | null> {
    try {
      const executionPath = `${this.EXECUTIONS_FOLDER}/${executionId}.json`;
      const executionFile = this.ensureBucket().file(executionPath);

      const [exists] = await executionFile.exists();
      if (!exists) {
        return null;
      }

      const [contents] = await executionFile.download();
      return JSON.parse(contents.toString('utf8'));
    } catch (error) {
      console.error('Error getting PLED execution:', error);
      throw new Error(`Failed to get execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List execution summaries from manifest (FAST - doesn't read full files)
   * Use this for listing executions in the UI
   */
  async listExecutionsSummary(templateId?: string): Promise<Array<{
    id: string;
    templateId: string;
    name: string;
    status: string;
    startedAt: number;
    totalExternalEvents?: number;
    eventTypes?: string[];
  }>> {
    try {
      const manifest = await this.getManifest();

      // Filter by templateId if provided
      const executionInfos = templateId
        ? manifest.executions.filter((e: any) => e.templateId === templateId)
        : manifest.executions;

      // Sort by start date (newest first)
      return executionInfos
        .map((e: any) => ({
          id: e.id,
          templateId: e.templateId,
          name: e.name,
          status: e.status,
          startedAt: e.startedAt,
          totalExternalEvents: e.totalExternalEvents,
          eventTypes: e.eventTypes,
        }))
        .sort((a: any, b: any) => b.startedAt - a.startedAt);
    } catch (error) {
      console.error('Error listing execution summaries:', error);
      throw new Error(`Failed to list executions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List full executions (SLOW - reads all files)
   * Only use when you need complete execution data
   */
  async listExecutions(templateId?: string): Promise<PledExecution[]> {
    try {
      const manifest = await this.getManifest();
      const executions: PledExecution[] = [];

      // Filter by templateId if provided
      const executionInfos = templateId
        ? manifest.executions.filter(e => e.templateId === templateId)
        : manifest.executions;

      // Load each execution from storage
      for (const executionInfo of executionInfos) {
        try {
          const execution = await this.getExecution(executionInfo.id);
          if (execution) {
            executions.push(execution);
          }
        } catch (error) {
          console.warn(`Failed to load execution ${executionInfo.id}:`, error);
          // Continue with other executions
        }
      }

      // Sort by start date (newest first)
      return executions.sort((a, b) => b.startedAt - a.startedAt);
    } catch (error) {
      console.error('Error listing PLED executions:', error);
      throw new Error(`Failed to list executions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateExecution(executionId: string, updates: Partial<PledExecution>): Promise<void> {
    try {
      const existingExecution = await this.getExecution(executionId);
      if (!existingExecution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      const updatedExecution: PledExecution = {
        ...existingExecution,
        ...updates,
        id: executionId, // Ensure ID doesn't change
        templateId: existingExecution.templateId, // Ensure templateId doesn't change
        startedAt: existingExecution.startedAt, // Preserve original start time
        updatedAt: Date.now(),
      };

      // Save updated execution
      const executionPath = `${this.EXECUTIONS_FOLDER}/${executionId}.json`;
      const executionFile = this.ensureBucket().file(executionPath);
      await executionFile.save(JSON.stringify(updatedExecution, null, 2), {
        contentType: 'application/json',
        metadata: {
          executionId,
          templateId: updatedExecution.templateId,
          updated: new Date(updatedExecution.updatedAt).toISOString()
        }
      });

      // Update manifest if status or external events changed
      const shouldUpdateManifest =
        (updates.status && updates.status !== existingExecution.status) ||
        (updates as any).totalExternalEvents !== undefined ||
        (updates as any).eventTypes !== undefined;

      if (shouldUpdateManifest) {
        const manifest = await this.getManifest();
        const executionIndex = manifest.executions.findIndex(e => e.id === executionId);
        if (executionIndex >= 0) {
          if (updates.status) {
            manifest.executions[executionIndex].status = updates.status;
          }
          if ((updates as any).totalExternalEvents !== undefined) {
            (manifest.executions[executionIndex] as any).totalExternalEvents = (updates as any).totalExternalEvents;
          }
          if ((updates as any).eventTypes !== undefined) {
            (manifest.executions[executionIndex] as any).eventTypes = (updates as any).eventTypes;
          }
          manifest.lastUpdated = Date.now();
          await this.saveManifest(manifest);
        }
      }

      console.log(`PLED execution updated in storage: ${executionId}`);
    } catch (error) {
      console.error('Error updating PLED execution:', error);
      throw new Error(`Failed to update execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteExecution(executionId: string): Promise<void> {
    try {
      // Delete execution file
      const executionPath = `${this.EXECUTIONS_FOLDER}/${executionId}.json`;
      const executionFile = this.ensureBucket().file(executionPath);

      const [exists] = await executionFile.exists();
      if (exists) {
        await executionFile.delete();
      }

      // Update manifest
      const manifest = await this.getManifest();
      manifest.executions = manifest.executions.filter(e => e.id !== executionId);
      manifest.lastUpdated = Date.now();
      await this.saveManifest(manifest);

      console.log(`PLED execution deleted from storage: ${executionId}`);
    } catch (error) {
      console.error('Error deleting PLED execution:', error);
      throw new Error(`Failed to delete execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Generic File Storage Methods (for resources, documents, etc.)
  // ============================================================================

  /**
   * Upload a buffer to Firebase Storage
   */
  async uploadBuffer(path: string, buffer: Buffer, options?: {
    contentType?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const file = this.ensureBucket().file(path);
      await file.save(buffer, {
        contentType: options?.contentType || 'application/octet-stream',
        metadata: options?.metadata || {}
      });
      console.log(`📁 Buffer uploaded to: ${path}`);
    } catch (error) {
      console.error(`❌ Failed to upload buffer to ${path}:`, error);
      throw error;
    }
  }

  /**
   * Upload JSON data to Firebase Storage
   */
  async uploadJSON(path: string, data: any): Promise<void> {
    try {
      const file = this.ensureBucket().file(path);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        metadata: {
          uploaded: new Date().toISOString()
        }
      });
      console.log(`📄 JSON uploaded to: ${path}`);
    } catch (error) {
      console.error(`❌ Failed to upload JSON to ${path}:`, error);
      throw error;
    }
  }

  /**
   * Upload text content to Firebase Storage
   */
  async uploadText(path: string, text: string): Promise<void> {
    try {
      const file = this.ensureBucket().file(path);
      await file.save(text, {
        contentType: 'text/plain',
        metadata: {
          uploaded: new Date().toISOString()
        }
      });
      console.log(`📝 Text uploaded to: ${path}`);
    } catch (error) {
      console.error(`❌ Failed to upload text to ${path}:`, error);
      throw error;
    }
  }

  /**
   * Download a buffer from Firebase Storage
   */
  async downloadBuffer(path: string): Promise<Buffer | null> {
    try {
      const file = this.ensureBucket().file(path);
      const [exists] = await file.exists();

      if (!exists) {
        console.warn(`📁 File not found: ${path}`);
        return null;
      }

      const [contents] = await file.download();
      console.log(`📥 Buffer downloaded from: ${path} (${contents.length} bytes)`);
      return contents;
    } catch (error) {
      console.error(`❌ Failed to download buffer from ${path}:`, error);
      throw error;
    }
  }

  /**
   * Download JSON data from Firebase Storage
   */
  async downloadJSON(path: string): Promise<any | null> {
    try {
      const file = this.ensureBucket().file(path);
      const [exists] = await file.exists();

      if (!exists) {
        console.warn(`📄 JSON file not found: ${path}`);
        return null;
      }

      const [contents] = await file.download();
      const jsonData = JSON.parse(contents.toString('utf8'));
      console.log(`📄 JSON downloaded from: ${path}`);
      return jsonData;
    } catch (error) {
      console.error(`❌ Failed to download JSON from ${path}:`, error);
      throw error;
    }
  }

  /**
   * Download text content from Firebase Storage
   */
  async downloadText(path: string): Promise<string | null> {
    try {
      const file = this.ensureBucket().file(path);
      const [exists] = await file.exists();

      if (!exists) {
        console.warn(`📝 Text file not found: ${path}`);
        return null;
      }

      const [contents] = await file.download();
      const text = contents.toString('utf8');
      console.log(`📝 Text downloaded from: ${path} (${text.length} characters)`);
      return text;
    } catch (error) {
      console.error(`❌ Failed to download text from ${path}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from Firebase Storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const file = this.ensureBucket().file(path);
      const [exists] = await file.exists();

      if (exists) {
        await file.delete();
        console.log(`🗑️ File deleted: ${path}`);
      } else {
        console.warn(`🗑️ File not found for deletion: ${path}`);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in Firebase Storage
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const file = this.ensureBucket().file(path);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`❌ Failed to check if file exists ${path}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async initializePledStorage(): Promise<void> {
    try {
      console.log('Initializing PLED storage structure...');

      // Ensure manifest exists
      const manifest = await this.getManifest();

      // Create default template if none exists
      if (manifest.templates.length === 0) {
        await this.createDefaultTemplate();
      }

      console.log('PLED storage initialized successfully');
    } catch (error) {
      console.error('Error initializing PLED storage:', error);
      throw error;
    }
  }

  private async createDefaultTemplate(): Promise<void> {
    const defaultTemplate = {
      name: 'Default Procedure Template',
      description: 'A basic procedure template for getting started with PLED',
      scenario: {
        id: 'default-pled',
        name: 'Default PLED Procedure',
        description: 'Basic procedure with event source and sink for PLED system',
        nodes: [
          {
            nodeId: 'source1',
            type: 'DataSource',
            displayName: 'Event Source',
            x: 100,
            y: 100,
            emissionRate: 1,
            emissionValues: [1, 2, 3],
            outputs: [{ destinationNodeId: 'sink1' }]
          },
          {
            nodeId: 'sink1',
            type: 'Sink',
            displayName: 'Event Sink',
            x: 300,
            y: 100
          }
        ],
        edges: [
          {
            id: 'edge1',
            source: 'source1',
            target: 'sink1'
          }
        ]
      },
      version: '1.0',
      isDefault: true,
    };

    await this.createTemplate(defaultTemplate);
    console.log('Default PLED template created in storage');
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Try to access the storage bucket
      const [files] = await this.ensureBucket().getFiles({
        prefix: this.PLED_FOLDER,
        maxResults: 1
      });
      return true;
    } catch (error) {
      console.error('PLED Storage connection check failed:', error);
      return false;
    }
  }

  async getStorageInfo(): Promise<any> {
    try {
      const manifest = await this.getManifest();
      const [files] = await this.ensureBucket().getFiles({
        prefix: this.PLED_FOLDER
      });

      return {
        manifest,
        totalFiles: files.length,
        folders: {
          templates: this.TEMPLATES_FOLDER,
          executions: this.EXECUTIONS_FOLDER,
          manifest: this.MANIFEST_FILE
        },
        files: files.map(file => ({
          name: file.name,
          size: file.metadata.size,
          updated: file.metadata.updated
        }))
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pledStorageService = new PledStorageService();