/**
 * Simulation Event Source
 * 
 * Pre-generates events for simulation based on:
 * - Node configurations (rates, distributions)
 * - Simulation duration
 * - Random seed (for reproducibility)
 * 
 * This creates the "input tape" for the simulation that can be
 * replayed deterministically.
 * 
 * @module SimulationEventSource
 */

import { StoredEvent, createEvent } from '@/stores/eventStore';

/**
 * Simulation configuration
 */
export interface SimulationConfig {
  /** Simulation duration (simulation time units) */
  duration: number;
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Start time */
  startTime?: number;
  
  /** Data source configurations */
  dataSources: Array<{
    nodeId: string;
    rate: number; // events per time unit
    distribution?: 'poisson' | 'uniform' | 'exponential';
    dataGenerator?: (count: number) => any;
  }>;
}

/**
 * Simulation Event Source
 */
export class SimulationEventSource {
  private rng: () => number;
  
  constructor(seed?: number) {
    // Simple seeded random number generator (for reproducibility)
    this.rng = this.createSeededRNG(seed);
  }
  
  /**
   * Generate all events for simulation
   */
  generateEvents(config: SimulationConfig): Omit<StoredEvent, 'id'>[] {
    const events: Omit<StoredEvent, 'id'>[] = [];
    const startTime = config.startTime || 0;
    
    // Add simulation start event
    events.push(
      createEvent('SimulationStart', 'system', {}, {
        timestamp: startTime,
        metadata: { context: 'simulation' },
      })
    );
    
    // Generate events for each data source
    config.dataSources.forEach((source) => {
      const sourceEvents = this.generateDataSourceEvents(
        source.nodeId,
        source.rate,
        startTime,
        startTime + config.duration,
        source.distribution || 'poisson',
        source.dataGenerator
      );
      
      events.push(...sourceEvents);
    });
    
    // Add simulation end event
    events.push(
      createEvent('SimulationEnd', 'system', {}, {
        timestamp: startTime + config.duration,
        metadata: { context: 'simulation' },
      })
    );
    
    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`📊 Generated ${events.length} events for simulation`);
    
    return events;
  }
  
  /**
   * Generate events for a single data source
   */
  private generateDataSourceEvents(
    nodeId: string,
    rate: number,
    startTime: number,
    endTime: number,
    distribution: 'poisson' | 'uniform' | 'exponential',
    dataGenerator?: (count: number) => any
  ): Omit<StoredEvent, 'id'>[] {
    const events: Omit<StoredEvent, 'id'>[] = [];
    let currentTime = startTime;
    let count = 0;
    
    while (currentTime < endTime) {
      // Generate inter-arrival time
      const interArrivalTime = this.generateInterArrivalTime(rate, distribution);
      currentTime += interArrivalTime;
      
      if (currentTime >= endTime) break;
      
      // Generate data
      const data = dataGenerator ? dataGenerator(count) : { value: this.rng() * 100 };
      
      // Create event
      events.push(
        createEvent('SourceEmit', nodeId, { payload: data }, {
          timestamp: currentTime,
          metadata: {
            context: 'simulation',
            tags: ['generated', 'data-source'],
          },
        })
      );
      
      count++;
    }
    
    return events;
  }
  
  /**
   * Generate inter-arrival time based on distribution
   */
  private generateInterArrivalTime(
    rate: number,
    distribution: 'poisson' | 'uniform' | 'exponential'
  ): number {
    const meanTime = 1 / rate;
    
    switch (distribution) {
      case 'poisson':
      case 'exponential':
        // Exponential inter-arrival times (Poisson process)
        return -Math.log(1 - this.rng()) * meanTime;
      
      case 'uniform':
        return meanTime;
      
      default:
        return meanTime;
    }
  }
  
  /**
   * Create seeded random number generator
   */
  private createSeededRNG(seed?: number): () => number {
    if (seed === undefined) {
      return Math.random;
    }
    
    // Linear congruential generator
    let state = seed;
    
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick generation for simple scenarios
 */
export function generateSimpleSimulation(
  duration: number,
  sources: Array<{ nodeId: string; rate: number }>
): Omit<StoredEvent, 'id'>[] {
  const eventSource = new SimulationEventSource();
  
  return eventSource.generateEvents({
    duration,
    dataSources: sources.map(s => ({
      ...s,
      distribution: 'poisson',
    })),
  });
}
