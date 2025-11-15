/**
 * Setup Circle Webhook for Transaction Notifications
 *
 * This script registers your webhook endpoint with Circle to receive
 * real-time notifications when transactions change state and txHash becomes available.
 *
 * Run with: node setup-circle-webhook.js
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function setupWebhook() {
  console.log('\n🔔 Setting up Circle Webhook\n');
  console.log('═'.repeat(60));

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('❌ Missing Circle credentials in .env');
    process.exit(1);
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log('\n1️⃣  Checking existing webhooks...\n');

  try {
    // List existing subscriptions
    const existingSubs = await client.listSubscriptions();
    console.log('   Found', existingSubs.data?.length || 0, 'existing webhook(s)');

    if (existingSubs.data && existingSubs.data.length > 0) {
      console.log('\n   Existing webhooks:');
      existingSubs.data.forEach((sub, i) => {
        console.log(`   ${i + 1}. ${sub.endpoint}`);
        console.log(`      ID: ${sub.id}`);
        console.log(`      Enabled: ${sub.enabled}`);
        console.log(`      Created: ${sub.createDate}`);
        console.log('');
      });
    }

    console.log('\n2️⃣  Creating new webhook subscription...\n');

    // Get your deployed app URL
    // In production, this should be your actual domain
    // For local development, you can use ngrok or similar
    const deployedUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookEndpoint = `${deployedUrl}/api/webhooks/circle`;

    console.log('   Webhook endpoint:', webhookEndpoint);
    console.log('');

    if (deployedUrl.includes('localhost')) {
      console.log('⚠️  WARNING: You are using localhost!');
      console.log('   Circle webhooks require a publicly accessible HTTPS endpoint.');
      console.log('   For local development:');
      console.log('   1. Use ngrok: ngrok http 3000');
      console.log('   2. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
      console.log('   3. Set NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io in .env');
      console.log('   4. Re-run this script');
      console.log('');
      console.log('   For production, deploy your app and use the production URL.');
      console.log('');
      process.exit(1);
    }

    // Create subscription
    const subscription = await client.createSubscription({
      endpoint: webhookEndpoint,
    });

    console.log('✅ Webhook subscription created!\n');
    console.log('═'.repeat(60));
    console.log('Subscription Details:');
    console.log('═'.repeat(60));
    console.log('ID:', subscription.data?.id);
    console.log('Endpoint:', subscription.data?.endpoint);
    console.log('Enabled:', subscription.data?.enabled);
    console.log('Created:', subscription.data?.createDate);
    console.log('');

    console.log('📋 What happens now:');
    console.log('');
    console.log('1. When you mint a claim, Circle creates a transaction');
    console.log('2. Circle will POST to your webhook as transaction state changes:');
    console.log('   - INITIATED → Transaction created');
    console.log('   - QUEUED → Waiting to be processed');
    console.log('   - SENT → Sent to blockchain node');
    console.log('   - CONFIRMED → Broadcast onchain (txHash available!)');
    console.log('   - COMPLETE → Fully confirmed');
    console.log('');
    console.log('3. Your webhook handler at /api/webhooks/circle will:');
    console.log('   - Receive the transaction data with txHash');
    console.log('   - Update your claim record with the blockchain hash');
    console.log('   - Show the user their claim is on-chain');
    console.log('');

    console.log('🔍 Test your webhook:');
    console.log(`   curl -X HEAD ${webhookEndpoint}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
    if (error.response?.data) {
      console.error('   Circle API Error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupWebhook();
