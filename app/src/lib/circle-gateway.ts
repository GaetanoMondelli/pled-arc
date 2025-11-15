/**
 * Circle Gateway Integration
 * Enables unified USDC balance across multiple chains
 */

import { ethers } from 'ethers';

// Gateway Contract Addresses (Testnet)
export const GATEWAY_CONTRACTS = {
  'ARC-TESTNET': {
    wallet: '0x...',  // Gateway Wallet contract on Arc (need to get from Circle docs)
    minter: '0x...',  // Gateway Minter contract on Arc
  },
  'ETH-SEPOLIA': {
    wallet: '0x...',  // Gateway Wallet contract on Sepolia
    minter: '0x...',  // Gateway Minter contract on Sepolia
  },
  'BASE-SEPOLIA': {
    wallet: '0x...',
    minter: '0x...',
  }
};

// USDC Contract Addresses (for approval)
export const USDC_CONTRACTS = {
  'ARC-TESTNET': '0x3600000000000000000000000000000000000000',
  'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'BASE-SEPOLIA': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
};

// Gateway Wallet ABI (minimal - just deposit function)
const GATEWAY_WALLET_ABI = [
  'function deposit(address token, uint256 amount) external',
  'function balanceOf(address account, address token) external view returns (uint256)'
];

// USDC ERC-20 ABI (minimal)
const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

/**
 * Deposit USDC into Gateway to create unified balance
 */
export async function depositToGateway(params: {
  blockchain: 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA';
  amount: string; // In USDC (not wei)
  privateKey: string; // Wallet private key
  rpcUrl: string;
}) {
  const { blockchain, amount, privateKey, rpcUrl } = params;

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const gatewayWalletAddress = GATEWAY_CONTRACTS[blockchain].wallet;
  const usdcAddress = USDC_CONTRACTS[blockchain];

  // Convert amount to wei (USDC has 6 decimals)
  const amountWei = ethers.parseUnits(amount, 6);

  console.log(`\n💰 Depositing ${amount} USDC to Gateway on ${blockchain}`);
  console.log(`   From: ${wallet.address}`);
  console.log(`   Gateway Wallet: ${gatewayWalletAddress}\n`);

  // Step 1: Approve Gateway Wallet to spend USDC
  const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, wallet);

  const currentAllowance = await usdcContract.allowance(wallet.address, gatewayWalletAddress);

  if (currentAllowance < amountWei) {
    console.log('📝 Approving Gateway Wallet to spend USDC...');
    const approveTx = await usdcContract.approve(gatewayWalletAddress, amountWei);
    await approveTx.wait();
    console.log('   ✅ Approved!\n');
  } else {
    console.log('   ✅ Already approved\n');
  }

  // Step 2: Deposit USDC into Gateway
  const gatewayContract = new ethers.Contract(
    gatewayWalletAddress,
    GATEWAY_WALLET_ABI,
    wallet
  );

  console.log('🔄 Depositing to Gateway...');
  const depositTx = await gatewayContract.deposit(usdcAddress, amountWei);
  const receipt = await depositTx.wait();

  console.log('   ✅ Deposit successful!');
  console.log(`   TX Hash: ${receipt.hash}\n`);

  return receipt;
}

/**
 * Get unified Gateway balance for an address
 */
export async function getGatewayBalance(address: string): Promise<{
  total: string;
  byChain: Record<string, string>;
}> {
  // This would call Gateway API to get unified balance
  // For now, placeholder
  const response = await fetch('https://gateway-api.circle.com/v1/balances/' + address, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get Gateway balance');
  }

  const data = await response.json();
  return data;
}

/**
 * Request attestation for withdrawal (needed to mint on destination chain)
 */
export async function requestWithdrawalAttestation(params: {
  sourceChain: string;
  destChain: string;
  amount: string;
  recipient: string;
  nonce: number;
  signature: string;
}) {
  const response = await fetch('https://gateway-api.circle.com/v1/attestation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    throw new Error('Failed to get attestation');
  }

  return await response.json();
}

/**
 * Withdraw from Gateway (mint on destination chain)
 */
export async function withdrawFromGateway(params: {
  blockchain: 'ARC-TESTNET' | 'ETH-SEPOLIA' | 'BASE-SEPOLIA';
  attestation: any; // Attestation from Gateway API
  privateKey: string;
  rpcUrl: string;
}) {
  const { blockchain, attestation, privateKey, rpcUrl } = params;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const gatewayMinterAddress = GATEWAY_CONTRACTS[blockchain].minter;

  // Gateway Minter ABI (minimal)
  const GATEWAY_MINTER_ABI = [
    'function receiveMessage(bytes calldata message) external'
  ];

  const minterContract = new ethers.Contract(
    gatewayMinterAddress,
    GATEWAY_MINTER_ABI,
    wallet
  );

  console.log(`\n🎯 Withdrawing from Gateway on ${blockchain}`);
  console.log(`   To: ${wallet.address}\n`);

  const tx = await minterContract.receiveMessage(attestation.message);
  const receipt = await tx.wait();

  console.log('   ✅ Withdrawal successful!');
  console.log(`   TX Hash: ${receipt.hash}\n`);

  return receipt;
}
