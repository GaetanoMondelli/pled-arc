import type { Scenario } from '@/lib/simulation/types';
import type { TemplateSync } from '@/lib/utils/sync';

// Separated types to avoid importing Firebase Admin in client code
export interface TemplateDocument {
  id: string;
  name: string;
  description?: string;
  scenario: Scenario;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  version: string;
  schemaVersion?: string;
  // Reference documentation in markdown format
  referenceDoc?: string;
  // Template sync tracking for versioning
  sync?: TemplateSync;
  // Migration tracking
  migratedAt?: number;
  migratedFrom?: string;
  // Optional execution state for templates with saved simulation progress
  executionState?: {
    scenario: Scenario;
    nodeStates: Record<string, any>;
    currentTime: number;
    eventCounter: number;
    nodeActivityLogs: Record<string, any[]>;
    globalActivityLog: any[];
    simulationSpeed: number;
    lastSavedAt: number;
  };
}

export interface ExternalEvent {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  data: any;
  targetDataSourceId?: string;
  nodeId?: string; // Alternative field name for compatibility
}

export interface ExecutionDocument {
  id: string;
  templateId: string;
  templateName?: string;
  scenarioName?: string;
  name: string;
  description?: string;

  // For external events replay (new format)
  externalEvents?: ExternalEvent[];
  events?: ExternalEvent[]; // Alternative field name for compatibility
  totalExternalEvents?: number;
  eventTypes?: string[];

  // Complete simulation state for reconstruction (legacy format)
  scenario?: Scenario;
  nodeStates?: Record<string, any>;
  currentTime?: number;
  eventCounter?: number;
  globalActivityLog?: any[];
  nodeActivityLogs?: Record<string, any[]>;

  // Execution metadata
  startedAt?: number;
  createdAt?: Date;
  lastSavedAt: number;
  isCompleted?: boolean;
  createdBy?: string;
}