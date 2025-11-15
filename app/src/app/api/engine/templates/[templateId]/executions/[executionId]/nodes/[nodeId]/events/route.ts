import { NextRequest, NextResponse } from 'next/server';
import { SimulationEngine } from '@/core/implementations/SimulationEngine';
import { ExternalEventQueue } from '@/core/ExternalEventQueue';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string; executionId: string; nodeId: string }> }
) {
  try {
    const { templateId, executionId, nodeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stepParam = searchParams.get('step') || 'last';

    console.log(`🔍 Fetching REAL node events for template=${templateId}, execution=${executionId}, node=${nodeId}, step=${stepParam}`);

    // Base URL for internal API calls - use actual request host
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    console.log(`🔍 DEBUGGING NODE EVENTS BASE URL: host=${host}, protocol=${protocol}, baseUrl=${baseUrl}`);

    // 1. Load template and execution data (like engine states API does)
    const [templateResponse, executionResponse] = await Promise.all([
      fetch(`${baseUrl}/api/admin/templates/${templateId}`),
      fetch(`${baseUrl}/api/admin/executions/${executionId}`)
    ]);

    if (!templateResponse.ok) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!executionResponse.ok) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const templateData = (await templateResponse.json()).template;
    const executionData = (await executionResponse.json()).execution;

    // 2. Validate nodeId exists in this template
    const templateNodes = templateData?.scenario?.nodes || [];
    const nodeExists = templateNodes.some((node: any) => node.nodeId === nodeId);

    if (!nodeExists) {
      return NextResponse.json({
        error: `Node '${nodeId}' not found in template '${templateId}'`,
        availableNodes: templateNodes.map((n: any) => n.nodeId)
      }, { status: 404 });
    }

    // 3. Initialize SimulationEngine and ExternalEventQueue (like template editor)
    console.log(`🚀 Initializing SimulationEngine + ExternalEventQueue for real event processing...`);
    const engine = new SimulationEngine();
    await engine.loadScenario(templateData.scenario);

    // 4. Create ExternalEventQueue and connect to engine (template editor pattern)
    const externalQueue = new ExternalEventQueue();
    externalQueue.setSimulationEngine(engine);

    // 5. Add external events to queue
    const externalEvents = executionData.externalEvents || [];
    for (const event of externalEvents) {
      externalQueue.addEvent(event);
    }

    console.log(`✅ Added ${externalEvents.length} external events to ExternalEventQueue`);

    // 5. Determine how many steps to run based on request
    let maxStepsToRun = 1000; // Default for 'last'

    if (stepParam !== 'last') {
      const requestedStep = parseInt(stepParam, 10);
      if (!isNaN(requestedStep) && requestedStep >= 0) {
        maxStepsToRun = requestedStep + 10; // Run a bit beyond to capture the step
        console.log(`🎯 Running engine up to step ${requestedStep} (maxSteps: ${maxStepsToRun})`);
      }
    } else {
      console.log(`🎯 Running engine to completion for 'last' step`);
    }

    // 6. Run simulation up to required step to generate activity log
    const result = await engine.run({
      maxSteps: maxStepsToRun,
      maxTicks: Date.now() + 30000, // 30 second timeout
      realTimeMode: false,
      debugMode: true
    });

    console.log(`🏁 Simulation run: ${result.reason} at step ${maxStepsToRun}`);

    // 7. Get REAL activity log from engine ledger
    const realActivityLog = engine.getActivities();
    console.log(`📊 REAL engine activity log has ${realActivityLog.length} events`);

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