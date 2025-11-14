/**
 * Circle Entity Secret Setup Script
 *
 * This script helps you:
 * 1. Generate a new Entity Secret (32-byte private key)
 * 2. Create a recovery file (IMPORTANT: backup this file!)
 * 3. Add the secret to your .env.local file
 *
 * Run with: npx tsx scripts/setup-circle-entity.ts
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const ENV_FILE = path.join(process.cwd(), '.env.local');
const RECOVERY_DIR = path.join(process.cwd(), '.circle-recovery');

function generateEntitySecret(): string {
  // Generate a 32-byte (256-bit) random hex string
  const secret = crypto.randomBytes(32).toString('hex');
  console.log('✅ Generated new Entity Secret (32 bytes)');
  return secret;
}

function createRecoveryFile(entitySecret: string) {
  // Create recovery directory if it doesn't exist
  if (!fs.existsSync(RECOVERY_DIR)) {
    fs.mkdirSync(RECOVERY_DIR, { recursive: true });
  }

  const recoveryData = {
    entitySecret,
    generatedAt: new Date().toISOString(),
    warning: 'KEEP THIS FILE SECURE! It contains your Entity Secret. Without it, you cannot access your wallets.',
  };

  const recoveryFile = path.join(RECOVERY_DIR, `entity-secret-recovery-${Date.now()}.json`);
  fs.writeFileSync(recoveryFile, JSON.stringify(recoveryData, null, 2));

  console.log(`✅ Recovery file created: ${recoveryFile}`);
  console.log('⚠️  IMPORTANT: Backup this file to a secure location!');

  return recoveryFile;
}

function updateEnvFile(entitySecret: string) {
  let envContent = '';

  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  // Check if CIRCLE_ENTITY_SECRET already exists
  if (envContent.includes('CIRCLE_ENTITY_SECRET=')) {
    // Replace existing value
    envContent = envContent.replace(
      /CIRCLE_ENTITY_SECRET=.*/,
      `CIRCLE_ENTITY_SECRET=${entitySecret}`
    );
    console.log('✅ Updated existing CIRCLE_ENTITY_SECRET in .env.local');
  } else {
    // Add new entry
    envContent += `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`;
    console.log('✅ Added CIRCLE_ENTITY_SECRET to .env.local');
  }

  fs.writeFileSync(ENV_FILE, envContent);
}

async function main() {
  console.log('\n🔐 Circle Entity Secret Setup\n');
  console.log('This will generate a new Entity Secret for your Circle Developer-Controlled Wallets.\n');

  // Check if entity secret already exists
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    const existingSecret = envContent.match(/CIRCLE_ENTITY_SECRET=([^\n]+)/)?.[1];

    if (existingSecret && existingSecret !== 'your-entity-secret-here') {
      console.log('⚠️  Warning: An Entity Secret already exists in .env.local');
      console.log('   Existing value:', existingSecret.substring(0, 20) + '...');
      console.log('\n   If you continue, a NEW secret will be generated and the old one will be replaced.');
      console.log('   Your existing wallets created with the old secret will become inaccessible!\n');

      // In a real scenario, you'd want to prompt the user here
      // For now, we'll just exit
      console.log('❌ Exiting to prevent accidental replacement.');
      console.log('   If you want to generate a new secret, manually remove CIRCLE_ENTITY_SECRET from .env.local first.\n');
      process.exit(1);
    }
  }

  try {
    // Step 1: Generate Entity Secret
    console.log('Step 1: Generating Entity Secret...');
    const entitySecret = generateEntitySecret();

    // Step 2: Create recovery file
    console.log('\nStep 2: Creating recovery file...');
    const recoveryFile = createRecoveryFile(entitySecret);

    // Step 3: Update .env.local
    console.log('\nStep 3: Updating .env.local...');
    updateEnvFile(entitySecret);

    console.log('\n✅ Setup complete!\n');
    console.log('Your Entity Secret has been configured. Here\'s what you need to do:\n');
    console.log('1. ⚠️  BACKUP the recovery file:', recoveryFile);
    console.log('2. 🔒 Keep the recovery file in a secure location (NOT in git)');
    console.log('3. 🚀 Restart your dev server: npm run dev');
    console.log('4. 🎉 Try creating a wallet on the homepage!\n');
    console.log('⚠️  Note: The .circle-recovery/ folder is already in .gitignore for safety.\n');

  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  }
}

main();
