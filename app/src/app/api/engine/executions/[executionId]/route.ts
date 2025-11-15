/**
 * Engine API - Executions Endpoint
 *
 * Direct access to execution data for engine operations
 * Bypasses complex admin API routing issues
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    console.log(`🔍 Engine API: Loading execution ${executionId}`);

    // Call admin API directly with proper server-side URL resolution
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    const adminResponse = await fetch(`${baseUrl}/api/admin/executions/${executionId}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!adminResponse.ok) {
      console.error(`❌ Admin API failed: ${adminResponse.status} ${adminResponse.statusText}`);
      return NextResponse.json(
        { error: 'Execution not found', details: `Admin API returned ${adminResponse.status}` },
        { status: adminResponse.status }
      );
    }

    const data = await adminResponse.json();

    console.log(`✅ Execution loaded: ${data.execution?.externalEvents?.length || 0} external events`);

    return NextResponse.json({
      success: true,
      execution: data.execution
    });

  } catch (error) {
    console.error('❌ Engine API execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load execution',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}