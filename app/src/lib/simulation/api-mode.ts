/**
 * API Mode Simulation Wrapper
 *
 * This module provides a wrapper around the simulation store that respects
 * the API simulation toggle. When API mode is enabled, it routes simulation
 * operations through the API instead of local execution.
 */

import { isAPISimulationEnabled } from '@/lib/config/api';
import { apiClient } from '@/lib/api/client';
import type { ExecutionDocument } from '@/lib/api/types';

export interface SimulationMode {
  isAPIMode: boolean;
  canUseAPI: boolean;
}

export function getSimulationMode(): SimulationMode {
  const isAPIMode = isAPISimulationEnabled();
  return {
    isAPIMode,
    canUseAPI: isAPIMode
  };
}

/**
 * Wrapper for simulation operations that respects API mode toggle
 */
export class SimulationAPI {
  private currentExecution: ExecutionDocument | null = null;

  /**
   * Initialize or switch to API mode with the given execution
   */
  async initialize(execution: ExecutionDocument): Promise<void> {
    if (!isAPISimulationEnabled()) {
      throw new Error('API simulation is not enabled');
    }
    this.currentExecution = execution;
  }

  /**
   * Process a single simulation tick via API
   */
  async tick(): Promise<ExecutionDocument | null> {
    if (!this.currentExecution) {
      throw new Error('No execution initialized for API simulation');
    }

    const response = await apiClient.processEvent(this.currentExecution.id, {
      type: 'tick',
      timestamp: this.currentExecution.currentTime + 1
    });

    if (response.error) {
      throw new Error(`API tick failed: ${response.error}`);
    }

    if (response.data) {
      this.currentExecution = response.data;
    }

    return this.currentExecution;
  }

  /**
   * Inject token into execution
   */
  async injectToken(nodeId: string, value: any): Promise<ExecutionDocument | null> {
    if (!this.currentExecution) {
      throw new Error('No execution initialized for API simulation');
    }

    const response = await apiClient.injectToken(this.currentExecution.id, {
      nodeId,
      value,
      timestamp: this.currentExecution.currentTime
    });

    if (response.error) {
      throw new Error(`Token injection failed: ${response.error}`);
    }

    if (response.data) {
      this.currentExecution = response.data;
    }

    return this.currentExecution;
  }

  /**
   * Get current execution state
   */
  getCurrentExecution(): ExecutionDocument | null {
    return this.currentExecution;
  }

  /**
   * Check if API simulation is available
   */
  static isAvailable(): boolean {
    return isAPISimulationEnabled();
  }
}

export const simulationAPI = new SimulationAPI();

/**
 * Hook to get current simulation mode info
 */
export function useSimulationMode() {
  return getSimulationMode();
}