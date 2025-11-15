import { NextRequest, NextResponse } from 'next/server';

const WORKFLOW_AGENT_URL = process.env.WORKFLOW_AGENT_URL || 'https://workflow-agent-319413928411.us-central1.run.app/chat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, scenario, history } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Forward the request to the workflow agent
    const response = await fetch(WORKFLOW_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        scenario: scenario || null,
        history: history || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Workflow Agent error:', errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Workflow Agent returned ${response.status}: ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Log the workflow agent's response for debugging
    console.log('🤖 Workflow Agent Response:', JSON.stringify(result, null, 2));
    console.log('🔍 Response keys:', Object.keys(result));
    console.log('📊 Scenario nodes:', result.scenario?.nodes?.length || 0);

    // Check if the workflow agent returned a valid scenario
    if (!result.scenario || !result.scenario.nodes || result.scenario.nodes.length === 0) {
      console.warn('⚠️  Workflow agent did not return a valid scenario with nodes');
      console.log('Operations result:', result.operations?.[0]?.result);

      // Add helpful error information
      const nodesCreated = result.operations?.[0]?.result?.nodesCreated || 0;
      const validationPassed = result.operations?.[0]?.result?.validationPassed;

      return NextResponse.json({
        success: false,
        message: result.message || 'Workflow agent did not create any nodes',
        error: `The workflow agent processed your request but did not generate any workflow nodes. Nodes created: ${nodesCreated}, Validation passed: ${validationPassed}`,
        debugInfo: {
          nodesCreated,
          validationPassed,
          operations: result.operations,
          langGraphExecution: result.langGraphExecution
        }
      });
    }

    // Return the workflow agent's response
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process chat request'
      },
      { status: 500 }
    );
  }
}
