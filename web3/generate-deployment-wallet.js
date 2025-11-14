/**
 * Generate a new EOA wallet for deploying contracts
 */

import { Wallet } from 'ethers';

console.log('\n🔑 Generating Deployment Wallet for Arc Testnet\n');
console.log('═══════════════════════════════════════════════════════\n');

const wallet = Wallet.createRandom();

console.log('✅ New Wallet Generated!\n');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);

console.log('\n═══════════════════════════════════════════════════════');
console.log('\n📋 NEXT STEPS:\n');
console.log('1. Add to web3/.env.local:');
console.log(`   ARC_TESTNET_PRIVATE_KEY=${wallet.privateKey}`);
console.log('\n2. Fund this address with Arc testnet ETH:');
console.log(`   Address: ${wallet.address}`);
console.log('   Amount needed: ~0.1 ETH (for gas fees)');
console.log('\n3. Deploy contract:');
console.log('   cd web3');
console.log('   npx hardhat ignition deploy ignition/modules/Counter.ts --network arcTestnet');
console.log('\n⚠️  SAVE THE PRIVATE KEY SECURELY!\n');
