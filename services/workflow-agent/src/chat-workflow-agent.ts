import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import winston from 'winston';
import Ajv from 'ajv';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

// Define tools for reusability
const ajv = new Ajv();
const tools = {
  validateSchema: async (schema: any, doc: any) => {
    const validate = ajv.compile(schema);
    const valid = validate(doc);
    return {
      valid,
      errors: validate.errors || []
    };
  },

  searchDocs: async (query: string, referenceDoc?: any) => {
    const relevantDocs = [];
    if (referenceDoc) {
      relevantDocs.push({
        content: JSON.stringify(referenceDoc, null, 2),
        relevance: 0.9
      });
    }
    return relevantDocs;
  },

  extractNodePatterns: (message: string) => {
    const patterns = {
      references: message.match(/@[\w-]+/g) || [],
      likeNodes: (message.match(/like\s+@[\w-]+/g) || []).map(m => m.replace('like ', '')),
      connections: message.match(/connected?\s+to\s+@?[\w-]+/gi) || [],
      conditions: message.match(/if\s+.+?\s+goes?\s+to\s+.+?/gi) || []
    };
    return patterns;
  }
};

// Unified state with all features
const UnifiedStateAnnotation = Annotation.Root({
  // Input
  userMessage: Annotation<string>(),
  chatHistory: Annotation<Array<{ role: string; content: string }>>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  currentScenario: Annotation<any>({ reducer: (x, y) => y ?? x }),

  // Processing state
  existingNodes: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  nodeContext: Annotation<string>({ reducer: (x, y) => y ?? x }),
  parsedRequest: Annotation<any>({ reducer: (x, y) => y ?? x }),
  generatedScenario: Annotation<any>({ reducer: (x, y) => y ?? x }),
  validationResults: Annotation<any>({ reducer: (x, y) => y ?? x }),

  // Reflection and retry
  reflectionDecision: Annotation<string>({ reducer: (x, y) => y ?? x }),
  retryCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 3
  }),

  // Output
  response: Annotation<any>({ reducer: (x, y) => y ?? x }),
  errors: Annotation<string[]>({
    reducer: (x, y) => [...(x || []), ...(y || [])],
    default: () => []
  }),

  // Real-time updates
  stateUpdates: Annotation<Array<{ step: string; message: string; timestamp: Date }>>({
    reducer: (x, y) => [...(x || []), ...(y || [])],
    default: () => []
  }),

  // LangGraph Studio tracking
  runId: Annotation<string>({ reducer: (x, y) => y ?? x }),
  threadId: Annotation<string>({ reducer: (x, y) => y ?? x })
});

type UnifiedState = typeof UnifiedStateAnnotation.State;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// State update emitter for real-time updates
const stateEmitter = new EventEmitter();

// Store active runs for Studio
const activeRuns = new Map<string, any>();
const runHistories = new Map<string, any[]>();

// Initialize the AI model
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  logger.error('No API key found. Please set GOOGLE_AI_API_KEY environment variable.');
  process.exit(1);
}

const model = new ChatGoogleGenerativeAI({
  apiKey,
  model: process.env.AI_MODEL || "gemini-2.0-flash",
  temperature: parseFloat(process.env.AI_TEMPERATURE || "0.1"),
});

// Helper to emit state updates
function emitStateUpdate(step: string, message: string, runId?: string) {
  const update = { step, message, timestamp: new Date(), runId };
  stateEmitter.emit('stateUpdate', update);
  logger.info(`📡 [STATE UPDATE] ${step}: ${message}`);

  // Store in run history
  if (runId && runHistories.has(runId)) {
    runHistories.get(runId)!.push(update);
  }

  return [update];
}

// Node 1: Context Analysis with History
async function analyzeContext(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('context_analysis', 'Analyzing context and chat history...', state.runId);

  const existingNodes = state.currentScenario?.nodes || [];
  const nodeContext = existingNodes.map((n: any) => `@${n.displayName || n.nodeId} (${n.type})`).join(', ');

  const historyContext = state.chatHistory.slice(-5).map(msg =>
    `${msg.role}: ${msg.content.substring(0, 100)}...`
  ).join('\n');

  logger.info('📊 [CONTEXT] Analysis complete:', {
    existingNodes: existingNodes.length,
    historyMessages: state.chatHistory.length,
    nodeContext: nodeContext || 'None',
    runId: state.runId
  });

  return {
    existingNodes,
    nodeContext,
    errors: [],
    stateUpdates: updates
  };
}

