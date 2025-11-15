import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

// POST /api/admin/init - Initialize the admin structure (create default templates and folders)
export async function POST() {
  try {
    await pledStorageService.initializePledStorage();
    return NextResponse.json({ success: true, message: 'Admin structure initialized' });
  } catch (error: any) {
    console.error('Error initializing admin structure:', error);
    return NextResponse.json(
      { error: 'Failed to initialize admin structure', details: error.message },
      { status: 500 }
    );
  }
}
