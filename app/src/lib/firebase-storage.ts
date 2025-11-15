import * as admin from "firebase-admin";

// Get Firebase admin app instance (reuse if exists)
function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountBase64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  let serviceAccount;
  try {
    const serviceAccountBuffer = Buffer.from(serviceAccountBase64, "base64");
    const serviceAccountString = serviceAccountBuffer.toString("utf8");

    if (!serviceAccountString || serviceAccountString.trim() === "") {
      throw new Error("FIREBASE_SERVICE_ACCOUNT decoded to empty string");
    }

    serviceAccount = JSON.parse(serviceAccountString);
  } catch (error) {
    console.error("Failed to parse Firebase service account:", error);
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    throw new Error("FIREBASE_STORAGE_BUCKET environment variable is not set");
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });
}

let bucket: admin.storage.Storage | null = null;

try {
  bucket = getFirebaseApp().storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
} catch (error) {
  console.error("Failed to initialize Firebase storage bucket:", error);
  // Don't throw here - let the error be handled when bucket is actually used
}

export { bucket };