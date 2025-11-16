const admin = require('firebase-admin');
const serviceAccount = require('./pled-ai-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'pled-ai.firebasestorage.app'
});

const db = admin.firestore();

const templatesToDelete = [
  'fndKL9FnT0vW8RiNJiwzF',
  'lucJ9zr0e2ggPCiENFuLP',
  '0DRst7Ohx8SdilIAdEEeF',
  'PJUz5CRGhBBsVUchZLvDA',
  '9qbCk1Y9drepfl7XZKxxl',
  'SdjXOrq5Pc2kzlCmPwJzQ',
  'HgBrRSZwi5ZqKeMh7xkle',
  'Y5YD3t73ivOPFo1ESudeN',
  'rc5ZqxlX5Nznqs6sbSD1Y',
  'ZucWbC4IPkqoc1zcpggRM',
  'k2ZCf4MAZYC7VeOLtJhCb',
  'PGyqRCR2uIo1bJmfP5cjX',
  'XUpWo2tw7zclSlFhUQea1',
  'li9Eqcxwx7Q0lTioFikFU',
  'mkHJyFk3j8fgU1kL9o75u'
];

async function deleteTemplates() {
  console.log('🗑️  Deleting', templatesToDelete.length, 'DAO House duplicate templates...\n');

  for (const templateId of templatesToDelete) {
    try {
      await db.collection('templates').doc(templateId).delete();
      console.log('✅ Deleted:', templateId);
    } catch (error) {
      console.error('❌ Failed to delete', templateId, ':', error.message);
    }
  }

  console.log('\n✨ Cleanup complete!');
  console.log('Remaining templates:');
  console.log('  - oypjt7e3uUPnxB4tjlQlU (DAO House P&L Complete Flow)');
  console.log('  - 5FWDJYeR0jbDl7PzI1bzr (Captive Solar credit)');
  console.log('  - A7vv9uLUf2t3CfKISnkqd (FSM Complete Test Workflow)');

  process.exit(0);
}

deleteTemplates();
