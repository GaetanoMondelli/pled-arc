/**
 * Engine State API with Pagination
 *
 * Provides paginated access to simulation states for step-by-step debugging
 * and efficient state retrieval without overwhelming the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';

// In-memory storage for batch state sessions (in production, use Redis)
const stateSessionCache = new Map<string, {
  engine: SimulationEngine;
  states: any[];
  totalSteps: number;
  batchSize: number;
  currentPage: number;
  isComplete: boolean;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      templateId,
      executionId,
      batchSize = 100,
      page = 0,
      sessionId
    } = body;

    switch (action) {
      case 'initialize':
        return await initializeBatchStateSession(templateId, executionId, batchSize);

      case 'getStates':
        return await getBatchStates(sessionId, page, batchSize);

      case 'getAllStates':
        return await getAllStates(sessionId);

      case 'getStateRange':
        return await getStateRange(sessionId, body.startStep, body.endStep);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Engine State API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Initialize a new batch state session
 */
async function initializeBatchStateSession(
  templateId: string,
  executionId: string,
  batchSize: number = 100
) {
  const sessionId = `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`🚀 Initializing batch state session: ${sessionId}`);
  console.log(`   Template: ${templateId}`);
  console.log(`   Execution: ${executionId}`);
  console.log(`   Batch size: ${batchSize}`);

  try {
    // Load template and execution data
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

    // Initialize simulation engine
    const engine = new SimulationEngine();
    await engine.loadScenario(templateData.scenario);

    // Add external events
    const externalEvents = executionData.externalEvents || [];
    for (const event of externalEvents) {
      engine.getExternalEventQueue().addEvent(event);
    }

    console.log(`✅ Session initialized with ${externalEvents.length} external events`);

    // Store session
    stateSessionCache.set(sessionId, {
      engine,
      states: [],
      totalSteps: 0,
      batchSize,
      currentPage: 0,
      isComplete: false
    });

    return NextResponse.json({
      success: true,
      sessionId,
      batchSize,
      externalEventsCount: externalEvents.length,
      message: 'Batch state session initialized successfully'
    });

  } catch (error) {
    console.error('❌ Failed to initialize batch state session:', error);
    return NextResponse.json({
      error: 'Failed to initialize session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get a batch of states with pagination
 */
async function getBatchStates(
  sessionId: string,
  page: number = 0,
  requestedBatchSize?: number
) {
  const session = stateSessionCache.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'State session not found' }, { status: 404 });
  }

  const batchSize = requestedBatchSize || session.batchSize;
  const startIndex = page * batchSize;

  console.log(`📄 Getting batch states - Page: ${page}, Batch size: ${batchSize}`);

  try {
    // Generate states if we don't have enough cached
    while (session.states.length <= startIndex + batchSize && !session.isComplete) {
      console.log(`⏭️ Generating more states... Current: ${session.states.length}`);

      const result = await session.engine.run({
        maxSteps: session.totalSteps + Math.min(50, batchSize), // Generate in chunks
        maxTicks: Date.now() + 10000, // 10 second timeout per batch
        realTimeMode: false,
        debugMode: true
      });

      // Capture current state
      const currentState = {
        step: session.totalSteps,
        timestamp: session.engine.getCurrentTimestamp(),
        nodeStates: session.engine.getAllNodeStates(),
        queues: {
          processing: session.engine.getQueue().getSize(),
          external: session.engine.getExternalEventQueue().getSize()
        },
        activityLog: session.engine.getGlobalActivityLog().slice(-10), // Last 10 activities
        isComplete: result.reason === 'completed'
      };

      session.states.push(currentState);
      session.totalSteps++;

      session.isComplete = result.reason === 'completed' || session.engine.getQueue().isEmpty();
    }

    // Get the requested page of states
    const pageStates = session.states.slice(startIndex, startIndex + batchSize);
    const hasMorePages = startIndex + batchSize < session.states.length || !session.isComplete;

    return NextResponse.json({
      success: true,
      sessionId,
      page,
      batchSize,
      states: pageStates,
      totalStates: session.states.length,
      hasMorePages,
      isComplete: session.isComplete,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(session.states.length / batchSize),
        hasNext: hasMorePages,
        hasPrevious: page > 0
      }
    });

  } catch (error) {
    console.error('❌ Failed to get batch states:', error);
    return NextResponse.json({
      error: 'Failed to get states',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get all states (use with caution for large simulations)
 */
async function getAllStates(sessionId: string) {
  const session = stateSessionCache.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'State session not found' }, { status: 404 });
  }

  console.log(`📋 Getting all states for session: ${sessionId}`);

  try {
    // Run simulation to completion
    while (!session.isComplete) {
      const result = await session.engine.run({
        maxSteps: session.totalSteps + 100,
        maxTicks: Date.now() + 30000, // 30 second timeout
        realTimeMode: false,
        debugMode: true
      });

      // Capture current state
      const currentState = {
        step: session.totalSteps,
        timestamp: session.engine.getCurrentTimestamp(),
        nodeStates: session.engine.getAllNodeStates(),
        queues: {
          processing: session.engine.getQueue().getSize(),
          external: session.engine.getExternalEventQueue().getSize()
        },
        activityLog: session.engine.getGlobalActivityLog().slice(-10)
      };

      session.states.push(currentState);
      session.totalSteps++;

      session.isComplete = result.reason === 'completed' || session.engine.getQueue().isEmpty();
    }

    return NextResponse.json({
      success: true,
      sessionId,
      totalStates: session.states.length,
      states: session.states,
      isComplete: session.isComplete
    });

  } catch (error) {
    console.error('❌ Failed to get all states:', error);
    return NextResponse.json({
      error: 'Failed to get all states',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get states within a specific range
 */
async function getStateRange(
  sessionId: string,
  startStep: number,
  endStep: number
) {
  const session = stateSessionCache.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'State session not found' }, { status: 404 });
  }

  console.log(`📊 Getting state range: ${startStep} - ${endStep}`);

  try {
    // Generate states up to endStep if needed
    while (session.states.length <= endStep && !session.isComplete) {
      const result = await session.engine.run({
        maxSteps: session.totalSteps + Math.min(50, endStep - session.totalSteps + 10),
        maxTicks: Date.now() + 15000, // 15 second timeout
        realTimeMode: false,
        debugMode: true
      });

      const currentState = {
        step: session.totalSteps,
        timestamp: session.engine.getCurrentTimestamp(),
        nodeStates: session.engine.getAllNodeStates(),
        queues: {
          processing: session.engine.getQueue().getSize(),
          external: session.engine.getExternalEventQueue().getSize()
        },
        activityLog: session.engine.getGlobalActivityLog().slice(-10)
      };

      session.states.push(currentState);
      session.totalSteps++;

      session.isComplete = result.reason === 'completed' || session.engine.getQueue().isEmpty();
    }

    // Get the requested range
    const rangeStates = session.states.slice(startStep, endStep + 1);

    return NextResponse.json({
      success: true,
      sessionId,
      startStep,
      endStep,
      states: rangeStates,
      totalStates: session.states.length,
      isComplete: session.isComplete
    });

  } catch (error) {
    console.error('❌ Failed to get state range:', error);
    return NextResponse.json({
      error: 'Failed to get state range',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for basic session info
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId parameter required' }, { status: 400 });
  }

  const session = stateSessionCache.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'State session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId,
    totalStates: session.states.length,
    batchSize: session.batchSize,
    isComplete: session.isComplete,
    currentPage: session.currentPage
  });
}