// Node 2: Enhanced DSL Parsing with History Context
async function parseDSLRequest(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('dsl_parsing', 'Parsing DSL request with AI...', state.runId);

  // Check if this is a cleanup/fix request
  const cleanupKeywords = ['clean errors', 'fix errors', 'clear errors', 'fix validation', 'clean validation', 'remove errors', 'cleanup'];
  const isCleanupRequest = cleanupKeywords.some(keyword =>
    state.userMessage.toLowerCase().includes(keyword)
  );

  if (isCleanupRequest && state.currentScenario) {
    // Return empty parsing result - validation will clean up broken edges
    logger.info('🧹 [CLEANUP] Detected cleanup request, will clean validation errors');
    return {
      parsedRequest: {
        newNodes: [],
        connections: [],
        intent: 'cleanup_validation_errors'
      },
      stateUpdates: updates
    };
  }

  const patterns = tools.extractNodePatterns(state.userMessage);
  const relevantDocs = await tools.searchDocs(state.userMessage, state.currentScenario);

  const prompt = `DSL-AWARE WORKFLOW AGENT: Advanced parsing with chat context.

CHAT HISTORY (last 5 messages):
${state.chatHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

EXISTING SCENARIO CONTEXT:
${state.currentScenario ? `
📊 Current Nodes (${state.existingNodes.length}):
${state.existingNodes.map((n: any) => `  - @${n.nodeId} (${n.displayName || 'Unnamed'}) - ${n.type}`).join('\n')}

🚨 CRITICAL: These nodes already exist. NEVER connect to them unless user EXPLICITLY says "@NodeName"!
🚨 FORBIDDEN: Any connection to @CreditFSM, @RegistrySink, @EnergyQueue, etc. without explicit @reference
🚨 CREATE NEW: Always create new sinks, new credit nodes, new everything unless @ is used
` : '🆕 Empty scenario - all nodes will be new'}

USER REQUEST: "${state.userMessage}"

EXTRACTED PATTERNS:
- References: ${patterns.references.join(', ') || 'None'}
- Like nodes: ${patterns.likeNodes.join(', ') || 'None'}
- Connections: ${patterns.connections.length} found
- Conditions: ${patterns.conditions.length} found

${state.retryCount > 0 ? `
RETRY ATTEMPT ${state.retryCount}/${state.maxRetries}
Previous errors: ${state.errors.join('; ')}
IMPORTANT: Fix the validation issues mentioned above!
` : ''}

DSL SYNTAX:
- "like @NodeName" = CREATE NEW with SIMILAR CONFIG (clone, don't reuse existing)
- "@NodeName" = reference existing for connections ONLY
- "connected to" = create edge
- "if X goes to Y" = conditional routing
- "state machine" or "FSM" = FSM node with states
- "queue" or "buffer" = Queue node for buffering

🚨 CRITICAL RULES:
- DEFAULT BEHAVIOR: CREATE ALL NEW NODES unless explicitly told to use existing with @NodeId
- "create a new flow" = CREATE COMPLETELY NEW NODES, never connect to existing nodes
- "like @NodeName" = CREATE NEW node inspired by existing, don't connect to original
- NEVER CONNECT TO EXISTING NODES unless user explicitly says "@NodeName" in their request
- "connected to a credit sink" = CREATE NEW SINK, don't use existing CreditFSM
- "token registry credit sink" = CREATE NEW SINK, not existing registry
- ALWAYS add MarkdownComment as FIRST node with meaningful description of user's request
- MarkdownComment content should be: "## {User Request Summary}\n\nCreated: @NodeId1, @NodeId2, @NodeId3\n\nThis workflow..."
- Include @NodeId references in MarkdownComment for navigation

Return EXACTLY this JSON (MarkdownComment must be FIRST in newNodes array):
{
  "analysis": "What needs to be done",
  "referencedNodes": ["@nodes from request"],
  "newNodes": [
    {
      "type": "MarkdownComment",
      "name": "Workflow Description",
      "config": {
        "content": "## {User Request}\n\nCreated nodes: @NodeId1, @NodeId2, etc.\n\nThis workflow does: {explanation}"
      }
    },
    {
      "type": "DataSource|ProcessNode|FSM|Queue|Sink|Multiplexer",
      "name": "unique name for this node",
      "config": {
        "description": "what this node does",
        "states": ["pending", "processing"] // for FSM only
      }
    }
  ],
  "connections": [
    {
      "from": "node name or @reference",
      "to": "node name or @reference"
    }
  ],
  "totalNodes": number,
  "reasoning": "Why this approach"
}`;

  try {
    const result = await model.invoke(prompt);
    const cleanText = result.content.toString()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsedRequest = JSON.parse(cleanText);

    logger.info('✅ [DSL PARSING] Success:', {
      nodes: parsedRequest.newNodes?.length || 0,
      connections: parsedRequest.connections?.length || 0,
      runId: state.runId
    });

    return {
      parsedRequest,
      stateUpdates: updates
    };
  } catch (error) {
    logger.error('❌ [DSL PARSING] Failed:', error);
    return {
      errors: [`DSL parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`],
      stateUpdates: updates
    };
  }
}

// Node 3: Smart Positioning - ONLY position NEW nodes, keep existing ones FIXED
async function calculatePositions(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('positioning', 'Positioning new nodes using semantic layout...', state.runId);

  if (!state.generatedScenario || !state.validationResults?.valid) {
    return {
      errors: ['No valid scenario for positioning'],
      stateUpdates: updates
    };
  }

  // Import the semantic positioning library
  const { positionNodes } = await import('./lib/semantic-positioning');

  // Separate existing and new nodes using the original scenario
  const originalNodeIds = new Set(state.currentScenario?.nodes?.map((n: any) => n.nodeId) || []);
  const existingNodes = state.generatedScenario.nodes.filter((node: any) => originalNodeIds.has(node.nodeId));
  const newNodes = state.generatedScenario.nodes.filter((node: any) => !originalNodeIds.has(node.nodeId));

  console.log(`🔍 [SEMANTIC POSITIONING] Total nodes: ${state.generatedScenario.nodes.length}, Existing: ${existingNodes.length}, New: ${newNodes.length}`);
  console.log(`🔍 [SEMANTIC POSITIONING] New node types:`, newNodes.map(n => ({ id: n.nodeId, type: n.type })));

  if (newNodes.length === 0) {
    // No new nodes to position
    return {
      generatedScenario: state.generatedScenario,
      stateUpdates: updates
    };
  }

  // Use semantic positioning with custom config for workflow agents
  const positioningConfig = {
    columnWidth: 180,      // Much tighter - about 2-3x node width
    rowHeight: 100,        // Closer vertical spacing for same types
    rowGroupSpacing: 35,   // Spacing between different node types
    nodeTypePriority: {
      'DataSource': 1,
      'Queue': 2,
      'ProcessNode': 3,
      'Multiplexer': 4,
      'FSM': 5,
      'Sink': 6,
      'MarkdownComment': 0
    },
    startX: 50,
    startY: 100,
    commentOffsetY: 120
  };

  // Position new nodes using semantic algorithm
  const positionedNewNodes = positionNodes(
    existingNodes,
    newNodes,
    state.generatedScenario.edges || [],
    positioningConfig
  );

  // Combine existing nodes (unchanged) with positioned new nodes
  const allNodes = [
    ...existingNodes, // Keep existing positions exactly as they were
    ...positionedNewNodes
  ];

  console.log(`🔍 [SEMANTIC POSITIONING] After positioning:`, positionedNewNodes.map(n => ({
    id: n.nodeId,
    type: n.type,
    position: n.position
  })));
  console.log(`🔍 [SEMANTIC POSITIONING] Final node count: ${allNodes.length}`);

  return {
    generatedScenario: {
      ...state.generatedScenario,
      nodes: allNodes
    },
    stateUpdates: updates
  };
}

