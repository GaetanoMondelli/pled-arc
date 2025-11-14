/**
 * Generate Entity Secret Ciphertext using API Key
 *
 * Run with: npx tsx scripts/generate-ciphertext-with-api-key.ts
 */

import { generateEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function generateCiphertext() {
  console.log('\n🔐 Generating Entity Secret Ciphertext using API Key\n');

  const apiKey = process.env.CIRCLE_API_KEY; // Use API Key, not Client Key!
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
  }

  console.log('API Key (API):', apiKey.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret.substring(0, 20) + '...\n');

  try {
    console.log('🔄 Generating ciphertext...\n');

    const ciphertext = await generateEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });

    console.log('✅ SUCCESS! Entity Secret Ciphertext generated!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('COPY THIS CIPHERTEXT AND PASTE IT IN CIRCLE CONSOLE:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(ciphertext);
    console.log('\n═══════════════════════════════════════════════════════\n');

    console.log('📋 Next steps:');
    console.log('1. Copy the ciphertext above');
    console.log('2. Go to: Circle Console → Wallets → Dev Controlled → Configurator');
    console.log('3. Paste in "Entity Secret Ciphertext" field');
    console.log('4. Click "Register"');
    console.log('5. Your entity secret will be registered!');
    console.log('6. Then you can create wallets!\n');

  } catch (error: any) {
    console.error('❌ Error:\n');
    console.error('Message:', error.message);

    if (error.response) {
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
    }

    process.exit(1);
  }
}

generateCiphertext();
