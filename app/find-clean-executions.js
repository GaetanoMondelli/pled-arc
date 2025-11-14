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

async function findCleanExecutions() {
  console.log('🔍 Analyzing execution files to find ones with 5 events...\n');

  const locations = ['pled/executions/', 'arcpled/executions/'];

  for (const location of locations) {
    console.log(`\n📂 Checking ${location}`);
    const [files] = await bucket.getFiles({ prefix: location });

    const eventCounts = {};
    const filesWithFiveEvents = [];

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;

      const [contents] = await file.download();
      const data = JSON.parse(contents.toString());

      const eventCount = data.events?.length || 0;

      if (!eventCounts[eventCount]) {
        eventCounts[eventCount] = 0;
      }
      eventCounts[eventCount]++;

      if (eventCount === 5) {
        filesWithFiveEvents.push({
          name: file.name,
          id: data.id,
          templateId: data.templateId,
          status: data.status,
          events: eventCount
        });
      }
    }

    console.log('\n📊 Event count distribution:');
    Object.entries(eventCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, num]) => {
      console.log(`   ${count} events: ${num} files`);
    });

    if (filesWithFiveEvents.length > 0) {
      console.log(`\n✅ Found ${filesWithFiveEvents.length} files with exactly 5 events:`);
      filesWithFiveEvents.forEach(f => {
        console.log(`   ${f.name}`);
        console.log(`     ID: ${f.id}, Template: ${f.templateId}, Status: ${f.status}`);
      });
    } else {
      console.log('\n❌ No files with exactly 5 events found');
    }
  }

  process.exit(0);
}

findCleanExecutions().catch(console.error);
