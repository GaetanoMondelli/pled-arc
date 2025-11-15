/**
 * Engine API
 *
 * A step-by-step debugger API for external event processing using core engine
 * Allows full control over core engine execution with state inspection
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';
import { templateService } from '@/lib/template-service';

// In-memory storage for debug sessions (in production, use Redis)
const debugSessions = new Map<string, {
  engine: SimulationEngine;
  totalSteps: number;
  maxSteps: number;
  isComplete: boolean;
  scenario: any;
  externalEvents: any[];
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, templateId, executionId, scenario, externalEvents, steps = 1 } = body;

    switch (action) {
      case 'initialize':
        return await initializeDebugSession(templateId, executionId, scenario, externalEvents);

      case 'step':
        return await stepSimulation(sessionId, steps);

      case 'inspect':
        return await inspectEngineState(sessionId);

      case 'reset':
        return await resetSession(sessionId);

      case 'complete':
        return await runToCompletion(sessionId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Debugger API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Initialize a new debug session
 */
async function initializeDebugSession(
  templateId?: string,
  executionId?: string,
  scenario?: any,
  externalEvents?: any[]
) {
  const sessionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`🚀 Initializing debug session: ${sessionId}`);

  try {
    // Load scenario and external events
    let finalScenario = scenario;
    let finalExternalEvents = externalEvents || [];

    if (templateId && executionId) {
      console.log(`📥 Loading from template: ${templateId}, execution: ${executionId}`);

      // Call admin API directly (bypass templateService that has URL issues in server context)
      const baseUrl = `http://localhost:${process.env.PORT || 3001}/api/admin`;

      const [templateResponse, executionResponse] = await Promise.all([
        fetch(`${baseUrl}/templates/${templateId}`),
        fetch(`${baseUrl}/executions/${executionId}`)
      ]);

      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
      }
      if (!executionResponse.ok) {
        throw new Error(`Failed to fetch execution: ${executionResponse.statusText}`);
      }

      const templateData = (await templateResponse.json()).template;
      const executionData = (await executionResponse.json()).execution;

      finalScenario = templateData.scenario;
      finalExternalEvents = executionData.externalEvents || [];
    } else if (templateId) {
      console.log(`📥 Loading from template: ${templateId}`);

      // Call admin API directly
      const baseUrl = `http://localhost:${process.env.PORT || 3001}/api/admin`;
      const templateResponse = await fetch(`${baseUrl}/templates/${templateId}`);

      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
      }

      const templateData = (await templateResponse.json()).template;
      finalScenario = templateData.scenario;
    }

    if (!finalScenario) {
      throw new Error('No scenario provided');
    }

    // Create and initialize engine
    const engine = new SimulationEngine();
    console.log('🎯 Initializing engine with scenario...');
    engine.initialize(finalScenario);

    // Inject external events
    if (finalExternalEvents.length > 0) {
      console.log(`📡 Injecting ${finalExternalEvents.length} external events...`);
      const queue = engine.getQueue();

      finalExternalEvents.forEach((externalEvent, index) => {
        const simulationEvent = {
          type: 'DataEmit',
          sourceNodeId: externalEvent.targetDataSourceId,
          targetNodeId: null,
          timestamp: externalEvent.timestamp || Date.now() + index,
          data: {
            token: {
              id: `token_${externalEvent.id}`,
              value: externalEvent.data,
              sourceNodeId: externalEvent.targetDataSourceId,
              targetNodeId: null,
              timestamp: externalEvent.timestamp || Date.now() + index,
              correlationIds: [`corr_${externalEvent.id}`],
              metadata: { externalEvent: true, externalEventType: externalEvent.type }
            },
            emissionIndex: 0,
            totalEmissions: 1,
            externalEvent: true
          },
          parentEventId: null,
          correlationIds: [`corr_${externalEvent.id}`]
        };

        queue.enqueue(simulationEvent);
      });
    }

    // Store debug session
    debugSessions.set(sessionId, {
      engine,
      totalSteps: 0,
      maxSteps: 1000,
      isComplete: false,
      scenario: finalScenario,
      externalEvents: finalExternalEvents
    });

    // Get initial state
    const initialState = getEngineState(engine);

    return NextResponse.json({
      success: true,
      sessionId,
      state: {
        ...initialState,
        totalSteps: 0,
        isComplete: false,
        scenario: {
          name: finalScenario.name,
          nodeCount: finalScenario.nodes?.length || 0,
          edgeCount: finalScenario.edges?.length || 0
        },
        externalEvents: finalExternalEvents.length
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize debug session:', error);
    throw error;
  }
}

/**
 * Step the simulation forward by N steps
 */
async function stepSimulation(sessionId: string, steps: number = 1) {
  const session = debugSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Debug session not found' }, { status: 404 });
  }

  console.log(`⏭️ Stepping simulation ${steps} step(s)...`);

  try {
    // Run simulation for specified steps
    const result = await session.engine.run({
      maxSteps: session.totalSteps + steps,
      maxTicks: Date.now() + 30000, // 30 second timeout
      realTimeMode: false,
      debugMode: true
    });

    session.totalSteps += steps;
    session.isComplete = result.reason === 'completed' || session.engine.getQueue().isEmpty();

    // Get current state
    const currentState = getEngineState(session.engine);

    return NextResponse.json({
      success: true,
      sessionId,
      stepsExecuted: steps,
      state: {
        ...currentState,
        totalSteps: session.totalSteps,
        isComplete: session.isComplete,
        simulationResult: result
      }
    });

  } catch (error) {
    console.error('❌ Step simulation error:', error);
    throw error;
  }
}

