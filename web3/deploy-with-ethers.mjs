/**
 * Deploy IncrementalVerifiableClaim using ethers.js
 * This allows ANY wallet to mint claims (no onlyDeployer restriction)
 */

import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deploy() {
  console.log('\n🚀 Deploying IncrementalVerifiableClaim to Arc Testnet\n');
  console.log('═'.repeat(60));
  console.log('');

  // Connect to Arc Testnet
  const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');

  // Private key from env (the one that was used before)
  const privateKey = '0x52cf5dca72301d3069035a60ead072454a8c80db2873ea0ed08c607a56fe0f3d';
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('📋 Deployment Details:');
  console.log('   Network: Arc Testnet (Chain ID: 5042002)');
  console.log('   RPC: https://rpc.testnet.arc.network');
  console.log('   Deployer:', wallet.address);
  console.log('');

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error('Deployer wallet has no ETH! Fund it first.');
  }

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

  // Deploy
  console.log('🚀 Deploying contract...\n');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deploymentTx = await factory.deploy();

  console.log('⏳ Waiting for deployment...');
  console.log(`   Transaction hash: ${deploymentTx.deploymentTransaction().hash}\n`);

  await deploymentTx.waitForDeployment();

  const contractAddress = await deploymentTx.getAddress();

  console.log('✅ CONTRACT DEPLOYED!\n');
  console.log('═'.repeat(60));
  console.log('Contract Address:', contractAddress);
  console.log('Deployer:', wallet.address);
  console.log('TxHash:', deploymentTx.deploymentTransaction().hash);
  console.log('═'.repeat(60));
  console.log('');
  console.log(`🔗 View on explorer: https://testnet.arcscan.app/address/${contractAddress}\n`);
  console.log(`📝 Update your .env file:`);
  console.log(`NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS=${contractAddress}\n`);
  console.log('');
  console.log('✅ Now ANY wallet (including Circle SDK wallets) can mint claims!\n');
}

deploy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  });
