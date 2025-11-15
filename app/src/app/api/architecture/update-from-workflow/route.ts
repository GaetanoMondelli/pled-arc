import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-storage';

const ARCHITECTURE_DOC_PATH = 'architecture/reference-document.md';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenario, newComponents, updateDescription } = body;

    if (!newComponents || !Array.isArray(newComponents)) {
      return NextResponse.json(
        { success: false, error: 'newComponents array is required' },
        { status: 400 }
      );
    }

    // Get existing architecture document
    let existingDoc = '';
    try {
      const file = bucket.file(ARCHITECTURE_DOC_PATH);
      const [exists] = await file.exists();

      if (exists) {
        const [contents] = await file.download();
        existingDoc = contents.toString('utf-8');
      }
    } catch (error) {
      console.warn('No existing architecture document found, creating new one');
    }

    // Build summary of changes
    const componentsList = newComponents.map((comp: any) =>
      `- **${comp.name}** (${comp.type}): ${comp.purpose}\n  - Connections: ${comp.connections}`
    ).join('\n');

    // Update the document with new components
    const timestamp = new Date().toISOString();
    const updateSection = `
## Workflow Update - ${new Date().toLocaleString()}

${updateDescription || 'Architecture updated with new workflow components'}

### Components Added/Updated:

${componentsList}

---

`;

    const updatedDoc = updateSection + existingDoc;

    // Save updated document to Firebase Storage
    const file = bucket.file(ARCHITECTURE_DOC_PATH);
    await file.save(updatedDoc, {
      contentType: 'text/markdown',
      metadata: {
        updated: timestamp,
        componentCount: newComponents.length.toString()
      }
    });

    // Generate summary
    const summary = `Updated architecture reference with ${newComponents.length} component${newComponents.length !== 1 ? 's' : ''}:\n${newComponents.map((c: any) => c.name).join(', ')}`;

    return NextResponse.json({
      success: true,
      summary,
      componentCount: newComponents.length,
      documentPath: ARCHITECTURE_DOC_PATH
    });

  } catch (error: any) {
    console.error('Architecture update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update architecture reference'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve the current architecture document
export async function GET(request: NextRequest) {
  try {
    const file = bucket.file(ARCHITECTURE_DOC_PATH);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({
        success: true,
        content: '# Architecture Reference\n\nNo architecture documentation yet. Create a workflow and sync to generate documentation.',
        exists: false
      });
    }

    const [contents] = await file.download();
    const content = contents.toString('utf-8');

    return NextResponse.json({
      success: true,
      content,
      exists: true
    });

  } catch (error: any) {
    console.error('Architecture retrieval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve architecture reference'
      },
      { status: 500 }
    );
  }
}
