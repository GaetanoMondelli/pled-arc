/**
 * Register Entity Secret with Circle
 *
 * This script properly registers your entity secret using Circle's SDK
 * Run with: npx tsx scripts/register-entity-secret-proper.ts
 */

import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function registerSecret() {
  console.log('\n🔐 Registering Entity Secret with Circle\n');

  const apiKey = process.env.CIRCLE_SDK_API_KEY || process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 30) + '...');
  console.log('Entity Secret:', entitySecret.substring(0, 20) + '...\n');

  try {
    console.log('🚀 Registering Entity Secret with Circle...\n');

    const response = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });

    console.log('✅ Entity Secret registered successfully!\n');

    // The SDK downloads a recovery file automatically
    // But we can also access it from the response
    if (response.data?.recoveryFile) {
      console.log('📁 Recovery File Content:');
      console.log(JSON.stringify(response.data.recoveryFile, null, 2));
      console.log('');

      // Save it to our recovery folder
      const recoveryDir = path.join(process.cwd(), '.circle-recovery');
      if (!fs.existsSync(recoveryDir)) {
        fs.mkdirSync(recoveryDir, { recursive: true });
      }

      const recoveryPath = path.join(recoveryDir, `recovery_file_${Date.now()}.json`);
      fs.writeFileSync(recoveryPath, JSON.stringify(response.data.recoveryFile, null, 2));
      console.log('💾 Recovery file saved to:', recoveryPath);
      console.log('');
    }

    console.log('✅ Setup complete!\n');
    console.log('You can now use the Circle SDK to create wallets.');
    console.log('Try running: npm run dev\n');
    console.log('⚠️  IMPORTANT: Backup the recovery file to a secure location!\n');

  } catch (error: any) {
    console.error('❌ Error registering Entity Secret:\n');
    console.error('Status:', error.response?.status);
    console.error('Error Message:', error.message);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('\n');

    if (error.response?.status === 401) {
      console.error('🔑 Authentication Error:');
      console.error('   Your API key is invalid or doesn\'t have the right permissions.\n');
      console.error('   Steps to fix:');
      console.error('   1. Go to https://console.circle.com/');
      console.error('   2. Make sure you\'re using the Client Key (TEST_CLIENT_KEY:...)');
      console.error('   3. Ensure the key has "Developer-Controlled Wallets" permissions\n');
    } else if (error.response?.status === 409 || error.message?.includes('already registered')) {
      console.log('✅ Entity Secret is already registered with Circle!');
      console.log('   You can start using the SDK now.\n');
    }

    process.exit(1);
  }
}

registerSecret();
