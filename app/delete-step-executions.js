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

async function deleteStepExecutions() {
  try {
    console.log('🔍 Searching for Step Execution entries in Storage...');

    // List all files in arcpled/executions/
    const [files] = await bucket.getFiles({
      prefix: 'arcpled/executions/'
    });

    console.log(`📊 Found ${files.length} total execution files`);

    // Filter Step Execution entries
    const stepExecutions = [];
    for (const file of files) {
      try {
        const [contents] = await file.download();
        const data = JSON.parse(contents.toString('utf-8'));

        if (data.name && data.name.match(/^Step Execution 2025-11-/)) {
          stepExecutions.push({
            file,
            name: data.name,
            path: file.name,
            data
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
        console.log(`⚠️  Skipping ${file.name}: ${error.message}`);
      }
    }

    console.log(`🎯 Found ${stepExecutions.length} Step Execution entries`);

    if (stepExecutions.length === 0) {
      console.log('✅ No Step Execution entries to delete');
      return;
    }

    // Keep the first one, delete the rest
    const toKeep = stepExecutions[0];
    const toDelete = stepExecutions.slice(1);

    console.log(`\n📌 KEEPING:`);
    console.log(`   ${toKeep.name}`);
    console.log(`   Path: ${toKeep.path}`);

    console.log(`\n🗑️  DELETING ${toDelete.length} executions:\n`);

    // Delete files
    let deleted = 0;
    for (const exec of toDelete) {
      console.log(`   ❌ ${exec.name} (${exec.path})`);
      await exec.file.delete();
      deleted++;
    }

    console.log(`\n✅ Successfully deleted ${deleted} Step Execution entries`);
    console.log(`📌 Kept 1 execution for reference: ${toKeep.name}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
deleteStepExecutions()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
