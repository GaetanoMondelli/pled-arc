import type { FSMDefinition, FSMOutputConfig, FSMState } from "./types";

/**
 * Analyzes an FSM definition and extracts dynamic outputs from emit actions
 */
export function extractFSMOutputs(fsm: FSMDefinition): FSMOutputConfig[] {
  const outputs: FSMOutputConfig[] = [];
  const outputNames = new Set<string>();

  // Scan all states for emit actions
  fsm.states.forEach((state: FSMState) => {
    // Check onEntry actions
    state.onEntry?.forEach(action => {
      if (action.action === 'emit' && action.target) {
        outputNames.add(action.target);
      }
    });

    // Check onExit actions
    state.onExit?.forEach(action => {
      if (action.action === 'emit' && action.target) {
        outputNames.add(action.target);
      }
    });
  });

  // Create output configurations for each discovered output
  outputNames.forEach(name => {
    outputs.push({
      name,
      interface: {
        type: "Any", // Default interface, can be customized
        requiredFields: []
      },
      destinationNodeId: "", // Will be connected in editor
      destinationInputName: ""
    });
  });

  return outputs;
}

/**
 * Updates an FSM definition with dynamically extracted outputs
 */
export function updateFSMWithDynamicOutputs(fsm: FSMDefinition): FSMDefinition {
  const dynamicOutputs = extractFSMOutputs(fsm);

  return {
    ...fsm,
    outputs: dynamicOutputs
  };
}

/**
 * Validates that all emit actions reference valid outputs
 */
export function validateFSMOutputs(fsm: FSMDefinition): string[] {
  const errors: string[] = [];
  const definedOutputs = new Set(fsm.outputs?.map(o => o.name) || []);
  const referencedOutputs = new Set<string>();

  // Collect all referenced outputs from emit actions
  fsm.states.forEach((state: FSMState) => {
    state.onEntry?.forEach(action => {
      if (action.action === 'emit' && action.target) {
        referencedOutputs.add(action.target);
      }
    });

    state.onExit?.forEach(action => {
      if (action.action === 'emit' && action.target) {
        referencedOutputs.add(action.target);
      }
    });
  });

  // Check for undefined outputs
  referencedOutputs.forEach(outputName => {
    if (!definedOutputs.has(outputName)) {
      errors.push(`Emit action references undefined output: ${outputName}`);
    }
  });

  // Check for unused outputs
  definedOutputs.forEach(outputName => {
    if (!referencedOutputs.has(outputName)) {
      errors.push(`Defined output is never used: ${outputName}`);
    }
  });

  return errors;
}

/**
 * Gets all possible outputs that could be emitted by an FSM
 */
export function getFSMPossibleOutputs(fsm: FSMDefinition): string[] {
  return extractFSMOutputs(fsm).map(o => o.name);
}

/**
 * Creates a default FSM configuration with basic emit structure
 */
export function createDefaultFSM(): FSMDefinition {
  return {
    states: [
      {
        name: "idle",
        isInitial: true
      },
      {
        name: "processing",
        onEntry: [
          {
            action: "log",
            value: "Processing started"
          }
        ]
      },
      {
        name: "emitting",
        onEntry: [
          {
            action: "emit",
            target: "output",
            formula: "input.data.value"
          }
        ]
      }
    ],
    transitions: [
      {
        from: "idle",
        to: "processing",
        trigger: "token_received"
      },
      {
        from: "processing",
        to: "emitting",
        trigger: "condition",
        condition: "input.data.value > 0"
      },
      {
        from: "emitting",
        to: "idle",
        trigger: "emission_complete"
      }
    ],
    variables: {},
    outputs: [
      {
        name: "output",
        interface: {
          type: "SimpleValue",
          requiredFields: ["data.value"]
        }
      }
    ]
  };
}