# Firebase Quick Reference

## Location of Credentials

**File**: `/archackathon/app/.env.local` (this folder)

**Required Environment Variables**:
```bash
FIREBASE_SERVICE_ACCOUNT='ewogICJ0eXBlIjogInN...'  # Base64 encoded service account JSON
FIREBASE_STORAGE_BUCKET=quantmondelli.appspot.com
```

These are **already configured** - no setup needed!

## How to Access Firebase

### Import the helpers:
```typescript
import { bucket, uploadFile, uploadJSON, downloadJSON } from '@/lib/firebase';
import { StoragePaths, generateDocumentId } from '@/lib/storage-paths';
```

### Quick Examples:

**Upload JSON:**
```typescript
const userId = 'user-123';
const documentId = generateDocumentId();
const path = StoragePaths.parsedDocument(userId, documentId);

await uploadJSON(path, { your: 'data' });
```

**Download JSON:**
```typescript
const data = await downloadJSON(path);
```

**Complete workflow:**
```typescript
import { processDocument } from '@/lib/document-workflow';

const result = await processDocument({
  file: uploadedFile,
  userId: 'user-123',
  scenario: 'contract-analysis'
});
```

## Helper Files in This Folder

- `/src/lib/firebase.ts` - Firebase Admin initialization & helpers
- `/src/lib/storage-paths.ts` - Path generators for Firebase Storage
- `/src/lib/document-workflow.ts` - Complete document processing pipeline

## Storage Structure

```
Firebase Storage (quantmondelli.appspot.com)
/
├── uploads/{userId}/{timestamp}-{filename}
├── parsed-documents/{userId}/{documentId}.json
├── dsl-suggestions/{userId}/{documentId}.json
└── generated-workflows/{userId}/{workflowId}.json
```

## More Info

See `/app/claude.md` for complete Firebase documentation.
