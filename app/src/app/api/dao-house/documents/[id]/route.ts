import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import { daoHouseService } from '@/lib/services/dao-house-service';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/dao-house/documents/[id]
 * Delete a document and all its associated files
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { companyId, executionId } = body;

    if (!companyId || !executionId) {
      return NextResponse.json(
        { error: 'companyId and executionId are required' },
        { status: 400 }
      );
    }

    // Get filing metadata
    const filings = await daoHouseService.listFilings(companyId);
    const filing = filings.find((f: any) => f.id === id);

    if (!filing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete all format files from Firebase Storage
    const formats = filing.formats;
    const deletePromises: Promise<void>[] = [];

    if (formats.pdf) {
      const pdfPath = `arcpled/dao-house/documents/${companyId}/${executionId}/original/${formats.pdf}`;
      deletePromises.push(pledStorageService.deleteFile(pdfPath));
    }

    if (formats.json) {
      const jsonPath = `arcpled/dao-house/documents/${companyId}/${executionId}/json/${formats.json}`;
      deletePromises.push(pledStorageService.deleteFile(jsonPath));
    }

    if (formats.text) {
      const textPath = `arcpled/dao-house/documents/${companyId}/${executionId}/text/${formats.text}`;
      deletePromises.push(pledStorageService.deleteFile(textPath));
    }

    if (formats.markdown) {
      const markdownPath = `arcpled/dao-house/documents/${companyId}/${executionId}/markdown/${formats.markdown}`;
      deletePromises.push(pledStorageService.deleteFile(markdownPath));
    }

    // Delete all files
    await Promise.all(deletePromises);

    // Delete filing metadata
    await daoHouseService.deleteFilingMetadata(companyId, executionId, id);

    console.log(`✅ Deleted document ${id} and all associated files`);

    return NextResponse.json({
      success: true,
      deletedDocumentId: id,
      deletedFiles: Object.keys(formats).length,
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', details: error.message },
      { status: 500 }
    );
  }
}
