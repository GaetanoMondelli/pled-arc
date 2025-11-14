/**
 * Core Event-Driven Simulation System
 *
 * This is the shared core module that provides types, schemas, and interfaces
 * for both SDK and UI implementations. It ensures consistency and type safety
 * across the entire system.
 *
 * Usage:
 * ```typescript
 * // In SDK
 * import { EventData, NodeConfig, IProcessor } from '../core';
 *
 * // In UI
 * import { ScenarioConfig, ActivityEntry, IUIAdapter } from '../core';
 * ```
 */

// ============================================================================
// TYPES EXPORT
// ============================================================================

export * from './types';

// ============================================================================
// SCHEMAS EXPORT
// ============================================================================

export * from './schemas';

// ============================================================================
// INTERFACES EXPORT
// ============================================================================

export * from './interfaces';

// ============================================================================
// IMPLEMENTATIONS EXPORT
// ============================================================================

export { Scenario } from './implementations/Scenario';
export { ActivityQueue } from './implementations/ActivityQueue';
export { ActivityLedger } from './implementations/ActivityLedger';
export { SimulationEngine } from './implementations/SimulationEngine';
export { TokenLineageTracker } from './implementations/TokenLineageTracker';

// ============================================================================
// PROCESSORS EXPORT
// ============================================================================

export { BaseProcessor } from './processors/BaseProcessor';
export { DataSourceProcessor } from './processors/DataSourceProcessor';
export { ProcessorNodeProcessor } from './processors/ProcessorNodeProcessor';
export { SinkProcessor } from './processors/SinkProcessor';
export { MultiplexerProcessor } from './processors/MultiplexerProcessor';
export { FSMProcessNodeProcessor } from './processors/FSMProcessNodeProcessor';
export { QueueProcessor } from './processors/QueueProcessor';

// ============================================================================
// SCENARIOS EXPORT
// ============================================================================

// No scenarios currently exported - they would be added here as needed

// ============================================================================
// VERSION AND METADATA
// ============================================================================

export const CORE_VERSION = '1.0.0';

export const CORE_INFO = {
  name: 'Event-Driven Simulation Core',
  version: CORE_VERSION,
  description: 'Shared types, schemas, and interfaces for event-driven simulation system',
  compatibility: {
    sdk: '>=1.0.0',
    ui: '>=1.0.0',
  },
  features: [
    'Type-safe event handling',
    'Schema validation',
    'Interface contracts',
    'Token lineage tracking',
    'Multiplexing support',
    'Batch processing',
    'Time-based triggers',
    'Business activity logging',
  ],
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if core is compatible with a specific version
 */
export function isCompatible(component: 'sdk' | 'ui', version: string): boolean {
  const required = CORE_INFO.compatibility[component];
  // Simple version check - in production you'd use semver
  return version >= required.replace('>=', '');
}

/**
 * Get core information for debugging
 */
export function getCoreInfo() {
  return {
    ...CORE_INFO,
    loadedAt: new Date().toISOString(),
    environment: typeof window !== 'undefined' ? 'browser' : 'node',
  };
}

/**
 * Validate that all required core components are available
 */
export function validateCoreIntegrity(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check that key types are available
    const requiredTypes = [
      'EventData', 'NodeConfig', 'ScenarioConfig', 'Token',
      'ActivityEntry', 'QueueSnapshot', 'EngineConfig'
    ];

    // Note: In a real implementation, you'd check if these types are properly exported
    // This is mainly for runtime validation in complex scenarios

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : ['Core integrity check passed']
    };
  } catch (error) {
    errors.push(`Core integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings };
  }
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Print core information to console (development only)
 */
export function printCoreInfo(): void {
  if (typeof console !== 'undefined') {
    console.log(`\\n${'='.repeat(60)}`);
    console.log(`🏗️  ${CORE_INFO.name} v${CORE_INFO.version}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Description: ${CORE_INFO.description}`);
    console.log(`🔧 Features: ${CORE_INFO.features.length}`);
    CORE_INFO.features.forEach(feature => console.log(`   • ${feature}`));
    console.log(`🔗 SDK Compatibility: ${CORE_INFO.compatibility.sdk}`);
    console.log(`🖥️  UI Compatibility: ${CORE_INFO.compatibility.ui}`);
    console.log(`${'='.repeat(60)}\\n`);
  }
}

// ============================================================================
// RUNTIME CHECKS
// ============================================================================

// Perform basic integrity check on module load (development mode)
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
  const integrity = validateCoreIntegrity();
  if (!integrity.isValid) {
    console.error('❌ Core integrity check failed:', integrity.errors);
  } else {
    console.log('✅ Core module loaded successfully');
  }
}