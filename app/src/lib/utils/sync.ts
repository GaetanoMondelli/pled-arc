/**
 * Simple sync utilities - minimal implementation for existing features
 */

export interface TemplateVersion {
  name: string;              // "v1.0", "production", "stable", etc.
  architecture: string;      // JSON stringified scenario
  resources: string;         // JSON stringified resources
  documentation: string;     // referenceDoc text
  timestamp: number;         // when this version was tagged
  description?: string;      // optional description
}

export interface TemplateSync {
  taggedVersions?: TemplateVersion[];  // List of tagged versions
}

// Create a new tagged version
export function createTaggedVersion(template: any, versionName: string, description?: string): TemplateVersion {
  return {
    name: versionName,
    architecture: JSON.stringify(template.scenario || {}),
    resources: JSON.stringify(template.resources || []),
    documentation: template.referenceDoc || '',
    timestamp: Date.now(),
    description
  };
}

// Add a tagged version to template
export function addTaggedVersion(template: any, versionName: string, description?: string): TemplateSync {
  const currentSync = template.sync || { taggedVersions: [] };
  const newVersion = createTaggedVersion(template, versionName, description);

  const updatedVersions = [
    ...(currentSync.taggedVersions || []),
    newVersion
  ];

  return {
    taggedVersions: updatedVersions
  };
}

// Get all tagged versions for a template
export function getTaggedVersions(template: any): TemplateVersion[] {
  return template.sync?.taggedVersions || [];
}

// Legacy compatibility stubs
export function computeHash(): string {
  return "";
}

export function initializeSyncData(): TemplateSync {
  return { taggedVersions: [] };
}