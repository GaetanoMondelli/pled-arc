/**
 * Engine API - Templates Endpoint
 *
 * Direct access to template data for engine operations
 * Bypasses complex admin API routing issues
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    console.log(`🔍 Engine API: Loading template ${templateId}`);

    // Call admin API directly with proper server-side URL resolution
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    const adminResponse = await fetch(`${baseUrl}/api/admin/templates/${templateId}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!adminResponse.ok) {
      console.error(`❌ Admin API failed: ${adminResponse.status} ${adminResponse.statusText}`);
      return NextResponse.json(
        { error: 'Template not found', details: `Admin API returned ${adminResponse.status}` },
        { status: adminResponse.status }
      );
    }

    const data = await adminResponse.json();

    console.log(`✅ Template loaded: ${data.template?.name || 'Unknown'}`);

    return NextResponse.json({
      success: true,
      template: data.template
    });

  } catch (error) {
    console.error('❌ Engine API template error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}