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

async function deleteBadFiles() {
  console.log('🗑️  Deleting only files WITHOUT 5 events (keeping the 117 good ones)...\n');

  const locations = ['pled/executions/', 'arcpled/executions/'];

  for (const location of locations) {
    console.log(`📂 Checking ${location}`);
    const [files] = await bucket.getFiles({ prefix: location });

    let deletedCount = 0;
    let keptCount = 0;

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;

      const [contents] = await file.download();
      const data = JSON.parse(contents.toString());
      const eventCount = data.events?.length || 0;

      if (eventCount !== 5) {
        console.log(`  🗑️  Deleting: ${file.name} (${eventCount} events)`);
        await file.delete();
        deletedCount++;
      } else {
        keptCount++;
      }
    }

    console.log(`✅ ${location}: Deleted ${deletedCount} bad files, kept ${keptCount} good files\n`);
  }

  console.log('🎉 Cleanup complete! Only the 117 original executions remain.');
  process.exit(0);
}

deleteBadFiles().catch(console.error);
