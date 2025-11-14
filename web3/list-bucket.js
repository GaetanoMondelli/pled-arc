#!/usr/bin/env node

import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the .env file from the app directory
const envPath = join(__dirname, '../app/.env');
const envContent = readFileSync(envPath, 'utf-8');

// Extract FIREBASE_SERVICE_ACCOUNT value
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='([^']+)'/);
if (!match) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT not found in .env file');
  process.exit(1);
}

const serviceAccountBase64 = match[1];
const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Initialize Storage with credentials
const storage = new Storage({
  projectId: serviceAccount.project_id,
  credentials: serviceAccount,
});

const bucketName = 'quantmondelli.appspot.com';

async function listTopLevelFolders() {
  console.log(`📦 Listing top-level folders in bucket ${bucketName}...\n`);

  const bucket = storage.bucket(bucketName);

  try {
    const [files] = await bucket.getFiles({ delimiter: '/' });
    const prefixes = new Set();

    // Get all unique top-level folders
    const options = { delimiter: '/', autoPaginate: false };
    const [, , apiResponse] = await bucket.getFiles(options);

    if (apiResponse && apiResponse.prefixes) {
      apiResponse.prefixes.forEach(prefix => {
        console.log(`📁 ${prefix}`);
      });
    }

    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listTopLevelFolders();
