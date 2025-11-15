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
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkExecution() {
  const executionId = 's1rRjnOl4XmETIwt6UQjb';
  const doc = await db.collection('executions').doc(executionId).get();

  if (!doc.exists) {
    console.log('❌ Execution not found');
    return;
  }

  const data = doc.data();
  console.log('✅ Execution found:');
  console.log('- ID:', executionId);
  console.log('- Template ID:', data.templateId);
  console.log('- External Events count:', data.externalEvents?.length || 0);
  console.log('- External Events:', JSON.stringify(data.externalEvents, null, 2));
}

checkExecution()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