// Node 4: Build Scenario
async function buildScenario(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('scenario_building', 'Building workflow scenario...', state.runId);

  if (!state.parsedRequest) {
    return {
      errors: ['No parsed request for building'],
      stateUpdates: updates
    };
  }

  // Handle cleanup requests specially
  if (state.parsedRequest.intent === 'cleanup_validation_errors') {
    logger.info('🧹 [CLEANUP] Processing cleanup request - returning current scenario for validation');
    return {
      generatedScenario: state.currentScenario,
      stateUpdates: updates
    };
  }

  const scenario = state.currentScenario ? {
    ...state.currentScenario,
    nodes: [...(state.currentScenario.nodes || [])],
    edges: [...(state.currentScenario.edges || [])]
  } : {
    version: '3.0',
    metadata: {
      name: 'Unified LangGraph Workflow',
      description: 'Generated via Unified Agent',
      author: 'Unified LangGraph Agent',
      created: new Date().toISOString()
    },
    nodes: [],
    edges: []
  };

  // Ensure version property is always present, even for existing scenarios
  if (!scenario.version) {
    scenario.version = '3.0';
  }

  const newNodeMap = new Map();

  state.parsedRequest.newNodes.forEach((nodeSpec: any) => {
    // Simpler ID: just type + short hash
    const nodeId = `${nodeSpec.type}_${Math.random().toString(36).substr(2, 8)}`;
    const nodeName = nodeSpec.config?.name || nodeSpec.name || nodeId;
    newNodeMap.set(nodeName, nodeId);

    const baseNode = {
      nodeId,
      type: nodeSpec.type,
      displayName: nodeName,
      // Position will be calculated after validation in positioning step
      description: nodeSpec.config?.description || '',
    };

    let fullNode: any;
    switch (nodeSpec.type) {
      case 'DataSource':
        fullNode = {
          ...baseNode,
          // No interval - ES simulation ignores timing
          generation: nodeSpec.config.generation || { type: 'random', valueMin: 1, valueMax: 100 },
          outputs: []
        };
        break;

      case 'ProcessNode':
        fullNode = {
          ...baseNode,
          processing: nodeSpec.config.processing || { type: 'formula', formula: 'input' },
          inputs: [{ name: 'input', interface: { type: 'SimpleValue', requiredFields: [] }, required: true }],
          outputs: []
        };
        break;

      case 'Multiplexer':
        fullNode = {
          ...baseNode,
          multiplexing: nodeSpec.config.multiplexing || { strategy: 'round_robin' },
          inputs: [{ name: 'input', interface: { type: 'SimpleValue', requiredFields: [] }, required: true }],
          outputs: []
        };
        break;

      case 'Sink':
        fullNode = {
          ...baseNode,
          inputs: [{ name: 'input', interface: { type: 'SimpleValue', requiredFields: [] }, required: true }]
        };
        break;

      case 'FSM':
        fullNode = {
          ...baseNode,
          states: nodeSpec.config.states || ['pending', 'processing', 'completed'],
          initialState: nodeSpec.config.initialState || 'pending',
          transitions: nodeSpec.config.transitions || [],
          inputs: [{ name: 'input', interface: { type: 'SimpleValue', requiredFields: [] }, required: true }],
          outputs: []
        };
        break;

      case 'Queue':
        fullNode = {
          ...baseNode,
          capacity: nodeSpec.config.capacity || 10,
          processing: nodeSpec.config.processing || { type: 'fifo' },
          inputs: [{ name: 'input', interface: { type: 'SimpleValue', requiredFields: [] }, required: true }],
          outputs: []
        };
        break;

      case 'MarkdownComment':
        fullNode = {
          ...baseNode,
          content: nodeSpec.config.content || 'Generated comment',
          width: 350,
          height: 250,
          config: {
            content: nodeSpec.config.content || 'Generated comment',
            backgroundColor: 'lightblue',
            fontSize: '12'
          }
        };
        break;

      default:
        throw new Error(`Unknown node type: ${nodeSpec.type}`);
    }

    scenario.nodes.push(fullNode);
  });

  const resolveNodeRef = (ref: string): string => {
    // Only allow connections to existing nodes if explicitly referenced with @
    if (ref.startsWith('@')) {
      const refName = ref.substring(1);

      // First check if it's a new node created in this request
      if (newNodeMap.has(refName)) return newNodeMap.get(refName);

      // Then check existing nodes (only for @ references)
      const existing = state.existingNodes.find((n: any) =>
        n.displayName === refName || n.nodeId === refName
      );
      if (existing) return existing.nodeId;

      throw new Error(`Node reference ${ref} not found`);
    }

    // For non-@ references, ONLY look in new nodes created in this request
    const newNodeId = newNodeMap.get(ref);
    if (newNodeId) return newNodeId;

    // NEVER automatically connect to existing nodes without @ prefix
    throw new Error(`Connection target "${ref}" not found in new nodes. Use @NodeName to reference existing nodes.`);
  };

  try {
    // AGGRESSIVE VALIDATION: Block any connection to existing nodes without @ prefix
    state.parsedRequest.connections.forEach((conn: any) => {
      // Check if we're trying to connect to an existing node without @
      if (!conn.to.startsWith('@') && state.existingNodes.some((n: any) =>
          n.nodeId === conn.to || n.displayName === conn.to)) {
        throw new Error(`FORBIDDEN: Cannot connect to existing node "${conn.to}" without @ prefix. Use @${conn.to} if intended.`);
      }

      // Additional check for common existing node names
      const forbiddenTargets = ['CreditFSM', 'RegistrySink', 'EnergyQueue', 'EmissionProcess'];
      if (forbiddenTargets.some(forbidden => conn.to.includes(forbidden)) && !conn.to.startsWith('@')) {
        throw new Error(`FORBIDDEN: Cannot connect to existing node type "${conn.to}". Create a NEW node or use @NodeName.`);
      }

      const sourceId = resolveNodeRef(conn.from);
      const targetId = resolveNodeRef(conn.to);

      const sourceNode = scenario.nodes.find((n: any) => n.nodeId === sourceId);
      const targetNode = scenario.nodes.find((n: any) => n.nodeId === targetId);

      // Only create edges if both source and target nodes exist
      if (!sourceNode) {
        console.warn(`⚠️ Skipping edge: source node ${sourceId} not found`);
        return;
      }
      if (!targetNode) {
        console.warn(`⚠️ Skipping edge: target node ${targetId} not found`);
        return;
      }

      if (sourceNode.outputs) {
        sourceNode.outputs.push({
          name: 'output',
          destinationNodeId: targetId,
          destinationInputName: 'input',
          interface: { type: 'SimpleValue', requiredFields: [] }
        });
      }

      if (!scenario.edges) scenario.edges = [];
      scenario.edges.push({
        id: `edge_${sourceId}_to_${targetId}_${Date.now()}`,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceOutputName: 'output',
        targetInputName: 'input'
      });
    });
  } catch (error) {
    return {
      errors: [`Connection error: ${error instanceof Error ? error.message : 'Unknown'}`],
      stateUpdates: updates
    };
  }

  return {
    generatedScenario: scenario,
    stateUpdates: updates
  };
}

