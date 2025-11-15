/**
 * Cleanup script to delete test documents from DAO House
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'arcpled.firebasestorage.app'
  });
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

async function cleanupDocuments() {
  console.log('🧹 Starting cleanup of test documents...\n');

  try {
    // 1. Delete all files in the dao-house/documents folder
    console.log('📁 Deleting files from Firebase Storage...');
    const [files] = await bucket.getFiles({
      prefix: 'arcpled/dao-house/documents/'
    });

    console.log(`Found ${files.length} files to delete`);

    for (const file of files) {
      await file.delete();
      console.log(`  ✓ Deleted: ${file.name}`);
    }

    console.log(`\n✅ Deleted ${files.length} files from storage\n`);

    // 2. Reset the execution to have no external events
    console.log('🔄 Resetting execution events...');

    // Get the Web3 Scion company to find its executionId
    const companyPath = 'arcpled/dao-house/companies/web3-scion/profile.json';
    const [companyData] = await bucket.file(companyPath).download();
    const company = JSON.parse(companyData.toString());

    if (company.executionId) {
      console.log(`Found execution ID: ${company.executionId}`);

      // Get the execution file
      const executionPath = `arcpled/executions/${company.executionId}/execution.json`;
      try {
        const [execData] = await bucket.file(executionPath).download();
        const execution = JSON.parse(execData.toString());

        // Reset external events to empty array
        execution.externalEvents = [];
        execution.totalExternalEvents = 0;
        execution.eventTypes = [];

        // Save it back
        await bucket.file(executionPath).save(
          JSON.stringify(execution, null, 2),
          { contentType: 'application/json' }
        );

        console.log(`✅ Reset execution ${company.executionId} - cleared all events\n`);
      } catch (err) {
        console.log(`⚠️  Could not find/update execution file: ${err.message}\n`);
      }
    } else {
      console.log('⚠️  No executionId found in company profile\n');
    }

    console.log('✨ Cleanup complete!');
    console.log('\nYou can now:');
    console.log('1. Refresh the DAO House page');
    console.log('2. Upload new documents');
    console.log('3. View them in the execution events modal\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }

  process.exit(0);
}

cleanupDocuments();
