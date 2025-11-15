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

async function listStorage() {
  console.log('📂 Firebase Storage Contents:\n');

  const folders = ['pled/templates/', 'pled/executions/', 'arcpled/templates/', 'arcpled/executions/'];

  for (const folder of folders) {
    console.log(`\n📁 ${folder}`);
    const [files] = await bucket.getFiles({ prefix: folder });

    if (files.length === 0) {
      console.log('   (empty)');
    } else {
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          console.log(`   ✓ ${file.name}`);
        }
      }
    }
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

listStorage().catch(console.error);
