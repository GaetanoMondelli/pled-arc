/**
 * Firebase Admin SDK Configuration
 *
 * This module initializes Firebase Admin SDK using the service account
 * credentials from environment variables.
 *
 * The FIREBASE_SERVICE_ACCOUNT is base64 encoded and stored in .env.local
 *
 * Usage:
 * import { bucket, admin } from '@/lib/firebase';
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin (singleton pattern)
if (!admin.apps.length) {
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    // Decode base64 service account
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
    );

    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket,
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Export Firebase Admin instance
export { admin };

// Export Storage bucket for convenience
export const bucket = admin.storage().bucket();

// Helper functions for common operations

/**
 * Upload a file to Firebase Storage
 * @param path - Destination path in Firebase Storage (e.g., 'uploads/user123/doc.pdf')
 * @param data - File data (Buffer, string, or Uint8Array)
 * @param contentType - MIME type (e.g., 'application/pdf', 'application/json')
 * @returns Promise with the uploaded file reference
 */
export async function uploadFile(
  path: string,
  data: Buffer | string | Uint8Array,
  contentType: string = 'application/octet-stream'
) {
  const file = bucket.file(path);

  await file.save(data, {
    metadata: {
      contentType,
    },
  });

  return file;
}

/**
 * Download a file from Firebase Storage
 * @param path - File path in Firebase Storage
 * @returns Promise with file contents as Buffer
 */
export async function downloadFile(path: string): Promise<Buffer> {
  const file = bucket.file(path);
  const [contents] = await file.download();
  return contents;
}

/**
 * Get a signed URL for a file (for temporary public access)
 * @param path - File path in Firebase Storage
 * @param expiresInMs - Expiration time in milliseconds (default: 1 hour)
 * @returns Promise with signed URL
 */
export async function getSignedUrl(
  path: string,
  expiresInMs: number = 1000 * 60 * 60 // 1 hour
): Promise<string> {
  const file = bucket.file(path);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMs,
  });
  return url;
}

/**
 * Delete a file from Firebase Storage
 * @param path - File path in Firebase Storage
 */
export async function deleteFile(path: string): Promise<void> {
  const file = bucket.file(path);
  await file.delete();
}

/**
 * List files in a directory
 * @param prefix - Directory prefix (e.g., 'uploads/user123/')
 * @returns Promise with array of file names
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const [files] = await bucket.getFiles({ prefix });
  return files.map(file => file.name);
}

/**
 * Check if a file exists
 * @param path - File path in Firebase Storage
 * @returns Promise with boolean
 */
export async function fileExists(path: string): Promise<boolean> {
  const file = bucket.file(path);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Upload JSON data to Firebase Storage
 * @param path - Destination path in Firebase Storage
 * @param data - JavaScript object to be stringified
 * @returns Promise with the uploaded file reference
 */
export async function uploadJSON(path: string, data: any) {
  return uploadFile(path, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Download and parse JSON from Firebase Storage
 * @param path - File path in Firebase Storage
 * @returns Promise with parsed JSON object
 */
export async function downloadJSON<T = any>(path: string): Promise<T> {
  const contents = await downloadFile(path);
  return JSON.parse(contents.toString('utf-8'));
}
