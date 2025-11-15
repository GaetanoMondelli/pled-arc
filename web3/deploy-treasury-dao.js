/**
 * Deploy TreasuryDAO contract to Arc using Circle Smart Contract Platform SDK
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

dotenv.config({ path: path.join(__dirname, '../app/.env') });

async function deployTreasuryDAO() {
  console.log('\n🚀 Deploying TreasuryDAO Contract to ARC-TESTNET using Circle SCP\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
  }

  console.log('Using API Key:', apiKey.substring(0, 20) + '...\n');

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

  // Read OpenZeppelin dependencies and TreasuryDAOPermissionless
  console.log('2️⃣  Reading contract sources...\n');

  const treasurySource = fs.readFileSync(
    path.join(__dirname, 'contracts/TreasuryDAOPermissionless.sol'),
    'utf8'
  );

  // Read OpenZeppelin contracts (only ReentrancyGuard and IERC20 needed for permissionless version)
  const reentrancyGuardSource = fs.readFileSync(
    path.join(__dirname, 'node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol'),
    'utf8'
  );

  const ierc20Source = fs.readFileSync(
    path.join(__dirname, 'node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol'),
    'utf8'
  );

  // Compile contracts
  console.log('3️⃣  Compiling contracts...\n');

  const input = {
    language: 'Solidity',
    sources: {
      'TreasuryDAOPermissionless.sol': {
        content: treasurySource
      },
      '@openzeppelin/contracts/utils/ReentrancyGuard.sol': {
        content: reentrancyGuardSource
      },
      '@openzeppelin/contracts/token/ERC20/IERC20.sol': {
        content: ierc20Source
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

  const contract = output.contracts['TreasuryDAOPermissionless.sol'].TreasuryDAOPermissionless;
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully\n');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Generate entity secret ciphertext
  console.log('4️⃣  Generating entity secret ciphertext...\n');
  const ciphertext = await walletClient.generateEntitySecretCiphertext();

  // USDC address on Arc Testnet
  const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

  // Encode constructor parameters
  const constructorParams = [USDC_ADDRESS];
  console.log('Constructor params:', constructorParams);

  // Deploy contract
  console.log('5️⃣  Deploying to ARC-TESTNET...\n');

  const deployment = await scpClient.deployContract({
    name: 'TreasuryDAOPermissionless',
    description: 'PERMISSIONLESS Share-based DAO treasury for Web3 Scion - Circle Arc Hackathon (NO ACCESS CONTROL)',
    walletId: arcWallet.id,
    blockchain: 'ARC-TESTNET',
    fee: {
      type: 'level',
      config: {
        feeLevel: 'MEDIUM'
      }
    },
    abiJson: JSON.stringify(abi),
    bytecode: `0x${bytecode}`,
    constructorParameters: constructorParams,
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
      console.log('Contract Address:', contractData.address);
      console.log('Deployer:', arcWallet.address);
      console.log('Blockchain:', contractData.blockchain);
      console.log('═══════════════════════════════════════════════════════\n');

      // Now initialize shares
      console.log('6️⃣  Initializing officer shares...\n');

      // Get all wallets to find Arc ones for officers
      const allWallets = wallets.data?.wallets || [];
      const arcWallets = allWallets.filter(w => w.blockchain === 'ARC-TESTNET' && w.accountType === 'EOA');

      const michaelBurry = arcWallets[0]?.address || '0x5a79daf48e3b02e62bdaf8554b50083617f4a359';
      const richardBranson = arcWallets[1]?.address || '0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37';

      console.log('Michael Burry (60%):', michaelBurry);
      console.log('Richard Branson (40%):', richardBranson);
      console.log();

      // Execute initializeShares function
      const initSharesTx = await scpClient.executeSmartContractFunction({
        walletId: arcWallet.id,
        contractAddress: contractData.address,
        abiFunctionSignature: 'initializeShares(address[],uint256[])',
        abiParameters: [
          [michaelBurry, richardBranson],
          [60, 40]
        ],
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM'
          }
        },
        entitySecretCiphertext: ciphertext
      });

      console.log('✅ Shares initialization transaction sent!');
      console.log('Transaction ID:', initSharesTx.data?.transactionId);
      console.log();

      console.log('\n🎉 DEPLOYMENT COMPLETE!\n');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(`🔗 View on explorer: https://testnet.arcscan.app/address/${contractData.address}\n`);
      console.log(`📝 Update your .env file:\nNEXT_PUBLIC_TREASURY_DAO_ADDRESS=${contractData.address}\n`);
      console.log('Officer Shares:');
      console.log(`- Michael Burry: 60% (${michaelBurry})`);
      console.log(`- Richard Branson: 40% (${richardBranson})`);
      console.log();
      console.log('Next steps:');
      console.log('1. Fund the treasury with USDC');
      console.log('2. Test profit distribution');
      console.log('3. Integrate with DAO House claims\n');

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

deployTreasuryDAO().catch(console.error);
