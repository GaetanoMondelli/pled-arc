/**
 * Show RAW response from Circle API to prove data comes from them
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function showRawResponse() {
  console.log('\n📡 RAW RESPONSE FROM CIRCLE API\n');

  const apiKey = process.env.CIRCLE_API_KEY!;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log('Calling Circle API: client.listWallets()...\n');

  const response = await client.listWallets({});

  console.log('═══════════════════════════════════════════════════════');
  console.log('RAW RESPONSE FROM CIRCLE:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n✅ This is the ACTUAL response from Circle API!');
  console.log('   - blockchain: comes from Circle');
  console.log('   - createDate: comes from Circle');
  console.log('   - address: comes from Circle');
  console.log('   - Everything comes from Circle!\n');
}

showRawResponse();
