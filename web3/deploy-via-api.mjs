/**
 * Deploy contract using Circle REST API directly
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';
import { config } from 'dotenv';
import crypto from 'crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../app/.env') });

async function deploy() {
  console.log('\n🚀 Deploying via Circle REST API\n');
  console.log('═'.repeat(60));

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  // Initialize SDK client
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  // Get wallet
  const walletsResponse = await client.listWallets({ blockchain: 'ARC-TESTNET' });
  const arcWallet = walletsResponse.data.wallets[0];

  console.log('📋 Using wallet:', arcWallet.address);
  console.log('   Wallet ID:', arcWallet.id);
  console.log('');

  // Compile contract
  console.log('🔨 Compiling contract...\n');

  const merkleTreeSource = readFileSync(join(__dirname, 'contracts/IncrementalMerkleTree.sol'), 'utf8');
  const claimContractSource = readFileSync(join(__dirname, 'contracts/IncrementalVerifiableClaim.sol'), 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'IncrementalMerkleTree.sol': { content: merkleTreeSource },
      'IncrementalVerifiableClaim.sol': { content: claimContractSource }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some(err => err.severity === 'error')) {
    output.errors.forEach(err => console.error(err.formattedMessage));
    throw new Error('Compilation failed');
  }

  const contract = output.contracts['IncrementalVerifiableClaim.sol'].IncrementalVerifiableClaim;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Compiled! Bytecode length:', bytecode.length, 'chars\n');

  // Generate entitySecretCiphertext using SDK
  console.log('🔐 Generating entity secret ciphertext...\n');

  const entitySecretCiphertext = await client.generateEntitySecretCiphertext();

  console.log('✅ Got ciphertext\n');

  // Deploy via Smart Contract Platform API
  console.log('🚀 Deploying contract via /contracts/deploy...\n');

  const deployResponse = await fetch('https://api.circle.com/v1/w3s/contracts/deploy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'IncrementalVerifiableClaim',
      description: 'IncrementalVerifiableClaimContract',
      walletId: arcWallet.id,
      blockchain: 'ARC-TESTNET',
      abiJson: JSON.stringify(contract.abi),
      bytecode: `0x${bytecode}`,
      constructorParameters: [],
      entitySecretCiphertext,
      feeLevel: 'MEDIUM',
      idempotencyKey: crypto.randomUUID()
    })
  });

  const deployData = await deployResponse.json();

  if (!deployResponse.ok) {
    console.error('❌ API Error:', JSON.stringify(deployData, null, 2));
    throw new Error('Deployment failed');
  }

  console.log('✅ Deployment initiated!');
  console.log('   Contract ID:', deployData.data.contractId);
  console.log('   Transaction ID:', deployData.data.transactionId);
  console.log('');

  // Poll for contract deployment status
  console.log('⏳ Polling for contract address...\n');

  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const contractResponse = await fetch(`https://api.circle.com/v1/w3s/contracts/${deployData.data.contractId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const contractData = await contractResponse.json();
    const contractInfo = contractData.data.contract;

    console.log(`   [${i + 1}] Status: ${contractInfo.status}${contractInfo.contractAddress ? `, Address: ${contractInfo.contractAddress}` : ''}`);

    if (contractInfo.status === 'COMPLETE' && contractInfo.contractAddress) {
      console.log('\n✅ CONTRACT DEPLOYED!\n');
      console.log('═'.repeat(60));
      console.log('Contract:', contractInfo.contractAddress);
      console.log('Deployer:', arcWallet.address);
      console.log('TxHash:', contractInfo.txHash);
      console.log('═'.repeat(60));
      console.log('');
      console.log(`🔗 Explorer: https://testnet.arcscan.app/address/${contractInfo.contractAddress}\n`);
      console.log(`📝 Update .env:\nNEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS=${contractInfo.contractAddress}\n`);
      return;
    }

    if (contractInfo.status === 'FAILED') {
      console.error('\n❌ Failed:', contractInfo.deploymentErrorReason || contractInfo.deploymentErrorDetails);
      throw new Error('Deployment failed');
    }
  }

  console.warn('\n⚠️ Timeout');
}

deploy().catch(console.error);
