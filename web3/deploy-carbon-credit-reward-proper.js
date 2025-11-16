/**
 * Deploy CarbonCreditReward contract to Arc using Circle Smart Contract Platform SDK
 */

import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';
import solc from 'solc';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../app/.env.local') });

// Arc Testnet USDC address (native USDC)
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

async function deployCarbonCreditReward() {
  console.log('\n🌱 Deploying CarbonCreditReward Contract to ARC-TESTNET\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const claimContractAddress = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
  }

  if (!claimContractAddress) {
    throw new Error('Missing NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS - deploy IncrementalVerifiableClaim first');
  }

  console.log('Using API Key:', apiKey.substring(0, 20) + '...');
  console.log('Claim Contract:', claimContractAddress);
  console.log('USDC Address:', ARC_USDC_ADDRESS);
  console.log('');

  // Initialize SDKs
  const scpClient = initiateSmartContractPlatformClient({
    apiKey,
    entitySecret
  });

  const walletClient = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  // Get ARC-TESTNET wallet
  console.log('1️⃣  Finding ARC-TESTNET wallet...\n');
  const wallets = await walletClient.listWallets({});
  const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

  if (!arcWallet) {
    throw new Error('No ARC-TESTNET wallet found! Create one first.');
  }

  console.log(`✅ Using wallet: ${arcWallet.address}\n`);

  // Read contract sources
  console.log('2️⃣  Reading contract sources...\n');

  const merkleTreeSource = fs.readFileSync(
    path.join(__dirname, 'contracts/IncrementalMerkleTree.sol'),
    'utf8'
  );

  const claimContractSource = fs.readFileSync(
    path.join(__dirname, 'contracts/IncrementalVerifiableClaim.sol'),
    'utf8'
  );

  const carbonCreditSource = fs.readFileSync(
    path.join(__dirname, 'contracts/CarbonCreditReward.sol'),
    'utf8'
  );

  // Compile contracts
  console.log('3️⃣  Compiling contracts...\n');

  const input = {
    language: 'Solidity',
    sources: {
      'IncrementalMerkleTree.sol': {
        content: merkleTreeSource
      },
      'IncrementalVerifiableClaim.sol': {
        content: claimContractSource
      },
      'CarbonCreditReward.sol': {
        content: carbonCreditSource
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const hasErrors = output.errors.some(err => err.severity === 'error');
    output.errors.forEach(err => {
      if (err.severity === 'error') {
        console.error('❌ Compilation error:', err.formattedMessage);
      } else {
        console.warn('⚠️  Warning:', err.message);
      }
    });
    if (hasErrors) {
      throw new Error('Contract compilation failed');
    }
  }

  const contract = output.contracts['CarbonCreditReward.sol'].CarbonCreditReward;
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully\n');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Encode constructor arguments
  console.log('4️⃣  Encoding constructor arguments...\n');

  // Constructor takes (address _usdcAddress, address _claimContract)
  const abiCoder = {
    encode: (types, values) => {
      // Simple ABI encoding for two addresses
      const encoded = values.map(v => v.toLowerCase().replace('0x', '').padStart(64, '0')).join('');
      return encoded;
    }
  };

  const constructorArgs = abiCoder.encode(
    ['address', 'address'],
    [ARC_USDC_ADDRESS, claimContractAddress]
  );

  console.log(`   USDC: ${ARC_USDC_ADDRESS}`);
  console.log(`   Claim Contract: ${claimContractAddress}\n`);

  // Generate entity secret ciphertext
  console.log('5️⃣  Generating entity secret ciphertext...\n');
  const ciphertext = await walletClient.generateEntitySecretCiphertext();

  // Deploy contract
  console.log('6️⃣  Deploying to ARC-TESTNET...\n');

  const deployment = await scpClient.deployContract({
    name: 'CarbonCreditReward',
    description: 'Carbon Credit Fund Reward - Escrow for USDC rewards based on verifiable claims',
    walletId: arcWallet.id,
    blockchain: 'ARC-TESTNET',
    fee: {
      type: 'level',
      config: {
        feeLevel: 'MEDIUM'
      }
    },
    abiJson: JSON.stringify(abi),
    bytecode: `0x${bytecode}${constructorArgs}`,
    entitySecretCiphertext: ciphertext
  });

  console.log('✅ Deployment initiated!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Deployment Details:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Contract ID:', deployment.data?.id);
  console.log('Transaction ID:', deployment.data?.transactionId);
  console.log('Deployer Wallet:', arcWallet.address);
  console.log('\n💡 Waiting for deployment to complete...\n');

  // Poll for deployment status
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    console.log(`⏳ Checking deployment status (attempt ${attempts}/${maxAttempts})...`);

    const status = await scpClient.getContract({ id: deployment.data?.id });
    const contractData = status.data?.contract;

    console.log(`   Status: ${contractData?.deployStatus}`);

    if (contractData?.deployStatus === 'DEPLOYED') {
      console.log('\n✅ CONTRACT DEPLOYED SUCCESSFULLY!\n');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🌱 Carbon Credit Fund Reward');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log('Contract Address:', contractData.address);
      console.log('Deployer:', arcWallet.address);
      console.log('Blockchain:', contractData.blockchain);
      console.log('USDC Address:', ARC_USDC_ADDRESS);
      console.log('Claim Contract:', claimContractAddress);
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(`🔗 View on explorer: https://testnet.arcscan.app/address/${contractData.address}\n`);
      console.log(`📝 Update your .env.local file:`);
      console.log(`NEXT_PUBLIC_CARBON_CREDIT_REWARD_ADDRESS=${contractData.address}\n`);
      console.log('\n💡 Next steps:');
      console.log('   1. Fund the escrow with USDC using fundEscrow()');
      console.log('   2. Mint verifiable claims with IncrementalVerifiableClaim');
      console.log('   3. Claim rewards using claimReward(tokenId)\n');

      return contractData;
    } else if (contractData?.deployStatus === 'FAILED') {
      console.error('\n❌ Deployment failed!');
      console.error('Error:', contractData.deployError || 'Unknown error');
      throw new Error('Contract deployment failed');
    }
  }

  console.warn('\n⚠️  Deployment timeout - check status manually');
  console.log(`Contract ID: ${deployment.data?.id}\n`);
}

deployCarbonCreditReward().catch(console.error);
