/**
 * Execution Events API
 *
 * Stream-like API for managing external events in an execution.
 * Supports getting all events and pushing new events to an existing execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import type { ExternalEvent } from '@/lib/firestore-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/executions/[executionId]/events
 * Get the array of external events for this execution (stream-like access)
 *
 * Query params:
 * - offset?: number (default: 0) - Start index for pagination
 * - limit?: number (default: 100) - Max number of events to return
 * - type?: string - Filter by event type
 * - since?: number - Get events after this timestamp (Unix milliseconds)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const type = searchParams.get('type');
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : null;

    console.log(`🔍 Fetching events for execution ${executionId} (offset: ${offset}, limit: ${limit})`);

    // Get execution
    const execution = await pledStorageService.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution not found'
        },
        { status: 404 }
      );
    }

    // Get external events (support both field names for compatibility)
    let events = execution.externalEvents || execution.events || [];

    // Apply filters
    if (type) {
      events = events.filter((e: ExternalEvent) => e.type === type);
    }

    if (since !== null) {
      events = events.filter((e: ExternalEvent) => e.timestamp > since);
    }

    // Calculate pagination
    const total = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);
    const hasMore = (offset + limit) < total;

    // Calculate unique event types
    const eventTypes = [...new Set(events.map((e: ExternalEvent) => e.type))];

    return NextResponse.json({
      success: true,
      executionId,
      events: paginatedEvents,
      pagination: {
        offset,
        limit,
        total,
        hasMore,
        returned: paginatedEvents.length
      },
      metadata: {
        totalEvents: total,
        eventTypes,
        filters: {
          type: type || null,
          since: since || null
        }
      }
    });

  } catch (error: any) {
    console.error(`❌ Error fetching events for execution ${(await params).executionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution events',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/executions/[executionId]/events
 * Push new events to an existing execution (stream-like append)
 *
 * Body:
 * {
 *   events: ExternalEvent[]  // Array of new events to append
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    const body = await request.json();
    const { events: newEvents } = body;

    // Validate input
    if (!Array.isArray(newEvents)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Events must be an array'
        },
        { status: 400 }
      );
    }

    if (newEvents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Events array cannot be empty'
        },
        { status: 400 }
      );
    }

    console.log(`➕ Pushing ${newEvents.length} new events to execution ${executionId}`);

    // Get existing execution
    const execution = await pledStorageService.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution not found'
        },
        { status: 404 }
      );
    }

    // Merge new events with existing ones
    const existingEvents = execution.externalEvents || execution.events || [];
    const allEvents = [...existingEvents, ...newEvents];

    // Calculate updated statistics
    const eventTypes = [...new Set(allEvents.map((e: ExternalEvent) => e.type))];

    // Update execution with new events
    await pledStorageService.updateExecution(executionId, {
      externalEvents: allEvents,
      totalExternalEvents: allEvents.length,
      eventTypes
    });

    console.log(`✅ Added ${newEvents.length} events. Total: ${allEvents.length}`);

    return NextResponse.json({
      success: true,
      executionId,
      eventsAdded: newEvents.length,
      totalEvents: allEvents.length,
      newEventTypes: eventTypes,
      timestamp: Date.now()
    }, { status: 200 });

  } catch (error: any) {
    console.error(`❌ Error pushing events to execution ${(await params).executionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to push events to execution',
        details: error.message
      },
      { status: 500 }
    );
  }
}
