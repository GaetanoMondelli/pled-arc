/**
 * Executions API
 *
 * Simplified API for creating and managing executions with external events.
 * Provides stream-like access to external events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import type { ExternalEvent } from '@/lib/firestore-types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/executions
 * Create a new execution with optional initial external events
 *
 * Body:
 * {
 *   templateId: string;
 *   name: string;
 *   description?: string;
 *   externalEvents?: ExternalEvent[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      name,
      description,
      externalEvents = []
    } = body;

    // Validate required fields
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Execution name is required' },
        { status: 400 }
      );
    }

    // Fetch template to get metadata
    const template = await pledStorageService.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Calculate event type statistics
    const eventTypes = [...new Set(externalEvents.map((e: ExternalEvent) => e.type))];

    // Create execution with external events
    const executionId = await pledStorageService.createExecution({
      templateId,
      templateName: template.name,
      scenarioName: template.scenario?.name || name,
      name,
      description,
      externalEvents,
      totalExternalEvents: externalEvents.length,
      eventTypes,
      isCompleted: false,
      createdAt: new Date()
    });

    console.log(`✅ Created execution ${executionId} with ${externalEvents.length} initial events`);

    const execution = await pledStorageService.getExecution(executionId);

    return NextResponse.json({
      success: true,
      executionId,
      execution,
      eventCount: externalEvents.length
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error creating execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create execution',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/executions
 * List all executions (optionally filtered by templateId)
 *
 * Query params:
 * - templateId?: string
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    const executions = await pledStorageService.listExecutions(
      templateId || undefined
    );

    return NextResponse.json({
      success: true,
      executions,
      count: executions.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch executions',
        details: error.message
      },
      { status: 500 }
    );
  }
}
