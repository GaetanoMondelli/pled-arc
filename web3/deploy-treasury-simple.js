/**
 * Simple deployment script for TreasuryDAOPermissionless using viem
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define Arc Testnet chain
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ARC',
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
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

async function main() {
  console.log('\n🚀 Deploying TreasuryDAOPermissionless to Arc Testnet\n');
  console.log('═'.repeat(60));

  // Get private key from environment
  const privateKey = process.env.ARC_TESTNET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('ARC_TESTNET_PRIVATE_KEY not set');
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey);
  console.log('Deployer address:', account.address);

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

  // Read and compile contract
  console.log('\n1️⃣  Compiling contract...\n');

  const treasurySource = fs.readFileSync(
    path.join(__dirname, 'contracts/TreasuryDAOPermissionless.sol'),
    'utf8'
  );

  const reentrancyGuardSource = fs.readFileSync(
    path.join(__dirname, 'node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol'),
    'utf8'
  );

  const ierc20Source = fs.readFileSync(
    path.join(__dirname, 'node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol'),
    'utf8'
  );

  const input = {
    language: 'Solidity',
    sources: {
      'TreasuryDAOPermissionless.sol': { content: treasurySource },
      '@openzeppelin/contracts/utils/ReentrancyGuard.sol': { content: reentrancyGuardSource },
      '@openzeppelin/contracts/token/ERC20/IERC20.sol': { content: ierc20Source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const hasErrors = output.errors.some(err => err.severity === 'error');
    if (hasErrors) {
      output.errors.forEach(err => console.error('❌', err.formattedMessage));
      throw new Error('Compilation failed');
    }
  }

  const contract = output.contracts['TreasuryDAOPermissionless.sol'].TreasuryDAOPermissionless;
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Deploy contract
  console.log('2️⃣  Deploying contract...\n');

  const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
  console.log('   USDC address:', USDC_ADDRESS);

  // Encode constructor
  const encodedConstructor = abi.find(item => item.type === 'constructor');

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [USDC_ADDRESS],
  });

  console.log('   Transaction hash:', hash);
  console.log('   Waiting for confirmation...\n');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'reverted') {
    throw new Error('Contract deployment failed');
  }

  const contractAddress = receipt.contractAddress;
  console.log('✅ Contract deployed at:', contractAddress);

  // Initialize shares
  console.log('\n3️⃣  Initializing shares...\n');

  const michaelBurry = '0x5a79daf48e3b02e62bdaf8554b50083617f4a359';
  const richardBranson = '0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37';
  const cathieWood = '0x3c4b268b88ca7374e2f597b6627011225263d8b4';

  console.log('   Michael Burry:', michaelBurry, '- 50 shares (50%)');
  console.log('   Richard Branson:', richardBranson, '- 30 shares (30%)');
  console.log('   Cathie Wood:', cathieWood, '- 20 shares (20%)\n');

  const initHash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: 'initializeShares',
    args: [
      [michaelBurry, richardBranson, cathieWood],
      [50n, 30n, 20n],
    ],
  });

  console.log('   Transaction hash:', initHash);
  console.log('   Waiting for confirmation...\n');

  await publicClient.waitForTransactionReceipt({ hash: initHash });

  console.log('✅ Shares initialized!\n');

  // Verify shares
  console.log('4️⃣  Verifying shares...\n');

  const totalShares = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'totalShares',
  });

  const [addresses, sharesArray] = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'getAllOfficers',
  });

  console.log('   Total shares:', totalShares.toString());
  console.log('\n   Officer allocations:');
  for (let i = 0; i < addresses.length; i++) {
    const percentage = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: 'getSharePercentage',
      args: [addresses[i]],
    });
    console.log(`   - ${addresses[i]}: ${sharesArray[i]} shares (${Number(percentage) / 100}%)`);
  }

  console.log('\n═'.repeat(60));
  console.log('✅ DEPLOYMENT COMPLETE!\n');
  console.log('Contract address:', contractAddress);
  console.log('Explorer:', `https://testnet.arcscan.app/address/${contractAddress}`);
  console.log('\nNext steps:');
  console.log('1. Update .env.local with:');
  console.log(`   NEXT_PUBLIC_TREASURY_DAO_ADDRESS=${contractAddress}`);
  console.log('2. Fund the treasury with USDC');
  console.log('3. Test the DAO House integration\n');

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
