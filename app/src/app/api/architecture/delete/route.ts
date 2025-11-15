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
  statements?: string[];
  contributedChanges?: any[];
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Resource id is required' },
        { status: 400 }
      );
    }

    // Load existing resources
    let resources: Resource[] = [];
    try {
      const file = bucket.file(RESOURCES_PATH);
      const [exists] = await file.exists();

      if (!exists) {
        return NextResponse.json(
          { success: false, error: 'No resources found' },
          { status: 404 }
        );
      }

      const [contents] = await file.download();
      resources = JSON.parse(contents.toString('utf-8'));
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to load resources' },
        { status: 500 }
      );
    }

    // Find resource index
    const resourceIndex = resources.findIndex(r => r.id === id);

    if (resourceIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Resource not found' },
        { status: 404 }
      );
    }

    const deletedResource = resources[resourceIndex];
    resources.splice(resourceIndex, 1);

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
      message: `Resource "${deletedResource.name}" deleted successfully`,
      deletedResource
    });

  } catch (error: any) {
    console.error('Resource deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete resource'
      },
      { status: 500 }
    );
  }
}
