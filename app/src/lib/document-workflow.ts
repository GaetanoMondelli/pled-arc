/**
 * Complete Document Processing Workflow
 *
 * This module demonstrates the complete workflow:
 * 1. Upload document to Firebase
 * 2. Parse with Docling
 * 3. Get DSL suggestions from Workflow Agent
 * 4. Save all results to Firebase
 *
 * All persistence operations use Firebase Storage.
 */

import { uploadFile, uploadJSON, getSignedUrl } from './firebase';
import { StoragePaths, generateDocumentId } from './storage-paths';

interface ProcessDocumentParams {
  file: File;
  userId: string;
  scenario?: string;
}

interface ProcessDocumentResult {
  documentId: string;
  uploadPath: string;
  parsedPath: string;
  dslPath: string;
  uploadUrl: string;
  parsedData: any;
  dslSuggestions: any;
}

/**
 * Complete document processing workflow
 * Handles: Upload → Parse → Analyze → Store
 */
export async function processDocument({
  file,
  userId,
  scenario = 'contract-analysis',
}: ProcessDocumentParams): Promise<ProcessDocumentResult> {
  const documentId = generateDocumentId();

  try {
    // STEP 1: Upload original document to Firebase
    console.log('📤 Step 1: Uploading document to Firebase...');
    const uploadPath = StoragePaths.upload(userId, file.name);
    const fileBuffer = await file.arrayBuffer();

    await uploadFile(uploadPath, Buffer.from(fileBuffer), file.type);
    console.log(`✅ Uploaded to: ${uploadPath}`);

    // STEP 2: Get signed URL for Docling to access the file
    console.log('🔗 Step 2: Generating signed URL...');
    const fileUrl = await getSignedUrl(uploadPath, 1000 * 60 * 60); // 1 hour
    console.log('✅ Signed URL generated');

    // STEP 3: Parse document with Docling
    console.log('📄 Step 3: Parsing with Docling...');
    const doclingResponse = await fetch(process.env.DOCLING_SERVICE_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DOCLING_API_KEY}`,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        documentUrl: fileUrl,
        filename: file.name,
        format: file.type,
      }),
    });

    if (!doclingResponse.ok) {
      throw new Error(`Docling failed: ${doclingResponse.status}`);
    }

    const parsedData = await doclingResponse.json();
    console.log('✅ Document parsed successfully');

    // STEP 4: Save parsed result to Firebase
    console.log('💾 Step 4: Saving parsed result to Firebase...');
    const parsedPath = StoragePaths.parsedDocument(userId, documentId);
    await uploadJSON(parsedPath, parsedData);
    console.log(`✅ Saved to: ${parsedPath}`);

    // STEP 5: Send to Workflow Agent for DSL suggestions
    console.log('🤖 Step 5: Getting DSL suggestions from Workflow Agent...');
    const workflowResponse = await fetch(process.env.WORKFLOW_AGENT_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: JSON.stringify(parsedData),
        scenario,
        history: [],
      }),
    });

    if (!workflowResponse.ok) {
      throw new Error(`Workflow Agent failed: ${workflowResponse.status}`);
    }

    const dslSuggestions = await workflowResponse.json();
    console.log('✅ DSL suggestions received');

    // STEP 6: Save DSL suggestions to Firebase
    console.log('💾 Step 6: Saving DSL suggestions to Firebase...');
    const dslPath = StoragePaths.dslSuggestion(userId, documentId);
    await uploadJSON(dslPath, dslSuggestions);
    console.log(`✅ Saved to: ${dslPath}`);

    // Return all paths and data
    return {
      documentId,
      uploadPath,
      parsedPath,
      dslPath,
      uploadUrl: fileUrl,
      parsedData,
      dslSuggestions,
    };
  } catch (error) {
    console.error('❌ Document processing failed:', error);
    throw error;
  }
}

/**
 * Retrieve a processed document and its results from Firebase
 */
export async function getProcessedDocument(userId: string, documentId: string) {
  const { downloadJSON } = await import('./firebase');

  const parsedPath = StoragePaths.parsedDocument(userId, documentId);
  const dslPath = StoragePaths.dslSuggestion(userId, documentId);

  const [parsedData, dslSuggestions] = await Promise.all([
    downloadJSON(parsedPath),
    downloadJSON(dslPath),
  ]);

  return {
    documentId,
    parsedData,
    dslSuggestions,
  };
}

/**
 * List all documents for a user
 */
export async function listUserDocuments(userId: string) {
  const { listFiles } = await import('./firebase');

  const prefix = StoragePaths.userParsedDocuments(userId);
  const files = await listFiles(prefix);

  return files.map(path => {
    const filename = path.split('/').pop() || '';
    const documentId = filename.replace('.json', '');
    return {
      documentId,
      path,
    };
  });
}

/**
 * Delete all data for a document
 */
export async function deleteDocument(userId: string, documentId: string) {
  const { deleteFile, fileExists } = await import('./firebase');

  const paths = [
    StoragePaths.parsedDocument(userId, documentId),
    StoragePaths.dslSuggestion(userId, documentId),
    // Note: We don't delete the original upload to keep audit trail
  ];

  for (const path of paths) {
    if (await fileExists(path)) {
      await deleteFile(path);
      console.log(`🗑️ Deleted: ${path}`);
    }
  }
}
