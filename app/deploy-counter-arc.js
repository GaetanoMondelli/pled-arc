/**
 * Deploy Counter contract to Arc using Circle Smart Contract Platform SDK
 */

import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import * as path from 'path';
import solc from 'solc';
import fs from 'fs';

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

async function deployCounter() {
  console.log('\n🚀 Deploying Counter Contract to ARC-TESTNET using Circle SCP\n');
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
      }
    });
  }

  const contract = output.contracts['Counter.sol'].Counter;
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully\n');
  console.log(`   Bytecode length: ${bytecode.length} characters\n`);

  // Generate entity secret ciphertext
  console.log('3️⃣  Generating entity secret ciphertext...\n');
  const ciphertext = await walletClient.generateEntitySecretCiphertext();

  // Deploy contract
  console.log('4️⃣  Deploying to ARC-TESTNET...\n');

  const deployment = await scpClient.deployContract({
    name: 'Counter',
    description: 'Simple counter contract for Arc hackathon',
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
    entitySecretCiphertext: ciphertext
  });

  console.log('✅ Deployment initiated!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Deployment Details:');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Contract ID:', deployment.data?.id);
  console.log('Transaction ID:', deployment.data?.transactionId);
  console.log('\n💡 Use this contract address in your frontend!\n');

  return deployment.data;
}

deployCounter().catch(console.error);
