/**
 * Token Lineage API - Trace a token's journey through the simulation
 *
 * GET /api/engine/templates/{templateId}/executions/{executionId}/tokens/{correlationId}/lineage?step=5
 * - Runs simulation up to the specified step on the server
 * - Traces all activities related to a specific correlation ID
 * - Returns the complete token journey
 */

import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';
import { ExternalEventQueue } from '@/core/ExternalEventQueue';

interface TokenLineageResponse {
  success: boolean;
  templateId: string;
  executionId: string;
  correlationId: string;
  step: number;
  activities: any[];
  journey: any;
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string; correlationId: string }> }
) {
  try {
    const { templateId, executionId, correlationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stepParam = searchParams.get('step') || '0';
    const step = parseInt(stepParam, 10);

    console.log(`🔍 Token Lineage API: template=${templateId}, execution=${executionId}, cid=${correlationId}, step=${step}`);

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

    // 7. Filter activities by correlation ID
    // Check multiple possible fields where correlation ID might be stored
    const correlatedActivities = allActivities.filter((activity: any) => {
      // Check direct correlation ID fields
      if (activity.cId === correlationId) return true;
      if (activity.correlationId === correlationId) return true;

      // Check in correlationIds array
      if (Array.isArray(activity.correlationIds) && activity.correlationIds.includes(correlationId)) return true;

      // Check in nested data/value objects
      if (activity.data?.cId === correlationId) return true;
      if (activity.data?.correlationId === correlationId) return true;
      if (activity.value?.cId === correlationId) return true;
      if (activity.value?.correlationId === correlationId) return true;

      // Check in metadata
      if (activity.metadata?.correlationId === correlationId) return true;

      return false;
    });

    console.log(`📊 Found ${correlatedActivities.length} activities for correlation ID ${correlationId} out of ${allActivities.length} total`);

    // 8. Find input correlation IDs (for process nodes with multiple inputs)
    const inputCorrelationIds: string[] = [];

    // Look for the token creation/emission activity for this correlation ID
    const emissionActivity = correlatedActivities.find(a =>
      (a.action === 'token_emitted' || a.action === 'emitting') &&
      (a.cId === correlationId || a.correlationId === correlationId ||
       (Array.isArray(a.correlationIds) && a.correlationIds.includes(correlationId)))
    );

    if (emissionActivity) {
      console.log(`📊 Found emission activity for ${correlationId} at tick ${emissionActivity.tick}`);

      // Look backwards in time for consuming activities at the same node around the same time
      const emissionTick = emissionActivity.tick || emissionActivity.timestamp || 0;
      const nodeId = emissionActivity.nodeId;

      // Find consuming activities at the same node just before emission
      const consumingActivities = allActivities.filter((a: any) => {
        const activityTick = a.tick || a.timestamp || 0;
        return (
          a.nodeId === nodeId &&
          (a.action === 'consuming' || a.action === 'token_consumed') &&
          activityTick <= emissionTick &&
          activityTick >= emissionTick - 5 // Within 5 ticks
        );
      });

      console.log(`📊 Found ${consumingActivities.length} consuming activities near emission`);

      // Extract correlation IDs from consumed tokens
      for (const consumeActivity of consumingActivities) {
        // Check various fields where input correlation IDs might be
        const potentialCids = [
          consumeActivity.cId,
          consumeActivity.correlationId,
          ...(Array.isArray(consumeActivity.correlationIds) ? consumeActivity.correlationIds : []),
          consumeActivity.data?.cId,
          consumeActivity.value?.cId,
        ].filter(Boolean);

        for (const cid of potentialCids) {
          if (cid && cid !== correlationId && !inputCorrelationIds.includes(cid)) {
            inputCorrelationIds.push(cid);
          }
        }
      }
    }

    console.log(`📊 Found ${inputCorrelationIds.length} input correlation IDs: ${inputCorrelationIds.join(', ')}`);

    // 9. Gather activities for all input correlation IDs
    const allRelatedActivities = [...correlatedActivities];

    for (const inputCid of inputCorrelationIds) {
      const inputActivities = allActivities.filter((activity: any) => {
        if (activity.cId === inputCid) return true;
        if (activity.correlationId === inputCid) return true;
        if (Array.isArray(activity.correlationIds) && activity.correlationIds.includes(inputCid)) return true;
        if (activity.data?.cId === inputCid) return true;
        if (activity.value?.cId === inputCid) return true;
        if (activity.metadata?.correlationId === inputCid) return true;
        return false;
      });

      console.log(`📊 Found ${inputActivities.length} activities for input correlation ID ${inputCid}`);
      allRelatedActivities.push(...inputActivities);
    }

    // Remove duplicates
    const uniqueActivities = Array.from(
      new Map(allRelatedActivities.map(a => [a.seq || `${a.tick}_${a.nodeId}_${a.action}`, a])).values()
    );

    // 10. Build token journey with all related activities
    const journey = {
      correlationId,
      inputCorrelationIds,
      activities: uniqueActivities.sort((a, b) => (a.tick || a.timestamp || 0) - (b.tick || b.timestamp || 0)),
      nodes: [...new Set(uniqueActivities.map(a => a.nodeId))],
      startTime: uniqueActivities.length > 0 ? (uniqueActivities[0].tick || uniqueActivities[0].timestamp || 0) : 0,
      endTime: uniqueActivities.length > 0 ? (uniqueActivities[uniqueActivities.length - 1].tick || uniqueActivities[uniqueActivities.length - 1].timestamp || 0) : 0,
    };

    // 11. Return trace data with all related activities
    const response: TokenLineageResponse = {
      success: true,
      templateId,
      executionId,
      correlationId,
      step: stepCount,
      activities: uniqueActivities,
      journey,
      timestamp: Date.now()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Token Lineage API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        activities: [],
        journey: null
      },
      { status: 500 }
    );
  }
}
