import { NextRequest, NextResponse } from 'next/server';
import { daoHouseService } from '@/lib/services/dao-house-service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;
    const executionId = formData.get('executionId') as string;
    const documentType = formData.get('documentType') as string;

    if (!file || !companyId || !executionId || !documentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upload document to Firebase
    const documentId = await daoHouseService.uploadDocument(
      companyId,
      executionId,
      file
    );

    // Create filing metadata
    const filing = {
      id: documentId,
      companyId,
      executionId,
      name: file.name,
      type: documentType as any,
      filedDate: new Date().toISOString(),
      description: `${documentType} filing`,
      status: 'pending' as const,
      formats: {
        pdf: file.type === 'application/pdf' ? file.name : undefined,
      },
    };

    await daoHouseService.saveFilingMetadata(filing);

    // Trigger execution event
    const eventResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/executions/${executionId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            {
              id: `evt_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'document.uploaded',
              data: {
                documentId,
                companyId,
                fileName: file.name,
                documentType,
                uploadedAt: new Date().toISOString(),
              },
              timestamp: Date.now(),
            },
          ],
        }),
      }
    );

    if (!eventResponse.ok) {
      const errorText = await eventResponse.text();
      console.error('Failed to trigger execution event:', errorText);
    }

    // Trigger async document processing
    // This will parse the document with Docling and convert to multiple formats
    fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dao-house/process-document`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          companyId,
          executionId,
          fileName: file.name,
        }),
      }
    ).catch((error) => {
      console.error('Background processing failed:', error);
      // Don't fail the upload if processing fails
    });

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        filing,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
