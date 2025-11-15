import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

// GET /api/admin/executions/[id] - Get a specific execution
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const execution = await pledStorageService.getExecution(id);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found', details: `Execution ${id} does not exist` },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Update execution with provided fields
    await pledStorageService.updateExecution(id, body);

    const execution = await pledStorageService.getExecution(id);
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pledStorageService.deleteExecution(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting execution:', error);
    return NextResponse.json(
      { error: 'Failed to delete execution', details: error.message },
      { status: 500 }
    );
  }
}
