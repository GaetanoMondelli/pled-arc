/**
 * Deploy CarbonCreditReward contract to Arc using Viem
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';
import solc from 'solc';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../app/.env') });

// Define Arc Testnet chain
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Arc',
    symbol: 'ARC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
});

// Arc Testnet USDC address (native USDC)
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

async function deployCarbonCreditReward() {
  console.log('\n🌱 Deploying CarbonCreditReward Contract to ARC-TESTNET\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const privateKey = process.env.ARC_TESTNET_PRIVATE_KEY;
  const claimContractAddress = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS;

  if (!privateKey) {
    throw new Error('Missing ARC_TESTNET_PRIVATE_KEY in .env');
  }

  if (!claimContractAddress) {
    throw new Error('Missing NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS - deploy IncrementalVerifiableClaim first');
  }

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}`);

  console.log('Deployer Address:', account.address);
  console.log('Claim Contract:', claimContractAddress);
  console.log('USDC Address:', ARC_USDC_ADDRESS);
  console.log('');

  // Create clients
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Read contract sources
  console.log('1️⃣  Reading contract sources...\n');

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
  console.log('2️⃣  Compiling contracts...\n');

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
  const bytecode = `0x${contract.evm.bytecode.object}`;

  console.log('✅ Contract compiled successfully\n');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Deploy contract
  console.log('3️⃣  Deploying to ARC-TESTNET...\n');

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [ARC_USDC_ADDRESS, claimContractAddress],
  });

  console.log(`   Deploy TX: ${hash}\n`);
  console.log('   Waiting for confirmation...\n');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log('✅ CONTRACT DEPLOYED SUCCESSFULLY!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌱 Carbon Credit Reward Fund');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Contract Address:', receipt.contractAddress);
  console.log('Deployer:', account.address);
  console.log('Transaction Hash:', hash);
  console.log('Block Number:', receipt.blockNumber);
  console.log('Gas Used:', receipt.gasUsed.toString());
  console.log('USDC Address:', ARC_USDC_ADDRESS);
  console.log('Claim Contract:', claimContractAddress);
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`🔗 View on explorer: https://testnet.arcscan.app/address/${receipt.contractAddress}\n`);
  console.log(`📝 Update your .env file:`);
  console.log(`NEXT_PUBLIC_CARBON_CREDIT_REWARD_ADDRESS=${receipt.contractAddress}\n`);
  console.log('\n💡 Next steps:');
  console.log('   1. Add to .env: NEXT_PUBLIC_CARBON_CREDIT_REWARD_ADDRESS=' + receipt.contractAddress);
  console.log('   2. Fund the escrow with USDC using fundEscrow()');
  console.log('   3. Mint verifiable claims with IncrementalVerifiableClaim');
  console.log('   4. Claim rewards using claimReward(tokenId)');
  console.log('   5. Run: node test-carbon-credit-reward.js\n');

  return receipt.contractAddress;
}

deployCarbonCreditReward().catch(console.error);
