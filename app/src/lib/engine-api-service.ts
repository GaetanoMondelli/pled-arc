/**
 * Engine API Service
 *
 * Unified service for accessing templates and executions via Engine API
 * Can be used by both template editor and sink state monitor
 */

interface TemplateData {
  id: string;
  name: string;
  scenario: any;
}

interface ExecutionData {
  id: string;
  templateId: string;
  externalEvents: any[];
}

class EngineAPIService {

  /**
   * Get template data - try multiple sources
   */
  async getTemplate(templateId: string): Promise<TemplateData> {
    console.log(`🔍 Engine API Service: Loading template ${templateId}`);

    // Use the working admin API
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.template) {
          console.log('✅ Template loaded via Admin API');
          return {
            id: templateId,
            name: data.template.name || 'Template',
            scenario: data.template.scenario
          };
        }
      } else {
        console.error(`❌ Admin API failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Admin API failed for template:', error);
    }

    // NEVER CREATE FAKE DATA - FAIL PROPERLY
    throw new Error(`Template ${templateId} not found - no fallback data will be generated`);
  }

  /**
   * Get execution data - use working admin API
   */
  async getExecution(executionId: string): Promise<ExecutionData> {
    console.log(`🔍 Engine API Service: Loading execution ${executionId}`);

    // Use the working admin API
    try {
      const response = await fetch(`/api/admin/executions/${executionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.execution) {
          console.log('✅ Execution loaded via Admin API');
          return {
            id: executionId,
            templateId: data.execution.templateId,
            externalEvents: data.execution.externalEvents || []
          };
        }
      } else {
        console.error(`❌ Admin API failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Admin API failed for execution:', error);
    }

    // NEVER CREATE FAKE DATA - FAIL PROPERLY
    throw new Error(`Execution ${executionId} not found - no fallback data will be generated`);
  }

  /**
   * Get node-specific events from template-first API
   */
  async getNodeEvents(templateId: string, executionId: string, nodeId: string, step: string | number = 'last'): Promise<{
    templateId: string;
    executionId: string;
    nodeId: string;
    step: string | number;
    nodeType: string;
    events: any[];
    totalLedgerEntries: number;
    nodeSpecificEntries: number;
    filteredEntries: number;
  }> {
    console.log(`🔍 Engine API Service: Loading node events for ${templateId}/${executionId}/${nodeId} step=${step}`);

    try {
      // Add cache busting
      const url = `/api/engine/templates/${templateId}/executions/${executionId}/nodes/${nodeId}/events?step=${step}&_cache_bust=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log(`✅ Node events loaded: ${data.filteredEntries} events for node ${nodeId}`);
      console.log(`🔍 DEBUGGING API SERVICE: Full response data:`, data);
      console.log(`🔍 DEBUGGING API SERVICE: data.events:`, data.events);
      console.log(`🔍 DEBUGGING API SERVICE: data.events.length:`, data.events?.length);
      return data;

    } catch (error) {
      console.error('❌ Failed to load node events:', error);

      // NO FALLBACK! Let it fail!
      throw error;
    }
  }

  /**
   * Get aggregated sink data using specified formula
   */
  async getSinkAggregation(
    templateId: string,
    executionId: string,
    sinkId: string,
    formula: string = 'latest',
    customExpression?: string
  ): Promise<{
    templateId: string;
    executionId: string;
    sinkId: string;
    formula: string;
    aggregatedValue: any;
    totalEvents: number;
    events: any[];
    timestamp: string;
  }> {
    console.log(`🔍 Engine API Service: Getting sink aggregation for ${templateId}/${executionId}/${sinkId} with formula=${formula}`);

    try {
      let url = `/api/engine/templates/${templateId}/executions/${executionId}/sinks/${sinkId}/aggregate?formula=${formula}`;
      if (customExpression) {
        url += `&customExpression=${encodeURIComponent(customExpression)}`;
      }

      // Add aggressive cache busting to prevent any cached responses
      url += `&_cache_bust=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log(`✅ Sink aggregation loaded: ${data.aggregatedValue} (${data.totalEvents} events)`);
      return data;

    } catch (error) {
      console.error('❌ Failed to load sink aggregation:', error);
      throw error;
    }
  }

  /**
   * Execute one step of simulation
   */
  async executeStep(templateId: string, executionId: string, currentStep: number | string): Promise<{
    success: boolean;
    step: number;
    timestamp: number;
    queueSize: number;
    activity: any[];
    nodeStates: Record<string, any>;
    activeNodeIds: string[];
    message: string;
  }> {
    const isSeekToEnd = currentStep === 'end' || currentStep === -1;
    const logStep = isSeekToEnd ? 'end' : currentStep + 1;
    console.log(`🎯 Engine API Service: Executing step ${logStep} for ${templateId}/${executionId}`);

    try {
      const url = `/api/engine/templates/${templateId}/executions/${executionId}/step?currentStep=${currentStep}&_cache_bust=${Date.now()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error || !data.success) {
        throw new Error(data.error || 'Step execution failed');
      }

      console.log(`✅ Step ${data.step} executed: ${data.activeNodeIds.length} active nodes, ${data.queueSize} remaining`);
      return data;

    } catch (error) {
      console.error('❌ Failed to execute step:', error);
      throw error;
    }
  }

  /**
   * Get node activity at a specific step (on-demand, not preloaded)
   */
  async getNodeActivity(
    templateId: string,
    executionId: string,
    nodeId: string,
    step: number
  ): Promise<{
    success: boolean;
    templateId: string;
    executionId: string;
    nodeId: string;
    step: number;
    activities: any[];
    nodeState: any;
    totalActivities: number;
    timestamp: number;
  }> {
    console.log(`🔍 Engine API Service: Getting node activity for ${templateId}/${executionId}/${nodeId} at step ${step}`);

    try {
      const url = `/api/engine/templates/${templateId}/executions/${executionId}/nodes/${nodeId}/activity?step=${step}&_cache_bust=${Date.now()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error || !data.success) {
        throw new Error(data.error || 'Failed to fetch node activity');
      }

      console.log(`✅ Node activity loaded: ${data.activities.length} activities for node ${nodeId}`);
      return data;

    } catch (error) {
      console.error('❌ Failed to load node activity:', error);
      throw error;
    }
  }

  /**
   * Get token lineage/trace for a correlation ID (on-demand)
   */
  async getTokenLineage(
    templateId: string,
    executionId: string,
    correlationId: string,
    step: number
  ): Promise<{
    success: boolean;
    templateId: string;
    executionId: string;
    correlationId: string;
    step: number;
    activities: any[];
    journey: any;
    timestamp: number;
  }> {
    console.log(`🔍 Engine API Service: Getting token lineage for ${templateId}/${executionId}/${correlationId} at step ${step}`);

    try {
      const url = `/api/engine/templates/${templateId}/executions/${executionId}/tokens/${correlationId}/lineage?step=${step}&_cache_bust=${Date.now()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error || !data.success) {
        throw new Error(data.error || 'Failed to fetch token lineage');
      }

      console.log(`✅ Token lineage loaded: ${data.activities.length} activities for correlation ID ${correlationId}`);
      return data;

    } catch (error) {
      console.error('❌ Failed to load token lineage:', error);
      throw error;
    }
  }

  /**
   * Check if template and execution data is available
   */
  async checkAvailability(templateId: string, executionId: string): Promise<{
    templateAvailable: boolean;
    executionAvailable: boolean;
    source: string;
  }> {
    const checks = await Promise.allSettled([
      fetch(`/api/engine/templates/${templateId}`),
      fetch(`/api/engine/executions/${executionId}`)
    ]);

    return {
      templateAvailable: checks[0].status === 'fulfilled' &&
                         (checks[0].value as Response).ok,
      executionAvailable: checks[1].status === 'fulfilled' &&
                          (checks[1].value as Response).ok,
      source: 'engine-api'
    };
  }
}

// Export singleton instance
export const engineAPIService = new EngineAPIService();

// Legacy export for backwards compatibility
export const sinkStateTemplateService = engineAPIService;