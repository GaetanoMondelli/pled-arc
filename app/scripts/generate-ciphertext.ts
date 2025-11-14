/**
 * Generate Entity Secret Ciphertext for Circle Console
 *
 * This generates the encrypted version of your entity secret
 * that you can paste into the Circle Console
 *
 * Run with: npx tsx scripts/generate-ciphertext.ts
 */

import { generateEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function generateCiphertext() {
  console.log('\n🔐 Generating Entity Secret Ciphertext for Circle Console\n');

  const apiKey = process.env.CIRCLE_SDK_API_KEY || process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
  }

  console.log('Entity Secret:', entitySecret.substring(0, 20) + '...\n');

  try {
    console.log('🔄 Generating ciphertext (this may take a moment)...\n');

    const ciphertext = await generateEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });

    console.log('✅ Entity Secret Ciphertext generated!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('COPY THIS CIPHERTEXT:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(ciphertext);
    console.log('\n═══════════════════════════════════════════════════════\n');

    console.log('📋 Next steps:');
    console.log('1. Copy the ciphertext above');
    console.log('2. Go to Circle Console → Wallets → Dev Controlled → Configurator');
    console.log('3. Paste the ciphertext in the "Entity Secret Ciphertext" field');
    console.log('4. Click "Register"');
    console.log('5. Then you can create wallets!\n');

  } catch (error: any) {
    console.error('❌ Error generating ciphertext:\n');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
    }

    console.log('\n💡 Alternative: Manual registration through Console');
    console.log('If this fails, you can register directly in the Console:');
    console.log('1. Go to: Wallets → Dev Controlled → Configurator');
    console.log('2. Click "Learn registration process" for instructions');
    console.log('3. Follow the Console UI wizard\n');

    process.exit(1);
  }
}

generateCiphertext();
