/**
 * Step API - Execute one step of simulation and return state
 *
 * GET /api/engine/templates/{templateId}/executions/{executionId}/step?currentStep=3
 * - Executes the next step of the simulation
 * - Returns node states, activity, and queue states
 * - Allows stepping through execution step-by-step
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';
import { ExternalEventQueue } from '@/core/ExternalEventQueue';

interface StepResponse {
  success: boolean;
  step: number;
  timestamp: number;
  queueSize: number;
  activity: any[]; // NEW activities from this step only
  allActivities: any[]; // ALL activities accumulated up to this point
  nodeStates: Record<string, any>;
  activeNodeIds: string[];
  message: string;
  queueSnapshot: any; // Task queue state for debugging
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string }> }
) {
  try {
    const { templateId, executionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const currentStepParam = searchParams.get('currentStep') || '0';
    const seekToEnd = currentStepParam === 'end' || currentStepParam === '-1';
    const currentStep = seekToEnd ? 0 : parseInt(currentStepParam, 10);

    console.log(`🎯 Step API: template=${templateId}, execution=${executionId}, currentStep=${currentStep}, seekToEnd=${seekToEnd}`);

    // 1. Load template
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const templateResponse = await fetch(`${baseUrl}/api/admin/templates/${templateId}`);
    if (!templateResponse.ok) {
      throw new Error(`Template ${templateId} not found`);
    }
    const templateData = await templateResponse.json();

    // 2. Load execution (optional - use 'none' or 'temp' to skip)
    let externalEvents: any[] = [];

    if (executionId !== 'none' && executionId !== 'temp') {
      const executionResponse = await fetch(`${baseUrl}/api/admin/executions/${executionId}`);
      if (!executionResponse.ok) {
        throw new Error(`Execution ${executionId} not found`);
      }
      const executionData = await executionResponse.json();

      // Support both 'externalEvents' and 'events' fields for compatibility
      externalEvents = executionData.execution.externalEvents || executionData.execution.events || [];
    } else {
      console.log(`⚠️ No execution loaded - using empty external events queue`);
    }

    // 3. Initialize engine
    const engine = new SimulationEngine();
    await engine.loadScenario(templateData.template.scenario);

    // 4. Load external events
    const externalQueue = new ExternalEventQueue();
    externalQueue.setSimulationEngine(engine);

    if (externalEvents.length > 0) {
      for (const event of externalEvents) {
        await externalQueue.addEvent(event);
      }
    }

    console.log(`✅ Loaded ${externalEvents.length} external events`);

    // 5. Handle seek to end or run simulation up to currentStep
    let stepCount = 0;

    if (seekToEnd) {
      // Seek to end: run simulation until queue is empty
      console.log(`🎯 Seeking to end of simulation...`);
      while (engine.getQueue().size() > 0 && stepCount < 10000) { // Safety limit
        await engine.step();
        stepCount++;
      }
      console.log(`✅ Reached end of simulation at step ${stepCount}`);

      // For seek to end, return final state without executing another step
      const finalActivities = engine.getActivities();
      const queueSnapshot = {
        size: engine.getQueue().size(),
        snapshots: engine.getQueue().getSnapshots(),
        processed: engine.getQueue().getProcessedCount(),
        total: engine.getQueue().getTotalCount(),
        eventHistory: engine.getQueue().getEventHistory()
      };

      // Get node states
      const nodeStates: Record<string, any> = {};
      const scenario = templateData.template.scenario;
      if (scenario?.nodes) {
        for (const node of scenario.nodes) {
          const state = engine.getNodeState(node.nodeId);
          if (state) {
            nodeStates[node.nodeId] = state;
          }
        }
      }

      const response: StepResponse = {
        success: true,
        step: stepCount,
        timestamp: Date.now(),
        queueSize: 0,
        activity: [], // No new activities to highlight
        allActivities: finalActivities,
        nodeStates,
        activeNodeIds: [],
        queueSnapshot,
        message: `Simulation complete at step ${stepCount}`
      };

      return NextResponse.json(response);
    }

    // Normal step execution: run up to currentStep
    while (stepCount < currentStep && engine.getQueue().size() > 0) {
      await engine.step();
      stepCount++;
    }

    console.log(`🏃 Ran ${stepCount} steps to reach step ${currentStep}`);

    // 6. Get queue size BEFORE executing next step (this is what user wants to see)
    const queueSizeBeforeStep = engine.getQueue().size();
    console.log(`📊 Queue size before step ${currentStep + 1}: ${queueSizeBeforeStep}`);

    // 7. Get current state BEFORE the next step
    const beforeActivities = engine.getActivities();
    const beforeActivityCount = beforeActivities.length;

    // 8. Execute ONE more step (if queue has events)
    const hasMore = queueSizeBeforeStep > 0 ? await engine.step() : null;
    const newStep = currentStep + 1;

    // 9. Get NEW activities from this step
    const afterActivities = engine.getActivities();
    const stepActivities = afterActivities.slice(beforeActivityCount);

    // 10. Extract active node IDs from step activities
    const activeNodeIds = new Set<string>();
    stepActivities.forEach((activity: any) => {
      if (activity.nodeId) activeNodeIds.add(activity.nodeId);
      if (activity.node) activeNodeIds.add(activity.node);
      if (activity.targetNodeId) activeNodeIds.add(activity.targetNodeId);
    });

    console.log(`✅ Step ${newStep}: ${stepActivities.length} activities, ${activeNodeIds.size} active nodes`);

    // 11. Get node states
    const nodeStates: Record<string, any> = {};
    const scenario = templateData.template.scenario;
    if (scenario?.nodes) {
      for (const node of scenario.nodes) {
        const state = engine.getNodeState(node.nodeId);
        if (state) {
          nodeStates[node.nodeId] = state;
        }
      }
    }

    // 12. Get task queue snapshot for debugging
    const queueSnapshot = {
      size: engine.getQueue().size(),
      snapshots: engine.getQueue().getSnapshots(), // Get all queue snapshots
      processed: engine.getQueue().getProcessedCount(),
      total: engine.getQueue().getTotalCount(),
      eventHistory: engine.getQueue().getEventHistory() // Full event history for task queue modal
    };

    // 13. Return response with all state for debugging
    const response: StepResponse = {
      success: true,
      step: newStep,
      timestamp: Date.now(),
      queueSize: queueSizeBeforeStep - 1, // We just processed one event
      activity: stepActivities, // NEW activities from this step only (for active node highlighting)
      allActivities: afterActivities, // ALL activities accumulated up to this point (for ledger modal)
      nodeStates,
      activeNodeIds: Array.from(activeNodeIds),
      queueSnapshot,
      message: queueSizeBeforeStep > 1
        ? `Executed step ${newStep}, ${queueSizeBeforeStep - 1} events remaining`
        : queueSizeBeforeStep === 1
          ? `Executed step ${newStep}, simulation complete`
          : `Step ${newStep} - no more events to process`
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Step API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 0,
        activeNodeIds: []
      },
      { status: 500 }
    );
  }
}
