import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dao-house/cleanup
 * Delete all test documents and reset execution events
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🧹 Starting cleanup of test documents...');

    const bucket = require('@/lib/firebase-storage').bucket;
    if (!bucket) {
      return NextResponse.json(
        { error: 'Firebase storage not available' },
        { status: 500 }
      );
    }

    // 1. Delete all files in dao-house/documents
    const [files] = await bucket.getFiles({
      prefix: 'arcpled/dao-house/documents/'
    });

    console.log(`📁 Found ${files.length} files to delete`);

    for (const file of files) {
      await file.delete();
      console.log(`  ✓ Deleted: ${file.name}`);
    }

    // 2. Get Web3 Scion company to find executionId
    const companyData = await pledStorageService.downloadJSON(
      'arcpled/dao-house/companies/web3-scion/profile.json'
    );

    if (companyData && companyData.executionId) {
      console.log(`🔄 Resetting execution ${companyData.executionId}`);

      // Reset external events to empty array
      await pledStorageService.updateExecution(companyData.executionId, {
        externalEvents: [],
        totalExternalEvents: 0,
        eventTypes: [],
      });

      console.log(`✅ Reset execution - cleared all events`);
    }

    console.log(`✨ Cleanup complete! Deleted ${files.length} files`);

    return NextResponse.json({
      success: true,
      message: 'Cleanup complete',
      filesDeleted: files.length,
      executionReset: !!companyData?.executionId,
    });

  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 }
    );
  }
}
