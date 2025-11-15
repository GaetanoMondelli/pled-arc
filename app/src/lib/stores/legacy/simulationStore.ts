import { nanoid } from "@/lib/nanoid";
import { evaluateFormula } from "@/lib/simulation/formulaEngine";
import {
  calculateGenerationLevel,
  createAggregationDetails,
  createEnhancedSourceTokenSummaries,
  createLineageMetadata,
  createTransformationDetails,
  determineOperationType,
  extractUltimateSources,
} from "@/lib/simulation/lineageHelpers";
import { ActivityMessages, ActivityColors } from "@/lib/simulation/activityMessages";
import { TokenLineageTracker } from "@/lib/simulation/tokenLineage";
import {
  type AggregationDetails,
  type AnyNode,
  type AnyNodeState,
  DataSourceNodeSchema,
  type DataSourceState,
  FSMProcessNodeSchema,
  type FSMProcessNodeState,
  type HistoryEntry,
  type LineageMetadata,
  type NodeStateMachineState,
  ProcessNodeSchema,
  type ProcessNodeState,
  QueueNodeSchema,
  type QueueState,
  type Scenario,
  SinkNodeSchema,
  type SinkState,
  type SourceTokenSummary,
  type StateMachineInfo,
  type Token,
  type TransformationDetails,
} from "@/lib/simulation/types";
import { validateScenario } from "@/lib/simulation/validation";
import { templateService } from "@/lib/template-service";
import type { TemplateDocument, ExecutionDocument } from "@/lib/firestore-types";
import { z } from "zod";
import { create } from "zustand";

const MAX_SINK_TOKENS_STORED = 50;
const MAX_NODE_ACTIVITY_LOGS = 500;
const MAX_GLOBAL_ACTIVITY_LOGS = 1000;

/**
 * Prepares a scenario for saving by ensuring it contains original nodes, not grouped ones
 */
function getSaveReadyScenario(scenario: Scenario): Scenario {
  console.log("🔄 getSaveReadyScenario called with visualMode:", scenario?.groups?.visualMode);

  if (!scenario?.groups?.visualMode || scenario.groups.visualMode === "all") {
    console.log("❌ Not grouped, saving as-is");
    return scenario;
  }

  console.log("✅ Scenario is grouped, proceeding with connection restoration...");

  // If grouped, restore the original scenario by removing Group nodes and restoring original connections
  const groupNodes = scenario.nodes.filter(n => n.type === "Group");
  const groupedNodeIds = scenario.groups?.groupedNodeIds || [];

  console.log("getSaveReadyScenario - Found group nodes:", groupNodes.map(g => ({ id: g.nodeId, containedNodes: 'containedNodes' in g ? g.containedNodes : 'NO_CONTAINED_NODES' })));

  // Create a map from group node ID to the original nodes it contained
  const groupToOriginalNodesMap = new Map<string, string[]>();
  groupNodes.forEach(groupNode => {
    if ('containedNodes' in groupNode && groupNode.containedNodes) {
      console.log(`Group ${groupNode.nodeId} contains nodes:`, groupNode.containedNodes);
      groupToOriginalNodesMap.set(groupNode.nodeId, groupNode.containedNodes);
    } else {
      console.warn(`Group ${groupNode.nodeId} has no containedNodes!`);
    }
  });

  const originalNodes = scenario.nodes
    .filter(n => n.type !== "Group") // Remove all Group nodes
    .map(node => {
      // Remove internal grouping flags
      const { _isGrouped, ...cleanNode } = node as any;

      // If this node has outputs connecting to group nodes, restore the original connections
      if ('outputs' in cleanNode && cleanNode.outputs) {
        const restoredOutputs = cleanNode.outputs.map((output: any) => {
          // Check if this output is connecting to a group node
          const targetGroupId = output.destinationNodeId;
          if (targetGroupId && targetGroupId.startsWith('group_')) {
            console.log(`Found connection from ${cleanNode.nodeId} to group ${targetGroupId}, input: ${output.destinationInputName}`);

            // Find the group node and determine which original node this should connect to
            const containedNodes = groupToOriginalNodesMap.get(targetGroupId) || [];
            console.log(`Group ${targetGroupId} contains nodes:`, containedNodes);

            // Parse the input name to find which original node this was meant for
            // Format is "input-{originalNodeDisplayName}.{inputName}"
            const inputMatch = output.destinationInputName?.match(/^input-(.+)\.(.+)$/);
            console.log(`Input name "${output.destinationInputName}" parsing result:`, inputMatch);

            if (inputMatch) {
              const [, originalNodeDisplayName, originalInputName] = inputMatch;
              console.log(`Looking for original node with display name: "${originalNodeDisplayName}"`);

              // Find the original node by display name
              const originalTargetNode = scenario.nodes.find(n =>
                containedNodes.includes(n.nodeId) && n.displayName === originalNodeDisplayName
              );

              console.log(`Original target node found:`, originalTargetNode ? `${originalTargetNode.nodeId} (${originalTargetNode.displayName})` : 'NOT FOUND');

              if (originalTargetNode) {
                console.log(`✅ Restoring connection from ${cleanNode.nodeId} to ${originalTargetNode.nodeId} (was connecting to group ${targetGroupId})`);
                return {
                  ...output,
                  destinationNodeId: originalTargetNode.nodeId,
                  destinationInputName: originalInputName,
                };
              } else {
                console.error(`❌ Could not find original target node for ${originalNodeDisplayName} in group ${targetGroupId}`);
              }
            } else {
              console.error(`❌ Could not parse input name: ${output.destinationInputName}`);
            }
          }
          return output;
        });

        return {
          ...cleanNode,
          outputs: restoredOutputs,
        };
      }

      return cleanNode;
    });

  // IMPORTANT: Preserve the activeFilters so it gets saved with the template
  const savedActiveFilters = scenario.groups?.activeFilters || [];
  console.log("💾 Saving scenario with activeFilters:", savedActiveFilters);

  return {
    ...scenario,
    nodes: originalNodes,
    groups: {
      ...scenario.groups,
      visualMode: "all",
      activeFilters: savedActiveFilters,
      groupedNodeIds: [], // Clear grouped node tracking
    },
  };
}

interface ScenarioSnapshot {
  scenario: Scenario | null;
  timestamp: number;
  description: string;
}

interface SimulationState {
  scenario: Scenario | null;
  nodesConfig: Record<string, AnyNode>;
  nodeStates: Record<string, AnyNodeState>;
  currentTime: number;
  isRunning: boolean;
  simulationSpeed: number;
  eventCounter: number;
  nodeActivityLogs: Record<string, HistoryEntry[]>;
  globalActivityLog: HistoryEntry[];

  // Execution-based activity storage (preserves data across resets)
  executionHistory: ExecutionDocument[];
  currentExecutionId: string | null;

  selectedNodeId: string | null;
  selectedToken: Token | null;
  isGlobalLedgerOpen: boolean;
  errorMessages: string[];

  // Node activity tracking for visual feedback
  activeNodeIds: Set<string>;
  recentlyActiveNodeIds: Set<string>;
  lastStepInvolvedNodes: string[];

  // Template and execution management
  currentTemplate: TemplateDocument | null;
  currentExecution: ExecutionDocument | null;
  availableTemplates: TemplateDocument[];
  // Track unsaved changes for real-time UI feedback
  hasUnsavedChanges: boolean;

  // External event queue (set by template editor)
  externalQueue: any | null;

  // Undo/Redo system
  undoHistory: ScenarioSnapshot[];
  redoHistory: ScenarioSnapshot[];

  // Actions
  loadScenario: (scenarioData: any) => Promise<void>;
  startNewExecution: () => void;
  endCurrentExecution: () => void;
  restoreExecution: (executionId: string) => boolean;
  play: () => void;
  pause: () => void;
  stepForward: (timeIncrement?: number) => void;
  timestamp: () => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedToken: (token: Token | null) => void;
  clearErrors: () => void;

  // Node activity tracking actions
  markNodeActive: (nodeId: string) => void;
  markNodeInactive: (nodeId: string) => void;
  markNodesAsRecentlyActive: (nodeIds: string[]) => void;
  clearNodeActivity: () => void;
  getNodeActivityStatus: (nodeId: string) => { isActive: boolean; isRecentlyActive: boolean; wasInLastStep: boolean };
  updateNodeConfigInStore: (nodeId: string, newConfigData: any) => boolean;
  markAsUnsavedChanges: () => void;
  toggleGlobalLedger: () => void;
  setEventDrivenMode: (isEventDriven: boolean) => void;
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveSnapshot: (description: string) => void;

  // Template and execution actions
  loadTemplates: () => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>;
  createNewTemplate: (name: string, description?: string, fromDefault?: boolean) => Promise<string>;
  saveCurrentAsTemplate: (name: string, description?: string) => Promise<string>;
  updateCurrentTemplate: () => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  saveExecution: (name: string, description?: string) => Promise<string>;
  loadExecution: (executionId: string) => Promise<void>;
  createNewExecution: (name: string, description?: string) => Promise<string>;

  // External queue management
  setExternalQueue: (queue: any) => void;

  // Helper functions
  _updateNodeState: (nodeId: string, partialState: Partial<AnyNodeState>) => void;
  _transitionNodeState: (nodeId: string, newState: NodeStateMachineState, timestamp: number, trigger?: string) => void;
  _logNodeActivity: (
    nodeIdForLog: string,
    logCoreDetails: Omit<HistoryEntry, "timestamp" | "nodeId" | "epochTimestamp" | "sequence" | "state" | "bufferSize" | "outputBufferSize">,
    timestamp: number,
  ) => HistoryEntry;
  _createToken: (originNodeId: string, value: any, timestamp: number, sourceTokens?: Token[]) => Token;
  _tryFireProcessNode: (pnConfig: any, pnState: ProcessNodeState, timestamp: number) => void;
  _restoreScenarioState: (scenario: Scenario) => void;
  _executeFSMTransition: (fsmConfig: any, fsmState: any, transition: any, newTime: number) => void;
  _executeFSMAction: (fsmConfig: any, fsmState: any, action: any, newTime: number) => void;
  _routeFSMToken: (fsmConfig: any, token: Token, outputConfig: any, newTime: number) => void;
  _restoreExecutionState: (execution: ExecutionDocument) => void;
}

// Simple default scenario to prevent loading issues
const DEFAULT_SCENARIO: Scenario = {
  id: "default",
  name: "Default Scenario",
  description: "A simple default scenario",
  nodes: [
    {
      nodeId: "source1",
      type: "DataSource",
      displayName: "Source",
      x: 100,
      y: 100,
      emissionRate: 1,
      emissionValues: [1, 2, 3],
      outputs: [{ destinationNodeId: "sink1" }]
    },
    {
      nodeId: "sink1",
      type: "Sink",
      displayName: "Sink",
      x: 300,
      y: 100
    }
  ],
  edges: [
    {
      id: "edge1",
      source: "source1",
      target: "sink1"
    }
  ]
};

// Initialize nodes configuration and states for default scenario
const DEFAULT_NODES_CONFIG: Record<string, AnyNode> = {
  source1: DEFAULT_SCENARIO.nodes[0] as any,
  sink1: DEFAULT_SCENARIO.nodes[1] as any,
};

const DEFAULT_NODE_STATES: Record<string, AnyNodeState> = {
  source1: {
    lastEmissionTime: -1,
    stateMachine: {
      currentState: "source_idle",
      transitionHistory: []
    }
  } as DataSourceState,
  sink1: {
    consumedTokenCount: 0,
    lastConsumedTime: -1,
    consumedTokens: [],
    stateMachine: {
      currentState: "sink_idle",
      transitionHistory: []
    }
  } as SinkState,
};

const DEFAULT_ACTIVITY_LOGS: Record<string, HistoryEntry[]> = {
  source1: [],
  sink1: [],
};

