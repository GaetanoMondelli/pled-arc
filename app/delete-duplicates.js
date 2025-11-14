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

async function deleteDuplicates() {
  console.log('🗑️  Deleting duplicate executions (keeping only 1)...\n');

  const locations = ['pled/executions/', 'arcpled/executions/'];

  for (const location of locations) {
    console.log(`📂 Processing ${location}`);
    const [files] = await bucket.getFiles({ prefix: location });

    let keptFile = null;
    let deletedCount = 0;

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;

      if (!keptFile) {
        // Keep the first file
        keptFile = file.name;
        console.log(`  ✅ KEEPING: ${file.name}`);
      } else {
        // Delete all others
        console.log(`  🗑️  Deleting: ${file.name}`);
        await file.delete();
        deletedCount++;
      }
    }

    console.log(`✅ ${location}: Kept 1 file, deleted ${deletedCount} duplicates\n`);
  }

  console.log('🎉 Done! Only 1 execution remains in each folder.');
  process.exit(0);
}

deleteDuplicates().catch(console.error);
