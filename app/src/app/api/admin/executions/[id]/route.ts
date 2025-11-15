import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

// GET /api/admin/executions/[id] - Get a specific execution
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const execution = await pledStorageService.getExecution(params.id);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found', details: `Execution ${params.id} does not exist` },
        { status: 404 }
      );
    }

    return NextResponse.json({ execution });
  } catch (error: any) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/admin/executions/[id] - Update an execution
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      nodeStates,
      currentTime,
      eventCounter,
      globalActivityLog,
      nodeActivityLogs,
      isCompleted
    } = body;

    await pledStorageService.updateExecution(params.id, {
      name,
      description,
      nodeStates,
      currentTime,
      eventCounter,
      globalActivityLog,
      nodeActivityLogs,
      isCompleted
    });

    const execution = await pledStorageService.getExecution(params.id);
    return NextResponse.json({ execution });
  } catch (error: any) {
    console.error('Error updating execution:', error);
    return NextResponse.json(
      { error: 'Failed to update execution', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/executions/[id] - Delete an execution
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await pledStorageService.deleteExecution(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting execution:', error);
    return NextResponse.json(
      { error: 'Failed to delete execution', details: error.message },
      { status: 500 }
    );
  }
}
