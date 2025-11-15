import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-storage';

const RESOURCES_PATH = 'architecture/resources.json';

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
    console.error('Resources list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list resources',
        resources: []
      },
      { status: 500 }
    );
  }
}
