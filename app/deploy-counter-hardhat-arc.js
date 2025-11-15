/**
 * Deploy Counter contract to Arc testnet using ethers.js directly
 */

import { ethers } from 'ethers';
import solc from 'solc';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Counter contract source
const contractSource = `
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Counter {
  uint public x;

  event Increment(uint by);

  function inc() public {
    x++;
    emit Increment(1);
  }

  function incBy(uint by) public {
    require(by > 0, "incBy: increment should be positive");
    x += by;
    emit Increment(by);
  }
}
`;

async function deployToArc() {
  console.log('\n🚀 Deploying Counter Contract to Arc Testnet (Direct)\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Arc testnet RPC and private key from web3/.env.local
  const ARC_RPC = 'https://rpc.testnet.arc.network';
  const PRIVATE_KEY = '0x52cf5dca72301d3069035a60ead072454a8c80db2873ea0ed08c607a56fe0f3d';

  // Connect to Arc testnet
  console.log('1️⃣  Connecting to Arc testnet RPC...\n');
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`✅ Connected! Deploying from: ${wallet.address}\n`);

  // Check balance (Arc testnet may be gas-free!)
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`   (Arc testnet may be gas-free, attempting deployment...)\n`);

  // Compile contract
  console.log('2️⃣  Compiling Counter contract...\n');

  const input = {
    language: 'Solidity',
    sources: {
      'Counter.sol': {
        content: contractSource
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    output.errors.forEach(err => {
      if (err.severity === 'error') {
        console.error('Compilation error:', err.formattedMessage);
        throw new Error('Compilation failed');
      }
    });
  }

  const contract = output.contracts['Counter.sol'].Counter;
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully\n');

  // Deploy contract
  console.log('3️⃣  Deploying to Arc testnet...\n');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  const deployTx = await factory.deploy();
  console.log('⏳ Transaction sent:', deployTx.deploymentTransaction().hash);
  console.log('   Waiting for confirmation...\n');

  await deployTx.waitForDeployment();

  const contractAddress = await deployTx.getAddress();

  console.log('✅ Contract deployed!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Deployment Details:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Contract Address:', contractAddress);
  console.log('Transaction Hash:', deployTx.deploymentTransaction().hash);
  console.log('Block Explorer:', `https://testnet.arcscan.app/address/${contractAddress}`);
  console.log('\n💡 Use this contract address in your Circle SDK frontend!\n');

  return {
    address: contractAddress,
    abi: abi
  };
}

deployToArc().catch(console.error);
