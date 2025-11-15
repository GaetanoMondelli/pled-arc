/**
 * Deploy IncrementalVerifiableClaim contract via Circle SDK
 * This makes the Circle wallet the deployer, so it can call onlyDeployer functions
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../app/.env') });

async function deployContract() {
  console.log('\n🚀 Deploying IncrementalVerifiableClaim via Circle SDK\n');
  console.log('═'.repeat(60));
  console.log('');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
  }

  console.log('✅ Circle credentials loaded\n');

  // Initialize Circle SDK
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  // Get Arc Testnet wallet
  console.log('📋 Fetching Arc Testnet wallets...');
  const walletsResponse = await client.listWallets({ blockchain: 'ARC-TESTNET' });
  const wallets = walletsResponse.data?.wallets || [];

  if (wallets.length === 0) {
    throw new Error('No Arc Testnet wallets found!');
  }

  const wallet = wallets[0];
  console.log(`   Using wallet: ${wallet.address}`);
  console.log(`   Wallet ID: ${wallet.id}\n`);

  // Read and compile contracts
  console.log('📝 Reading contract sources...');
  const merkleTreeSource = readFileSync(join(__dirname, 'contracts/IncrementalMerkleTree.sol'), 'utf8');
  const claimContractSource = readFileSync(join(__dirname, 'contracts/IncrementalVerifiableClaim.sol'), 'utf8');

  console.log('🔨 Compiling contracts...\n');

  const input = {
    language: 'Solidity',
    sources: {
      'IncrementalMerkleTree.sol': { content: merkleTreeSource },
      'IncrementalVerifiableClaim.sol': { content: claimContractSource }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const hasErrors = output.errors.some(err => err.severity === 'error');
    output.errors.forEach(err => {
      if (err.severity === 'error') {
        console.error('❌ Compilation error:', err.formattedMessage);
      }
    });
    if (hasErrors) throw new Error('Contract compilation failed');
  }

  const contract = output.contracts['IncrementalVerifiableClaim.sol'].IncrementalVerifiableClaim;
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Deploy contract via Circle SDK
  // Contract deployment is done by sending a transaction to address 0x0 with bytecode as callData
  console.log('🚀 Deploying contract to Arc Testnet...\n');

  const deployment = await client.createContractExecutionTransaction({
    walletId: wallet.id,
    contractAddress: '0x0000000000000000000000000000000000000000', // Deploy to zero address
    callData: `0x${bytecode}`,
    fee: {
      type: 'level',
      config: { feeLevel: 'MEDIUM' }
    },
    idempotencyKey: crypto.randomUUID()
  });

  console.log('✅ Deployment transaction created!\n');
  console.log('═'.repeat(60));
  console.log('Transaction Details:');
  console.log('═'.repeat(60));
  console.log('  Transaction ID:', deployment.data?.id);
  console.log('  State:', deployment.data?.state);
  console.log('  Deployer Wallet:', wallet.address);
  console.log('');

  // Poll for contract address
  console.log('⏳ Waiting for deployment to complete...\n');

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    console.log(`   Checking status (attempt ${attempts}/${maxAttempts})...`);

    const txResponse = await client.getTransaction({ id: deployment.data?.id });
    const tx = txResponse.data?.transaction;

    console.log(`   State: ${tx?.state}`);

    if (tx?.state === 'COMPLETE') {
      // Contract address should be in the transaction response
      console.log('\n✅ CONTRACT DEPLOYED!\n');
      console.log('═'.repeat(60));
      console.log('Contract Address:', tx.contractAddress || 'Check transaction on explorer');
      console.log('Deployer:', wallet.address);
      console.log('TxHash:', tx.txHash);
      console.log('═'.repeat(60));
      console.log('');
      console.log(`🔗 View on explorer: https://testnet.arcscan.app/tx/${tx.txHash}\n`);
      console.log(`📝 Update your .env file:`);
      console.log(`NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS=${tx.contractAddress || 'CHECK_EXPLORER'}\n`);
      return tx;
    } else if (tx?.state === 'FAILED') {
      console.error('\n❌ Deployment failed!');
      console.error('Error:', tx.errorReason || tx.errorDetails || 'Unknown error');
      throw new Error('Contract deployment failed');
    }
  }

  console.warn('\n⚠️  Deployment timeout');
  console.log(`Transaction ID: ${deployment.data?.id}\n`);
}

deployContract()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error.message);
    if (error.response?.data) {
      console.error('Circle API Error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  });
