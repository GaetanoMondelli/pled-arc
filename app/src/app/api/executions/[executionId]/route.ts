/**
 * Individual Execution API
 *
 * Get or delete a specific execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/executions/[executionId]
 * Get a specific execution with all its data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;

    console.log(`🔍 Fetching execution: ${executionId}`);

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

    return NextResponse.json({
      success: true,
      execution,
      eventCount: execution.externalEvents?.length || execution.events?.length || 0
    });

  } catch (error: any) {
    console.error(`❌ Error fetching execution ${(await params).executionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/executions/[executionId]
 * Delete a specific execution
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;

    console.log(`🗑️  Deleting execution: ${executionId}`);

    await pledStorageService.deleteExecution(executionId);

    return NextResponse.json({
      success: true,
      message: `Execution ${executionId} deleted successfully`
    });

  } catch (error: any) {
    console.error(`❌ Error deleting execution ${(await params).executionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete execution',
        details: error.message
      },
      { status: 500 }
    );
  }
}