// Node 5: Enhanced Validation with Schema Tools
async function validateScenario(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('validation', 'Validating scenario structure...', state.runId);

  if (!state.generatedScenario) {
    return {
      errors: ['No scenario to validate'],
      stateUpdates: updates
    };
  }

  const scenarioSchema = {
    type: 'object',
    required: ['version', 'nodes'],
    properties: {
      version: { type: 'string' },
      nodes: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['nodeId', 'type'],
          properties: {
            nodeId: { type: 'string' },
            type: { type: 'string' }
          }
        }
      },
      edges: { type: 'array' }
    }
  };

  const schemaValidation = await tools.validateSchema(scenarioSchema, state.generatedScenario);

  const validationResults = {
    valid: schemaValidation.valid,
    nodeCount: state.generatedScenario.nodes.length,
    edgeCount: state.generatedScenario.edges?.length || 0,
    issues: schemaValidation.errors.map((e: any) => `${e.instancePath}: ${e.message}`),
    schemaValid: schemaValidation.valid
  };

  if (validationResults.nodeCount === 0) {
    validationResults.valid = false;
    validationResults.issues.push('No nodes in scenario');
  }

  // Check for edge consistency - all edges must reference existing nodes
  const nodeIds = new Set(state.generatedScenario.nodes.map((node: any) => node.nodeId));
  const validEdges: any[] = [];
  const edgeIds = new Set();

  state.generatedScenario.edges?.forEach((edge: any) => {
    const sourceId = edge.sourceNodeId || edge.from;
    const targetId = edge.targetNodeId || edge.to || edge.destinationNodeId;

    // Check for duplicate edges
    if (edgeIds.has(edge.id)) {
      validationResults.valid = false;
      validationResults.issues.push(`Duplicate edge: ${edge.id}`);
      return;
    }

    // Check if both source and target nodes exist
    if (!nodeIds.has(sourceId)) {
      validationResults.issues.push(`Edge ${edge.id} references unknown source node: ${sourceId} - REMOVED`);
      return; // Skip this edge but don't fail validation
    }

    if (!nodeIds.has(targetId)) {
      validationResults.issues.push(`Edge ${edge.id} references unknown target node: ${targetId} - REMOVED`);
      return; // Skip this edge but don't fail validation
    }

    // Edge is valid, keep it
    validEdges.push(edge);
    edgeIds.add(edge.id);
  });

  // Update scenario with only valid edges
  state.generatedScenario.edges = validEdges;

  // Update the edge count after cleanup
  validationResults.edgeCount = validEdges.length;

  logger.info('✅ [VALIDATION] Complete:', validationResults);

  return {
    validationResults,
    generatedScenario: state.generatedScenario, // Return updated scenario with cleaned edges
    stateUpdates: updates
  };
}

// Node 6: Reflection - Decide next action based on validation
async function reflection(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('reflection', 'Analyzing results and deciding next steps...', state.runId);

  if (state.validationResults && !state.validationResults.valid) {
    const issues = state.validationResults.issues.join('; ');

    const prompt = `You built a scenario with ${state.generatedScenario?.nodes.length || 0} nodes.
Validation issues found: ${issues}
Retry count: ${state.retryCount}/${state.maxRetries}
Errors so far: ${state.errors.join('; ')}

What should we do next?
- "retry_parsing": Try parsing again with fixes
- "manual_fix": Attempt to fix the schema manually
- "finish": Accept current state and end
- "error": Too many errors, give up

Respond with just the action name.`;

    try {
      const result = await model.invoke(prompt);
      const decision = result.content.toString().trim().toLowerCase();

      logger.info(`🤔 [REFLECTION] Decision: ${decision} (runId: ${state.runId})`);

      if (decision === 'retry_parsing' && state.retryCount < state.maxRetries) {
        return {
          reflectionDecision: decision,
          retryCount: state.retryCount + 1,
          errors: [`Retrying due to: ${issues}`],
          stateUpdates: updates
        };
      }

      return {
        reflectionDecision: decision === 'retry_parsing' ? 'error' : decision,
        stateUpdates: updates
      };
    } catch (error) {
      return {
        reflectionDecision: 'error',
        errors: ['Reflection failed'],
        stateUpdates: updates
      };
    }
  }

  return {
    reflectionDecision: 'finish',
    stateUpdates: updates
  };
}

