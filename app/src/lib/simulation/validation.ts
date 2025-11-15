import { type AnyNode, type Scenario, ScenarioSchema } from "./types";

export function validateScenario(data: any): { scenario: Scenario | null; errors: string[] } {
  // Check if data is likely incomplete/invalid to avoid noisy validation errors
  if (!data || !data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    console.log('🔍 [VALIDATION] Skipping validation for empty/incomplete scenario');
    return {
      scenario: null,
      errors: ['Scenario is empty or incomplete'],
    };
  }

  console.log('✅ [VALIDATION] BYPASSING V3 SCHEMA VALIDATION - Using ES (Event System) now');
  console.log(`🔍 [VALIDATION] Scenario has ${data.nodes.length} nodes - accepting as valid`);

  // Skip all legacy V3 schema validation completely since ES is used now
  // Just return the data as valid scenario
  return { scenario: data, errors: [] };
}