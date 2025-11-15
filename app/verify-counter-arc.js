/**
 * Verify Counter contract on Arc testnet block explorer
 */

import axios from 'axios';
import solc from 'solc';

const CONTRACT_ADDRESS = '0xB070f8E15B34333A70C9Ac3158363a1d8667e617';
const COMPILER_VERSION = 'v0.8.28+commit.7893614a';

// Contract source
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

async function verifyContract() {
  console.log('\n🔍 Verifying Counter Contract on Arc Testnet\n');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Contract Address:', CONTRACT_ADDRESS);
  console.log('Compiler Version:', COMPILER_VERSION);
  console.log('\nBlock Explorer:', `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}\n`);
  
  // Compile to get ABI
  console.log('📝 Compiling contract...\n');
  
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
  const contract = output.contracts['Counter.sol'].Counter;
  const abi = contract.abi;

  console.log('✅ Contract compiled\n');
  console.log('📋 Contract ABI:');
  console.log(JSON.stringify(abi, null, 2));
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n💡 To verify on Arc testnet block explorer:');
  console.log('\n1. Go to:', `https://testnet.arcscan.app/address/${CONTRACT_ADDRESS}#code`);
  console.log('\n2. Click "Verify & Publish"');
  console.log('\n3. Fill in:');
  console.log('   - Compiler Type: Solidity (Single file)');
  console.log('   - Compiler Version:', COMPILER_VERSION);
  console.log('   - License: UNLICENSED');
  console.log('   - Optimization: No');
  console.log('\n4. Paste this source code:\n');
  console.log('─────────────────────────────────────────────────────');
  console.log(contractSource.trim());
  console.log('─────────────────────────────────────────────────────');
  console.log('\n5. Click "Verify and Publish"\n');
}

verifyContract().catch(console.error);