// Node 7: Generate Response
async function generateResponse(state: UnifiedState): Promise<Partial<UnifiedState>> {
  const updates = emitStateUpdate('response_generation', 'Generating final response...', state.runId);

  if (state.errors && state.errors.length > 0 && state.reflectionDecision === 'error') {
    return {
      response: {
        success: false,
        error: 'Failed after retries',
        errors: state.errors,
        stateJourney: state.stateUpdates,
        runId: state.runId,
        threadId: state.threadId
      },
      stateUpdates: updates
    };
  }

  // Handle cleanup requests with special message
  const isCleanupRequest = state.parsedRequest?.intent === 'cleanup_validation_errors';
  const cleanedEdgeCount = state.validationResults?.issues?.filter(issue => issue.includes('REMOVED')).length || 0;

  let message;
  if (isCleanupRequest && cleanedEdgeCount > 0) {
    message = `🧹 **Scenario Cleaned Successfully!** Removed ${cleanedEdgeCount} invalid edge${cleanedEdgeCount !== 1 ? 's' : ''} that referenced non-existent nodes. Your workflow is now valid and ready for simulation.`;
  } else if (isCleanupRequest) {
    message = `✅ **Scenario Validation Complete!** No issues found - your workflow is already clean and valid.`;
  } else {
    // Generate rich markdown response with clickable node links
    const newNodesCount = state.parsedRequest?.newNodes?.length || 0;
    const totalNodesCount = state.generatedScenario?.nodes.length || 0;
    const newNodes = state.parsedRequest?.newNodes || [];

    message = `✅ **Workflow Created Successfully!**\n\n`;
    message += `${state.parsedRequest?.analysis}\n\n`;

    if (newNodesCount > 0) {
      message += `🎉 **${newNodesCount} new node${newNodesCount !== 1 ? 's' : ''}** added to your diagram (${totalNodesCount} total):\n\n`;

      // Create clickable links for each new node
      newNodes.forEach((node: any) => {
        // Find the actual generated node to get the description
        const generatedNode = state.generatedScenario?.nodes.find((n: any) => n.displayName === node.displayName || n.displayName === node.name);

        const nodeId = generatedNode?.nodeId || node.nodeId || node.name;
        const displayName = generatedNode?.displayName || node.displayName || node.name;
        const description = generatedNode?.description || node.description || '';

        // Create clickable link that will zoom to the node
        message += `• [**${displayName}**](#node-${nodeId}) - ${description}\n`;
      });

      message += `\n✨ Click any node name above to zoom and focus on it in the diagram.`;
    } else {
      message += `📊 Workflow updated with ${totalNodesCount} total nodes.`;
    }
  }

  const response = {
    success: true,
    message,
    scenario: state.generatedScenario,
    operations: [{
      tool: 'unified_langgraph_dsl',
      input: {
        message: state.userMessage,
        historyContext: state.chatHistory.length,
        retries: state.retryCount
      },
      result: {
        success: true,
        nodesCreated: state.parsedRequest?.newNodes.length || 0,
        connectionsCreated: state.parsedRequest?.connections.length || 0,
        validationPassed: state.validationResults?.valid || false
      }
    }],
    langGraphExecution: {
      totalSteps: 7,
      completedSteps: state.stateUpdates.map(u => u.step),
      validationResults: state.validationResults,
      retryCount: state.retryCount,
      stateJourney: state.stateUpdates,
      runId: state.runId,
      threadId: state.threadId
    }
  };

  return {
    response,
    stateUpdates: updates
  };
}

// Create the Unified LangGraph workflow
const workflow = new StateGraph(UnifiedStateAnnotation)
  .addNode("context_analysis", analyzeContext)
  .addNode("dsl_parsing", parseDSLRequest)
  .addNode("positioning", calculatePositions)
  .addNode("scenario_building", buildScenario)
  .addNode("validation", validateScenario)
  .addNode("reflection", reflection)
  .addNode("response_generation", generateResponse);

workflow
  .addEdge(START, "context_analysis")
  .addEdge("context_analysis", "dsl_parsing")
  .addEdge("dsl_parsing", "scenario_building")
  .addEdge("scenario_building", "validation")
  .addEdge("validation", "positioning")
  .addEdge("positioning", "reflection")
  .addConditionalEdges(
    "reflection",
    async (state: UnifiedState) => state.reflectionDecision || "finish",
    {
      "retry_parsing": "dsl_parsing",
      "manual_fix": "scenario_building",
      "finish": "response_generation",
      "error": "response_generation"
    }
  )
  .addEdge("response_generation", END);

// Compile the workflow
const app = workflow.compile();

// Create Express server with unified endpoints
const server = express();
const port = process.env.PORT || 3002;

// Store SSE clients
const sseClients = new Set<express.Response>();

// Middleware - Flexible CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*', // Wide open for development/Studio
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Run-Id', 'X-Thread-Id']
};

server.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
server.use(cors(corsOptions));
server.use(express.json({ limit: '10mb' }));

// SSE endpoint for real-time updates
server.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  sseClients.add(res);

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

  const updateHandler = (update: any) => {
    res.write(`data: ${JSON.stringify({ type: 'state_update', ...update })}\n\n`);
  };
  stateEmitter.on('stateUpdate', updateHandler);

  req.on('close', () => {
    sseClients.delete(res);
    stateEmitter.removeListener('stateUpdate', updateHandler);
  });
});