/**
 * Inspect current engine state without stepping
 */
async function inspectEngineState(sessionId: string) {
  const session = debugSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Debug session not found' }, { status: 404 });
  }

  const currentState = getEngineState(session.engine);

  return NextResponse.json({
    success: true,
    sessionId,
    state: {
      ...currentState,
      totalSteps: session.totalSteps,
      isComplete: session.isComplete
    }
  });
}

/**
 * Reset the simulation to initial state
 */
async function resetSession(sessionId: string) {
  const session = debugSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Debug session not found' }, { status: 404 });
  }

  // Re-initialize engine
  session.engine.initialize(session.scenario);

  // Re-inject external events
  if (session.externalEvents.length > 0) {
    const queue = session.engine.getQueue();
    session.externalEvents.forEach((externalEvent, index) => {
      const simulationEvent = {
        type: 'DataEmit',
        sourceNodeId: externalEvent.targetDataSourceId,
        targetNodeId: null,
        timestamp: externalEvent.timestamp || Date.now() + index,
        data: {
          token: {
            id: `token_${externalEvent.id}`,
            value: externalEvent.data,
            sourceNodeId: externalEvent.targetDataSourceId,
            targetNodeId: null,
            timestamp: externalEvent.timestamp || Date.now() + index,
            correlationIds: [`corr_${externalEvent.id}`],
            metadata: { externalEvent: true }
          },
          emissionIndex: 0,
          totalEmissions: 1,
          externalEvent: true
        },
        parentEventId: null,
        correlationIds: [`corr_${externalEvent.id}`]
      };
      queue.enqueue(simulationEvent);
    });
  }

  session.totalSteps = 0;
  session.isComplete = false;

  const resetState = getEngineState(session.engine);

  return NextResponse.json({
    success: true,
    sessionId,
    message: 'Session reset to initial state',
    state: {
      ...resetState,
      totalSteps: 0,
      isComplete: false
    }
  });
}

/**
 * Run simulation to completion
 */
async function runToCompletion(sessionId: string) {
  const session = debugSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Debug session not found' }, { status: 404 });
  }

  console.log('🏃 Running simulation to completion...');

  try {
    const result = await session.engine.run({
      maxSteps: session.maxSteps,
      maxTicks: Date.now() + 60000, // 60 second timeout
      realTimeMode: false,
      debugMode: false
    });

    const stats = session.engine.getStats();
    session.totalSteps = stats.totalSteps;
    session.isComplete = true;

    const finalState = getEngineState(session.engine);

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Simulation completed',
      state: {
        ...finalState,
        totalSteps: session.totalSteps,
        isComplete: true,
        simulationResult: result
      }
    });

  } catch (error) {
    console.error('❌ Run to completion error:', error);
    throw error;
  }
}

/**
 * Extract comprehensive engine state for debugging
 */
function getEngineState(engine: SimulationEngine) {
  const stats = engine.getStats();
  const ledger = engine.getLedger();
  const queue = engine.getQueue();

  return {
    engineStats: stats,
    queueSize: queue.size(),
    nextEvent: queue.peek(),
    activities: ledger.getActivities(),
    nodeStates: {
      // Get state for key nodes
      dataSources: ['pey_source_0', 'peffy_source_0', 'pehpy_source_0', 'pebessy_source_0']
        .map(nodeId => ({
          nodeId,
          state: engine.getNodeState(nodeId)
        })),
      processors: ['formula_calc_0']
        .map(nodeId => ({
          nodeId,
          state: engine.getNodeState(nodeId)
        })),
      sinks: ['result_sink_0', 'RegistrySink']
        .map(nodeId => ({
          nodeId,
          state: engine.getNodeState(nodeId)
        }))
    }
  };
}

// Cleanup old sessions (run periodically)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of debugSessions.entries()) {
    // Remove sessions older than 1 hour
    const sessionAge = now - parseInt(sessionId.split('_')[1]);
    if (sessionAge > 3600000) {
      debugSessions.delete(sessionId);
      console.log(`🧹 Cleaned up old debug session: ${sessionId}`);
    }
  }
}, 300000); // Check every 5 minutes