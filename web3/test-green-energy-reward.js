/**
 * Test script for GreenEnergyReward contract on Arc Testnet
 *
 * This script demonstrates the full workflow:
 * 1. Connect to deployed contracts
 * 2. Fund the escrow with USDC
 * 3. Mint a test claim
 * 4. Calculate and claim the reward
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

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

// Contract addresses
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const CLAIM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS;
const REWARD_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GREEN_ENERGY_REWARD_ADDRESS;
const PRIVATE_KEY = process.env.ARC_TESTNET_PRIVATE_KEY;

// ABIs
const USDC_ABI = [
  {
    "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const REWARD_ABI = [
  {
    "inputs": [{"name": "amount", "type": "uint256"}],
    "name": "fundEscrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "claimReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "calculateReward",
    "outputs": [
      {"name": "claimValue", "type": "uint256"},
      {"name": "rewardAmount", "type": "uint256"},
      {"name": "canClaim", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getEscrowBalance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "isRewardClaimed",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalRewardsDistributed",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalClaimsRewarded",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const CLAIM_ABI = [
  {
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "claimId", "type": "string"},
      {"name": "workflowId", "type": "string"},
      {"name": "executionId", "type": "string"},
      {"name": "initialLedgerEvents", "type": "bytes32[]"},
      {"name": "initialSinkEvents", "type": "bytes32[]"},
      {"name": "aggregateValue", "type": "string"},
      {"name": "metadataUri", "type": "string"}
    ],
    "name": "mintClaim",
    "outputs": [{"name": "tokenId", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "getClaimMetadata",
    "outputs": [
      {"name": "claimId", "type": "string"},
      {"name": "workflowId", "type": "string"},
      {"name": "executionId", "type": "string"},
      {"name": "aggregateValue", "type": "string"},
      {"name": "metadataUri", "type": "string"},
      {"name": "createdAt", "type": "uint256"},
      {"name": "lastUpdatedAt", "type": "uint256"},
      {"name": "owner", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function testGreenEnergyReward() {
  console.log('\n🧪 Testing GreenEnergyReward Contract on Arc Testnet\n');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!PRIVATE_KEY) {
    throw new Error('Missing ARC_TESTNET_PRIVATE_KEY in .env');
  }

  if (!CLAIM_CONTRACT_ADDRESS) {
    throw new Error('Missing NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS in .env');
  }

  if (!REWARD_CONTRACT_ADDRESS) {
    throw new Error('Missing NEXT_PUBLIC_GREEN_ENERGY_REWARD_ADDRESS in .env - deploy contract first');
  }

  const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace('0x', '')}`);

  console.log('Test Account:', account.address);
  console.log('Claim Contract:', CLAIM_CONTRACT_ADDRESS);
  console.log('Reward Contract:', REWARD_CONTRACT_ADDRESS);
  console.log('USDC Contract:', ARC_USDC_ADDRESS);
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

  // Step 1: Check USDC balance
  console.log('1️⃣  Checking USDC balance...\n');
  const usdcBalance = await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`   Your USDC balance: ${formatUnits(usdcBalance, 6)} USDC\n`);

  if (usdcBalance === 0n) {
    console.warn('⚠️  You need USDC to fund the escrow. Request testnet tokens first.\n');
  }

  // Step 2: Check escrow balance
  console.log('2️⃣  Checking escrow balance...\n');
  const escrowBalance = await publicClient.readContract({
    address: REWARD_CONTRACT_ADDRESS,
    abi: REWARD_ABI,
    functionName: 'getEscrowBalance',
  });

  console.log(`   Escrow balance: ${formatUnits(escrowBalance, 6)} USDC\n`);

  // Step 3: Fund escrow if needed
  if (escrowBalance < parseUnits('1', 6) && usdcBalance > parseUnits('1', 6)) {
    console.log('3️⃣  Funding escrow with 1 USDC...\n');

    // First approve
    const approveTx = await walletClient.writeContract({
      address: ARC_USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [REWARD_CONTRACT_ADDRESS, parseUnits('1', 6)],
    });

    console.log(`   Approve TX: ${approveTx}`);
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('   ✅ Approved\n');

    // Fund escrow
    const fundTx = await walletClient.writeContract({
      address: REWARD_CONTRACT_ADDRESS,
      abi: REWARD_ABI,
      functionName: 'fundEscrow',
      args: [parseUnits('1', 6)],
    });

    console.log(`   Fund TX: ${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log('   ✅ Escrow funded\n');

    // Check new balance
    const newBalance = await publicClient.readContract({
      address: REWARD_CONTRACT_ADDRESS,
      abi: REWARD_ABI,
      functionName: 'getEscrowBalance',
    });

    console.log(`   New escrow balance: ${formatUnits(newBalance, 6)} USDC\n`);
  } else {
    console.log('3️⃣  Escrow already funded, skipping...\n');
  }

  // Step 4: Mint a test claim (claim value = 32 → reward = 0.32 USDC)
  console.log('4️⃣  Minting test claim (value: 32)...\n');

  const testClaimId = `test-claim-${Date.now()}`;
  const testClaimValue = 32;
  const eventHash = `0x${Buffer.from('test-event-data').toString('hex').padEnd(64, '0')}`;

  try {
    const mintTx = await walletClient.writeContract({
      address: CLAIM_CONTRACT_ADDRESS,
      abi: CLAIM_ABI,
      functionName: 'mintClaim',
      args: [
        account.address,
        testClaimId,
        'green-energy-workflow',
        'test-execution-001',
        [eventHash], // initialLedgerEvents
        [eventHash], // initialSinkEvents
        JSON.stringify({ value: testClaimValue, unit: 'carbon-credits' }), // aggregateValue
        'ipfs://test-metadata' // metadataUri
      ],
    });

    console.log(`   Mint TX: ${mintTx}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
    console.log('   ✅ Claim minted\n');

    // Calculate token ID (same way as contract: keccak256(abi.encodePacked(claimId)))
    const { keccak256, toHex } = await import('viem');
    const tokenId = BigInt(keccak256(toHex(testClaimId)));
    console.log(`   Token ID: ${tokenId}\n`);

    // Step 5: Calculate reward
    console.log('5️⃣  Calculating reward...\n');

    const [claimValue, rewardAmount, canClaim] = await publicClient.readContract({
      address: REWARD_CONTRACT_ADDRESS,
      abi: REWARD_ABI,
      functionName: 'calculateReward',
      args: [tokenId],
    });

    console.log(`   Claim Value: ${claimValue}`);
    console.log(`   Reward Amount: ${formatUnits(rewardAmount, 6)} USDC`);
    console.log(`   Can Claim: ${canClaim}\n`);

    // Step 6: Claim reward
    if (canClaim) {
      console.log('6️⃣  Claiming reward...\n');

      const beforeBalance = await publicClient.readContract({
        address: ARC_USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });

      const claimTx = await walletClient.writeContract({
        address: REWARD_CONTRACT_ADDRESS,
        abi: REWARD_ABI,
        functionName: 'claimReward',
        args: [tokenId],
      });

      console.log(`   Claim TX: ${claimTx}`);
      await publicClient.waitForTransactionReceipt({ hash: claimTx });
      console.log('   ✅ Reward claimed\n');

      const afterBalance = await publicClient.readContract({
        address: ARC_USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });

      console.log(`   Balance before: ${formatUnits(beforeBalance, 6)} USDC`);
      console.log(`   Balance after: ${formatUnits(afterBalance, 6)} USDC`);
      console.log(`   Received: ${formatUnits(afterBalance - beforeBalance, 6)} USDC\n`);
    } else {
      console.log('⚠️  Cannot claim reward (insufficient escrow balance or already claimed)\n');
    }

    // Step 7: Check statistics
    console.log('7️⃣  Contract Statistics\n');

    const totalDistributed = await publicClient.readContract({
      address: REWARD_CONTRACT_ADDRESS,
      abi: REWARD_ABI,
      functionName: 'totalRewardsDistributed',
    });

    const totalClaims = await publicClient.readContract({
      address: REWARD_CONTRACT_ADDRESS,
      abi: REWARD_ABI,
      functionName: 'totalClaimsRewarded',
    });

    console.log(`   Total Rewards Distributed: ${formatUnits(totalDistributed, 6)} USDC`);
    console.log(`   Total Claims Rewarded: ${totalClaims}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ All tests completed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    throw error;
  }
}

testGreenEnergyReward().catch(console.error);