// Health check
server.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Unified LangGraph Agent',
    version: '2.0.0',
    features: {
      langGraphStudio: true,
      chatHistory: true,
      retryLogic: true,
      reflection: true,
      realTimeUpdates: true,
      tools: Object.keys(tools)
    },
    endpoints: {
      chat: '/chat (POST) - Main chat endpoint',
      studio: '/run (POST) - LangGraph Studio',
      graph: '/graph (GET) - Graph structure',
      threads: '/threads (GET) - Thread management',
      stream: '/api/stream (GET) - SSE updates'
    },
    hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)
  });
});

// === LANGGRAPH STUDIO ENDPOINTS ===

// Get graph structure for Studio
server.get('/graph', async (req, res) => {
  try {
    const graph = app.getGraph();

    res.json({
      nodes: Object.keys(graph.nodes).map(nodeId => ({
        id: nodeId,
        type: 'function',
        name: nodeId,
        label: nodeId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        metadata: {
          function: graph.nodes[nodeId]?.name || nodeId
        }
      })),
      edges: graph.edges.map((edge: any, index) => ({
        id: `edge_${index}`,
        source: edge.source || edge[0],
        target: edge.target || edge[1],
        label: edge.data?.label || '',
        conditional: edge.conditional || false
      })),
      metadata: {
        name: 'Unified DSL Workflow Agent',
        version: '2.0.0',
        hasConditionals: true,
        hasRetryLoop: true,
        entryPoint: 'context_analysis'
      }
    });
  } catch (error) {
    logger.error('Failed to get graph:', error);
    res.status(500).json({ error: 'Failed to get graph' });
  }
});

// List threads (Studio compatibility)
server.get('/threads', (req, res) => {
  const threads = Array.from(activeRuns.entries()).map(([runId, runData]) => ({
    id: runData.threadId || runId,
    runId,
    created: runData.created || new Date().toISOString(),
    status: runData.status || 'completed',
    metadata: runData.metadata || {}
  }));

  res.json({ threads });
});

// Get specific thread
server.get('/threads/:threadId', (req, res) => {
  const { threadId } = req.params;
  const runData = Array.from(activeRuns.values()).find(r => r.threadId === threadId);

  if (!runData) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  res.json({
    id: threadId,
    runId: runData.runId,
    status: runData.status,
    history: runHistories.get(runData.runId) || [],
    created: runData.created,
    metadata: runData.metadata
  });
});

