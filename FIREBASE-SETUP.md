# Firebase Setup Guide

## Overview

All data persistence in the `/archackathon/` project uses **Firebase Storage**.

The Firebase Admin service account is already configured in `/archackathon/app/.env.local` and provides full access to Firebase services.

## Environment Variables (Already Set)

Located in `/archackathon/app/.env.local`:

```bash
FIREBASE_SERVICE_ACCOUNT='ewogICJ0eXBlIjogInN...' # Base64 encoded service account
FIREBASE_STORAGE_BUCKET=quantmondelli.appspot.com
```

**No additional configuration needed!** These credentials are sufficient for all Firebase operations.

## Quick Start

### 1. Use Firebase Helpers

The app includes ready-to-use Firebase helper modules:

```typescript
// Import Firebase helpers
import { bucket, uploadFile, downloadFile, uploadJSON, downloadJSON } from '@/lib/firebase';
import { StoragePaths, generateDocumentId } from '@/lib/storage-paths';

// Upload a file
const userId = 'user-123';
const documentId = generateDocumentId();
const path = StoragePaths.parsedDocument(userId, documentId);

await uploadJSON(path, { content: 'parsed data' });

// Download a file
const data = await downloadJSON(path);
```

### 2. Use Complete Workflow

For document processing pipeline:

```typescript
import { processDocument } from '@/lib/document-workflow';

const result = await processDocument({
  file: uploadedFile,
  userId: 'user-123',
  scenario: 'contract-analysis'
});

// Returns:
// {
//   documentId,
//   uploadPath,
//   parsedPath,
//   dslPath,
//   parsedData,
//   dslSuggestions
// }
```

## File Structure in Firebase Storage

```
/
├── uploads/                    # Original documents
│   └── {userId}/
│       └── {timestamp}-{filename}
│
├── parsed-documents/           # Docling outputs
│   └── {userId}/
│       └── {documentId}.json
│
├── dsl-suggestions/            # Workflow Agent outputs
│   └── {userId}/
│       └── {documentId}.json
│
├── generated-workflows/        # Final workflows
│   └── {userId}/
│       └── {workflowId}.json
│
└── public/                     # Public files
    └── templates/
        └── {templateId}.json
```

## Available Helper Functions

### Basic Operations
- `uploadFile(path, data, contentType)` - Upload any file
- `downloadFile(path)` - Download file as Buffer
- `deleteFile(path)` - Delete a file
- `fileExists(path)` - Check if file exists
- `listFiles(prefix)` - List files in directory
- `getSignedUrl(path, expiresInMs)` - Get temporary public URL

### JSON Operations
- `uploadJSON(path, data)` - Upload JSON object
- `downloadJSON(path)` - Download and parse JSON

### Path Helpers
- `StoragePaths.upload(userId, filename)` - Generate upload path
- `StoragePaths.parsedDocument(userId, documentId)` - Parsed doc path
- `StoragePaths.dslSuggestion(userId, documentId)` - DSL path
- `generateDocumentId()` - Generate unique doc ID
- `generateWorkflowId()` - Generate unique workflow ID

### Workflow Functions
- `processDocument({ file, userId, scenario })` - Complete pipeline
- `getProcessedDocument(userId, documentId)` - Retrieve results
- `listUserDocuments(userId)` - List user's documents
- `deleteDocument(userId, documentId)` - Delete all document data

## Example: API Route with Firebase

```typescript
// app/api/upload-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processDocument } from '@/lib/document-workflow';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    // Process document: Upload → Parse → Analyze → Store (all in Firebase)
    const result = await processDocument({
      file,
      userId,
      scenario: 'contract-analysis'
    });

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      suggestions: result.dslSuggestions
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
```

## Example: Client Component

```typescript
'use client';

import { useState } from 'react';

export function DocumentUpload() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', 'user-123'); // Get from auth

    const response = await fetch('/api/upload-document', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('Document processed:', result);
    
    setUploading(false);
  };

  return (
    <input
      type="file"
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      disabled={uploading}
    />
  );
}
```

## Testing Firebase Connection

Run the services tests to verify Firebase is working:

```bash
cd services
./run-test.sh complete
```

This will test the complete workflow including Firebase storage.

## Important Notes

1. **All persistence MUST use Firebase** - No local file storage
2. **Service account is already configured** - No additional setup needed
3. **Helper functions handle all common operations** - Use them!
4. **Follow the recommended folder structure** - Keeps data organized
5. **Files are organized by userId** - For security and isolation

## Troubleshooting

**"FIREBASE_SERVICE_ACCOUNT not set" error:**
- Make sure you're running from `/app` directory
- Check `.env.local` exists and has FIREBASE_SERVICE_ACCOUNT

**"Permission denied" error:**
- Service account has admin access, so this shouldn't happen
- Check Firebase console for any restrictions

**Import errors:**
- Make sure firebase-admin is installed: `npm install firebase-admin`
- Check that imports use `@/lib/firebase` (with @ alias)

## Resources

- Helper files: `/app/src/lib/firebase.ts`, `/app/src/lib/storage-paths.ts`
- Complete workflow: `/app/src/lib/document-workflow.ts`
- Documentation: `/app/claude.md` (Firebase section)
