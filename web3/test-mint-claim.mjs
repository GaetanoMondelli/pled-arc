import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const CONTRACT_ADDRESS = '0xeFa0243540BdBDC0Bf27Ab2f2E3111e9EA059Ffa';
const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';

async function main() {
  console.log('🧪 Testing Claim Minting on Arc Testnet');
  console.log('━'.repeat(60));
  console.log('');

  // Connect to Arc Testnet
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  const network = await provider.getNetwork();
  console.log('✅ Connected to network:', network.chainId.toString());
  console.log('');

  // Get wallet from environment
  const privateKey = process.env.ARC_TESTNET_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: ARC_TESTNET_PRIVATE_KEY not set in .env file');
    console.log('');
    console.log('Please add to web3/.env:');
    console.log('ARC_TESTNET_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('👛 Wallet Address:', wallet.address);

  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Wallet Balance:', ethers.formatEther(balance), 'ETH');
  console.log('');

  if (balance === 0n) {
    console.error('❌ ERROR: Wallet has 0 ETH!');
    console.log('');
    console.log('You need Arc Testnet ETH to mint claims.');
    console.log('Run this to get testnet tokens:');
    console.log('  cd web3');
    console.log('  node request-arc-testnet-tokens.js');
    console.log('');
    process.exit(1);
  }

  // Load contract ABI
  const contractArtifact = JSON.parse(
    readFileSync('./ignition/deployments/chain-5042002/artifacts/IncrementalVerifiableClaimModule#IncrementalVerifiableClaim.json', 'utf-8')
  );
  const contractABI = contractArtifact.abi;

  // Connect to contract
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

  console.log('📋 Contract Information:');
  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
  } catch (error) {
    console.error('   ❌ ERROR reading contract:', error.message);
  }
  console.log('');

  // Create test claim data
  const testOwner = wallet.address;
  const testClaimId = 'test-claim-' + Date.now();
  const testWorkflowId = 'workflow-test';
  const testExecutionId = 'execution-test';

  // Create test merkle tree hashes (simulating ledger and sink events)
  const testLedgerHashes = [
    ethers.randomBytes(32),
    ethers.randomBytes(32),
  ];
  const testSinkHashes = [
    ethers.randomBytes(32),
  ];

  const testAggregateValue = JSON.stringify({ total: 42, verified: true });
  const testMetadataUri = 'ipfs://QmTest' + Date.now();

  console.log('🔨 Preparing to mint claim...');
  console.log('   Owner:', testOwner);
  console.log('   Claim ID:', testClaimId);
  console.log('   Workflow ID:', testWorkflowId);
  console.log('   Execution ID:', testExecutionId);
  console.log('   Ledger Events:', testLedgerHashes.length);
  console.log('   Sink Events:', testSinkHashes.length);
  console.log('   Metadata URI:', testMetadataUri);
  console.log('');

  // Estimate gas
  console.log('⛽ Estimating gas...');
  try {
    const gasEstimate = await contract.mintClaim.estimateGas(
      testOwner,
      testClaimId,
      testWorkflowId,
      testExecutionId,
      testLedgerHashes,
      testSinkHashes,
      testAggregateValue,
      testMetadataUri
    );

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 20000000000n;
    const estimatedCost = gasEstimate * gasPrice;

    console.log('   Gas estimate:', gasEstimate.toString());
    console.log('   Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    console.log('   Estimated cost:', ethers.formatEther(estimatedCost), 'ETH');
    console.log('');

    // Check if wallet has enough
    if (balance < estimatedCost) {
      console.warn('⚠️  WARNING: Wallet might not have enough ETH for this transaction!');
      console.log('   Required:', ethers.formatEther(estimatedCost), 'ETH');
      console.log('   Available:', ethers.formatEther(balance), 'ETH');
      console.log('');
    }

  } catch (error) {
    console.error('❌ ERROR estimating gas:', error.message);
    if (error.data) {
      console.error('   Error data:', error.data);
    }
    console.log('');
    console.log('This might indicate a problem with the contract or parameters.');
    process.exit(1);
  }

  // Actually mint the claim
  console.log('🚀 Sending mint transaction...');
  try {
    const tx = await contract.mintClaim(
      testOwner,
      testClaimId,
      testWorkflowId,
      testExecutionId,
      testLedgerHashes,
      testSinkHashes,
      testAggregateValue,
      testMetadataUri
    );

    console.log('✅ Transaction sent!');
    console.log('   TX Hash:', tx.hash);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());
    console.log('');

    // Parse events to get token ID
    const mintEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'ClaimMinted';
      } catch {
        return false;
      }
    });

    if (mintEvent) {
      const parsed = contract.interface.parseLog(mintEvent);
      const tokenId = parsed.args[0];
      console.log('🎉 Claim minted successfully!');
      console.log('   Token ID:', tokenId.toString());
      console.log('');
    }

    console.log('🔗 View on Explorer:');
    console.log('   https://testnet.arcscan.app/tx/' + tx.hash);
    console.log('');

  } catch (error) {
    console.error('❌ ERROR minting claim:', error.message);
    if (error.data) {
      console.error('   Error data:', error.data);
    }
    if (error.reason) {
      console.error('   Reason:', error.reason);
    }
    console.log('');
    process.exit(1);
  }

  console.log('✅ Test completed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  });
