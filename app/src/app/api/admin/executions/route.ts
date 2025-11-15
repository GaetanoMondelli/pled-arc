import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import type { Scenario } from '@/lib/simulation/types';

export const dynamic = 'force-dynamic';

// GET /api/admin/executions - Get all executions (optionally filtered by templateId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    const executions = await pledStorageService.listExecutions(
      templateId || undefined
    );

    return NextResponse.json({ executions });
  } catch (error: any) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executions', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/executions - Create a new execution (save simulation state)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      templateName,
      scenarioName,
      name,
      description,
      scenario,
      nodeStates,
      currentTime,
      eventCounter,
      globalActivityLog,
      nodeActivityLogs,
      isCompleted,
      externalEvents,
      totalExternalEvents,
      eventTypes,
      createdAt
    } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required', details: 'Missing templateId field' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Execution name is required', details: 'Missing name field' },
        { status: 400 }
      );
    }

    const executionId = await pledStorageService.createExecution({
      templateId,
      templateName,
      scenarioName,
      name,
      description,
      scenario: scenario as Scenario,
      nodeStates,
      currentTime,
      eventCounter,
      globalActivityLog,
      nodeActivityLogs,
      isCompleted,
      externalEvents,
      totalExternalEvents,
      eventTypes,
      createdAt: createdAt ? new Date(createdAt) : undefined
    });

    const execution = await pledStorageService.getExecution(executionId);
    return NextResponse.json({ execution }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating execution:', error);
    return NextResponse.json(
      { error: 'Failed to create execution', details: error.message },
      { status: 500 }
    );
  }
}
