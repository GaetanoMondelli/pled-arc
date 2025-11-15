import * as admin from "firebase-admin";

// Get Firebase admin app instance (reuse if exists)
function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountBuffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || "", "base64");
  const serviceAccount = JSON.parse(serviceAccountBuffer.toString("utf8"));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = getFirebaseApp().storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
export { bucket };