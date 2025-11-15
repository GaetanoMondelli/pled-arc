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

async function syncExecutions() {
  console.log('🔄 Syncing executions: pled → arcpled\n');

  // 1. Delete all files in arcpled/executions/
  console.log('🗑️  Step 1: Deleting all files in arcpled/executions/...');
  const [arcFiles] = await bucket.getFiles({ prefix: 'arcpled/executions/' });

  let deletedCount = 0;
  for (const file of arcFiles) {
    if (file.name.endsWith('.json')) {
      console.log(`  🗑️  Deleting: ${file.name}`);
      await file.delete();
      deletedCount++;
    }
  }
  console.log(`✅ Deleted ${deletedCount} files from arcpled/executions/\n`);

  // 2. Copy all files from pled/executions/ to arcpled/executions/
  console.log('📋 Step 2: Copying files from pled/executions/ to arcpled/executions/...');
  const [pledFiles] = await bucket.getFiles({ prefix: 'pled/executions/' });

  let copiedCount = 0;
  for (const file of pledFiles) {
    if (file.name.endsWith('.json')) {
      const fileName = file.name.replace('pled/executions/', '');
      const destName = `arcpled/executions/${fileName}`;

      console.log(`  📋 Copying: ${file.name} → ${destName}`);
      await file.copy(bucket.file(destName));
      copiedCount++;
    }
  }
  console.log(`✅ Copied ${copiedCount} files to arcpled/executions/\n`);

  console.log('🎉 Sync complete!');
  process.exit(0);
}

syncExecutions().catch(console.error);
