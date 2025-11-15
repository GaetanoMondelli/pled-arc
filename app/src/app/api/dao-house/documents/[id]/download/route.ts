import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';
import { daoHouseService } from '@/lib/services/dao-house-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dao-house/documents/[id]/download?format=pdf|json|text|markdown
 * Download a document in a specific format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';

    // Get filing metadata to find the document paths
    // For now, we'll need to search through companies
    // This could be optimized by storing filing metadata in a dedicated collection

    const companies = await daoHouseService.listCompanies();
    let filing: any = null;
    let companyId = '';
    let executionId = '';

    // Search for the filing across all companies
    for (const company of companies) {
      const filings = await daoHouseService.listFilings(company.id);
      const found = filings.find((f: any) => f.id === id);
      if (found) {
        filing = found;
        companyId = company.id;
        executionId = company.executionId || '';
        break;
      }
    }

    if (!filing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Determine the file path based on format
    let filePath = '';
    let contentType = 'application/octet-stream';
    let fileName = '';

    switch (format) {
      case 'pdf':
        filePath = `arcpled/dao-house/documents/${companyId}/${executionId}/original/${filing.formats.pdf}`;
        contentType = 'application/pdf';
        fileName = filing.formats.pdf || `${id}.pdf`;
        break;
      case 'json':
        filePath = `arcpled/dao-house/documents/${companyId}/${executionId}/json/${filing.formats.json}`;
        contentType = 'application/json';
        fileName = filing.formats.json || `${id}.json`;
        break;
      case 'text':
        filePath = `arcpled/dao-house/documents/${companyId}/${executionId}/text/${filing.formats.text}`;
        contentType = 'text/plain';
        fileName = filing.formats.text || `${id}.txt`;
        break;
      case 'markdown':
        filePath = `arcpled/dao-house/documents/${companyId}/${executionId}/markdown/${filing.formats.markdown}`;
        contentType = 'text/markdown';
        fileName = filing.formats.markdown || `${id}.md`;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid format. Use: pdf, json, text, or markdown' },
          { status: 400 }
        );
    }

    // Download file from Firebase Storage
    const fileBuffer = await pledStorageService.downloadBuffer(filePath);

    if (!fileBuffer) {
      return NextResponse.json(
        { error: `File not found: ${format}` },
        { status: 404 }
      );
    }

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { error: 'Failed to download document', details: error.message },
      { status: 500 }
    );
  }
}
