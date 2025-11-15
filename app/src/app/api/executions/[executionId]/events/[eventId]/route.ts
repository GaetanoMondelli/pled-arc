import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/executions/[executionId]/events/[eventId]
 * Delete a specific external event from an execution
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string; eventId: string }> }
) {
  try {
    const { executionId, eventId } = await params;

    const execution = await pledStorageService.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Filter out the event to delete
    const updatedEvents = (execution.externalEvents || []).filter(
      (event: any) => event.id !== eventId
    );

    if (updatedEvents.length === (execution.externalEvents || []).length) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update execution
    await pledStorageService.updateExecution(executionId, {
      externalEvents: updatedEvents,
      totalExternalEvents: updatedEvents.length,
    });

    console.log(`✅ Deleted event ${eventId} from execution ${executionId}`);

    return NextResponse.json({
      success: true,
      deletedEventId: eventId,
      remainingEvents: updatedEvents.length,
    });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event', details: error.message },
      { status: 500 }
    );
  }
}
