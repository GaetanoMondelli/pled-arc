import { Action, Event } from './types';

/**
 * Generate a UUID v4 string
 */
function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface ActionContext {
  currentState: string;
  variables: Record<string, any>;
  instanceId: string;
}

export interface ActionResult {
  success: boolean;
  events: Event[];
  error?: string;
}

/**
 * Action Executor - Handles action execution with different types
 */
export class ActionExecutor {
  async executeActions(actions: Action[], context: ActionContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          events: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async executeAction(action: Action, context: ActionContext): Promise<ActionResult> {
    switch (action.type) {
      case 'CREATE_EVENT':
        return this.executeCreateEvent(action, context);

      case 'HTTP_REQUEST':
        return this.executeHttpRequest(action, context);

      case 'LOG_MESSAGE':
        return this.executeLogMessage(action, context);

      case 'CUSTOM':
        return this.executeCustomAction(action, context);

      default:
        return {
          success: false,
          events: [],
          error: `Unknown action type: ${action.type}`
        };
    }
  }

  private executeCreateEvent(action: Action, context: ActionContext): ActionResult {
    const event: Event = {
      id: generateGuid(),
      type: action.data.eventType || 'ACTION_GENERATED',
      timestamp: new Date().toISOString(),
      data: {
        ...action.data,
        generatedBy: action.id,
        state: context.currentState,
        instanceId: context.instanceId
      },
      source: `action_${action.id}`
    };

    return {
      success: true,
      events: [event]
    };
  }

  private async executeHttpRequest(action: Action, context: ActionContext): Promise<ActionResult> {
    try {
      const response = await fetch(action.data.url, {
        method: action.data.method || 'GET',
        headers: action.data.headers || {},
        body: action.data.body ? JSON.stringify(action.data.body) : undefined
      });

      const responseData = await response.json();

      const event: Event = {
        id: generateGuid(),
        type: 'HTTP_RESPONSE',
        timestamp: new Date().toISOString(),
        data: {
          actionId: action.id,
          status: response.status,
          response: responseData,
          success: response.ok
        },
        source: `action_${action.id}`
      };

      return {
        success: response.ok,
        events: [event]
      };
    } catch (error) {
      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : 'HTTP request failed'
      };
    }
  }

  private executeLogMessage(action: Action, context: ActionContext): ActionResult {
    console.log(`[FSM Action] ${action.data.message}`, {
      state: context.currentState,
      action: action.id,
      context: action.data.context
    });

    return {
      success: true,
      events: []
    };
  }

  private executeCustomAction(action: Action, context: ActionContext): ActionResult {
    // For custom actions, just create an event with the action data
    const event: Event = {
      id: generateGuid(),
      type: 'CUSTOM_ACTION',
      timestamp: new Date().toISOString(),
      data: {
        actionId: action.id,
        actionType: action.type,
        state: context.currentState,
        customData: action.data
      },
      source: `action_${action.id}`
    };

    return {
      success: true,
      events: [event]
    };
  }
}