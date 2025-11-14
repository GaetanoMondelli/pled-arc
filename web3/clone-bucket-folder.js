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
const sourcePrefix = 'pled/';
const destPrefix = 'arcpled/';

async function cloneFolder() {
  console.log(`📦 Cloning folder from ${sourcePrefix} to ${destPrefix} in bucket ${bucketName}...`);

  const bucket = storage.bucket(bucketName);

  try {
    // List all files in the source folder
    const [files] = await bucket.getFiles({ prefix: sourcePrefix });

    console.log(`📄 Found ${files.length} files in ${sourcePrefix}`);

    if (files.length === 0) {
      console.log('⚠️  No files found in source folder');
      return;
    }

    // Copy each file to the destination
    let copied = 0;
    for (const file of files) {
      const sourcePath = file.name;
      const relativePath = sourcePath.substring(sourcePrefix.length);

      // Skip if it's just the folder itself
      if (!relativePath) continue;

      const destPath = destPrefix + relativePath;

      console.log(`  Copying: ${sourcePath} → ${destPath}`);

      try {
        await file.copy(destPath);
        copied++;
      } catch (error) {
        console.error(`    ❌ Error copying ${sourcePath}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully copied ${copied} files from ${sourcePrefix} to ${destPrefix}`);
    console.log(`🎉 Clone complete!`);

  } catch (error) {
    console.error('❌ Error during cloning:', error.message);
    process.exit(1);
  }
}

cloneFolder();
