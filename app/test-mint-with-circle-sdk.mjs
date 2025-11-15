/**
 * Test minting a claim using Circle SDK
 * This simulates what the webapp does when tokenizing a claim
 */

import { config } from 'dotenv';
import crypto from 'crypto';

config({ path: '../app/.env' });

const CONTRACT_ADDRESS = '0xeFa0243540BdBDC0Bf27Ab2f2E3111e9EA059Ffa';

async function main() {
  console.log('🧪 Testing Claim Minting via Circle SDK');
  console.log('━'.repeat(60));
  console.log('');

  // Check environment variables
  const apiKey = process.env.CIRCLE_API_KEY;
  const sdkApiKey = process.env.CIRCLE_SDK_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !sdkApiKey || !entitySecret) {
    console.error('❌ Missing Circle credentials in app/.env:');
    console.error('  CIRCLE_API_KEY:', !!apiKey);
    console.error('  CIRCLE_SDK_API_KEY:', !!sdkApiKey);
    console.error('  CIRCLE_ENTITY_SECRET:', !!entitySecret);
    process.exit(1);
  }

  console.log('✅ Circle credentials loaded');
  console.log('');

  // Import Circle SDK
  const { initiateDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets');

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: sdkApiKey,
    entitySecret: entitySecret,
  });

  console.log('✅ Circle SDK client initialized');
  console.log('');

  // List wallets to find an Arc testnet wallet
  console.log('📋 Fetching Arc Testnet wallets...');
  const walletsResponse = await client.listWallets({
    blockchain: 'ARC-TESTNET',
  });

  const wallets = walletsResponse.data?.wallets || [];
  console.log(`   Found ${wallets.length} Arc Testnet wallet(s)`);

  if (wallets.length === 0) {
    console.error('❌ No Arc Testnet wallets found!');
    console.log('');
    console.log('Create one first by running:');
    console.log('  node create-arc-wallet.js');
    process.exit(1);
  }

  const wallet = wallets[0];
  console.log(`   Using wallet: ${wallet.address}`);
  console.log(`   Wallet ID: ${wallet.id}`);
  console.log('');

  // Create test claim data
  const testOwner = wallet.address;
  const testClaimId = 'test-claim-' + Date.now();
  const testWorkflowId = 'workflow-test';
  const testExecutionId = 'execution-test';

  // Create test merkle tree hashes (simulating ledger and sink events)
  // These would normally come from hashing the actual events
  const testLedgerHashes = [
    '0x' + crypto.randomBytes(32).toString('hex'),
    '0x' + crypto.randomBytes(32).toString('hex'),
  ];
  const testSinkHashes = [
    '0x' + crypto.randomBytes(32).toString('hex'),
  ];

  const testAggregateValue = JSON.stringify({ total: 42, verified: true });
  const testMetadataUri = 'ipfs://QmTest' + Date.now();

  console.log('🔨 Preparing to mint claim...');
  console.log('   Owner:', testOwner);
  console.log('   Claim ID:', testClaimId);
  console.log('   Workflow ID:', testWorkflowId);
  console.log('   Execution ID:', testExecutionId);
  console.log('   Ledger Events:', testLedgerHashes.length);
  console.log('   Sink Events:', testSinkHashes.length);
  console.log('   Metadata URI:', testMetadataUri);
  console.log('');

  // Execute contract via Circle SDK
  console.log('🚀 Calling Circle SDK to execute contract...');
  console.log('   Contract:', CONTRACT_ADDRESS);
  console.log('   Function: mintClaim(address,string,string,string,bytes32[],bytes32[],string,string)');
  console.log('');

  try {
    const transaction = await client.createContractExecutionTransaction({
      walletId: wallet.id,
      contractAddress: CONTRACT_ADDRESS,
      abiFunctionSignature: 'mintClaim(address,string,string,string,bytes32[],bytes32[],string,string)',
      abiParameters: [
        testOwner,
        testClaimId,
        testWorkflowId,
        testExecutionId,
        testLedgerHashes,
        testSinkHashes,
        testAggregateValue,
        testMetadataUri,
      ],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM'
        }
      },
      idempotencyKey: crypto.randomUUID()
    });

    console.log('✅ Transaction created!');
    console.log('');
    console.log('📋 Transaction Details:');
    console.log('   ID:', transaction.data?.id);
    console.log('   State:', transaction.data?.state);
    console.log('   TxHash:', transaction.data?.txHash || 'Pending (will be set when broadcasted)');
    console.log('   Created:', transaction.data?.createDate);
    console.log('');

    if (transaction.data?.txHash) {
      console.log('🔗 View on Arc Explorer:');
      console.log('   https://testnet.arcscan.app/tx/' + transaction.data.txHash);
    } else {
      console.log('⏳ Transaction is being processed by Circle...');
      console.log('   Check status later with transaction ID: ' + transaction.data?.id);
      console.log('');
      console.log('   The txHash will be available once Circle broadcasts the transaction.');
      console.log('   This usually takes a few seconds to a minute.');
    }

    console.log('');
    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ ERROR executing contract:', error.message);
    if (error.response?.data) {
      console.error('   Circle API Error:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  });
