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

async function inspectExecution() {
  console.log('🔍 Downloading one execution file to inspect...\n');

  // Download the first execution file from pled/executions/
  const file = bucket.file('pled/executions/0aWFQ5KcRVbssAw5MedIA.json');
  const [contents] = await file.download();
  const data = JSON.parse(contents.toString());

  console.log('📄 Execution file: pled/executions/0aWFQ5KcRVbssAw5MedIA.json\n');
  console.log('📊 Basic info:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Template ID: ${data.templateId}`);
  console.log(`   Name: ${data.name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Started at: ${data.startedAt}`);
  console.log(`   Updated at: ${data.updatedAt}`);
  console.log(`   Events count: ${data.events?.length || 0}`);
  console.log(`   Messages count: ${data.messages?.length || 0}\n`);

  console.log('📋 Events:');
  data.events?.forEach((event, i) => {
    console.log(`   ${i + 1}. Type: ${event.type}, Timestamp: ${event.timestamp}`);
    if (event.nodeId) console.log(`      Node: ${event.nodeId}`);
    if (event.payload) console.log(`      Payload: ${JSON.stringify(event.payload).substring(0, 100)}...`);
  });

  console.log('\n💾 Saving to local file for inspection...');
  fs.writeFileSync('execution-sample.json', JSON.stringify(data, null, 2));
  console.log('✅ Saved to: execution-sample.json');

  // Check a few more to see if they're similar
  console.log('\n🔍 Checking similarity with other executions...');
  const [files] = await bucket.getFiles({ prefix: 'pled/executions/' });

  const samples = [];
  for (let i = 0; i < Math.min(5, files.length); i++) {
    if (!files[i].name.endsWith('.json')) continue;
    const [content] = await files[i].download();
    const exec = JSON.parse(content.toString());
    samples.push({
      id: exec.id,
      templateId: exec.templateId,
      eventCount: exec.events?.length || 0,
      status: exec.status,
      name: exec.name
    });
  }

  console.log('\n📊 Sample of 5 executions:');
  samples.forEach(s => {
    console.log(`   ${s.id}: Template ${s.templateId}, ${s.eventCount} events, ${s.status}, "${s.name}"`);
  });

  process.exit(0);
}

inspectExecution().catch(console.error);
