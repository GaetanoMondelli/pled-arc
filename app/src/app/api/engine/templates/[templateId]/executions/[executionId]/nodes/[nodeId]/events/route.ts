import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string; nodeId: string }> }
) {
  try {
    const { templateId, executionId, nodeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stepParam = searchParams.get('step') || 'last';

    console.log(`🔍 Fetching node events for template=${templateId}, execution=${executionId}, node=${nodeId}, step=${stepParam}`);

    // Base URL for internal API calls
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // 1. Use step API to get simulation state
    const stepUrl = `${baseUrl}/api/engine/templates/${templateId}/executions/${executionId}/step?currentStep=${stepParam === 'last' ? 'end' : stepParam}`;
    console.log(`🔍 Fetching simulation state from: ${stepUrl}`);

    const stepResponse = await fetch(stepUrl);
    if (!stepResponse.ok) {
      const errorData = await stepResponse.json();
      return NextResponse.json({
        error: errorData.error || 'Failed to fetch simulation state',
        details: errorData
      }, { status: stepResponse.status });
    }

    const stepData = await stepResponse.json();
    const realActivityLog = stepData.allActivities || [];
    console.log(`📊 Got ${realActivityLog.length} activities from step API`);

    // 2. Validate nodeId exists (get template to check)
    const templateResponse = await fetch(`${baseUrl}/api/admin/templates/${templateId}`);
    if (!templateResponse.ok) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    const templateData = (await templateResponse.json()).template;
    const templateNodes = templateData?.scenario?.nodes || [];
    const nodeExists = templateNodes.some((node: any) => node.nodeId === nodeId);

    if (!nodeExists) {
      return NextResponse.json({
        error: `Node '${nodeId}' not found in template '${templateId}'`,
        availableNodes: templateNodes.map((n: any) => n.nodeId)
      }, { status: 404 });
    }

    // 7. Convert activity log to numbered sequence (like template editor shows)
    const allEvents = realActivityLog.map((event: any, index: number) => ({
      seq: index + 1,
      ...event
    }));

    // 8. Filter events for this specific node
    const nodeEvents = allEvents.filter((entry: any) => {
      const matchesNode =
        entry.nodeId === nodeId ||
        entry.node === nodeId ||
        entry.targetNodeId === nodeId ||
        (entry.details && entry.details.includes(nodeId));

      if (matchesNode) {
        console.log(`✅ Found matching event #${entry.seq}: ${entry.eventType} for ${nodeId}`);
      }

      return matchesNode;
    });

    console.log(`🎯 Found ${nodeEvents.length} events for node ${nodeId} from ${allEvents.length} total real events`);

    // 9. Apply step filtering and determine actual step
    let filteredEvents = nodeEvents;
    let actualStep: number | string;

    if (stepParam !== 'last') {
      const stepNumber = parseInt(stepParam, 10);
      if (isNaN(stepNumber) || stepNumber < 0) {
        return NextResponse.json({
          error: `Invalid step parameter '${stepParam}'. Must be a number >= 0 or 'last'`
        }, { status: 400 });
      }

      // Filter events up to and including the specified step
      filteredEvents = nodeEvents.filter(entry => entry.seq <= stepNumber);
      actualStep = stepNumber;
      console.log(`📈 Filtered to ${filteredEvents.length} events up to step ${stepNumber}`);
    } else {
      // For 'last', return the highest sequence number processed
      const maxSeq = Math.max(...nodeEvents.map(e => e.seq || 0), 0);
      actualStep = maxSeq;
      console.log(`📈 Processing 'last' step - highest sequence: ${maxSeq}`);
    }

    // 10. Sort by sequence number
    filteredEvents.sort((a, b) => (a.seq || 0) - (b.seq || 0));

    return NextResponse.json({
      templateId,
      executionId,
      nodeId,
      requestedStep: stepParam,
      actualStep: actualStep,
      nodeType: templateNodes.find((n: any) => n.nodeId === nodeId)?.type || 'unknown',
      totalActivityLogEntries: realActivityLog.length,
      nodeSpecificEntries: nodeEvents.length,
      filteredEntries: filteredEvents.length,
      events: filteredEvents,
      dataSource: "real_simulation_engine"
    });

  } catch (error) {
    console.error('❌ Error fetching node events:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}