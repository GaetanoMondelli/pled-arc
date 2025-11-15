import type { TemplateDocument, ExecutionDocument } from '@/lib/firestore-types';
import type { Scenario } from '@/lib/simulation/types';

class TemplateService {
  private baseUrl = '/api/admin';

  // Template operations
  async getTemplates(): Promise<TemplateDocument[]> {
    const response = await fetch(`${this.baseUrl}/templates`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || 'Failed to fetch templates');
    }
    const data = await response.json();

    // Handle warning case (Firebase not configured)
    if (data.warning) {
      console.warn(data.warning);
    }

    return data.templates || [];
  }

  async getTemplate(templateId: string): Promise<TemplateDocument> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    const data = await response.json();
    return data.template;
  }

  async createTemplate(params: {
    name: string;
    description?: string;
    scenario?: Scenario;
    referenceDoc?: string;
    resources?: any[];
    fromDefault?: boolean;
  }): Promise<TemplateDocument> {
    const response = await fetch(`${this.baseUrl}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to create template');
    }

    const data = await response.json();
    return data.template;
  }

  async updateTemplate(templateId: string, updates: {
    name?: string;
    description?: string;
    scenario?: Scenario;
    referenceDoc?: string;
  }): Promise<TemplateDocument> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to update template');
    }

    const data = await response.json();
    return data.template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to delete template');
    }
  }

  // Execution operations
  async getExecutions(templateId?: string): Promise<ExecutionDocument[]> {
    const url = templateId
      ? `${this.baseUrl}/executions?templateId=${templateId}`
      : `${this.baseUrl}/executions`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch executions');
    }
    const data = await response.json();
    return data.executions;
  }

  async getExecution(executionId: string): Promise<ExecutionDocument> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch execution');
    }
    const data = await response.json();
    return data.execution;
  }

  async saveExecution(params: {
    templateId: string;
    templateName?: string;
    scenarioName?: string;
    name: string;
    description?: string;
    scenario?: Scenario;
    nodeStates?: Record<string, any>;
    currentTime?: number;
    eventCounter?: number;
    globalActivityLog?: any[];
    nodeActivityLogs?: Record<string, any[]>;
    isCompleted?: boolean;
    // New external events format
    externalEvents?: any[];
    totalExternalEvents?: number;
    eventTypes?: string[];
    createdAt?: Date;
  }): Promise<ExecutionDocument> {
    const response = await fetch(`${this.baseUrl}/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to save execution');
    }

    const data = await response.json();
    return data.execution;
  }

  async updateExecution(executionId: string, updates: {
    name?: string;
    description?: string;
    nodeStates?: Record<string, any>;
    currentTime?: number;
    eventCounter?: number;
    globalActivityLog?: any[];
    nodeActivityLogs?: Record<string, any[]>;
    isCompleted?: boolean;
  }): Promise<ExecutionDocument> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to update execution');
    }

    const data = await response.json();
    return data.execution;
  }

  async deleteExecution(executionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/executions/${executionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to delete execution');
    }
  }

  // NEW STREAMING API METHODS

  /**
   * Push new events to an existing execution (appends, doesn't replace)
   */
  async pushEventsToExecution(executionId: string, events: any[]): Promise<{
    success: boolean;
    eventsAdded: number;
    totalEvents: number;
  }> {
    const response = await fetch(`/api/executions/${executionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to push events');
    }

    return await response.json();
  }

  /**
   * Create a new execution using the streaming API
   */
  async createExecutionWithEvents(params: {
    templateId: string;
    name: string;
    description?: string;
    externalEvents?: any[];
  }): Promise<{ executionId: string; execution: ExecutionDocument; eventCount: number }> {
    const response = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to create execution');
    }

    return await response.json();
  }

  /**
   * Get events from an execution with pagination
   */
  async getExecutionEvents(executionId: string, options?: {
    offset?: number;
    limit?: number;
    type?: string;
    since?: number;
  }): Promise<{
    success: boolean;
    events: any[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
      returned: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined) params.set('offset', options.offset.toString());
    if (options?.limit !== undefined) params.set('limit', options.limit.toString());
    if (options?.type) params.set('type', options.type);
    if (options?.since) params.set('since', options.since.toString());

    const url = `/api/executions/${executionId}/events${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to fetch events');
    }

    return await response.json();
  }

  async initializeAdminStructure(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/init`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to initialize admin structure');
    }
  }
}

export const templateService = new TemplateService();
export default templateService;