const fs = require('fs');
const admin = require('firebase-admin');

// Load environment variables
const envLocal = fs.readFileSync('.env.local', 'utf8');
const envLines = envLocal.split('\n');
for (const line of envLines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();

async function checkVersioning() {
  console.log('🔍 Checking if versioning is enabled...\n');

  try {
    const [metadata] = await bucket.getMetadata();
    console.log('Bucket versioning:', metadata.versioning);

    if (metadata.versioning?.enabled) {
      console.log('✅ Versioning is ENABLED! We can restore old versions.\n');

      // Try to list versions of one file
      const testFile = 'pled/executions/AmbX3I7kqGZckom0DtWIN.json';
      console.log(`Checking versions for: ${testFile}`);

      const file = bucket.file(testFile);
      const [versions] = await file.getMetadata();
      console.log('Versions:', versions);

    } else {
      console.log('❌ Versioning is NOT enabled on this bucket.');
      console.log('Cannot restore previous versions automatically.\n');

      console.log('📋 Options:');
      console.log('1. Delete all executions and start fresh');
      console.log('2. Check if you have a local backup');
      console.log('3. Check Firebase Console for any backup/restore features');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkVersioning().catch(console.error);
