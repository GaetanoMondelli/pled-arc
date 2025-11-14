/**
 * Cleanup Script: Delete arcpled/executions and copy from pled/executions
 */

const fs = require('fs');
const admin = require('firebase-admin');

// Load environment variables manually
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

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();

async function cleanup() {
  console.log('🧹 Starting cleanup...');

  // Step 1: Delete all files in arcpled/executions/
  console.log('\n📂 Step 1: Deleting polluted executions from arcpled/executions/');
  const [arcpledFiles] = await bucket.getFiles({ prefix: 'arcpled/executions/' });
  console.log(`Found ${arcpledFiles.length} files to delete`);

  for (const file of arcpledFiles) {
    console.log(`  🗑️  Deleting: ${file.name}`);
    await file.delete();
  }
  console.log('✅ Deleted all files from arcpled/executions/');

  // Step 2: Copy files from pled/executions/ to arcpled/executions/
  console.log('\n📂 Step 2: Copying clean data from pled/executions/ to arcpled/executions/');
  const [pledFiles] = await bucket.getFiles({ prefix: 'pled/executions/' });
  console.log(`Found ${pledFiles.length} files to copy`);

  for (const file of pledFiles) {
    const newPath = file.name.replace('pled/executions/', 'arcpled/executions/');
    console.log(`  📋 Copying: ${file.name} -> ${newPath}`);

    // Download and re-upload
    const [contents] = await file.download();
    const [metadata] = await file.getMetadata();

    await bucket.file(newPath).save(contents, {
      metadata: {
        contentType: metadata.contentType || 'application/json'
      }
    });
  }
  console.log('✅ Copied all files from pled/executions/ to arcpled/executions/');

  // Step 3: Update manifest if needed
  console.log('\n📂 Step 3: Checking manifest files...');
  const pledManifestFile = bucket.file('pled/manifest.json');
  const [pledManifestExists] = await pledManifestFile.exists();

  if (pledManifestExists) {
    console.log('  📋 Copying manifest from pled/manifest.json to arcpled/manifest.json');
    const [manifestContents] = await pledManifestFile.download();
    await bucket.file('arcpled/manifest.json').save(manifestContents, {
      metadata: { contentType: 'application/json' }
    });
    console.log('✅ Manifest copied');
  } else {
    console.log('  ⚠️  No pled/manifest.json found, skipping');
  }

  console.log('\n🎉 Cleanup complete!');
  process.exit(0);
}

cleanup().catch(error => {
  console.error('❌ Error during cleanup:', error);
  process.exit(1);
});
