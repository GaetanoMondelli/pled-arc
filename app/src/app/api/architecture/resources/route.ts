import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-storage';

const RESOURCES_PATH = 'architecture/resources.json';

interface Resource {
  id: string;
  name: string;
  uploadedAt: string;
  type: string;
  content?: string;
  tags: string[];
  statements: string[];
  contributedChanges: any[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resourceId, resourceName, resourceType, uploadedAt, statements } = body;

    if (!resourceId || !statements) {
      return NextResponse.json(
        { success: false, error: 'resourceId and statements are required' },
        { status: 400 }
      );
    }

    // Load existing resources
    let resources: Resource[] = [];
    try {
      const file = bucket.file(RESOURCES_PATH);
      const [exists] = await file.exists();

      if (exists) {
        const [contents] = await file.download();
        resources = JSON.parse(contents.toString('utf-8'));
      }
    } catch (error) {
      console.warn('No existing resources file found, creating new one');
    }

    // Find or create resource entry
    let resource = resources.find(r => r.id === resourceId);

    if (resource) {
      // Update existing resource
      resource.statements = [...new Set([...resource.statements, ...statements])];
      resource.contributedChanges.push({
        timestamp: new Date().toISOString(),
        addedStatements: statements.length
      });
    } else {
      // Create new resource entry
      resource = {
        id: resourceId,
        name: resourceName || resourceId,
        type: resourceType || 'document',
        uploadedAt: uploadedAt || new Date().toISOString(),
        tags: ['integrated'],
        statements,
        contributedChanges: [{
          timestamp: new Date().toISOString(),
          addedStatements: statements.length
        }]
      };
      resources.push(resource);
    }

    // Save updated resources
    const file = bucket.file(RESOURCES_PATH);
    await file.save(JSON.stringify(resources, null, 2), {
      contentType: 'application/json',
      metadata: {
        updated: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      resourceEntry: `${resource.name} (${resource.statements.length} statements)`,
      resource
    });

  } catch (error: any) {
    console.error('Resources API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update resources'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve all resources
export async function GET(request: NextRequest) {
  try {
    const file = bucket.file(RESOURCES_PATH);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({
        success: true,
        resources: []
      });
    }

    const [contents] = await file.download();
    const resources = JSON.parse(contents.toString('utf-8'));

    return NextResponse.json({
      success: true,
      resources
    });

  } catch (error: any) {
    console.error('Resources retrieval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve resources'
      },
      { status: 500 }
    );
  }
}
