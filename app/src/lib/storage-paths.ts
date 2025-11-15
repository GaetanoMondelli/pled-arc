/**
 * Firebase Storage Path Helpers
 *
 * Centralized path generation for Firebase Storage to maintain
 * consistent folder structure across the application.
 *
 * Recommended folder structure:
 * /uploads/{userId}/{timestamp}-{filename}
 * /parsed-documents/{userId}/{documentId}.json
 * /dsl-suggestions/{userId}/{documentId}.json
 * /generated-workflows/{userId}/{workflowId}.json
 * /public/templates/{templateId}.json
 */

export const StoragePaths = {
  /**
   * Path for original uploaded documents
   * @param userId - User ID
   * @param filename - Original filename
   * @returns Storage path
   */
  upload: (userId: string, filename: string) => {
    const timestamp = Date.now();
    return `uploads/${userId}/${timestamp}-${filename}`;
  },

  /**
   * Path for parsed documents (Docling output)
   * @param userId - User ID
   * @param documentId - Document ID
   * @returns Storage path
   */
  parsedDocument: (userId: string, documentId: string) => {
    return `parsed-documents/${userId}/${documentId}.json`;
  },

  /**
   * Path for DSL suggestions (Workflow Agent output)
   * @param userId - User ID
   * @param documentId - Document ID
   * @returns Storage path
   */
  dslSuggestion: (userId: string, documentId: string) => {
    return `dsl-suggestions/${userId}/${documentId}.json`;
  },

  /**
   * Path for generated workflows
   * @param userId - User ID
   * @param workflowId - Workflow ID
   * @returns Storage path
   */
  generatedWorkflow: (userId: string, workflowId: string) => {
    return `generated-workflows/${userId}/${workflowId}.json`;
  },

  /**
   * Path for public templates
   * @param templateId - Template ID
   * @returns Storage path
   */
  publicTemplate: (templateId: string) => {
    return `public/templates/${templateId}.json`;
  },

  /**
   * Path for user-specific folders
   * @param userId - User ID
   * @returns Storage path prefix
   */
  userFolder: (userId: string) => {
    return `users/${userId}/`;
  },

  /**
   * List all uploads for a user
   * @param userId - User ID
   * @returns Storage path prefix
   */
  userUploads: (userId: string) => {
    return `uploads/${userId}/`;
  },

  /**
   * List all parsed documents for a user
   * @param userId - User ID
   * @returns Storage path prefix
   */
  userParsedDocuments: (userId: string) => {
    return `parsed-documents/${userId}/`;
  },

  /**
   * List all DSL suggestions for a user
   * @param userId - User ID
   * @returns Storage path prefix
   */
  userDslSuggestions: (userId: string) => {
    return `dsl-suggestions/${userId}/`;
  },

  /**
   * List all workflows for a user
   * @param userId - User ID
   * @returns Storage path prefix
   */
  userWorkflows: (userId: string) => {
    return `generated-workflows/${userId}/`;
  },
} as const;

/**
 * Generate a unique document ID
 * @returns Unique ID based on timestamp and random string
 */
export function generateDocumentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Generate a unique workflow ID
 * @returns Unique ID based on timestamp and random string
 */
export function generateWorkflowId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `wf-${timestamp}-${random}`;
}

/**
 * Extract filename from a storage path
 * @param path - Storage path
 * @returns Filename
 */
export function getFilenameFromPath(path: string): string {
  return path.split('/').pop() || '';
}

/**
 * Extract user ID from a storage path
 * @param path - Storage path (must follow convention)
 * @returns User ID or null
 */
export function getUserIdFromPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length >= 2) {
    return parts[1];
  }
  return null;
}