// Main run endpoint for LangGraph Studio
server.post('/run', async (req, res) => {
  try {
    const {
      input,
      config = {},
      stream = false,
      threadId = uuidv4()
    } = req.body;

    const runId = uuidv4();

    activeRuns.set(runId, {
      runId,
      threadId,
      status: 'running',
      created: new Date().toISOString(),
      input,
      config,
      metadata: {
        source: 'langgraph-studio'
      }
    });

    runHistories.set(runId, []);

    logger.info('🎮 [STUDIO] Starting run:', {
      runId,
      threadId,
      inputKeys: Object.keys(input || {})
    });

    res.setHeader('X-Run-Id', runId);
    res.setHeader('X-Thread-Id', threadId);

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Run-Id': runId,
        'X-Thread-Id': threadId
      });

      res.write(`data: ${JSON.stringify({
        type: 'run_start',
        runId,
        threadId,
        timestamp: new Date().toISOString()
      })}\n\n`);

      const result = await app.invoke({
        userMessage: input?.message || input?.userMessage || '',
        currentScenario: input?.scenario || input?.currentScenario || null,
        chatHistory: input?.history || input?.chatHistory || [],
        retryCount: 0,
        maxRetries: config?.maxRetries || 3,
        runId,
        threadId
      }, { recursionLimit: 50 });

      res.write(`data: ${JSON.stringify({
        type: 'run_complete',
        runId,
        threadId,
        result: result.response,
        timestamp: new Date().toISOString()
      })}\n\n`);

      res.end();

      activeRuns.get(runId)!.status = 'completed';
      activeRuns.get(runId)!.result = result.response;

    } else {
      const result = await app.invoke({
        userMessage: input?.message || input?.userMessage || '',
        currentScenario: input?.scenario || input?.currentScenario || null,
        chatHistory: input?.history || input?.chatHistory || [],
        retryCount: 0,
        maxRetries: config?.maxRetries || 3,
        runId,
        threadId
      }, { recursionLimit: 50 });

      activeRuns.get(runId)!.status = 'completed';
      activeRuns.get(runId)!.result = result.response;

      res.json({
        runId,
        threadId,
        result: result.response,
        metadata: {
          executionTime: Date.now() - new Date(activeRuns.get(runId)!.created).getTime(),
          stepsExecuted: result.stateUpdates?.length || 0
        }
      });
    }

    logger.info('✅ [STUDIO] Run completed:', runId);

  } catch (error) {
    logger.error('❌ [STUDIO] Run failed:', error);

    const errorResponse = {
      error: 'Run execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      runId: req.body.runId,
      threadId: req.body.threadId
    };

    if (req.body.stream) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        ...errorResponse
      })}\n\n`);
      res.end();
    } else {
      res.status(500).json(errorResponse);
    }
  }
});

// Get run status
server.get('/runs/:runId', (req, res) => {
  const { runId } = req.params;
  const runData = activeRuns.get(runId);

  if (!runData) {
    return res.status(404).json({ error: 'Run not found' });
  }

  res.json({
    runId,
    threadId: runData.threadId,
    status: runData.status,
    created: runData.created,
    result: runData.result,
    history: runHistories.get(runId) || [],
    metadata: runData.metadata
  });
});

// === MAIN CHAT ENDPOINT (for clean-app compatibility) ===
server.post('/chat', async (req, res) => {
  try {
    const { message, scenario, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const runId = uuidv4();
    const threadId = req.headers['x-thread-id']?.toString() || uuidv4();

    logger.info('🚀 [CHAT] Starting workflow...', {
      message: message.substring(0, 100),
      hasScenario: !!scenario,
      historyLength: history.length,
      runId,
      threadId
    });

    // Store run info
    activeRuns.set(runId, {
      runId,
      threadId,
      status: 'running',
      created: new Date().toISOString(),
      input: { message, scenario, history },
      metadata: { source: 'chat-api' }
    });
    runHistories.set(runId, []);

    // Broadcast start to SSE clients
    sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({
        type: 'workflow_start',
        message,
        runId,
        threadId,
        timestamp: new Date()
      })}\n\n`);
    });

    const result = await app.invoke({
      userMessage: message,
      currentScenario: scenario,
      chatHistory: history,
      retryCount: 0,
      maxRetries: 3,
      runId,
      threadId
    }, { recursionLimit: 50 });

    // Update run status
    activeRuns.get(runId)!.status = 'completed';
    activeRuns.get(runId)!.result = result.response;

    // Broadcast completion
    sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({
        type: 'workflow_complete',
        success: result.response?.success || false,
        runId,
        threadId,
        timestamp: new Date()
      })}\n\n`);
    });

    logger.info('✅ [CHAT] Workflow completed');

    if (result.response) {
      result.response.debugInfo = {
        retryCount: result.retryCount,
        reflectionDecision: result.reflectionDecision,
        stateUpdates: result.stateUpdates,
        runId,
        threadId
      };
    }

    res.json(result.response);

  } catch (error) {
    logger.error('❌ [CHAT] Failed:', error);

    sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({
        type: 'workflow_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      })}\n\n`);
    });

    res.status(500).json({
      success: false,
      error: 'Workflow failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Document improvement functionality integrated directly
const DocumentImprovementState = Annotation.Root({
  resourceId: Annotation<string>,
  documentContent: Annotation<string>,
  currentArchitecture: Annotation<string>,
  chunks: Annotation<string[]>,
  currentChunkIndex: Annotation<number>,
  chunkAnalyses: Annotation<any[]>,
  runId: Annotation<string>,
  stateUpdates: Annotation<any[]>,
  errors: Annotation<string[]>,
  suggestions: Annotation<any>,
  completed: Annotation<boolean>
});

// Document chunking utility
function chunkDocument(content: string, maxChunkSize: number = 4000): string[] {
  const paragraphs = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        const sentences = paragraph.split(/(?<=\.)\s+/);
        let sentenceChunk = '';
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        if (sentenceChunk) currentChunk = sentenceChunk;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(chunk => chunk.trim().length > 0);
}

// Document improvement workflow nodes
async function initializeDocument(state: any) {
  const updates = emitStateUpdate('initialization', 'Preparing document for analysis...', state.runId);
  try {
    const chunks = chunkDocument(state.documentContent);
    logger.info(`📄 [CHUNKING] Document split into ${chunks.length} chunks`, { runId: state.runId });
    return { chunks, currentChunkIndex: 0, chunkAnalyses: [], stateUpdates: updates };
  } catch (error) {
    return { errors: [`Initialization failed: ${error instanceof Error ? error.message : 'Unknown'}`], stateUpdates: updates };
  }
}

async function analyzeChunk(state: any) {
  const chunkNumber = state.currentChunkIndex + 1;
  const totalChunks = state.chunks.length;
  const updates = emitStateUpdate('chunk_analysis', `Analyzing section ${chunkNumber}/${totalChunks}...`, state.runId);

  try {
    const currentChunk = state.chunks[state.currentChunkIndex];
    const previousContext = state.chunkAnalyses.length > 0 ?
      `PREVIOUS SECTIONS CONTEXT:\n${state.chunkAnalyses.map((analysis, idx) =>
        `Section ${idx + 1}: ${analysis.summary}`
      ).join('\n')}\n\nKEY CONCEPTS FROM PREVIOUS SECTIONS:\n${Array.from(new Set(state.chunkAnalyses.flatMap(a => a.keyConcepts || []))).join(', ')}\n\n` : '';

    const prompt = `You are analyzing a section of a document for architecture improvement insights.

${previousContext}CURRENT DOCUMENT SECTION (${chunkNumber}/${totalChunks}):
"${currentChunk}"

CURRENT ARCHITECTURE REFERENCE:
"${state.currentArchitecture}"

Analyze this section and extract:
1. Key concepts or patterns mentioned
2. Technical insights relevant to architecture
3. Potential improvements this suggests
4. Important methodologies or approaches described

Return your analysis as JSON:
{
  "keyConcepts": ["concept1", "concept2", ...],
  "technicalInsights": ["insight1", "insight2", ...],
  "suggestedImprovements": ["improvement1", "improvement2", ...],
  "methodologies": ["method1", "method2", ...],
  "relevanceScore": 0.0-1.0,
  "summary": "Brief summary of this section's contribution"
}`;

    const result = await model.invoke(prompt);
    let chunkAnalysis;
    try {
      chunkAnalysis = JSON.parse(result.content.toString());
    } catch {
      chunkAnalysis = {
        keyConcepts: [], technicalInsights: [`Analysis of section ${chunkNumber}`],
        suggestedImprovements: [], methodologies: [], relevanceScore: 0.5,
        summary: `Section ${chunkNumber} processed`
      };
    }

    chunkAnalysis.chunkIndex = state.currentChunkIndex;
    chunkAnalysis.chunkNumber = chunkNumber;

    return {
      chunkAnalyses: [...state.chunkAnalyses, chunkAnalysis],
      currentChunkIndex: state.currentChunkIndex + 1,
      stateUpdates: updates
    };
  } catch (error) {
    return { errors: [`Chunk analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`], stateUpdates: updates };
  }
}

async function synthesizeFindings(state: any) {
  const updates = emitStateUpdate('synthesis', 'Synthesizing findings into recommendations...', state.runId);

  try {
    const allConcepts = state.chunkAnalyses.flatMap(a => a.keyConcepts || []);
    const allInsights = state.chunkAnalyses.flatMap(a => a.technicalInsights || []);
    const allImprovements = state.chunkAnalyses.flatMap(a => a.suggestedImprovements || []);
    const allMethodologies = state.chunkAnalyses.flatMap(a => a.methodologies || []);

    const synthesisPrompt = `Based on analysis of a large document, synthesize final improvement recommendations.

ANALYZED CONCEPTS: ${JSON.stringify(allConcepts, null, 2)}
TECHNICAL INSIGHTS: ${JSON.stringify(allInsights, null, 2)}
SUGGESTED IMPROVEMENTS: ${JSON.stringify(allImprovements, null, 2)}
METHODOLOGIES IDENTIFIED: ${JSON.stringify(allMethodologies, null, 2)}
CURRENT ARCHITECTURE REFERENCE: "${state.currentArchitecture}"

Create final recommendations in the EXACT format expected by the existing system:
{
  "improvements": ["improvement 1", "improvement 2", ...],
  "newConcepts": ["concept 1", "concept 2", ...],
  "diagramChanges": ["change 1", "change 2", ...],
  "keyInsights": ["insight 1", "insight 2", ...],
  "summary": "Brief summary of how this document enhances the architecture"
}`;

    const result = await model.invoke(synthesisPrompt);
    let suggestions;
    try {
      suggestions = JSON.parse(result.content.toString());
    } catch {
      suggestions = {
        improvements: allImprovements.slice(0, 5),
        newConcepts: allConcepts.slice(0, 5),
        diagramChanges: ["Review document insights for diagram updates"],
        keyInsights: allInsights.slice(0, 5),
        summary: `Document analysis completed with ${state.chunkAnalyses.length} sections processed`
      };
    }

    return { suggestions, completed: true, stateUpdates: updates };
  } catch (error) {
    return { errors: [`Synthesis failed: ${error instanceof Error ? error.message : 'Unknown'}`], stateUpdates: updates };
  }
}

function shouldContinueChunking(state: any): string {
  if (state.errors && state.errors.length > 0) return END;
  if (state.currentChunkIndex >= state.chunks.length) return "synthesis";
  return "chunk_analysis";
}

// Create the document improvement graph
const documentImprovementGraph = new StateGraph(DocumentImprovementState)
  .addNode("initialization", initializeDocument)
  .addNode("chunk_analysis", analyzeChunk)
  .addNode("synthesis", synthesizeFindings)
  .addEdge(START, "initialization")
  .addEdge("initialization", "chunk_analysis")
  .addConditionalEdges("chunk_analysis", shouldContinueChunking, {
    "chunk_analysis": "chunk_analysis",
    "synthesis": "synthesis",
    [END]: END
  })
  .addEdge("synthesis", END);

const improveGraph = documentImprovementGraph.compile();

// Document improvement endpoint (v2 with LangGraph)
server.post('/improve-documents-v2', async (req, res) => {
  try {
    const { resourceId, documentContent, currentArchitecture } = req.body;

    if (!resourceId || !documentContent) {
      return res.status(400).json({
        error: 'resourceId and documentContent are required'
      });
    }

    const runId = uuidv4();

    logger.info('🚀 [IMPROVE DOCS V2] Starting LangGraph document improvement', {
      resourceId,
      runId,
      documentLength: documentContent.length
    });

    // Broadcast start to SSE clients
    sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({
        type: 'improve_docs_start',
        resourceId,
        runId,
        timestamp: new Date()
      })}\n\n`);
    });

    // Run the improve documents LangGraph workflow
    const initialState = {
      resourceId,
      documentContent,
      currentArchitecture: currentArchitecture || "",
      chunks: [],
      currentChunkIndex: 0,
      chunkAnalyses: [],
      runId,
      stateUpdates: [],
      errors: [],
      suggestions: null,
      completed: false
    };

    const result = await improveGraph.invoke(initialState);

    // Broadcast completion
    sseClients.forEach(client => {
      client.write(`data: ${JSON.stringify({
        type: 'improve_docs_complete',
        success: !result.errors || result.errors.length === 0,
        runId,
        timestamp: new Date()
      })}\n\n`);
    });

    if (result.errors && result.errors.length > 0) {
      logger.error('❌ [IMPROVE DOCS V2] Workflow failed', {
        errors: result.errors,
        runId
      });

      return res.status(500).json({
        success: false,
        error: 'Document improvement failed',
        details: result.errors
      });
    }

    logger.info('✅ [IMPROVE DOCS V2] Workflow completed successfully', {
      runId,
      chunksProcessed: result.chunkAnalyses?.length || 0
    });

    res.json({
      success: true,
      resourceId,
      runId,
      suggestions: result.suggestions,
      message: 'AI improvement suggestions generated successfully via LangGraph',
      metadata: {
        chunksProcessed: result.chunkAnalyses?.length || 0,
        documentLength: documentContent.length,
        method: 'langgraph_chunked_analysis'
      }
    });

  } catch (error) {
    logger.error('❌ [IMPROVE DOCS V2] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start server
server.listen(port, () => {
  logger.info('🚀 Unified LangGraph Agent started', {
    port,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      chat: `http://localhost:${port}/chat`,
      studio: `http://localhost:${port}/run`,
      graph: `http://localhost:${port}/graph`,
      stream: `http://localhost:${port}/api/stream`
    },
    cors: corsOptions.origin === '*' ? 'WIDE OPEN (*)' : corsOptions.origin
  });

  console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 Unified LangGraph Agent Ready!                     ║
╠════════════════════════════════════════════════════════╣
║  Chat API:   http://localhost:${port}/chat              ║
║  Studio:     npx langgraph studio connect              ║
║              http://localhost:${port}                   ║
║                                                        ║
║  Endpoints:                                            ║
║  • POST /chat     - Main chat endpoint                 ║
║  • POST /run      - LangGraph Studio                   ║
║  • GET  /graph    - Graph structure                    ║
║  • GET  /threads  - Thread management                  ║
║  • GET  /api/stream - Real-time updates               ║
╚════════════════════════════════════════════════════════╝
  `);
});

export { app as unifiedApp, server, stateEmitter };