export const useSimulationStore = create<SimulationState>((rawSet, get) => {
  // Wrap set to intercept and block legacy log pollution
  const set: typeof rawSet = (partial) => {
    if (typeof partial === 'function') {
      rawSet((state) => {
        const updates = partial(state);
        // Block legacy log updates in event-driven mode
        if (updates && typeof updates === 'object') {
          if ('globalActivityLog' in updates && Array.isArray(updates.globalActivityLog) && updates.globalActivityLog.length > 0) {
            console.warn(`🚫🚫🚫 [NUCLEAR BLOCK] Prevented ${updates.globalActivityLog.length} legacy logs from contaminating event-driven mode!`);
            return { ...updates, globalActivityLog: [] };
          }
        }
        return updates;
      });
    } else {
      // Block legacy log updates in event-driven mode
      if (partial && typeof partial === 'object') {
        if ('globalActivityLog' in partial && Array.isArray(partial.globalActivityLog) && partial.globalActivityLog.length > 0) {
          console.warn(`🚫🚫🚫 [NUCLEAR BLOCK] Prevented ${partial.globalActivityLog.length} legacy logs from contaminating event-driven mode!`);
          rawSet({ ...partial, globalActivityLog: [] });
          return;
        }
      }
      rawSet(partial);
    }
  };
  
  return {
  // Initial state
  scenario: DEFAULT_SCENARIO,
  nodesConfig: DEFAULT_NODES_CONFIG,
  nodeStates: DEFAULT_NODE_STATES,
  currentTime: 0,
  isRunning: false,
  simulationSpeed: 1,
  eventCounter: 0,
  nodeActivityLogs: DEFAULT_ACTIVITY_LOGS,
  globalActivityLog: [], // ALWAYS starts empty
  selectedNodeId: null,
  selectedToken: null,
  isGlobalLedgerOpen: false,
  errorMessages: [],

  // Node activity tracking for visual feedback
  activeNodeIds: new Set<string>(),
  recentlyActiveNodeIds: new Set<string>(),
  lastStepInvolvedNodes: [],

  // Execution history
  executionHistory: [],
  currentExecutionId: null,

  // Template and execution state
  currentTemplate: null,
  currentExecution: null,
  availableTemplates: [],
  hasUnsavedChanges: false,

  // External queue state
  externalQueue: null,

  // Undo/Redo state
  undoHistory: [],
  redoHistory: [],

  // Actions
  loadScenario: async (scenarioData: any) => {
    const currentState = get();

    console.log('🔍 [SimStore loadScenario] Called with scenario:', {
      hasData: !!scenarioData,
      nodeCount: scenarioData?.nodes?.length || 0,
      isRunning: currentState.isRunning,
      currentTime: currentState.currentTime,
      hasExecution: !!currentState.currentExecutionId
    });

    // BLOCK loadScenario during active simulation to prevent resets
    if (currentState.isRunning || (currentState.currentTime > 0 && currentState.currentExecutionId)) {
      console.warn('🚫 [BLOCKED] loadScenario called during active simulation - BLOCKING to prevent reset!');
      console.warn('🚫 Current time:', currentState.currentTime, 'Running:', currentState.isRunning, 'Execution:', currentState.currentExecutionId);
      console.trace('🚫 Call stack:');
      return;
    }

    console.log('🔄 Loading scenario with data:', scenarioData);

    // ULTIMATE SAFETY CHECK: Immediately exit if scenario data is clearly invalid
    if (!scenarioData ||
        !scenarioData.nodes ||
        !Array.isArray(scenarioData.nodes) ||
        scenarioData.nodes.length === 0 ||
        scenarioData.nodes.every((node: any) => !node || typeof node !== 'object' || !node.nodeId)) {
      console.log('🛑 [ULTIMATE SAFETY] Refusing to load invalid scenario data - exiting immediately');
      return;
    }

    // Log FSM nodes in incoming scenario BEFORE validation
    const fsmNodes = scenarioData?.nodes?.filter((n: any) => n.type === 'FSMProcessNode') || [];
    fsmNodes.forEach((fsm: any) => {
      console.log(`📥 [LOAD SCENARIO] FSM ${fsm.nodeId} incoming:`, {
        hasOutputs: !!fsm.outputs,
        outputsLength: fsm.outputs?.length || 0,
        outputNames: fsm.outputs?.map((o: any) => o.name) || [],
        fsmOutputs: fsm.fsm?.outputs || []
      });
    });
    
    // Debug incoming scenario data
    console.log('🔍 [LOAD SCENARIO] Incoming scenarioData:', {
      hasScenarioData: !!scenarioData,
      hasNodes: !!scenarioData?.nodes,
      isNodesArray: Array.isArray(scenarioData?.nodes),
      nodesLength: scenarioData?.nodes?.length,
      nodeTypes: scenarioData?.nodes?.map((n: any) => ({ type: n?.type, id: n?.nodeId, isUndefined: n === undefined }))
    });

    // Skip validation and loading for clearly invalid scenarios
    if (!scenarioData || !scenarioData.nodes || !Array.isArray(scenarioData.nodes) || scenarioData.nodes.length === 0) {
      console.log('🔍 [LOAD SCENARIO] Skipping load for empty/invalid scenario');
      return;
    }

    // Check if nodes are actually valid objects (not undefined)
    const validNodes = scenarioData.nodes.filter((node: any) => node && typeof node === 'object' && node.nodeId);
    if (validNodes.length === 0) {
      console.log('🔍 [LOAD SCENARIO] Skipping load - no valid nodes found (all nodes are undefined/invalid)');
      return;
    }

    // If we have some invalid nodes mixed with valid ones, filter them out
    if (validNodes.length < scenarioData.nodes.length) {
      console.warn(`🔍 [LOAD SCENARIO] Filtering out ${scenarioData.nodes.length - validNodes.length} invalid nodes`);
      scenarioData = {
        ...scenarioData,
        nodes: validNodes
      };
    }

    const { scenario: parsedScenario, errors } = validateScenario(scenarioData);
    console.log('🔍 Validation result - errors:', errors.length, 'parsed scenario:', !!parsedScenario);
    if (errors.length > 0) {
      // Check if these are just "undefined node" errors that we should silence
      const hasUndefinedNodeErrors = errors.some(error =>
        error.includes('Invalid input (received: undefined)')
      );

      // Only log as error if this was unexpected (scenario has nodes but still failed)
      if (errors.length === 1 && errors[0] === 'Scenario is empty or incomplete') {
        console.log('🔍 [LOAD SCENARIO] Skipped loading incomplete scenario');
        return;
      } else if (hasUndefinedNodeErrors) {
        console.log('🔍 [LOAD SCENARIO] Skipped loading scenario with undefined nodes - clearing scenario');
        // Clear the scenario to prevent future attempts
        set({
          scenario: null,
          nodesConfig: {},
          nodeStates: {},
          globalActivityLog: [],
          nodeActivityLogs: {},
          eventCounter: 0,
          currentTime: 0,
          errorMessages: [],
        });
        return;
      } else {
        console.error('❌ Scenario validation failed with errors:', errors);
      }
      set({
        errorMessages: errors,
        scenario: null,
        nodesConfig: {},
        nodeStates: {},
        globalActivityLog: [],
        nodeActivityLogs: {},
        eventCounter: 0,
      });
      return;
    }
    if (!parsedScenario) {
      set({
        errorMessages: ["Failed to parse scenario."],
        scenario: null,
        nodesConfig: {},
        nodeStates: {},
        globalActivityLog: [],
        nodeActivityLogs: {},
        eventCounter: 0,
      });
      return;
    }

    const nodesConfig: Record<string, AnyNode> = {};
    const initialNodeStates: Record<string, AnyNodeState> = {};
    const initialLogs: Record<string, HistoryEntry[]> = {};

    // Pre-process nodes: ensure FSM nodes have outputs array initialized from fsm.outputs
    parsedScenario.nodes = parsedScenario.nodes.map(node => {
      if (node.type === 'FSMProcessNode' && (node as any).fsm?.outputs) {
        const fsmOutputNames = (node as any).fsm.outputs;
        
        console.log(`🔍 [INIT FSM] Processing FSM ${node.nodeId}:`, {
          fsmOutputs: fsmOutputNames,
          hasNodeOutputs: !!node.outputs,
          nodeOutputsLength: node.outputs?.length || 0,
          nodeOutputNames: node.outputs?.map((o: any) => o.name) || []
        });
        
        // If node already has outputs array, check if they match fsm.outputs
        if (node.outputs && node.outputs.length > 0) {
          const existingOutputNames = new Set(node.outputs.map((o: any) => o.name));
          const allFsmOutputsPresent = fsmOutputNames.every((name: string) => existingOutputNames.has(name));
          
          if (allFsmOutputsPresent) {
            // All fsm.outputs are in node.outputs - good!
            console.log(`✅ [INIT FSM] FSM ${node.nodeId} outputs match fsm.outputs`);
            return node;
          }
          
          // Check if node.outputs has EXTRA outputs not in fsm.outputs
          const extraOutputs = node.outputs.filter((o: any) => !fsmOutputNames.includes(o.name));
          if (extraOutputs.length > 0) {
            console.warn(`⚠️ [INIT FSM] FSM ${node.nodeId} has outputs not in fsm.outputs:`, extraOutputs.map((o: any) => o.name));
            console.warn(`⚠️ [INIT FSM] Current fsm.outputs:`, fsmOutputNames);
            
            // Check if any extra outputs have connections
            const connectedExtraOutputs = extraOutputs.filter((o: any) => 
              o.destinationNodeId && o.destinationNodeId.trim() !== ''
            );
            
            if (connectedExtraOutputs.length > 0) {
              // CRITICAL FIX: If extra outputs have connections, UPDATE fsm.outputs to include them
              console.warn(`🔧 [INIT FSM] FSM ${node.nodeId} has connected outputs not in fsm.outputs. Updating fsm.outputs to include:`, connectedExtraOutputs.map((o: any) => o.name));
              
              const updatedFsmOutputs = [...fsmOutputNames, ...connectedExtraOutputs.map((o: any) => o.name)];
              
              // Keep ALL outputs (both from fsm.outputs and connected extras)
              const validOutputNames = new Set(node.outputs.map((o: any) => o.name));
              const missingOutputs = fsmOutputNames.filter((name: string) => !validOutputNames.has(name));
              
              if (missingOutputs.length > 0) {
                console.log(`➕ [INIT FSM] Adding missing fsm.outputs to FSM ${node.nodeId}:`, missingOutputs);
                return {
                  ...node,
                  fsm: {
                    ...(node as any).fsm,
                    outputs: updatedFsmOutputs
                  },
                  outputs: [
                    ...node.outputs,
                    ...missingOutputs.map((outputName: string) => ({
                      name: outputName,
                      destinationNodeId: '',
                      destinationInputName: '',
                      interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
                    }))
                  ]
                };
              }
              
              return {
                ...node,
                fsm: {
                  ...(node as any).fsm,
                  outputs: updatedFsmOutputs
                }
              };
            } else {
              // Extra outputs have no connections - remove them and keep only fsm.outputs
              console.warn(`🗑️ [INIT FSM] Removing unconnected outputs not in fsm.outputs from FSM ${node.nodeId}:`, extraOutputs.map((o: any) => o.name));
              
              const validOutputs = node.outputs.filter((o: any) => fsmOutputNames.includes(o.name));
              const validOutputNames = new Set(validOutputs.map((o: any) => o.name));
              const missingOutputs = fsmOutputNames.filter((name: string) => !validOutputNames.has(name));
              
              if (missingOutputs.length > 0) {
                console.log(`➕ [INIT FSM] Adding missing fsm.outputs to FSM ${node.nodeId}:`, missingOutputs);
                return {
                  ...node,
                  outputs: [
                    ...validOutputs,
                    ...missingOutputs.map((outputName: string) => ({
                      name: outputName,
                      destinationNodeId: '',
                      destinationInputName: '',
                      interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
                    }))
                  ]
                };
              }
              
              return { ...node, outputs: validOutputs };
            }
          }
          
          // Some fsm.outputs are missing from node.outputs
          const missingOutputs = fsmOutputNames.filter((name: string) => !existingOutputNames.has(name));
          console.log(`➕ [INIT FSM] Adding missing outputs to FSM ${node.nodeId}:`, missingOutputs);
          return {
            ...node,
            outputs: [
              ...node.outputs,
              ...missingOutputs.map((outputName: string) => ({
                name: outputName,
                destinationNodeId: '',
                destinationInputName: '',
                interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
              }))
            ]
          };
        } else {
          // No outputs array, create from fsm.outputs
          console.log(`🔧 [INIT FSM] Creating outputs array for FSM ${node.nodeId} from fsm.outputs:`, fsmOutputNames);
          return {
            ...node,
            outputs: fsmOutputNames.map((outputName: string) => ({
              name: outputName,
              destinationNodeId: '',
              destinationInputName: '',
              interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
            }))
          };
        }
      }
      return node;
    });

    parsedScenario.nodes.forEach(node => {
      nodesConfig[node.nodeId] = node;
      initialLogs[node.nodeId] = [];
      switch (node.type) {
        case "DataSource":
          initialNodeStates[node.nodeId] = {
            lastEmissionTime: -1,
            stateMachine: {
              currentState: "source_idle",
              transitionHistory: []
            }
          } as DataSourceState;
          break;
        case "Queue":
          initialNodeStates[node.nodeId] = {
            inputBuffer: [],
            outputBuffer: [],
            lastAggregationTime: -1,
            stateMachine: {
              currentState: "queue_idle",
              transitionHistory: []
            }
          } as QueueState;
          break;
        case "ProcessNode":
          const inputBuffers: Record<string, Token[]> = {};
          initialNodeStates[node.nodeId] = {
            inputBuffers,
            lastFiredTime: -1,
            stateMachine: {
              currentState: "process_idle",
              transitionHistory: []
            }
          } as ProcessNodeState;
          break;
        case "FSMProcessNode":
          const fsmNode = node as any; // FSMProcessNode type
          const fsmInputBuffers: Record<string, Token[]> = {};
          const initialState = fsmNode.fsm?.initialState || fsmNode.fsm?.states?.[0] || "idle";
          initialNodeStates[node.nodeId] = {
            inputBuffers: fsmInputBuffers,
            fsmVariables: { ...fsmNode.fsm?.variables } || {},
            currentFSMState: initialState,
            lastTransitionTime: -1,
            stateMachine: {
              currentState: initialState,
              transitionHistory: []
            }
          } as any; // FSMProcessNodeState;
          break;
        case "StateMultiplexer":
          // StateMultiplexer nodes route inputs to outputs based on conditions
          const multiplexerInputBuffers: Record<string, Token[]> = {};
          initialNodeStates[node.nodeId] = {
            inputBuffers: multiplexerInputBuffers,
            lastProcessedTime: -1,
            stateMachine: {
              currentState: "multiplexer_idle",
              transitionHistory: []
            }
          } as any;
          break;
        case "Sink":
          initialNodeStates[node.nodeId] = {
            consumedTokenCount: 0,
            lastConsumedTime: -1,
            consumedTokens: [],
            stateMachine: {
              currentState: "sink_idle",
              transitionHistory: []
            }
          } as SinkState;
          break;
        case "Module":
          const moduleNode = node as any; // ModuleNode type
          initialNodeStates[node.nodeId] = {
            inputBuffers: {},
            outputBuffers: {},
            subGraphStates: {},
            isExpanded: moduleNode.isExpanded || false,
            lastProcessedTime: -1,
            processedTokenCount: 0,
            internalEventCounter: 0,
            stateMachine: {
              currentState: "module_idle",
              transitionHistory: []
            }
          } as any; // ModuleState
          break;
        case "EnhancedFSMProcessNode":
          // Enhanced FSM support - basic implementation
          const enhancedFsmNode = node as any; // EnhancedFSMProcessNode type
          initialNodeStates[node.nodeId] = {
            currentState: "idle",
            previousState: undefined,
            stateChangedAt: 0,
            variables: {},
            stateVariables: {},
            eventBuffer: [],
            messageBuffer: [],
            tokenBuffers: { default: [] },
            lastProcessedTime: 0,
            processedEventCount: 0,
            processedMessageCount: 0,
            feedbackDepth: 0,
            circuitBreakerState: {
              isOpen: false,
              eventCount: 0,
              windowStartTime: 0,
            },
            stateHistory: [{ state: "idle", enteredAt: 0 }],
            transitionHistory: [],
            pendingActions: [],
            actionHistory: [],
            errors: []
          } as any; // EnhancedFSMProcessNodeState
          break;
        case "Group":
          // Group nodes don't need simulation state, they're visual only
          break;
      }
    });

    console.log('✅ Scenario validation successful! Setting scenario with', parsedScenario.nodes?.length, 'nodes');
    set({
      scenario: parsedScenario,
      nodesConfig,
      nodeStates: initialNodeStates,
      currentTime: 0,
      isRunning: false,
      nodeActivityLogs: initialLogs,
      globalActivityLog: [],
      errorMessages: [],
      selectedNodeId: null,
      // DON'T reset unsaved changes here - let the save process handle it
      selectedToken: null,
      isGlobalLedgerOpen: false,
      eventCounter: 0,
    });
  },

  startNewExecution: () => {
    const executionId = nanoid(12);
    const now = Date.now();

    console.log(`🚀 [EXECUTION] Starting new execution: ${executionId}`);

    const state = get();

    // Create a proper ExecutionDocument
    const executionDoc: ExecutionDocument = {
      id: executionId,
      templateId: state.currentTemplate?.id || 'no-template',
      name: `Execution ${new Date().toLocaleTimeString()}`,
      description: `Simulation run started at ${new Date().toLocaleString()}`,
      scenario: state.scenario!,
      nodeStates: { ...state.nodeStates },
      currentTime: 0,
      eventCounter: 0,
      globalActivityLog: [],
      nodeActivityLogs: Object.keys(state.nodesConfig).reduce((acc, nodeId) => {
        acc[nodeId] = [];
        return acc;
      }, {} as Record<string, HistoryEntry[]>),
      startedAt: now,
      lastSavedAt: now,
      isCompleted: false,
      createdBy: 'user'
    };

    set(state => ({
      currentExecutionId: executionId,
      currentExecution: executionDoc,
      // Reset activity logs for new execution
      globalActivityLog: [],
      nodeActivityLogs: Object.keys(state.nodesConfig).reduce((acc, nodeId) => {
        acc[nodeId] = [];
        return acc;
      }, {} as Record<string, HistoryEntry[]>),
      currentTime: 0,
      eventCounter: 0,
      isRunning: false
    }));

    // Clear any existing lineage data for fresh start
    TokenLineageTracker.clearAllLineage();
  },

  endCurrentExecution: () => {
    const state = get();
    if (!state.currentExecutionId) return;

    console.log(`🏁 [EXECUTION] Ending execution: ${state.currentExecutionId} after ${state.currentTime} ticks`);

    // Update the current execution with final state
    const executionRecord: ExecutionDocument = {
      ...state.currentExecution!,
      currentTime: state.currentTime,
      eventCounter: state.eventCounter,
      globalActivityLog: [...state.globalActivityLog],
      nodeActivityLogs: { ...state.nodeActivityLogs },
      nodeStates: { ...state.nodeStates },
      lastSavedAt: Date.now(),
      isCompleted: true
    };

    set(state => ({
      executionHistory: [...state.executionHistory, executionRecord],
      currentExecutionId: null,
      currentExecution: null,
      isRunning: false
    }));
  },

  restoreExecution: (executionId: string) => {
    const state = get();
    const execution = state.executionHistory.find(ex => ex.id === executionId);
    if (!execution) {
      console.error(`❌ [EXECUTION] Cannot restore execution ${executionId}: not found`);
      return false;
    }

    console.log(`🔄 [EXECUTION] Restoring execution: ${executionId} with ${execution.currentTime} ticks`);

    set({
      currentExecutionId: executionId,
      currentExecution: execution,
      // Always skip restoring legacy logs in event-driven mode
      globalActivityLog: [],
      nodeActivityLogs: {},
      nodeStates: { ...execution.nodeStates },
      currentTime: execution.currentTime,
      eventCounter: execution.eventCounter,
      isRunning: false
    });
    
    console.log(`🚫 [EVENT-DRIVEN MODE] Skipped restoring ${execution.globalActivityLog?.length || 0} legacy activity logs from execution history`);

    return true;
  },


  stepForward: (timeIncrement = 1) => {
    const { tick, isRunning, globalActivityLog, markNodesAsRecentlyActive } = get();
    if (isRunning) {
      console.warn("Cannot step forward while simulation is running. Pause first.");
      return;
    }

    // Track which nodes are involved in this step
    const logLengthBefore = globalActivityLog.length;

    for (let i = 0; i < timeIncrement; i++) {
      tick();
    }

    // Highlight nodes that were active in this step
    const logLengthAfter = get().globalActivityLog.length;
    const newLogEntries = get().globalActivityLog.slice(logLengthBefore, logLengthAfter);
    const involvedNodeIds = [...new Set(newLogEntries.map(entry => entry.nodeId).filter(Boolean))];

    if (involvedNodeIds.length > 0) {
      console.log(`🎯 Step involved nodes:`, involvedNodeIds);
      markNodesAsRecentlyActive(involvedNodeIds);

      // Clear the highlight after 2 seconds
      setTimeout(() => {
        const currentInvolved = get().lastStepInvolvedNodes;
        if (JSON.stringify(currentInvolved.sort()) === JSON.stringify(involvedNodeIds.sort())) {
          markNodesAsRecentlyActive([]);
        }
      }, 2000);
    }
  },

  timestamp: () => {
    const { nodesConfig, _logNodeActivity, _createToken, _updateNodeState, _transitionNodeState } = get();
    const newTime = get().currentTime + 1;
    set({ currentTime: newTime });

    // Process DataSource nodes
    Object.values(nodesConfig).forEach(nodeConfig => {
      const currentNodeState = get().nodeStates[nodeConfig.nodeId];

      if (nodeConfig.type === "DataSource") {
        const dsState = currentNodeState as DataSourceState;
        if (newTime >= (dsState.lastEmissionTime < 0 ? 0 : dsState.lastEmissionTime) + nodeConfig.interval) {
          // Transition to generating state
          _transitionNodeState(nodeConfig.nodeId, 'source_generating', newTime, 'interval_reached');

          const value =
            Math.floor(Math.random() * (nodeConfig.generation.valueMax - nodeConfig.generation.valueMin + 1)) + nodeConfig.generation.valueMin;
          console.log(`🎲 [DATASOURCE ${nodeConfig.nodeId}] Generated random value: ${value} (range: ${nodeConfig.generation.valueMin}-${nodeConfig.generation.valueMax})`);
          const token = _createToken(nodeConfig.nodeId, value, newTime);

          // Transition to emitting state
          _transitionNodeState(nodeConfig.nodeId, 'source_emitting', newTime, 'token_created');

          // Process all outputs (v3 supports multiple outputs)
          nodeConfig.outputs.forEach(output => {
            const destNodeConfig = nodesConfig[output.destinationNodeId];
            const emissionLog = _logNodeActivity(
              nodeConfig.nodeId,
              {
                action: "token_emitted",
                value: token.value,
                details: ActivityMessages.tokenEmitted(
                  { id: token.id, value: token.value },
                  { id: nodeConfig.nodeId, name: nodeConfig.displayName },
                  { id: output.destinationNodeId, name: destNodeConfig?.displayName || output.destinationNodeId }
                )
              },
              newTime,
            );

            if (destNodeConfig) {
              const destNodeState = get().nodeStates[destNodeConfig.nodeId];
              
              console.log(`🚀 [TOKEN FORWARD] Token ${token.id} (${token.value}) → ${destNodeConfig.type} (${destNodeConfig.nodeId}/${destNodeConfig.displayName})`);

              if (destNodeConfig.type === "Queue") {
                const qState = destNodeState as QueueState;
                if (destNodeConfig.capacity && qState.inputBuffer.length >= destNodeConfig.capacity) {
                  _transitionNodeState(destNodeConfig.nodeId, 'queue_idle', newTime, 'capacity_full');
                  const dropLog = _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "token_dropped",
                      value: token.value,
                      details: `From ${nodeConfig.displayName}, Token ${token.id} - queue at capacity`,
                    },
                    newTime,
                  );
                  token.history.push(dropLog);
                } else {
                  // Proper state transition logic for queue when receiving tokens
                  const currentQueueState = qState.stateMachine?.currentState || 'queue_idle';

                  // Always transition to accumulating when receiving a token
                  // This is the canonical FSM behavior
                  _transitionNodeState(destNodeConfig.nodeId, 'queue_accumulating', newTime, 'token_received');

                  _updateNodeState(destNodeConfig.nodeId, { inputBuffer: [...qState.inputBuffer, token] });

                  // Simplified: Only log state transitions, not individual token operations
                  _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "accumulating",
                      value: token.value,
                      details: `Added Token ${token.id} (${token.value}) to buffer`,
                    },
                    newTime,
                  );
                }
              } else if (destNodeConfig.type === "ProcessNode") {
                _transitionNodeState(destNodeConfig.nodeId, 'process_idle', newTime, 'token_received');
                const pnState = destNodeState as ProcessNodeState;
                const bufferForInput = pnState.inputBuffers[nodeConfig.nodeId] || [];
                _updateNodeState(destNodeConfig.nodeId, {
                  inputBuffers: { ...pnState.inputBuffers, [nodeConfig.nodeId]: [...bufferForInput, token] },
                });

                // Simplified ProcessNode event - state-based
                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "token_received",
                    value: bufferForInput.length + 1,
                    details: `Received token (buffer size: ${bufferForInput.length + 1})`,
                  },
                  newTime,
                );

                // Check if ProcessNode can fire now that it received a token
                const updatedPnState = get().nodeStates[destNodeConfig.nodeId] as ProcessNodeState;
                get()._tryFireProcessNode(destNodeConfig, updatedPnState, newTime);
              } else if (destNodeConfig.type === "FSMProcessNode") {
                // Handle FSM token reception - add to input buffer and check transitions
                const fsmState = destNodeState as any; // FSMProcessNodeState
                const currentFSMState = fsmState.currentFSMState || 'idle';

                // CRITICAL FIX: Find which input this token is for
                const targetInput = destNodeConfig.inputs?.find((inp: any) => 
                  inp.nodeId === nodeConfig.nodeId && inp.sourceOutputName === output.name
                );
                const bufferKey = targetInput?.name || 'input'; // Use actual input name
                
                console.log(`🔍 [FSM ${destNodeConfig.nodeId}] Token routing:`, {
                  sourceNode: nodeConfig.nodeId,
                  sourceOutput: output.name,
                  targetInput: bufferKey,
                  allInputs: destNodeConfig.inputs?.map((i: any) => ({ name: i.name, from: i.nodeId }))
                });

                // Add token to input buffer
                const inputBuffers = fsmState.inputBuffers || {};
                inputBuffers[bufferKey] = [...(inputBuffers[bufferKey] || []), token];
                _updateNodeState(destNodeConfig.nodeId, { inputBuffers });

                // Extract message value from token
                const messageValue = typeof token.value === 'string' ? token.value : JSON.stringify(token.value);
                
                console.log(`📨 [FSM ${destNodeConfig.nodeId}] Received message: "${messageValue}" from ${nodeConfig.displayName} | Token: ${token.id} | Current State: ${currentFSMState}`);
                
                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "message_received",
                    value: messageValue,
                    details: `Message: "${messageValue}" | From: ${nodeConfig.displayName} | State: ${currentFSMState} | Token: ${token.id}`,
                  },
                  newTime,
                );

                // Check for token_received transitions (generic trigger)
                const tokenReceivedTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) =>
                  t.trigger === 'token_received' && t.from === currentFSMState
                ) || [];

                if (tokenReceivedTransitions.length > 0) {
                  console.log(`🎯 [FSM ${destNodeConfig.nodeId}] Found ${tokenReceivedTransitions.length} token_received transitions from state "${currentFSMState}"`);
                }

                tokenReceivedTransitions.forEach((transition: any) => {
                  get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
                });
                
                // Check for message-specific transitions (e.g., trigger = "processing_complete")
                const messageTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) =>
                  t.trigger === messageValue && t.from === currentFSMState
                ) || [];
                
                if (messageTransitions.length > 0) {
                  console.log(`🎯 [FSM ${destNodeConfig.nodeId}] Found ${messageTransitions.length} transitions for message "${messageValue}" from state "${currentFSMState}"`);
                  _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "message_matched",
                      value: messageValue,
                      details: `Message "${messageValue}" matched ${messageTransitions.length} transition(s) from state "${currentFSMState}"`,
                    },
                    newTime,
                  );
                }

                messageTransitions.forEach((transition: any) => {
                  get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
                });

                // Check for condition-based transitions with the new token
                const conditionTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) => t.trigger === 'condition') || [];
                conditionTransitions.forEach((transition: any) => {
                  if (transition.from === fsmState.currentFSMState && transition.condition) {
                    const formulaContext = {
                      ...fsmState.fsmVariables,
                      ...Object.fromEntries(
                        Object.entries(inputBuffers).map(([key, tokens]: [string, any]) => [
                          key,
                          tokens[tokens.length - 1] // Use the latest token
                        ])
                      )
                    };

                    const { value: conditionResult } = evaluateFormula(transition.condition, formulaContext);
                    if (conditionResult) {
                      get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
                    }
                  }
                });
              } else if (destNodeConfig.type === "EnhancedFSMProcessNode") {
                // Handle Enhanced FSM token reception - convert to event
                const enhancedFsmState = destNodeState as any; // EnhancedFSMProcessNodeState

                // Add token to token buffer for processing by Enhanced FSM engine
                const tokenBufferKey = 'default';
                enhancedFsmState.tokenBuffers[tokenBufferKey] = [
                  ...(enhancedFsmState.tokenBuffers[tokenBufferKey] || []),
                  token
                ];

                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "token_received",
                    value: token.value,
                    details: `Token received from ${nodeConfig.displayName} (Enhanced FSM)`,
                  },
                  newTime,
                );
              } else if (destNodeConfig.type === "Sink") {
                _transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
                const sinkState = destNodeState as SinkState;
                const updatedConsumedTokens = [...(sinkState.consumedTokens || []), token].slice(-MAX_SINK_TOKENS_STORED);
                _updateNodeState(destNodeConfig.nodeId, {
                  consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
                  lastConsumedTime: newTime,
                  consumedTokens: updatedConsumedTokens,
                });

                // Simplified Sink event - state-based (like Queue → Sink)
                const sinkConsumptionLog = _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "consuming",
                    value: token.value,
                    details: `Token ${token.id} from ${nodeConfig.displayName} output`
                  },
                  newTime,
                );
                token.history.push(sinkConsumptionLog);

                // Add consumed event to log (like Queue → Sink)
                _logNodeActivity(
                  destNodeConfig.nodeId,
                  { action: "token_consumed", value: token.value, details: `Token ${token.id} from ${nodeConfig.displayName} output` },
                  newTime,
                );

                _transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'consumption_complete');
              }
            }
          });
          _updateNodeState(nodeConfig.nodeId, { lastEmissionTime: newTime });

          // Transition back to idle after emission
          _transitionNodeState(nodeConfig.nodeId, 'source_idle', newTime, 'emission_complete');
        }
      }

      // ProcessNode firing moved to event-driven logic (when tokens arrive)
      // Keeping this comment to remember where the polling logic was removed
      if (false && nodeConfig.type === "ProcessNode") {
        const pnConfig = nodeConfig;
        const pnState = currentNodeState as ProcessNodeState;
        let canFire = true;
        const inputsDataForFormula: Record<string, Token> = {};
        const aliasToSourceNodeId: Record<string, string> = {};

        for (const input of pnConfig.inputs) {
          const inputSourceNodeId = input.nodeId;
          if (!inputSourceNodeId) {
            canFire = false;
            break;
          }

          const sourceNodeConfig = nodesConfig[inputSourceNodeId];
          if (!sourceNodeConfig) {
            canFire = false;
            break;
          }

          const aliasKey = input.alias || inputSourceNodeId;
          aliasToSourceNodeId[aliasKey] = inputSourceNodeId;

          // ProcessNode should always check its own input buffers, regardless of source type
          if (pnState.inputBuffers[inputSourceNodeId] && pnState.inputBuffers[inputSourceNodeId].length > 0) {
            inputsDataForFormula[aliasKey] = pnState.inputBuffers[inputSourceNodeId][0];
          } else {
            canFire = false;
            break;
          }
        }

        if (canFire) {
          // Transition directly to emitting (ProcessNode fires instantly)
          _transitionNodeState(pnConfig.nodeId, 'process_emitting', newTime, 'fire');

          const consumedTokensForThisFiring: Token[] = [];
          const nextPnInputBuffers = JSON.parse(JSON.stringify(pnState.inputBuffers));

          Object.entries(inputsDataForFormula).forEach(([inputNodeId, tokenToConsume]) => {
            consumedTokensForThisFiring.push(tokenToConsume);
            const consumptionLog = _logNodeActivity(
              pnConfig.nodeId,
              {
                action: "firing",
                value: consumedTokensForThisFiring.length,
                details: `Firing with ${consumedTokensForThisFiring.length} inputs`,
              },
              newTime,
            );
            tokenToConsume.history.push(consumptionLog);

            const sourceNodeConfig = nodesConfig[inputNodeId];
            if (sourceNodeConfig && sourceNodeConfig.type === "Queue") {
              const qState = get().nodeStates[inputNodeId] as QueueState;
              _updateNodeState(inputNodeId, { outputBuffer: qState.outputBuffer.slice(1) });
            } else if (sourceNodeConfig) {
              const buffer = (nextPnInputBuffers[inputNodeId] as Token[]) || [];
              buffer.shift();
              nextPnInputBuffers[inputNodeId] = buffer;
            }
          });
          _updateNodeState(pnConfig.nodeId, { inputBuffers: nextPnInputBuffers, lastFiredTime: newTime });

          const formulaContext: Record<string, any> = { inputs: {} };
          Object.entries(inputsDataForFormula).forEach(([aliasKey, token]) => {
            formulaContext.inputs[aliasKey] = { value: token.value };
            // Add support for aliases and v3 data structure
            const sourceNodeId = aliasToSourceNodeId[aliasKey];
            const sourceNodeConfig = nodesConfig[sourceNodeId];
            if (sourceNodeConfig) {
              // Add the alias directly as a top-level context variable
              formulaContext[aliasKey] = {
                data: {
                  value: token.value,
                  aggregatedValue: token.value,
                  transformedValue: token.value
                }
              };
              // Also add the raw alias without data wrapper for simpler formulas
              formulaContext[aliasKey + 'Value'] = token.value;
            }
          });

          // Transition to emitting state
          _transitionNodeState(pnConfig.nodeId, 'process_emitting', newTime, 'calculation_complete');

          pnConfig.outputs.forEach((output, index) => {
            const { value: outputValue, error } = evaluateFormula(output.transformation?.formula || "", formulaContext);
            if (error) {
              _logNodeActivity(
                pnConfig.nodeId,
                {
                  action: "error",
                  details: `Output ${index} ('${output.transformation?.formula || ""}'): ${error}. Context: ${JSON.stringify(formulaContext)}`,
                  operationType: "transformation",
                },
                newTime,
              );
              set(stateFS => ({
                errorMessages: [
                  ...stateFS.errorMessages,
                  `Node ${pnConfig.displayName} (output ${index}) formula error: ${error}`,
                ],
              }));
            } else {
              const newToken = _createToken(pnConfig.nodeId, outputValue, newTime, consumedTokensForThisFiring);

              // Create detailed transformation breakdown
              const transformationDetails = createTransformationDetails(
                output.transformation?.formula || "",
                formulaContext.inputs,
                outputValue,
              );

              // Create lineage metadata for transformation
              const lineageMetadata = createLineageMetadata("transformation", consumedTokensForThisFiring, newToken.id);

              // Enhanced source token summaries
              const enhancedSourceTokenSummaries = createEnhancedSourceTokenSummaries(consumedTokensForThisFiring);

              // Individual output logging removed - covered by single "firing" event

              const destNodeConfig = nodesConfig[output.destinationNodeId];
              if (destNodeConfig) {
                const destNodeState = get().nodeStates[destNodeConfig.nodeId];
                const arrivalLogDetails = `Token ${newToken.id} from ${pnConfig.displayName} output ${index}`;
                const arrivalLog = _logNodeActivity(
                  destNodeConfig.nodeId,
                  { action: "token_received", value: newToken.value, details: `Received token from ${pnConfig.displayName}` },
                  newTime,
                );
                newToken.history.push(arrivalLog);

                if (destNodeConfig.type === "Queue") {
                  const qState = destNodeState as QueueState;
                  if (destNodeConfig.capacity && qState.inputBuffer.length >= destNodeConfig.capacity) {
                    const dropLog = _logNodeActivity(
                      destNodeConfig.nodeId,
                      {
                        action: "token_dropped",
                        value: newToken.value,
                        details: `From ${pnConfig.displayName}, Token ${newToken.id}`,
                      },
                      newTime,
                    );
                    newToken.history.push(dropLog);
                  } else {
                    _updateNodeState(destNodeConfig.nodeId, { inputBuffer: [...qState.inputBuffer, newToken] });
                    _logNodeActivity(
                      destNodeConfig.nodeId,
                      {
                        action: "accumulating",
                        value: qState.inputBuffer.length + 1,
                        details: `Collecting tokens (buffer size: ${qState.inputBuffer.length + 1})`,
                      },
                      newTime,
                    );
                  }
                } else if (destNodeConfig.type === "ProcessNode") {
                  const nextDestPnState = destNodeState as ProcessNodeState;
                  const bufferForInput = nextDestPnState.inputBuffers[pnConfig.nodeId] || [];
                  _updateNodeState(destNodeConfig.nodeId, {
                    inputBuffers: { ...nextDestPnState.inputBuffers, [pnConfig.nodeId]: [...bufferForInput, newToken] },
                  });
                  _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "token_received",
                      value: bufferForInput.length + 1,
                      details: `Received token (buffer size: ${bufferForInput.length + 1})`,
                    },
                    newTime,
                  );

                  // Check if ProcessNode can fire now that it received a token
                  const updatedDestPnState = get().nodeStates[destNodeConfig.nodeId] as ProcessNodeState;
                  get()._tryFireProcessNode(destNodeConfig, updatedDestPnState, newTime);
                } else if (destNodeConfig.type === "Sink") {
                  _transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
                  const sinkState = destNodeState as SinkState;
                  const updatedConsumedTokens = [...(sinkState.consumedTokens || []), newToken].slice(
                    -MAX_SINK_TOKENS_STORED,
                  );
                  _updateNodeState(destNodeConfig.nodeId, {
                    consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
                    lastConsumedTime: newTime,
                    consumedTokens: updatedConsumedTokens,
                  });

                  // Consistent logging with token ID
                  const sinkConsumptionLog = _logNodeActivity(
                    destNodeConfig.nodeId,
                    { action: "consuming", value: newToken.value, details: `Token ${newToken.id} from ${pnConfig.displayName} output` },
                    newTime,
                  );
                  newToken.history.push(sinkConsumptionLog);

                  // Add consumed event to log
                  _logNodeActivity(
                    destNodeConfig.nodeId,
                    { action: "token_consumed", value: newToken.value, details: `Token ${newToken.id} from ${pnConfig.displayName} output` },
                    newTime,
                  );

                  _transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'token_consumed');
                }
              }
            }
          });

          // Transition back to idle after all outputs processed
          _transitionNodeState(pnConfig.nodeId, 'process_idle', newTime, 'outputs_sent');
        }
      }
    });

    // Process FSMProcessNode state machines
    Object.values(nodesConfig).forEach(nodeConfig => {
      if (nodeConfig.type === "FSMProcessNode") {
        const fsmConfig = nodeConfig as any; // FSMProcessNode type
        const fsmState = get().nodeStates[fsmConfig.nodeId] as any; // FSMProcessNodeState
        const currentState = fsmState.currentFSMState || 'idle';

        // Check for timer-based transitions
        const timerTransitions = fsmConfig.fsm?.transitions?.filter((t: any) => t.trigger === 'timer') || [];
        timerTransitions.forEach((transition: any) => {
          if (transition.from === currentState) {
            // Simple timer logic - trigger every 5 seconds for demo
            if (newTime % 5 === 0) {
              get()._executeFSMTransition(fsmConfig, fsmState, transition, newTime);
            }
          }
        });

        // Check for condition-based transitions
        const conditionTransitions = fsmConfig.fsm?.transitions?.filter((t: any) => t.trigger === 'condition') || [];
        conditionTransitions.forEach((transition: any) => {
          if (transition.from === currentState && transition.condition) {
            // Evaluate condition with current FSM variables AND input tokens
            const formulaContext = {
              ...fsmState.fsmVariables,
              ...Object.fromEntries(
                Object.entries(fsmState.inputBuffers || {}).map(([key, tokens]: [string, any]) => [
                  key,
                  tokens[0] // Use first token in buffer
                ])
              )
            };

            const { value: conditionResult } = evaluateFormula(transition.condition, formulaContext);
            if (conditionResult) {
              get()._executeFSMTransition(fsmConfig, fsmState, transition, newTime);
            }
          }
        });
      }
    });

    // Process Enhanced FSM nodes - simplified version
    Object.values(nodesConfig).forEach(nodeConfig => {
      if (nodeConfig.type === "EnhancedFSMProcessNode") {
        const enhancedFsmConfig = nodeConfig as any; // EnhancedFSMProcessNode type
        const enhancedFsmState = get().nodeStates[enhancedFsmConfig.nodeId] as any; // EnhancedFSMProcessNodeState

        // Simple processing: check for tokens in token buffer and emit them
        if (enhancedFsmState.tokenBuffers?.default?.length > 0) {
          const tokensToProcess = [...enhancedFsmState.tokenBuffers.default];
          enhancedFsmState.tokenBuffers.default = []; // Clear buffer

          tokensToProcess.forEach(token => {
            // Simple token processing - just forward to outputs
            enhancedFsmConfig.outputs?.forEach((output: any) => {
              const destNodeConfig = nodesConfig[output.destinationNodeId];
              if (destNodeConfig && destNodeConfig.type === "Sink") {
                get()._transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
                const destNodeState = get().nodeStates[destNodeConfig.nodeId] as any;
                const updatedConsumedTokens = [...(destNodeState.consumedTokens || []), token].slice(-50);
                get()._updateNodeState(destNodeConfig.nodeId, {
                  consumedTokenCount: (destNodeState.consumedTokenCount || 0) + 1,
                  lastConsumedTime: newTime,
                  consumedTokens: updatedConsumedTokens,
                });

                get()._logNodeActivity(destNodeConfig.nodeId, {
                  action: "consuming",
                  value: token.value,
                  details: `Token ${token.id} from Enhanced FSM ${enhancedFsmConfig.displayName}`,
                }, newTime);

                get()._transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'token_consumed');
              }
            });
          });

          get()._logNodeActivity(enhancedFsmConfig.nodeId, {
            action: "tokens_processed",
            value: tokensToProcess.length,
            details: `Processed ${tokensToProcess.length} tokens`,
          }, newTime);
        }
      }
    });

    // Process StateMultiplexer nodes - route tokens based on conditions
    Object.values(nodesConfig).forEach(nodeConfig => {
      if (nodeConfig.type === "StateMultiplexer") {
        const multiplexerConfig = nodeConfig as any;
        const multiplexerState = get().nodeStates[multiplexerConfig.nodeId] as any;
        
        // Check if there are tokens in any input buffer
        const allInputTokens: { inputName: string; token: Token }[] = [];
        Object.entries(multiplexerState.inputBuffers || {}).forEach(([inputName, tokens]) => {
          (tokens as Token[]).forEach(token => {
            allInputTokens.push({ inputName, token });
          });
        });

        if (allInputTokens.length > 0) {
          allInputTokens.forEach(({ inputName, token }) => {
            // Evaluate route conditions
            // CRITICAL: Flatten the context so expr-eval can access properties
            const formulaContext = {
              input: {
                value: token.value,
                id: token.id,
                originNodeId: token.originNodeId,
                createdAt: token.createdAt,
              },
              [inputName]: {
                value: token.value,
                id: token.id,
              },
              // Also add direct access to token value for simpler conditions
              tokenValue: token.value,
            };

            console.log(`🔍 [Multiplexer ${multiplexerConfig.nodeId}] Evaluating token:`, {
              tokenId: token.id,
              tokenValue: token.value,
              tokenType: typeof token.value,
              formulaContext: formulaContext,
              availableRoutes: multiplexerConfig.config?.routes?.length || 0
            });

            let routeMatched = false;
            const routes = multiplexerConfig.config?.routes || [];
            
            for (const route of routes) {
              if (route.condition) {
                const evalResult = evaluateFormula(route.condition, formulaContext);
                console.warn(`🎯 Condition "${route.condition}" → Result:`, evalResult, `| Context input.value:`, formulaContext.input.value);
                const conditionResult = evalResult.value;
                const error = evalResult.error;
                
                if (!error && conditionResult) {
                  // Route matched! Emit to this output
                  const outputConfig = multiplexerConfig.outputs?.find((out: any) => out.name === route.outputName);
                  
                  if (outputConfig) {
                    console.log(`✅ [Multiplexer] "${route.condition}" matched → ${route.outputName}`);
                    
                    // Create new token or forward existing one based on action
                    let emittedToken = token;
                    if (route.action?.type === 'emit' && route.action.data !== 'input') {
                      // Transform the data
                      const { value: transformedValue } = evaluateFormula(route.action.data, formulaContext);
                      emittedToken = _createToken(multiplexerConfig.nodeId, transformedValue, newTime, [token]);
                    }

                    // Route to destination
                    const destNodeConfig = nodesConfig[outputConfig.destinationNodeId];
                    if (destNodeConfig) {
                      const destNodeState = get().nodeStates[destNodeConfig.nodeId];
                      
                      // Add token to destination's input buffer
                      const destInputBuffers = (destNodeState as any).inputBuffers || {};
                      const destBufferKey = outputConfig.destinationInputName || 'input';
                      destInputBuffers[destBufferKey] = [...(destInputBuffers[destBufferKey] || []), emittedToken];
                      _updateNodeState(destNodeConfig.nodeId, { inputBuffers: destInputBuffers });

                      _logNodeActivity(multiplexerConfig.nodeId, {
                        action: "token_routed",
                        value: emittedToken.value,
                        details: `Token ${emittedToken.id} routed to ${destNodeConfig.displayName} via ${route.outputName} (condition: ${route.condition})`,
                        multiplexerOutput: route.outputName,
                        multiplexerCondition: route.condition,
                        multiplexerDestination: destNodeConfig.displayName,
                      } as any, newTime);

                      _logNodeActivity(destNodeConfig.nodeId, {
                        action: "token_received",
                        value: emittedToken.value,
                        details: `Token ${emittedToken.id} from Multiplexer ${multiplexerConfig.displayName}`,
                      }, newTime);

                      // Handle Sink destination
                      if (destNodeConfig.type === "Sink") {
                        get()._transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
                        const sinkState = destNodeState as any;
                        const updatedConsumedTokens = [...(sinkState.consumedTokens || []), emittedToken].slice(-50);
                        _updateNodeState(destNodeConfig.nodeId, {
                          consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
                          lastConsumedTime: newTime,
                          consumedTokens: updatedConsumedTokens,
                        });

                        _logNodeActivity(destNodeConfig.nodeId, {
                          action: "token_consumed",
                          value: emittedToken.value,
                          details: `Token ${emittedToken.id} consumed`,
                        }, newTime);

                        get()._transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'consumption_complete');
                      }
                    }

                    routeMatched = true;
                    break; // Only take first matching route
                  }
                }
              }
            }

            // If no route matched, use default output
            if (!routeMatched && multiplexerConfig.config?.defaultOutput) {
              const defaultOutputConfig = multiplexerConfig.outputs?.find((out: any) => 
                out.name === multiplexerConfig.config.defaultOutput
              );
              
              if (defaultOutputConfig) {
                console.log(`⚠️ [Multiplexer] No match, using default: ${multiplexerConfig.config.defaultOutput}`);
                
                const destNodeConfig = nodesConfig[defaultOutputConfig.destinationNodeId];
                if (destNodeConfig) {
                  const destNodeState = get().nodeStates[destNodeConfig.nodeId];
                  const destInputBuffers = (destNodeState as any).inputBuffers || {};
                  const destBufferKey = defaultOutputConfig.destinationInputName || 'input';
                  destInputBuffers[destBufferKey] = [...(destInputBuffers[destBufferKey] || []), token];
                  _updateNodeState(destNodeConfig.nodeId, { inputBuffers: destInputBuffers });

                  _logNodeActivity(multiplexerConfig.nodeId, {
                    action: "token_routed",
                    value: token.value,
                    details: `Token ${token.id} routed to ${destNodeConfig.displayName} via default output`,
                    multiplexerOutput: multiplexerConfig.config.defaultOutput,
                    multiplexerCondition: "default",
                    multiplexerDestination: destNodeConfig.displayName,
                  } as any, newTime);

                  _logNodeActivity(destNodeConfig.nodeId, {
                    action: "token_received",
                    value: token.value,
                    details: `Token ${token.id} from Multiplexer ${multiplexerConfig.displayName} (default output)`,
                  }, newTime);

                  // Handle Sink destination
                  if (destNodeConfig.type === "Sink") {
                    get()._transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
                    const sinkState = destNodeState as any;
                    const updatedConsumedTokens = [...(sinkState.consumedTokens || []), token].slice(-50);
                    _updateNodeState(destNodeConfig.nodeId, {
                      consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
                      lastConsumedTime: newTime,
                      consumedTokens: updatedConsumedTokens,
                    });

                    _logNodeActivity(destNodeConfig.nodeId, {
                      action: "token_consumed",
                      value: token.value,
                      details: `Token ${token.id} consumed`,
                    }, newTime);

                    get()._transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'consumption_complete');
                  }
                }
              }
            }
          });

          // Clear input buffers after processing
          _updateNodeState(multiplexerConfig.nodeId, {
            inputBuffers: {},
            lastProcessedTime: newTime,
          });
        }
      }
    });

    // Process Queue state machines
    Object.values(nodesConfig).forEach(nodeConfig => {
      if (nodeConfig.type === "Queue") {
        const qConfig = nodeConfig;
        const qState = get().nodeStates[qConfig.nodeId] as QueueState;
        const currentState = qState.stateMachine?.currentState || 'queue_idle';

        // State machine driven logic
        switch (currentState) {
          case 'queue_idle':
            // Check if aggregation window has passed and we have tokens to process
            if (newTime >= (qState.lastAggregationTime < 0 ? 0 : qState.lastAggregationTime) + qConfig.aggregation.trigger.window) {
              if (qState.inputBuffer.length > 0) {
                // Transition to processing state
                _transitionNodeState(qConfig.nodeId, 'queue_processing', newTime, 'aggregation_window_triggered');
              } else {
                // Log empty aggregation window
                _logNodeActivity(
                  qConfig.nodeId,
                  { action: "trigger_met", details: `No tokens in input buffer.` },
                  newTime,
                );
                _updateNodeState(qConfig.nodeId, { lastAggregationTime: newTime });
              }
            }
            break;

          case 'queue_accumulating':
            // Continue accumulating until window triggers or capacity reached
            // This state is entered when receiving tokens (handled elsewhere)
            // Check if we should transition back to idle or to processing
            if (newTime >= (qState.lastAggregationTime < 0 ? 0 : qState.lastAggregationTime) + qConfig.aggregation.trigger.window) {
              if (qState.inputBuffer.length > 0) {
                _transitionNodeState(qConfig.nodeId, 'queue_processing', newTime, 'aggregation_window_triggered');
              } else {
                _transitionNodeState(qConfig.nodeId, 'queue_idle', newTime, 'no_tokens_to_process');
              }
            }
            break;

          case 'queue_processing':
            // Perform aggregation
            const tokensToAggregate = [...qState.inputBuffer];
            let aggregatedValue: any;
            const sourceTokenIdsForLog = tokensToAggregate.map(t => t.id);
            const sourceTokenSummariesForLog = tokensToAggregate.map(t => ({
              id: t.id,
              originNodeId: t.originNodeId,
              originalValue: t.value,
              createdAt: t.createdAt,
            }));

            switch (qConfig.aggregation.method) {
              case "sum":
                aggregatedValue = tokensToAggregate.reduce((sum, t) => sum + Number(t.value), 0);
                break;
              case "average":
                aggregatedValue =
                  tokensToAggregate.length > 0
                    ? tokensToAggregate.reduce((sum, t) => sum + Number(t.value), 0) / tokensToAggregate.length
                    : 0;
                break;
              case "count":
                aggregatedValue = tokensToAggregate.length;
                break;
              case "first":
                aggregatedValue = tokensToAggregate[0]?.value;
                break;
              case "last":
                aggregatedValue = tokensToAggregate[tokensToAggregate.length - 1]?.value;
                break;
              default:
                aggregatedValue = tokensToAggregate[0]?.value;
            }

            if (aggregatedValue !== undefined) {
              const newToken = _createToken(qConfig.nodeId, aggregatedValue, newTime, tokensToAggregate);

              // Create detailed aggregation breakdown
              const aggregationDetails = createAggregationDetails(
                qConfig.aggregation.method,
                tokensToAggregate,
                aggregatedValue,
              );

              // Create lineage metadata for aggregation
              const lineageMetadata = createLineageMetadata("aggregation", tokensToAggregate, newToken.id);

              // Enhanced source token summaries
              const enhancedSourceTokenSummaries = createEnhancedSourceTokenSummaries(tokensToAggregate);

              // Get source token IDs for lineage
              const sourceTokenIds = tokensToAggregate.map(t => t.id);

              // Simplified: Single processing event for the entire aggregation
              const consumedValues = tokensToAggregate.map(t => t.value).join(', ');

              // Build formula string based on aggregation method
              let formulaStr = '';
              switch(qConfig.aggregation.method) {
                case 'sum':
                  formulaStr = `sum(${consumedValues}) = ${tokensToAggregate.map(t => t.value).join(' + ')} = ${newToken.value}`;
                  break;
                case 'average':
                  const sum = tokensToAggregate.reduce((acc, t) => acc + Number(t.value), 0);
                  formulaStr = `average(${consumedValues}) = ${sum} / ${tokensToAggregate.length} = ${newToken.value}`;
                  break;
                case 'multiply':
                  formulaStr = `multiply(${consumedValues}) = ${tokensToAggregate.map(t => t.value).join(' × ')} = ${newToken.value}`;
                  break;
                default:
                  formulaStr = `${qConfig.aggregation.method}(${consumedValues}) = ${newToken.value}`;
              }

              _logNodeActivity(
                qConfig.nodeId,
                {
                  action: "processing",
                  value: newToken.value, // Show result value
                  details: `Token ${newToken.id} created: ${formulaStr}`,
                  sourceTokenIds: sourceTokenIds,  // Track parent tokens
                },
                newTime,
              );

              // Add to each consumed token's history
              tokensToAggregate.forEach(consumedToken => {
                consumedToken.history.push({
                  timestamp: newTime,
                  epochTimestamp: Date.now(),
                  sequence: 0, // Simplified
                  nodeId: qConfig.nodeId,
                  action: "processing",
                  value: newToken.value,
                  details: `${qConfig.aggregation.method}([${consumedValues}]) = ${newToken.value}`,
                  state: 'processing',
                  bufferSize: 0,
                  outputBufferSize: 1,
                });
              });

              // Transition to emitting state
              _transitionNodeState(qConfig.nodeId, 'queue_emitting', newTime, 'aggregation_complete');

              _updateNodeState(qConfig.nodeId, {
                inputBuffer: [],
                outputBuffer: [...qState.outputBuffer, newToken],
                lastAggregationTime: newTime,
              });
            } else {
              _logNodeActivity(
                qConfig.nodeId,
                {
                  action: "error",
                  details: `Input buffer cleared. Contained ${tokensToAggregate.length} tokens.`,
                },
                newTime,
              );
              _updateNodeState(qConfig.nodeId, { inputBuffer: [], lastAggregationTime: newTime });
              _transitionNodeState(qConfig.nodeId, 'queue_idle', newTime, 'no_value_to_aggregate');
            }
            break;

          case 'queue_emitting':
            // Forward tokens from output buffer - this happens immediately after aggregation
            // This state is also handled in the forwarding section below
            // Transition back to accumulating if we have room, or idle if we don't
            if (qState.outputBuffer.length === 0) {
              _transitionNodeState(qConfig.nodeId, 'queue_idle', newTime, 'output_buffer_empty');
            }
            break;

          default:
            // Unknown state, reset to idle
            _transitionNodeState(qConfig.nodeId, 'queue_idle', newTime, 'unknown_state_reset');
            break;
        }
      }
    });

    // Forward tokens from Queue output buffers
    Object.values(nodesConfig).forEach(nodeConfig => {
      if (nodeConfig.type === "Queue") {
        const qConfigSource = nodeConfig;
        const qStateSource = get().nodeStates[qConfigSource.nodeId] as QueueState;

        if (qStateSource.outputBuffer.length > 0) {
          // Forward the first token to ALL outputs in one operation
          const tokenToForward = qStateSource.outputBuffer[0];

          // Transition to emitting state first, THEN log the forwarding event
          _transitionNodeState(qConfigSource.nodeId, 'queue_emitting', newTime, 'forwarding_token');

          // Create a single forwarding log for all destinations
          const destinationNames = qConfigSource.outputs.map(output =>
            nodesConfig[output.destinationNodeId]?.displayName || output.destinationNodeId
          ).join(', ');

          const forwardActionLog = _logNodeActivity(
            qConfigSource.nodeId,
            {
              action: "emitting",
              value: tokenToForward.value,
              details: `Token ${tokenToForward.id} (${tokenToForward.value}) → ${destinationNames}`,
              sourceTokenIds: [],  // This token has already been created, just forwarding
            },
            newTime,
          );
          tokenToForward.history.push(forwardActionLog);

          // Process all outputs (v3 supports multiple outputs)
          qConfigSource.outputs.forEach(output => {
            const destNodeConfig = nodesConfig[output.destinationNodeId];
            if (destNodeConfig) {
              const transferLogDetails = `Token ${tokenToForward.id} from ${qConfigSource.displayName} output`;

              if (destNodeConfig.type === "Sink") {
                // Add TOKEN_ARRIVED_AT_NODE event for consistency
                const arrivalLog = _logNodeActivity(
                  destNodeConfig.nodeId,
                  { action: "consuming", value: tokenToForward.value, details: `Processing token from ${qConfigSource.displayName}` },
                  newTime,
                );
                tokenToForward.history.push(arrivalLog);

                const sinkNodeState = get().nodeStates[destNodeConfig.nodeId] as SinkState;
                const updatedConsumedTokensSink = [...(sinkNodeState.consumedTokens || []), tokenToForward].slice(
                  -MAX_SINK_TOKENS_STORED,
                );
                _updateNodeState(destNodeConfig.nodeId, {
                  consumedTokenCount: (sinkNodeState.consumedTokenCount || 0) + 1,
                  lastConsumedTime: newTime,
                  consumedTokens: updatedConsumedTokensSink,
                });
                const sinkConsumptionLog = _logNodeActivity(
                  destNodeConfig.nodeId,
                  { action: "token_consumed", value: tokenToForward.value, details: transferLogDetails },
                  newTime,
                );
                tokenToForward.history.push(sinkConsumptionLog);
                _updateNodeState(qConfigSource.nodeId, { outputBuffer: qStateSource.outputBuffer.slice(1) });
              } else if (destNodeConfig.type === "Queue") {
                const qStateDest = get().nodeStates[destNodeConfig.nodeId] as QueueState;
                const arrivalLog = _logNodeActivity(
                  destNodeConfig.nodeId,
                  { action: "accumulating", value: qStateDest.inputBuffer.length + 1, details: `Collecting tokens (buffer size: ${qStateDest.inputBuffer.length + 1})` },
                  newTime,
                );
                tokenToForward.history.push(arrivalLog);

                if (destNodeConfig.capacity && qStateDest.inputBuffer.length >= destNodeConfig.capacity) {
                  const dropLog = _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "token_dropped",
                      value: tokenToForward.value,
                      details: `Token ${tokenToForward.id} from ${qConfigSource.displayName}`,
                    },
                    newTime,
                  );
                  tokenToForward.history.push(dropLog);
                } else {
                  _updateNodeState(destNodeConfig.nodeId, { inputBuffer: [...qStateDest.inputBuffer, tokenToForward] });
                  _logNodeActivity(
                    destNodeConfig.nodeId,
                    {
                      action: "accumulating",
                      value: qStateDest.inputBuffer.length + 1,
                      details: `Collecting tokens (buffer size: ${qStateDest.inputBuffer.length + 1})`,
                    },
                    newTime,
                  );
                }
              } else if (destNodeConfig.type === "ProcessNode") {
                // Handle ProcessNode forwarding - THIS WAS MISSING!
                _transitionNodeState(destNodeConfig.nodeId, 'process_idle', newTime, 'token_received');
                const pnState = get().nodeStates[destNodeConfig.nodeId] as ProcessNodeState;
                const bufferForInput = pnState.inputBuffers[qConfigSource.nodeId] || [];
                _updateNodeState(destNodeConfig.nodeId, {
                  inputBuffers: { ...pnState.inputBuffers, [qConfigSource.nodeId]: [...bufferForInput, tokenToForward] },
                });

                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "token_received",
                    value: bufferForInput.length + 1,
                    details: `Received token from ${qConfigSource.displayName} (buffer size: ${bufferForInput.length + 1})`,
                  },
                  newTime,
                );
                tokenToForward.history.push({
                  timestamp: newTime,
                  epochTimestamp: Date.now(),
                  sequence: 0,
                  nodeId: destNodeConfig.nodeId,
                  action: "token_received",
                  value: bufferForInput.length + 1,
                  details: `Received token from ${qConfigSource.displayName} (buffer size: ${bufferForInput.length + 1})`,
                  state: 'process_idle',
                  bufferSize: bufferForInput.length + 1,
                  outputBufferSize: 0,
                });

                // Check if ProcessNode can fire now that it received a token
                const updatedPnState = get().nodeStates[destNodeConfig.nodeId] as ProcessNodeState;
                get()._tryFireProcessNode(destNodeConfig, updatedPnState, newTime);
              } else if (destNodeConfig.type === "FSMProcessNode") {
                // Handle FSM token forwarding from Queue
                const fsmState = get().nodeStates[destNodeConfig.nodeId] as any;
                const currentFSMState = fsmState.currentFSMState || 'idle';

                // Add token to input buffer
                const inputBuffers = fsmState.inputBuffers || {};
                const bufferKey = 'input';
                inputBuffers[bufferKey] = [...(inputBuffers[bufferKey] || []), tokenToForward];
                _updateNodeState(destNodeConfig.nodeId, { inputBuffers });

                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "token_received",
                    value: tokenToForward.value,
                    details: `Token received from ${qConfigSource.displayName}`,
                  },
                  newTime,
                );

                // Check for token_received transitions
                const tokenReceivedTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) =>
                  t.trigger === 'token_received' && t.from === currentFSMState
                ) || [];

                tokenReceivedTransitions.forEach((transition: any) => {
                  get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
                });

                // Check condition-based transitions
                const conditionTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) => t.trigger === 'condition') || [];
                conditionTransitions.forEach((transition: any) => {
                  if (transition.from === fsmState.currentFSMState && transition.condition) {
                    const formulaContext = {
                      ...fsmState.fsmVariables,
                      ...Object.fromEntries(
                        Object.entries(inputBuffers).map(([key, tokens]: [string, any]) => [
                          key,
                          tokens[tokens.length - 1]
                        ])
                      )
                    };

                    const { value: conditionResult } = evaluateFormula(transition.condition, formulaContext);
                    if (conditionResult) {
                      get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
                    }
                  }
                });
              } else if (destNodeConfig.type === "EnhancedFSMProcessNode") {
                // Handle Enhanced FSM token forwarding from Queue
                const enhancedFsmState = get().nodeStates[destNodeConfig.nodeId] as any;

                // Add token to token buffer for processing by Enhanced FSM engine
                const tokenBufferKey = 'default';
                enhancedFsmState.tokenBuffers[tokenBufferKey] = [
                  ...(enhancedFsmState.tokenBuffers[tokenBufferKey] || []),
                  tokenToForward
                ];

                _logNodeActivity(
                  destNodeConfig.nodeId,
                  {
                    action: "token_received",
                    value: tokenToForward.value,
                    details: `Token received from ${qConfigSource.displayName} (Enhanced FSM)`,
                  },
                  newTime,
                );
              }
            }
          });

          // Remove the forwarded token from output buffer (once, after all destinations processed)
          _updateNodeState(qConfigSource.nodeId, { outputBuffer: qStateSource.outputBuffer.slice(1) });

          // Transition back to idle after forwarding (once, after all destinations processed)
          _transitionNodeState(qConfigSource.nodeId, 'queue_idle', newTime, 'forwarding_complete');
        }
      }
    });
  },

  setSelectedNodeId: nodeId => set({ selectedNodeId: nodeId, selectedToken: null }),
  setSelectedToken: token => set({ selectedToken: token, selectedNodeId: null }),
  clearErrors: () => set({ errorMessages: [] }),

  // Node activity tracking actions
  markNodeActive: (nodeId: string) => {
    set(state => ({
      activeNodeIds: new Set([...state.activeNodeIds, nodeId]),
      recentlyActiveNodeIds: new Set([...state.recentlyActiveNodeIds, nodeId])
    }));
  },

  markNodeInactive: (nodeId: string) => {
    set(state => {
      const newActiveNodes = new Set(state.activeNodeIds);
      newActiveNodes.delete(nodeId);
      return { activeNodeIds: newActiveNodes };
    });
  },

  markNodesAsRecentlyActive: (nodeIds: string[]) => {
    set(state => ({
      recentlyActiveNodeIds: new Set([...state.recentlyActiveNodeIds, ...nodeIds]),
      lastStepInvolvedNodes: nodeIds
    }));

    // Clear recently active nodes after animation duration (2 seconds)
    setTimeout(() => {
      set(state => ({ recentlyActiveNodeIds: new Set() }));
    }, 2000);
  },

  clearNodeActivity: () => {
    set({
      activeNodeIds: new Set(),
      recentlyActiveNodeIds: new Set(),
      lastStepInvolvedNodes: []
    });
  },

  getNodeActivityStatus: (nodeId: string) => {
    const state = get();
    return {
      isActive: state.activeNodeIds.has(nodeId),
      isRecentlyActive: state.recentlyActiveNodeIds.has(nodeId),
      wasInLastStep: state.lastStepInvolvedNodes.includes(nodeId)
    };
  },
  toggleGlobalLedger: () => set(state => ({ isGlobalLedgerOpen: !state.isGlobalLedgerOpen })),

  updateNodeConfigInStore: (nodeId, newConfigData) => {
    const currentState = get();
    if (!currentState.scenario?.nodes) {
      console.error('❌ [UPDATE NODE] No scenario or nodes found');
      return false;
    }

    // Find the node and update its configuration
    const nodeIndex = currentState.scenario.nodes.findIndex(node => node.nodeId === nodeId);
    if (nodeIndex === -1) {
      console.error('❌ [UPDATE NODE] Node not found:', nodeId);
      return false;
    }

    // Save snapshot for undo functionality
    currentState.saveSnapshot(`Update ${currentState.scenario.nodes[nodeIndex].displayName || nodeId} configuration`);

    // Update the node configuration
    set(state => {
      if (!state.scenario?.nodes) return state;

      const updatedNodes = [...state.scenario.nodes];
      const updatedNode = {
        ...updatedNodes[nodeIndex],
        ...newConfigData
      };
      updatedNodes[nodeIndex] = updatedNode;

      // Also update nodesConfig map for consistency
      const updatedNodesConfig = {
        ...state.nodesConfig,
        [nodeId]: updatedNode
      };

      console.log('✅ [UPDATE NODE] Updated node:', nodeId, 'New config:', updatedNode);

      return {
        ...state,
        scenario: {
          ...state.scenario,
          nodes: updatedNodes
        },
        nodesConfig: updatedNodesConfig,
        hasUnsavedChanges: true // Node configuration changed
      };
    });

    return true;
  },

  markAsUnsavedChanges: () => {
    set(state => ({ ...state, hasUnsavedChanges: true }));
  },


  // Undo/Redo implementations
  saveSnapshot: (description) => {
    const currentState = get();
    if (currentState.scenario) {
      const snapshot: ScenarioSnapshot = {
        scenario: JSON.parse(JSON.stringify(currentState.scenario)),
        timestamp: Date.now(),
        description,
      };
      
      
      set(state => ({
        undoHistory: [...state.undoHistory, snapshot].slice(-20), // Keep last 20 snapshots
        redoHistory: [], // Clear redo history when new action is taken
      }));
    }
  },

  undo: () => {
    const state = get();
    if (state.undoHistory.length === 0) return;
    
    
    // Save current state to redo history before undoing
    if (state.scenario) {
      const currentSnapshot: ScenarioSnapshot = {
        scenario: JSON.parse(JSON.stringify(state.scenario)),
        timestamp: Date.now(),
        description: "Current state before undo",
      };
      
      const lastSnapshot = state.undoHistory[state.undoHistory.length - 1];
      
      set(prevState => ({
        redoHistory: [currentSnapshot, ...prevState.redoHistory].slice(0, 20),
        undoHistory: prevState.undoHistory.slice(0, -1),
      }));
      
      // Restore the complete scenario state
      if (lastSnapshot.scenario) {
        get()._restoreScenarioState(lastSnapshot.scenario);
      }
    }
  },

  redo: () => {
    const state = get();
    if (state.redoHistory.length === 0) return;
    
    // Save current state to undo history before redoing
    if (state.scenario) {
      const currentSnapshot: ScenarioSnapshot = {
        scenario: JSON.parse(JSON.stringify(state.scenario)),
        timestamp: Date.now(),
        description: "Current state before redo",
      };
      
      const nextSnapshot = state.redoHistory[0];
      
      set(prevState => ({
        undoHistory: [...prevState.undoHistory, currentSnapshot].slice(-20),
        redoHistory: prevState.redoHistory.slice(1),
      }));
      
      // Restore the complete scenario state
      if (nextSnapshot.scenario) {
        get()._restoreScenarioState(nextSnapshot.scenario);
      }
    }
  },

  canUndo: () => get().undoHistory.length > 0,
  canRedo: () => get().redoHistory.length > 0,

  // Template and execution actions
  loadTemplates: async () => {
    try {
      const templates = await templateService.getTemplates();
      set({ availableTemplates: templates });

      // Show info if template system is not available
      if (templates.length === 0) {
        console.info('Template management is not available. This may be due to Firebase configuration.');
      }
    } catch (error) {
      console.error('Failed to load templates:', error);

      // Handle Firebase configuration issues gracefully
      if (error instanceof Error && (
        error.message.includes('Firebase') ||
        error.message.includes('service account') ||
        error.message.includes('FIREBASE_SERVICE_ACCOUNT') ||
        error.message.includes('FAILED_PRECONDITION') ||
        error.message.includes('Datastore Mode') ||
        error.message.includes('Firestore API is not available')
      )) {
        console.warn('Template management unavailable: Firebase/Firestore configuration issue');
        set({ availableTemplates: [] });
      } else {
        set(state => ({
          errorMessages: [...state.errorMessages, `Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`],
        }));
      }
    }
  },

  loadTemplate: async (templateId: string) => {
    try {
      const template = await templateService.getTemplate(templateId);

      // No more sync checking - simple version tagging system

      set({ currentTemplate: template });

      // Load the clean scenario FIRST (always without group nodes)
      await get().loadScenario(template.scenario);

      // THEN re-apply grouping if it was enabled when saved
      if (template.scenario.groups?.activeFilters && template.scenario.groups.activeFilters.length > 0) {
        console.log(`🔄 Restoring grouping state for tags:`, template.scenario.groups.activeFilters);

        // Import the grouping utility function
        const { generateGroupedScenario } = await import('@/lib/utils/advancedGroupingUtils');

        // Create scenario with activeFilters set
        const scenarioWithFilters = {
          ...template.scenario,
          groups: {
            ...template.scenario.groups,
            activeFilters: template.scenario.groups.activeFilters,
          },
        };

        // Generate the grouped scenario (this creates virtual group nodes and redirects connections)
        const groupedScenario = generateGroupedScenario(scenarioWithFilters);

        // Load the grouped scenario
        await get().loadScenario(groupedScenario);

        console.log(`✅ Restored grouping state for template "${template.name}"`);
      }

      // If template has saved execution state, restore it
      if (template.executionState) {
        console.log(`Restoring saved execution state for template "${template.name}"`);
        
        set({
          // Restore simulation state
          nodeStates: template.executionState.nodeStates,
          currentTime: template.executionState.currentTime,
          eventCounter: template.executionState.eventCounter,
          // Always skip restoring legacy activity logs in event-driven mode
          nodeActivityLogs: {},
          globalActivityLog: [],
          // Restore simulation settings
          simulationSpeed: template.executionState.simulationSpeed,
          // Clear any error messages since we successfully loaded
          errorMessages: [],
        });
        
        console.log(`🚫 [EVENT-DRIVEN MODE] Skipped restoring ${template.executionState.globalActivityLog?.length || 0} legacy activity logs`);
        console.log(`Restored state: time=${template.executionState.currentTime}, events=${template.executionState.eventCounter}, logs=${template.executionState.globalActivityLog.length} entries`);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to load template: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
    }
  },

  createNewTemplate: async (name: string, description?: string, fromDefault = true) => {
    try {
      const state = get();
      console.log('🐛 createNewTemplate DEBUG:');
      console.log('  - fromDefault:', fromDefault);
      console.log('  - scenario exists:', !!state.scenario);
      console.log('  - scenario type:', typeof state.scenario);
      if (state.scenario) {
        console.log('  - scenario keys:', Object.keys(state.scenario));
      }

      // Remove fromDefault support - only allow saving current scenario
      if (!state.scenario) {
        throw new Error('No scenario loaded to save as template');
      }

      // Get current reference doc and resources
      const currentReferenceDoc = state.currentTemplate?.referenceDoc;
      let currentResources: any[] = [];

      try {
        const resourcesResponse = await fetch('/api/resources/list');
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json();
          currentResources = resourcesData.resources || [];
        }
      } catch (error) {
        console.warn('Failed to fetch current resources:', error);
      }

      console.log('  - sending scenario:', !!state.scenario);
      console.log('  - sending referenceDoc:', currentReferenceDoc ? `${currentReferenceDoc.length} chars` : 'none');
      console.log('  - sending resources:', currentResources.length, 'resources');

      const template = await templateService.createTemplate({
        name,
        description,
        scenario: state.scenario,
        referenceDoc: currentReferenceDoc,
        resources: currentResources,
      });

      // Update available templates
      set(state => ({
        availableTemplates: [...state.availableTemplates, template],
        currentTemplate: template,
      }));

      return template.id;
    } catch (error) {
      console.error('Failed to create template:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },

  saveCurrentAsTemplate: async (name: string, description?: string) => {
    try {
      const state = get();
      if (!state.scenario) {
        throw new Error('No scenario loaded to save as template');
      }

      // Get current reference doc and resources
      const currentReferenceDoc = state.currentTemplate?.referenceDoc;
      let currentResources: any[] = [];

      try {
        const resourcesResponse = await fetch('/api/resources/list');
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json();
          currentResources = resourcesData.resources || [];
        }
      } catch (error) {
        console.warn('Failed to fetch current resources:', error);
      }

      const template = await templateService.createTemplate({
        name,
        description,
        scenario: state.scenario,
        referenceDoc: currentReferenceDoc,
        resources: currentResources,
      });

      // Initialize simple sync data for new template
      const { initializeSyncData } = await import('@/lib/utils/sync');
      template.sync = initializeSyncData();

      // Update available templates
      set(prevState => ({
        availableTemplates: [...prevState.availableTemplates, template],
        currentTemplate: template,
      }));

      return template.id;
    } catch (error) {
      console.error('Failed to save current as template:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },
  updateCurrentTemplate: async () => {
    try {
      const state = get();
      if (!state.currentTemplate) {
        throw new Error('No template is currently loaded to update');
      }
      if (!state.scenario) {
        throw new Error('No scenario loaded to save');
      }

      console.log('🔄 SimulationStore.updateCurrentTemplate called');
      console.log('🔄 Current template has referenceDoc:', state.currentTemplate.referenceDoc ? `${state.currentTemplate.referenceDoc.length} characters` : 'NOT PRESENT');

      // Get the scenario to save - if grouped, we need to save a clean version for loading later
      const scenarioToSave = getSaveReadyScenario(state.scenario);

      // Capture complete simulation state for saving
      const completeState = {
        scenario: scenarioToSave,
        // Simulation execution state
        nodeStates: state.nodeStates,
        currentTime: state.currentTime,
        eventCounter: state.eventCounter,
        // Activity logs and ledger data
        nodeActivityLogs: state.nodeActivityLogs,
        globalActivityLog: state.globalActivityLog,
        // Simulation settings
        simulationSpeed: state.simulationSpeed,
        // Save timestamp
        lastSavedAt: Date.now(),
      };

      // CRITICAL FIX: Remove virtual group nodes and clean up internal flags before saving
      // This ensures we save the original scenario structure, not the grouped visualization
      const cleanedNodes = scenarioToSave.nodes
        .filter(node => !node.nodeId.startsWith('group_')) // Remove virtual group nodes
        .map(node => {
          // Remove internal grouping flags
          const { _isGrouped, ...cleanNode } = node as any;
          return cleanNode;
        });

      const scenarioWithoutGroupNodes = {
        ...scenarioToSave,
        nodes: cleanedNodes,
        groups: {
          ...scenarioToSave.groups,
          visualMode: scenarioToSave.groups?.visualMode || "all",
          // Keep activeFilters to remember which groups are enabled
          activeFilters: scenarioToSave.groups?.activeFilters || [],
        },
      };

      const updatedTemplate = await templateService.updateTemplate(state.currentTemplate.id, {
        scenario: scenarioWithoutGroupNodes,
        // Add execution state to template
        executionState: completeState,
        description: `${state.currentTemplate.description || ''} (Updated: ${new Date().toLocaleString()})`.trim(),
        // CRITICAL: Preserve the referenceDoc field
        referenceDoc: state.currentTemplate.referenceDoc,
        // CRITICAL: Preserve the sync baseline (don't overwrite when just saving)
        sync: state.currentTemplate.sync,
      });

      // No more sync checking - simple version tagging system

      console.log('🔄 Template updated, new template has referenceDoc:', updatedTemplate.referenceDoc ? `${updatedTemplate.referenceDoc.length} characters` : 'NOT PRESENT');

      // Update the current template and available templates list
      set(prevState => ({
        currentTemplate: updatedTemplate,
        availableTemplates: prevState.availableTemplates.map(t =>
          t.id === updatedTemplate.id ? updatedTemplate : t
        ),
        hasUnsavedChanges: false, // Everything saved
      }));
    } catch (error) {
      console.error('Failed to update template:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },
  deleteTemplate: async (templateId: string) => {
    try {
      await templateService.deleteTemplate(templateId);

      // Remove from available templates and clear current template if it was deleted
      set(prevState => ({
        availableTemplates: prevState.availableTemplates.filter(t => t.id !== templateId),
        currentTemplate: prevState.currentTemplate?.id === templateId ? null : prevState.currentTemplate,
      }));
    } catch (error) {
      console.error('Failed to delete template:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },

  saveExecution: async (name: string, description?: string) => {
    try {
      const state = get();

      if (!state.scenario) {
        throw new Error('No scenario loaded to save execution');
      }

      if (!state.currentTemplate) {
        throw new Error('No template associated with current execution');
      }

      const execution = await templateService.saveExecution({
        templateId: state.currentTemplate.id,
        name,
        description,
        scenario: state.scenario,
        nodeStates: state.nodeStates,
        currentTime: state.currentTime,
        eventCounter: state.eventCounter,
        globalActivityLog: state.globalActivityLog,
        nodeActivityLogs: state.nodeActivityLogs,
        isCompleted: false,
      });

      set({ currentExecution: execution });

      return execution.id;
    } catch (error) {
      console.error('Failed to save execution:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to save execution: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },

  loadExecution: async (executionId: string) => {
    try {
      const execution = await templateService.getExecution(executionId);
      set({ currentExecution: execution });

      // Restore the complete simulation state
      const state = get();
      state._restoreExecutionState(execution);
    } catch (error) {
      console.error('Failed to load execution:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to load execution: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
    }
  },

  createNewExecution: async (name: string, description?: string) => {
    try {
      const state = get();

      if (!state.scenario) {
        throw new Error('No scenario loaded to create execution');
      }

      if (!state.currentTemplate) {
        throw new Error('No template associated with current scenario');
      }

      const execution = await templateService.saveExecution({
        templateId: state.currentTemplate.id,
        name,
        description,
        scenario: state.scenario,
        nodeStates: state.nodeStates,
        currentTime: state.currentTime,
        eventCounter: state.eventCounter,
        globalActivityLog: state.globalActivityLog,
        nodeActivityLogs: state.nodeActivityLogs,
        isCompleted: false,
      });

      set({ currentExecution: execution });

      return execution.id;
    } catch (error) {
      console.error('Failed to create execution:', error);
      set(state => ({
        errorMessages: [...state.errorMessages, `Failed to create execution: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }));
      throw error;
    }
  },

  // External queue management
  setExternalQueue: (queue: any) => {
    console.log('🔗 Setting external queue in simulation store:', !!queue);
    set({ externalQueue: queue });
  },

  _updateNodeState: (nodeId, partialState) => {
    set(state => ({
      nodeStates: {
        ...state.nodeStates,
        [nodeId]: { ...state.nodeStates[nodeId], ...partialState },
      },
    }));
  },

  _transitionNodeState: (nodeId: string, newState: NodeStateMachineState, timestamp: number, trigger?: string) => {
    set(state => {
      const currentNodeState = state.nodeStates[nodeId];
      const currentStateMachine = currentNodeState?.stateMachine;

      const updatedStateMachine: StateMachineInfo = {
        currentState: newState,
        previousState: currentStateMachine?.currentState,
        stateChangedAt: timestamp,
        transitionHistory: [
          ...(currentStateMachine?.transitionHistory || []),
          {
            from: currentStateMachine?.currentState || 'source_idle',
            to: newState,
            timestamp,
            trigger
          }
        ].slice(-10) // Keep last 10 transitions
      };

      return {
        nodeStates: {
          ...state.nodeStates,
          [nodeId]: {
            ...currentNodeState,
            stateMachine: updatedStateMachine
          }
        }
      };
    });
  },

  _logNodeActivity: (nodeIdForLog, logCoreDetails, timestamp) => {
    // ALWAYS BLOCK LEGACY LOGGING IN EVENT-DRIVEN MODE
    console.warn(`🚫 [BLOCKED] Legacy _logNodeActivity called in EVENT-DRIVEN mode! Node: ${nodeIdForLog}, Action: ${logCoreDetails.action}`);
    return null; // Return null to indicate blocked
    const currentSequence = get().eventCounter;
    set(stateFS => ({ eventCounter: stateFS.eventCounter + 1 }));

    // Determine operation type from action
    const operationType = determineOperationType(logCoreDetails.action);

    // GET CURRENT FSM STATE - SINGLE SOURCE OF TRUTH
    const currentNodeState = get().nodeStates[nodeIdForLog];
    const nodeConfig = get().nodesConfig[nodeIdForLog];
    
    // CRITICAL: FSMProcessNode stores state differently than other nodes
    let currentFSMState = 'unknown';
    if (nodeConfig?.type === 'FSMProcessNode') {
      // FSMProcessNode stores state directly as currentFSMState
      currentFSMState = (currentNodeState as any)?.currentFSMState || 'idle';
    } else {
      // Other nodes use stateMachine.currentState
      currentFSMState = (currentNodeState as any)?.stateMachine?.currentState || 'unknown';
    }

    // Get buffer sizes for context
    const bufferSize = (currentNodeState as any)?.inputBuffer?.length || 
                       Object.values((currentNodeState as any)?.inputBuffers || {}).reduce((sum: number, buf: any) => sum + (buf?.length || 0), 0) || 0;
    const outputBufferSize = (currentNodeState as any)?.outputBuffer?.length || 0;

    const newEntry: HistoryEntry = {
      timestamp: timestamp,
      epochTimestamp: Date.now(),
      sequence: currentSequence,
      nodeId: nodeIdForLog,
      action: logCoreDetails.action,
      value: logCoreDetails.value,
      sourceTokenIds: logCoreDetails.sourceTokenIds,
      sourceTokenSummaries: logCoreDetails.sourceTokenSummaries,
      details: logCoreDetails.details,

      // FSM STATE - AUTHORITATIVE
      state: currentFSMState,
      bufferSize: bufferSize,
      outputBufferSize: outputBufferSize,

      operationType,
      // Enhanced fields will be added by specific operations
      aggregationDetails: (logCoreDetails as any).aggregationDetails,
      transformationDetails: (logCoreDetails as any).transformationDetails,
      lineageMetadata: (logCoreDetails as any).lineageMetadata,
      
      // CRITICAL: Preserve custom fields (e.g., multiplexer routing info)
      ...(logCoreDetails as any),
    };

    set(state => {
      if (!nodeIdForLog || typeof nodeIdForLog !== "string") {
        console.error(
          `[${timestamp}s] SIMULATION ERROR: Attempted to log activity with invalid nodeIdForLog: ${nodeIdForLog}. Action: ${logCoreDetails.action}, Details: ${logCoreDetails.details}`,
        );
        const currentErrors = state.errorMessages || [];
        return { ...state, errorMessages: [`Logging error: Invalid nodeIdForLog: ${nodeIdForLog}`, ...currentErrors] };
      }

      const currentNodeLogs = state.nodeActivityLogs[nodeIdForLog] || [];
      const updatedNodeLogs = [...currentNodeLogs, newEntry].slice(-MAX_NODE_ACTIVITY_LOGS);
      const newNodeActivityLogs = {
        ...state.nodeActivityLogs,
        [nodeIdForLog]: updatedNodeLogs,
      };

      const currentGlobalLog = state.globalActivityLog || [];
      const updatedGlobalLog = [...currentGlobalLog, newEntry].slice(-MAX_GLOBAL_ACTIVITY_LOGS);

      console.log(`✅ [ACTIVITY LOGGED] Sequence: ${newEntry.sequence}, Global log size: ${updatedGlobalLog.length}`);
      return { ...state, nodeActivityLogs: newNodeActivityLogs, globalActivityLog: updatedGlobalLog };
    });
    return newEntry;
  },

  _createToken: (originNodeId, value, timestamp, sourceTokens: Token[] = []) => {
    const newToken: Token = {
      id: nanoid(8),
      value,
      createdAt: timestamp,
      originNodeId,
      history: [],
    };

    const sourceTokenIds = sourceTokens.map(t => t.id);

    // Create enhanced source token summaries with recursive lineage
    const sourceTokenSummaries = createEnhancedSourceTokenSummaries(sourceTokens);

    // Create lineage metadata for this token creation
    const lineageMetadata = createLineageMetadata("creation", sourceTokens, newToken.id);

    // Register with lineage tracker
    const nodeConfig = get().nodesConfig[originNodeId];
    const nodeName = nodeConfig?.displayName || originNodeId;
    TokenLineageTracker.registerToken(
      newToken,
      originNodeId,
      nodeName,
      timestamp,
      sourceTokens,
      'created'
    );

    return newToken;
  },

  _tryFireProcessNode: (pnConfig, pnState, newTime) => {
    const { nodesConfig, _logNodeActivity, _createToken, _updateNodeState, _transitionNodeState } = get();

    // Check if ProcessNode can fire
    let canFire = true;
    const inputsDataForFormula: Record<string, Token> = {};
    const aliasToSourceNodeId: Record<string, string> = {};

    for (const input of pnConfig.inputs) {
      const inputSourceNodeId = input.nodeId;
      if (!inputSourceNodeId) {
        canFire = false;
        break;
      }

      const sourceNodeConfig = nodesConfig[inputSourceNodeId];
      if (!sourceNodeConfig) {
        canFire = false;
        break;
      }

      const aliasKey = input.alias || inputSourceNodeId;
      aliasToSourceNodeId[aliasKey] = inputSourceNodeId;

      // Check if we have tokens in input buffer for this input
      if (pnState.inputBuffers[inputSourceNodeId] && pnState.inputBuffers[inputSourceNodeId].length > 0) {
        inputsDataForFormula[aliasKey] = pnState.inputBuffers[inputSourceNodeId][0];
      } else {
        canFire = false;
        break;
      }
    }

    if (!canFire) {
      return; // Can't fire yet, need more inputs
    }

    // ProcessNode can fire!
    _transitionNodeState(pnConfig.nodeId, 'process_emitting', newTime, 'fire');

    const consumedTokensForThisFiring: Token[] = [];
    const nextPnInputBuffers = JSON.parse(JSON.stringify(pnState.inputBuffers));

    // Consume input tokens - CRITICAL: use actual source node ID, not alias!
    Object.entries(inputsDataForFormula).forEach(([aliasKey, tokenToConsume]) => {
      consumedTokensForThisFiring.push(tokenToConsume);

      // Get the actual source node ID from our alias mapping
      const actualSourceNodeId = aliasToSourceNodeId[aliasKey];
      if (actualSourceNodeId) {
        // Remove token from input buffer using the ACTUAL node ID
        const buffer = (nextPnInputBuffers[actualSourceNodeId] as Token[]) || [];
        buffer.shift();
        nextPnInputBuffers[actualSourceNodeId] = buffer;
        console.log(`🗑️ [PROCESSNODE ${pnConfig.nodeId}] Consumed token ${tokenToConsume.id} from buffer "${actualSourceNodeId}" (alias: "${aliasKey}")`);
      }
    });

    // Log firing event with source token IDs for lineage
    const consumedTokenIds = consumedTokensForThisFiring.map(t => t.id);
    const consumedTokenValues = consumedTokensForThisFiring.map(t => `${t.id}(${t.value})`).join(', ');

    _logNodeActivity(
      pnConfig.nodeId,
      {
        action: "firing",
        value: consumedTokensForThisFiring.length,
        details: `Firing with inputs: ${consumedTokenValues}`,
        sourceTokenIds: consumedTokenIds,
      },
      newTime,
    );

    _updateNodeState(pnConfig.nodeId, { inputBuffers: nextPnInputBuffers, lastFiredTime: newTime });

    // Build formula context
    const formulaContext: Record<string, any> = { inputs: {} };
    Object.entries(inputsDataForFormula).forEach(([aliasKey, token]) => {
      formulaContext.inputs[aliasKey] = { value: token.value };
      const sourceNodeId = aliasToSourceNodeId[aliasKey];
      if (sourceNodeId) {
        formulaContext[aliasKey] = {
          data: {
            value: token.value,
            aggregatedValue: token.value,
            transformedValue: token.value
          }
        };
        // Add direct value access for convenience
        formulaContext[aliasKey + 'Value'] = token.value;
        // CRITICAL: Add shorthand variable names for common patterns
        // If input is "number", also make it available as "num"
        if (aliasKey === 'number') {
          formulaContext['num'] = token.value;
        }
        // For any input, add direct value without the node name prefix
        // This makes formulas like "num <= 3" work when input is "number"
        const shortName = aliasKey.substring(0, 3); // First 3 chars
        if (shortName && !formulaContext[shortName]) {
          formulaContext[shortName] = token.value;
        }
        // CRITICAL FIX: Also add the raw value directly to avoid object references
        formulaContext[aliasKey] = token.value;
      }
    });
    
    console.log('🔍 [FORMULA CONTEXT]', formulaContext);

    // Generate outputs (simplified - no individual emitting events)
    pnConfig.outputs.forEach((output: any) => {
      const { formula } = output.transformation || { formula: "inputs.a" };
      const result = evaluateFormula(formula, formulaContext);
      const outputValue = typeof result === 'object' && result !== null && 'value' in result ? result.value : result;

      // Pass consumed tokens for lineage tracking
      const newToken = _createToken(pnConfig.nodeId, outputValue, newTime, consumedTokensForThisFiring);

      // Forward token to destination (reuse existing forwarding logic)
      const destNodeConfig = nodesConfig[output.destinationNodeId];

      // Log token creation with transformation details
      const destName = destNodeConfig?.displayName || output.destinationNodeId;

      // Build detailed formula explanation
      let formulaExplanation = formula;
      // Check if it's a simple division or multiplication
      if (formula.includes('/')) {
        const parts = formula.split('/');
        if (parts.length === 2) {
          const inputPart = parts[0].trim();
          const divisor = parts[1].trim();
          const inputValue = formulaContext[inputPart] || formulaContext[inputPart + 'Value'];
          if (inputValue !== undefined) {
            formulaExplanation = `${inputValue} / ${divisor} = ${outputValue}`;
          }
        }
      } else if (formula.includes('*')) {
        const parts = formula.split('*');
        if (parts.length === 2) {
          const inputPart = parts[0].trim();
          const multiplier = parts[1].trim();
          const inputValue = formulaContext[inputPart] || formulaContext[inputPart + 'Value'];
          if (inputValue !== undefined) {
            formulaExplanation = `${inputValue} × ${multiplier} = ${outputValue}`;
          }
        }
      }
      
      // For complex formulas (like ternary), show result prominently
      const outputValueStr = typeof outputValue === 'string' ? `"${outputValue}"` : outputValue;
      const detailsText = formula.length > 50 
        ? `Token ${newToken.id} → ${destName} | Output: ${outputValueStr} | Formula: ${formula.substring(0, 40)}...`
        : `Token ${newToken.id} → ${destName} | Output: ${outputValueStr} | ${formulaExplanation}`;

      _logNodeActivity(
        pnConfig.nodeId,
        {
          action: "token_emitted",
          value: outputValue,
          details: detailsText,
          sourceTokenIds: consumedTokenIds,
        },
        newTime,
      );
      if (destNodeConfig) {
        const destNodeState = get().nodeStates[destNodeConfig.nodeId];

        if (destNodeConfig.type === "Queue") {
          const qState = destNodeState as QueueState;
          _transitionNodeState(destNodeConfig.nodeId, 'queue_accumulating', newTime, 'token_received');
          _updateNodeState(destNodeConfig.nodeId, { inputBuffer: [...qState.inputBuffer, newToken] });

          _logNodeActivity(
            destNodeConfig.nodeId,
            {
              action: "accumulating",
              value: newToken.value,
              details: `Added Token ${newToken.id} (${newToken.value}) from ${pnConfig.displayName}`,
            },
            newTime,
          );
        } else if (destNodeConfig.type === "ProcessNode") {
          const destPnState = destNodeState as ProcessNodeState;
          const bufferForInput = destPnState.inputBuffers[pnConfig.nodeId] || [];
          _updateNodeState(destNodeConfig.nodeId, {
            inputBuffers: { ...destPnState.inputBuffers, [pnConfig.nodeId]: [...bufferForInput, newToken] },
          });

          _logNodeActivity(
            destNodeConfig.nodeId,
            {
              action: "token_received",
              value: bufferForInput.length + 1,
              details: `Received token from ${pnConfig.displayName} (buffer size: ${bufferForInput.length + 1})`,
            },
            newTime,
          );

          // Recursively try to fire the destination ProcessNode
          const updatedDestPnState = get().nodeStates[destNodeConfig.nodeId] as ProcessNodeState;
          get()._tryFireProcessNode(destNodeConfig, updatedDestPnState, newTime);
        } else if (destNodeConfig.type === "FSMProcessNode") {
          // CRITICAL: Handle FSM token reception from ProcessNode
          const fsmState = destNodeState as any;
          const currentFSMState = fsmState.currentFSMState || 'idle';

          // Find which input this token is for
          const targetInput = destNodeConfig.inputs?.find((inp: any) => 
            inp.nodeId === pnConfig.nodeId && inp.sourceOutputName === output.name
          );
          const bufferKey = targetInput?.name || 'input';
          
          console.log(`🎯 [FSM ${destNodeConfig.nodeId}] Token from ProcessNode:`, {
            sourceNode: pnConfig.nodeId,
            sourceOutput: output.name,
            targetInput: bufferKey,
            tokenValue: newToken.value,
            tokenId: newToken.id
          });

          // Add token to input buffer
          const inputBuffers = fsmState.inputBuffers || {};
          inputBuffers[bufferKey] = [...(inputBuffers[bufferKey] || []), newToken];
          _updateNodeState(destNodeConfig.nodeId, { inputBuffers });

          // Extract message value from token
          const messageValue = typeof newToken.value === 'string' ? newToken.value : JSON.stringify(newToken.value);
          
          console.log(`📨 [FSM ${destNodeConfig.nodeId}] Received message: "${messageValue}" from ${pnConfig.displayName} | Token: ${newToken.id} | State: ${currentFSMState}`);
          
          // ALWAYS log message reception (for auditing/debugging)
          _logNodeActivity(
            destNodeConfig.nodeId,
            {
              action: "message_received",
              value: messageValue,
              details: `Message: "${messageValue}" | From: ${pnConfig.displayName} | State: ${currentFSMState} | Token: ${newToken.id}`,
            },
            newTime,
          );
          
          // Check for valid transitions from current state
          const validTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) =>
            t.trigger === messageValue && t.from === currentFSMState
          ) || [];

          if (validTransitions.length > 0) {
            // Message triggers a valid transition - EXECUTE IT
            console.log(`🎯 [FSM ${destNodeConfig.nodeId}] Found ${validTransitions.length} valid transition(s) for message "${messageValue}" from state "${currentFSMState}"`);

            validTransitions.forEach((transition: any) => {
              get()._executeFSMTransition(destNodeConfig, fsmState, transition, newTime);
            });
          } else {
            // No valid transition - message logged but state unchanged
            console.log(`⚠️ [FSM ${destNodeConfig.nodeId}] Message "${messageValue}" has no valid transition from state "${currentFSMState}" - state unchanged`);
          }
        } else if (destNodeConfig.type === "EnhancedFSMProcessNode") {
          // Handle Enhanced FSM token reception from ProcessNode
          const enhancedFsmState = destNodeState as any;

          // Add token to token buffer for processing by Enhanced FSM engine
          const tokenBufferKey = 'default';
          enhancedFsmState.tokenBuffers[tokenBufferKey] = [
            ...(enhancedFsmState.tokenBuffers[tokenBufferKey] || []),
            newToken
          ];

          _logNodeActivity(
            destNodeConfig.nodeId,
            {
              action: "token_received",
              value: newToken.value,
              details: `Token received from ${pnConfig.displayName} (Enhanced FSM)`,
            },
            newTime,
          );
        } else if (destNodeConfig.type === "Sink") {
          const sinkState = destNodeState as SinkState;
          _transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
          const updatedConsumedTokens = [...(sinkState.consumedTokens || []), newToken].slice(-MAX_SINK_TOKENS_STORED);
          _updateNodeState(destNodeConfig.nodeId, {
            consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
            lastConsumedTime: newTime,
            consumedTokens: updatedConsumedTokens,
          });

          // Consistent logging with token ID
          _logNodeActivity(
            destNodeConfig.nodeId,
            {
              action: "consuming",
              value: newToken.value,
              details: `Token ${newToken.id} from ${pnConfig.displayName} output`
            },
            newTime,
          );

          // Add consumed event to log
          _logNodeActivity(
            destNodeConfig.nodeId,
            { action: "token_consumed", value: newToken.value, details: `Token ${newToken.id} from ${pnConfig.displayName} output` },
            newTime,
          );

          _transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'token_consumed');
        }
      }
    });

    // Transition back to idle
    _transitionNodeState(pnConfig.nodeId, 'process_idle', newTime, 'outputs_sent');
  },

  // FSM-specific functions
  _executeFSMTransition: (fsmConfig: any, fsmState: any, transition: any, newTime: number) => {
    const { _logNodeActivity, _updateNodeState, _transitionNodeState } = get();

    // Log transition
    _logNodeActivity(
      fsmConfig.nodeId,
      {
        action: "fsm_transition",
        details: `${transition.from} → ${transition.to} (${transition.trigger})`,
      },
      newTime,
    );

    // Execute onExit actions for current state
    // States can be strings ("idle") or objects ({name: "processing", onEntry: [...]})
    const currentStateObj = fsmConfig.fsm?.states?.find((s: any) => {
      if (typeof s === 'string') return s === fsmState.currentFSMState;
      if (typeof s === 'object' && s.name) return s.name === fsmState.currentFSMState;
      return false;
    });
    if (typeof currentStateObj === 'object' && currentStateObj?.onExit) {
      currentStateObj.onExit.forEach((action: any) => {
        get()._executeFSMAction(fsmConfig, fsmState, action, newTime);
      });
    }

    // Update FSM state
    _updateNodeState(fsmConfig.nodeId, {
      currentFSMState: transition.to,
      lastTransitionTime: newTime,
    });
    
    console.log(`🔄 [FSM ${fsmConfig.nodeId}] State updated: ${transition.from} → ${transition.to}`);

    // Update state machine tracking
    _transitionNodeState(fsmConfig.nodeId, transition.to, newTime, transition.trigger);

    // CRITICAL: Automatically emit current state to "state" output (if it exists)
    // This allows downstream nodes (like Multiplexer) to react to state changes
    const stateOutput = fsmConfig.outputs?.find((out: any) => out.name === 'state');
    if (stateOutput) {
      const stateToken = get()._createToken(fsmConfig.nodeId, transition.to, newTime);
      console.log(`📤 [FSM ${fsmConfig.nodeId}] Auto-emitting state "${transition.to}" to output "state"`);
      get()._routeFSMToken(fsmConfig, stateOutput, stateToken, newTime);
      
      _logNodeActivity(
        fsmConfig.nodeId,
        {
          action: "state_emitted",
          value: transition.to,
          details: `Emitted state "${transition.to}" after transition`,
        },
        newTime,
      );
    }

    // Execute onEntry actions for new state
    // States can be strings ("idle") or objects ({name: "processing", onEntry: [...]})
    const newStateObj = fsmConfig.fsm?.states?.find((s: any) => {
      if (typeof s === 'string') return s === transition.to;
      if (typeof s === 'object' && s.name) return s.name === transition.to;
      return false;
    });
    if (typeof newStateObj === 'object' && newStateObj?.onEntry) {
      console.log(`🎬 [FSM ${fsmConfig.nodeId}] Executing ${newStateObj.onEntry.length} onEntry action(s) for state "${transition.to}"`);
      newStateObj.onEntry.forEach((action: any) => {
        get()._executeFSMAction(fsmConfig, fsmState, action, newTime);
      });
    }
  },

  _executeFSMAction: (fsmConfig: any, fsmState: any, action: any, newTime: number) => {
    const { _logNodeActivity, _updateNodeState, _createToken, nodesConfig } = get();

    switch (action.action) {
      case 'emit':
        if (action.target && action.formula) {
          // Evaluate formula to get output value
          const formulaContext = {
            ...fsmState.fsmVariables,
            ...Object.fromEntries(
              Object.entries(fsmState.inputBuffers || {}).map(([key, tokens]: [string, any]) =>
                [key, tokens[0]?.value] // Use first token value
              )
            )
          };

          const { value: outputValue, error } = evaluateFormula(action.formula, formulaContext);
          if (!error) {
            // Create token and emit it
            const token = _createToken(fsmConfig.nodeId, outputValue, newTime);

            // Find the output configuration
            const outputConfig = fsmConfig.outputs?.find((out: any) => out.name === action.target);
            if (outputConfig) {
              get()._routeFSMToken(fsmConfig, outputConfig, token, newTime);
            }
          } else {
            _logNodeActivity(fsmConfig.nodeId, {
              action: "error",
              details: `FSM emit action formula error: ${error}`,
            }, newTime);
          }
        } else if (action.target && action.value !== undefined) {
          // Direct value emission
          const token = _createToken(fsmConfig.nodeId, action.value, newTime);
          const outputConfig = fsmConfig.outputs?.find((out: any) => out.name === action.target);
          if (outputConfig) {
            get()._routeFSMToken(fsmConfig, outputConfig, token, newTime);
          }
        }
        break;

      case 'log':
        _logNodeActivity(fsmConfig.nodeId, {
          action: "fsm_log",
          details: action.value || action.formula || "FSM log action",
        }, newTime);
        break;

      case 'set_variable':
        if (action.target) {
          let newValue = action.value;
          if (action.formula) {
            const { value, error } = evaluateFormula(action.formula, fsmState.fsmVariables);
            if (!error) newValue = value;
          }

          _updateNodeState(fsmConfig.nodeId, {
            fsmVariables: {
              ...fsmState.fsmVariables,
              [action.target]: newValue
            }
          });
        }
        break;

      case 'increment':
        if (action.target) {
          const currentValue = fsmState.fsmVariables[action.target] || 0;
          _updateNodeState(fsmConfig.nodeId, {
            fsmVariables: {
              ...fsmState.fsmVariables,
              [action.target]: currentValue + (action.value || 1)
            }
          });
        }
        break;

      case 'decrement':
        if (action.target) {
          const currentValue = fsmState.fsmVariables[action.target] || 0;
          _updateNodeState(fsmConfig.nodeId, {
            fsmVariables: {
              ...fsmState.fsmVariables,
              [action.target]: currentValue - (action.value || 1)
            }
          });
        }
        break;
    }
  },

  _routeFSMToken: (fsmConfig: any, outputConfig: any, token: any, newTime: number) => {
    const { _logNodeActivity, _updateNodeState, nodesConfig } = get();

    // Log emission
    _logNodeActivity(fsmConfig.nodeId, {
      action: "token_emitted",
      value: token.value,
      details: `Token ${token.id} via FSM action to ${outputConfig.destinationNodeId}`,
    }, newTime);

    // Route token to destination
    const destNodeConfig = nodesConfig[outputConfig.destinationNodeId];
    if (destNodeConfig) {
      const destNodeState = get().nodeStates[destNodeConfig.nodeId];

      // Handle different destination types
      if (destNodeConfig.type === "FSMProcessNode") {
        // FSM → FSM: trigger token_received transition
        const destFsmState = destNodeState as any;
        const tokenReceivedTransitions = destNodeConfig.fsm?.transitions?.filter((t: any) =>
          t.trigger === 'token_received' && t.from === destFsmState.currentFSMState
        ) || [];

        // Add token to input buffer
        const inputBuffers = destFsmState.inputBuffers || {};
        const bufferKey = outputConfig.destinationInputName || 'default';
        inputBuffers[bufferKey] = [...(inputBuffers[bufferKey] || []), token];
        _updateNodeState(destNodeConfig.nodeId, { inputBuffers });

        // Trigger transitions
        tokenReceivedTransitions.forEach((transition: any) => {
          get()._executeFSMTransition(destNodeConfig, destFsmState, transition, newTime);
        });

      } else if (destNodeConfig.type === "Sink") {
        // FSM → Sink: use existing Sink logic
        get()._transitionNodeState(destNodeConfig.nodeId, 'sink_processing', newTime, 'token_received');
        const sinkState = destNodeState as any;
        const updatedConsumedTokens = [...(sinkState.consumedTokens || []), token].slice(-50);
        _updateNodeState(destNodeConfig.nodeId, {
          consumedTokenCount: (sinkState.consumedTokenCount || 0) + 1,
          lastConsumedTime: newTime,
          consumedTokens: updatedConsumedTokens,
        });

        _logNodeActivity(destNodeConfig.nodeId, {
          action: "consuming",
          value: token.value,
          details: `Token ${token.id} from FSM ${fsmConfig.displayName}`,
        }, newTime);

        _logNodeActivity(destNodeConfig.nodeId, {
          action: "token_consumed",
          value: token.value,
          details: `Token ${token.id} from FSM ${fsmConfig.displayName}`,
        }, newTime);

        get()._transitionNodeState(destNodeConfig.nodeId, 'sink_idle', newTime, 'token_consumed');
      
      } else {
        // Generic handling for other node types: StateMultiplexer, ProcessNode, Queue, etc.
        // Add token to input buffer using the destinationInputName
        const inputBuffers = (destNodeState as any).inputBuffers || {};
        const bufferKey = outputConfig.destinationInputName || 'input';
        inputBuffers[bufferKey] = [...(inputBuffers[bufferKey] || []), token];
        _updateNodeState(destNodeConfig.nodeId, { inputBuffers });

        console.log(`📬 [${destNodeConfig.type} ${destNodeConfig.nodeId}] Received token from FSM ${fsmConfig.displayName}`, {
          token: token.id,
          value: token.value,
          input: bufferKey
        });

        _logNodeActivity(destNodeConfig.nodeId, {
          action: "token_received",
          value: token.value,
          details: `Token ${token.id} from FSM ${fsmConfig.displayName} → input "${bufferKey}"`,
        }, newTime);

        // Node-specific processing will happen in the main simulation tick
      }
    }
  },

  _restoreScenarioState: (scenario) => {
    
    const { validateScenario } = require('@/lib/simulation/validation');
    const { scenario: parsedScenario, errors } = validateScenario(scenario);
    
    if (parsedScenario && errors.length === 0) {
      
      const nodesConfig: Record<string, AnyNode> = {};
      const initialNodeStates: Record<string, AnyNodeState> = {};
      const initialLogs: Record<string, HistoryEntry[]> = {};

      parsedScenario.nodes.forEach(node => {
        nodesConfig[node.nodeId] = node;
        initialLogs[node.nodeId] = [];
        switch (node.type) {
          case "DataSource":
            initialNodeStates[node.nodeId] = { 
              lastEmissionTime: -1,
              stateMachine: {
                currentState: "source_idle",
                transitionHistory: []
              }
            } as DataSourceState;
            break;
          case "Queue":
            initialNodeStates[node.nodeId] = { 
              inputBuffer: [], 
              outputBuffer: [], 
              lastAggregationTime: -1,
              stateMachine: {
                currentState: "queue_idle",
                transitionHistory: []
              }
            } as QueueState;
            break;
          case "ProcessNode":
            const inputBuffers: Record<string, Token[]> = {};
            initialNodeStates[node.nodeId] = {
              inputBuffers,
              lastFiredTime: -1,
              stateMachine: {
                currentState: "process_idle",
                transitionHistory: []
              }
            } as ProcessNodeState;
            break;
          case "FSMProcessNode":
            const fsmNode = node as any; // FSMProcessNode type
            const fsmInputBuffers: Record<string, Token[]> = {};
            const initialState = fsmNode.fsm?.states?.find((s: any) => s.isInitial)?.name || fsmNode.fsm?.states?.[0]?.name || "idle";
            initialNodeStates[node.nodeId] = {
              inputBuffers: fsmInputBuffers,
              fsmVariables: { ...fsmNode.fsm?.variables } || {},
              currentFSMState: initialState,
              lastTransitionTime: -1,
              stateMachine: {
                currentState: initialState,
                transitionHistory: []
              }
            } as any; // FSMProcessNodeState;
            break;
          case "EnhancedFSMProcessNode":
            // Enhanced FSM support - basic implementation
            const enhancedFsmNode2 = node as any; // EnhancedFSMProcessNode type
            initialNodeStates[node.nodeId] = {
              currentState: "idle",
              previousState: undefined,
              stateChangedAt: 0,
              variables: {},
              stateVariables: {},
              eventBuffer: [],
              messageBuffer: [],
              tokenBuffers: { default: [] },
              lastProcessedTime: 0,
              processedEventCount: 0,
              processedMessageCount: 0,
              feedbackDepth: 0,
              circuitBreakerState: {
                isOpen: false,
                eventCount: 0,
                windowStartTime: 0,
              },
              stateHistory: [{ state: "idle", enteredAt: 0 }],
              transitionHistory: [],
              pendingActions: [],
              actionHistory: [],
              errors: []
            } as any; // EnhancedFSMProcessNodeState
            break;
          case "Sink":
            initialNodeStates[node.nodeId] = {
              consumedTokenCount: 0,
              lastConsumedTime: -1,
              consumedTokens: [],
              stateMachine: {
                currentState: "sink_idle",
                transitionHistory: []
              }
            } as SinkState;
            break;
          case "Module":
            const moduleNode2 = node as any; // ModuleNode type
            initialNodeStates[node.nodeId] = {
              inputBuffers: {},
              outputBuffers: {},
              subGraphStates: {},
              isExpanded: moduleNode2.isExpanded || false,
              lastProcessedTime: -1,
              processedTokenCount: 0,
              internalEventCounter: 0,
              stateMachine: {
                currentState: "module_idle",
                transitionHistory: []
              }
            } as any; // ModuleState
            break;
        }
      });

      set({
        scenario: parsedScenario,
        nodesConfig,
        nodeStates: initialNodeStates,
        currentTime: 0,
        isRunning: false,
        nodeActivityLogs: initialLogs,
        globalActivityLog: [],
        errorMessages: [],
        selectedNodeId: null,
        selectedToken: null,
        isGlobalLedgerOpen: false,
        eventCounter: 0,
      });
      
    } else {
    }
  },

  _restoreExecutionState: (execution: ExecutionDocument) => {
    // Restore complete execution state for perfect reconstruction
    set({
      scenario: execution.scenario,
      nodeStates: execution.nodeStates,
      currentTime: execution.currentTime,
      eventCounter: execution.eventCounter,
      // Always skip restoring legacy logs in event-driven mode
      globalActivityLog: [],
      nodeActivityLogs: {},
      currentExecution: execution,
    });
    
    console.log(`🚫 [EVENT-DRIVEN MODE] Skipped restoring ${execution.globalActivityLog?.length || 0} legacy activity logs from execution`);

    // Rebuild nodesConfig from scenario
    const nodesConfig: Record<string, AnyNode> = {};
    execution.scenario.nodes.forEach(node => {
      nodesConfig[node.nodeId] = node;
    });

    set(state => ({ ...state, nodesConfig }));
  },

  clearScenario: () => {
    console.log("🧹 [STORE] Clearing scenario and resetting state");
    set({
      scenario: null,
      nodesConfig: {},
      nodeStates: {},
      globalActivityLog: [],
      nodeActivityLogs: {},
      eventCounter: 0,
      currentTime: 0,
      isRunning: false,
      currentExecutionId: null,
      currentExecution: null,
      errorMessages: [],
      activeNodeIds: new Set(),
      recentlyActiveNodeIds: new Set(),
      lastStepInvolvedNodes: [],
    });
  },
}; // End of state object
}); // End of create wrapper
