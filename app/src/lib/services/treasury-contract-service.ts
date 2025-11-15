/**
 * Service for interacting with TreasuryDAOPermissionless contract via Circle SDK
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

// Treasury contract address (set after deployment)
export const TREASURY_DAO_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_DAO_ADDRESS || '';

// USDC address on Arc Testnet
const USDC_ARC_TESTNET = '0x3600000000000000000000000000000000000000';

// Define Arc Testnet chain for viem
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
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Treasury contract ABI
const TREASURY_ABI = [
  {
    inputs: [],
    name: 'getAllOfficers',
    outputs: [
      { internalType: 'address[]', name: '', type: 'address[]' },
      { internalType: 'uint256[]', name: '', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalShares',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'officer', type: 'address' }],
    name: 'getSharePercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTreasuryBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getOfficerCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPaymentCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface OfficerInfo {
  address: string;
  shares: number;
  percentage: number; // Basis points (6000 = 60.00%)
}

interface PaymentHistoryItem {
  recipient: string;
  amount: string;
  paymentType: string;
  reason: string;
  timestamp: number;
  documentHash: string;
}

/**
 * Initialize Circle Wallets client
 */
function getCircleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET');
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

/**
 * Get all officers and their share allocations from the blockchain
 */
export async function getAllOfficersFromChain(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<OfficerInfo[]> {
  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    // Call getAllOfficers() view function
    const [addresses, sharesArray] = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'getAllOfficers',
    });

    // Calculate total shares
    const totalShares = sharesArray.reduce((sum, s) => sum + Number(s), 0);

    // Build officer info array
    const officers: OfficerInfo[] = addresses.map((address, i) => {
      const officerShares = Number(sharesArray[i]);
      const percentage = totalShares > 0 ? (officerShares * 10000) / totalShares : 0;

      return {
        address,
        shares: officerShares,
        percentage: Math.round(percentage), // Basis points
      };
    });

    return officers;
  } catch (error) {
    console.error('Error reading officers from chain:', error);
    throw error;
  }
}

/**
 * Get specific officer info from the blockchain
 */
export async function getOfficerInfo(
  officerAddress: string,
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<{ shares: number; percentage: number }> {
  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    // Call getSharePercentage(address) view function
    const percentage = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'getSharePercentage',
      args: [officerAddress as `0x${string}`],
    });

    // Get all officers to find shares for this specific address
    const officers = await getAllOfficersFromChain(contractAddress);
    const officer = officers.find(o => o.address.toLowerCase() === officerAddress.toLowerCase());

    return {
      shares: officer?.shares || 0,
      percentage: Number(percentage), // Basis points
    };
  } catch (error) {
    console.error('Error reading officer info:', error);
    throw error;
  }
}

/**
 * Get total shares from the blockchain
 */
export async function getTotalShares(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<number> {
  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    const totalShares = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'totalShares',
    });

    return Number(totalShares);
  } catch (error) {
    console.error('Error reading total shares:', error);
    throw error;
  }
}

/**
 * Get treasury USDC balance from the blockchain
 */
export async function getTreasuryBalance(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<string> {
  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'getTreasuryBalance',
    });

    return balance.toString();
  } catch (error) {
    console.error('Error reading treasury balance:', error);
    throw error;
  }
}

/**
 * Get payment history count from the blockchain
 */
export async function getPaymentCount(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<number> {
  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    const count = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'getPaymentCount',
    });

    return Number(count);
  } catch (error) {
    console.error('Error reading payment count:', error);
    throw error;
  }
}

/**
 * Initialize shares on the treasury contract (one-time setup)
 */
export async function initializeShares(
  officers: string[],
  shares: number[],
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Generate entity secret ciphertext
    const ciphertext = await client.generateEntitySecretCiphertext();

    // Call initializeShares(address[], uint256[])
    const response = await client.executeSmartContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'initializeShares(address[],uint256[])',
      abiParameters: [officers, shares],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    return response.data?.transactionId || '';
  } catch (error) {
    console.error('Error initializing shares:', error);
    throw error;
  }
}

/**
 * Update shares for a specific officer (supports dilution)
 */
export async function updateShares(
  officerAddress: string,
  newShares: number,
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    const ciphertext = await client.generateEntitySecretCiphertext();

    // Call updateShares(address, uint256)
    const response = await client.executeSmartContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'updateShares(address,uint256)',
      abiParameters: [officerAddress, newShares],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    return response.data?.transactionId || '';
  } catch (error) {
    console.error('Error updating shares:', error);
    throw error;
  }
}

/**
 * Distribute profits to all shareholders
 */
export async function distributeProfits(
  totalAmount: string, // Amount in wei (18 decimals for USDC on Arc)
  documentHash: string,
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    const ciphertext = await client.generateEntitySecretCiphertext();

    // Call distributeProfits(uint256, bytes32)
    const response = await client.executeSmartContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'distributeProfits(uint256,bytes32)',
      abiParameters: [totalAmount, documentHash],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    return response.data?.transactionId || '';
  } catch (error) {
    console.error('Error distributing profits:', error);
    throw error;
  }
}

/**
 * Pay salary to a specific officer
 */
export async function paySalary(
  officerAddress: string,
  amount: string, // Amount in wei
  documentHash: string,
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    const ciphertext = await client.generateEntitySecretCiphertext();

    // Call paySalary(address, uint256, bytes32)
    const response = await client.executeSmartContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'paySalary(address,uint256,bytes32)',
      abiParameters: [officerAddress, amount, documentHash],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    return response.data?.transactionId || '';
  } catch (error) {
    console.error('Error paying salary:', error);
    throw error;
  }
}

/**
 * Pay bonus to a specific officer
 */
export async function payBonus(
  officerAddress: string,
  amount: string, // Amount in wei
  reason: string,
  documentHash: string,
  contractAddress: string = TREASURY_DAO_ADDRESS
): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    const ciphertext = await client.generateEntitySecretCiphertext();

    // Call payBonus(address, uint256, string, bytes32)
    const response = await client.executeSmartContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'payBonus(address,uint256,string,bytes32)',
      abiParameters: [officerAddress, amount, reason, documentHash],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    return response.data?.transactionId || '';
  } catch (error) {
    console.error('Error paying bonus:', error);
    throw error;
  }
}

/**
 * Helper: Convert USDC amount to wei (18 decimals on Arc)
 */
export function usdcToWei(amount: number): string {
  return (BigInt(amount) * BigInt(10 ** 18)).toString();
}

/**
 * Helper: Convert wei to USDC amount (18 decimals on Arc)
 */
export function weiToUsdc(wei: string): number {
  return Number(BigInt(wei) / BigInt(10 ** 18));
}

/**
 * Helper: Format percentage from basis points
 */
export function formatPercentage(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2) + '%';
}
