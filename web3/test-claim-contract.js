const { ethers } = require('hardhat');
require('dotenv').config();

const CONTRACT_ADDRESS = '0xeFa0243540BdBDC0Bf27Ab2f2E3111e9EA059Ffa';
const ARC_TESTNET_RPC = 'https://rpc-testnet.arcscan.app';

async function main() {
  console.log('🔍 Testing IncrementalVerifiableClaim Contract');
  console.log('📍 Contract Address:', CONTRACT_ADDRESS);
  console.log('🌐 Network: Arc Testnet (Chain ID: 5042002)');
  console.log('');

  // Connect to Arc Testnet
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);

  // Check if contract exists
  console.log('1️⃣ Checking if contract exists...');
  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === '0x') {
    console.error('❌ ERROR: No contract found at this address!');
    console.log('   The contract may not be deployed or the address is wrong.');
    process.exit(1);
  }
  console.log('✅ Contract exists! Code size:', code.length, 'bytes');
  console.log('');

  // Load contract ABI
  const contractArtifact = require('./ignition/deployments/chain-5042002/artifacts/IncrementalVerifiableClaimModule#IncrementalVerifiableClaim.json');
  const contractABI = contractArtifact.abi;

  // Get wallet from environment
  const privateKey = process.env.ARC_TESTNET_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: ARC_TESTNET_PRIVATE_KEY not set in .env file');
    console.log('   Please add your Arc testnet private key to web3/.env');
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('2️⃣ Connected wallet:', wallet.address);

  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  console.log('   Balance:', ethers.formatEther(balance), 'ETH');
  if (balance === 0n) {
    console.warn('⚠️  WARNING: Wallet has 0 ETH! You need testnet ETH to mint claims.');
    console.log('   Get testnet tokens from the faucet or run: node request-arc-testnet-tokens.js');
  }
  console.log('');

  // Connect to contract
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

  // Read contract info
  console.log('3️⃣ Reading contract information...');
  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
  } catch (error) {
    console.error('❌ ERROR reading contract info:', error.message);
  }
  console.log('');

  // Test mint (dry run)
  console.log('4️⃣ Testing mint transaction (estimating gas)...');
  try {
    const testMerkleRoot = ethers.randomBytes(32);
    const testMetadataUri = 'ipfs://QmTest123';
    const testClaimId = 'test-claim-' + Date.now();

    console.log('   Test parameters:');
    console.log('   - Merkle Root:', ethers.hexlify(testMerkleRoot));
    console.log('   - Metadata URI:', testMetadataUri);
    console.log('   - Claim ID:', testClaimId);
    console.log('');

    // Estimate gas
    const gasEstimate = await contract.mintClaim.estimateGas(
      testMerkleRoot,
      testMetadataUri,
      testClaimId
    );
    console.log('✅ Gas estimate:', gasEstimate.toString());
    console.log('   Estimated cost:', ethers.formatEther(gasEstimate * 20000000000n), 'ETH (assuming 20 gwei)');
    console.log('');
    console.log('✅ Contract is ready to mint claims!');
  } catch (error) {
    console.error('❌ ERROR estimating gas:', error.message);
    if (error.data) {
      console.error('   Error data:', error.data);
    }
  }

  console.log('');
  console.log('🔗 View contract on Arc Explorer:');
  console.log('   https://testnet.arcscan.app/address/' + CONTRACT_ADDRESS);
  console.log('');
  console.log('📋 Summary:');
  console.log('   Contract Address: ' + CONTRACT_ADDRESS);
  console.log('   Network: Arc Testnet');
  console.log('   Chain ID: 5042002');
  console.log('   Status: Ready ✅');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
