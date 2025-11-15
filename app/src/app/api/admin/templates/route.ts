import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import type { Scenario } from '@/lib/simulation/types';

export const dynamic = 'force-dynamic';

// GET /api/admin/templates - Get all templates
export async function GET() {
  try {
    const templates = await pledStorageService.listTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, scenario, referenceDoc, resources, fromDefault } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required', details: 'Missing name field' },
        { status: 400 }
      );
    }

    // If creating from default template
    if (fromDefault) {
      const defaultTemplate = await pledStorageService.getDefaultTemplate();
      const templateId = await pledStorageService.createTemplate({
        name,
        description: description || defaultTemplate.description,
        scenario: scenario || defaultTemplate.scenario,
        referenceDoc,
        resources: resources || []
      });

      const template = await pledStorageService.getTemplate(templateId);
      return NextResponse.json({ template }, { status: 201 });
    }

    // Create custom template
    const templateId = await pledStorageService.createTemplate({
      name,
      description: description || 'Custom template',
      scenario: scenario as Scenario,
      referenceDoc,
      resources: resources || []
    });

    const template = await pledStorageService.getTemplate(templateId);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template', details: error.message },
      { status: 500 }
    );
  }
}
