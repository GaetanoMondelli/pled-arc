/**
 * Generate Entity Secret Ciphertext using client method
 *
 * Run with: npx tsx scripts/generate-ciphertext-client.ts
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function generateCiphertextViaClient() {
  console.log('\n🔐 Generating Entity Secret Ciphertext (Client Method)\n');

  const apiKey = process.env.CIRCLE_SDK_API_KEY || process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret.substring(0, 20) + '...\n');

  try {
    console.log('Step 1: Initializing client...');
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log('✅ Client initialized\n');

    console.log('Step 2: Generating ciphertext using client.generateEntitySecretCiphertext()...');
    const ciphertext = await client.generateEntitySecretCiphertext();

    console.log('✅ Entity Secret Ciphertext generated!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('COPY THIS CIPHERTEXT:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(ciphertext);
    console.log('\n═══════════════════════════════════════════════════════\n');

    console.log('📋 Next steps:');
    console.log('1. Copy the ciphertext above');
    console.log('2. Go to: Wallets → Dev Controlled → Configurator');
    console.log('3. Paste in "Entity Secret Ciphertext" field');
    console.log('4. Click "Register"');
    console.log('5. Done!\n');

  } catch (error: any) {
    console.error('❌ Error:\n');
    console.error('Message:', error.message);

    if (error.response) {
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
    }

    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

generateCiphertextViaClient();
