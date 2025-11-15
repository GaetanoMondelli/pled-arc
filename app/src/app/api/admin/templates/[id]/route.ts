import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import type { Scenario } from '@/lib/simulation/types';

export const dynamic = 'force-dynamic';

// GET /api/admin/templates/[id] - Get a specific template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await pledStorageService.getTemplate(params.id);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', details: `Template ${params.id} does not exist` },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/admin/templates/[id] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, scenario, referenceDoc } = body;

    await pledStorageService.updateTemplate(params.id, {
      name,
      description,
      scenario: scenario as Scenario,
      referenceDoc
    });

    const template = await pledStorageService.getTemplate(params.id);
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await pledStorageService.deleteTemplate(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template', details: error.message },
      { status: 500 }
    );
  }
}
