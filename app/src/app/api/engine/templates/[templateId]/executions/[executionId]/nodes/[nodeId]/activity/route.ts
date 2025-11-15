/**
 * Node Activity API - Get activity for a specific node at a specific step
 *
 * GET /api/engine/templates/{templateId}/executions/{executionId}/nodes/{nodeId}/activity?step=5
 * - Runs simulation up to the specified step on the server
 * - Returns only activities related to the specified node
 * - Filters activities by nodeId, sourceNodeId, targetNodeId
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';
import { ExternalEventQueue } from '@/core/ExternalEventQueue';

interface NodeActivityResponse {
  success: boolean;
  templateId: string;
  executionId: string;
  nodeId: string;
  step: number;
  activities: any[];
  nodeState: any;
  totalActivities: number;
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string; nodeId: string }> }
) {
  try {
    const { templateId, executionId, nodeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stepParam = searchParams.get('step') || '0';
    const step = parseInt(stepParam, 10);

    console.log(`🔍 Node Activity API: template=${templateId}, execution=${executionId}, node=${nodeId}, step=${step}`);

    // 1. Load template
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const templateResponse = await fetch(`${baseUrl}/api/admin/templates/${templateId}`);
    if (!templateResponse.ok) {
      throw new Error(`Template ${templateId} not found`);
    }
    const templateData = await templateResponse.json();

    // 2. Load execution
    const executionResponse = await fetch(`${baseUrl}/api/admin/executions/${executionId}`);
    if (!executionResponse.ok) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const executionData = await executionResponse.json();

    // 3. Initialize engine
    const engine = new SimulationEngine();
    await engine.loadScenario(templateData.template.scenario);

    // 4. Load external events
    const externalQueue = new ExternalEventQueue();
    externalQueue.setSimulationEngine(engine);

    if (executionData.execution.externalEvents) {
      for (const event of executionData.execution.externalEvents) {
        await externalQueue.addEvent(event);
      }
    }

    // 5. Run simulation up to the requested step
    let stepCount = 0;
    while (stepCount < step && engine.getQueue().size() > 0) {
      await engine.step();
      stepCount++;
    }

    console.log(`✅ Ran ${stepCount} steps to reach step ${step}`);

    // 6. Get ALL activities from the ledger
    const allActivities = engine.getActivities();

    // 7. Filter activities for this specific node
    // Include activities where this node is the source, target, or main actor
    const nodeActivities = allActivities.filter((activity: any) => {
      return (
        activity.nodeId === nodeId ||
        activity.node === nodeId ||
        activity.sourceNodeId === nodeId ||
        activity.targetNodeId === nodeId ||
        (activity.data && activity.data.nodeId === nodeId)
      );
    });

    console.log(`📊 Found ${nodeActivities.length} activities for node ${nodeId} out of ${allActivities.length} total`);

    // 8. Get node state
    const nodeState = engine.getNodeState(nodeId);

    // 9. Return filtered activities
    const response: NodeActivityResponse = {
      success: true,
      templateId,
      executionId,
      nodeId,
      step: stepCount,
      activities: nodeActivities,
      nodeState: nodeState || {},
      totalActivities: allActivities.length,
      timestamp: Date.now()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Node Activity API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        activities: []
      },
      { status: 500 }
    );
  }
}
