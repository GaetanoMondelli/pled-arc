/**
 * Service for interacting with TreasuryDAOPermissionless contract via Circle SDK
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// Treasury contract address (set after deployment)
export const TREASURY_DAO_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_DAO_ADDRESS || '';

// USDC address on Arc Testnet
const USDC_ARC_TESTNET = '0x3600000000000000000000000000000000000000';

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
  const client = getCircleClient();

  try {
    // Find Arc Testnet wallet to call contract
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Call getAllOfficers() view function
    const response = await client.callContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'getAllOfficers()',
      abiParameters: [],
    });

    // Parse response
    // Response format: [[address[], uint256[]]]
    const data = response.data;

    if (!data || !Array.isArray(data) || data.length < 2) {
      throw new Error('Invalid response from getAllOfficers');
    }

    const addresses = data[0] as string[];
    const shares = data[1] as string[];

    // Calculate total shares
    const totalShares = shares.reduce((sum, s) => sum + parseInt(s), 0);

    // Build officer info array
    const officers: OfficerInfo[] = addresses.map((address, i) => {
      const officerShares = parseInt(shares[i]);
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
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Call getOfficerInfo(address) view function
    const response = await client.callContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'getOfficerInfo(address)',
      abiParameters: [officerAddress],
    });

    const data = response.data;

    if (!data || !Array.isArray(data) || data.length < 2) {
      throw new Error('Invalid response from getOfficerInfo');
    }

    return {
      shares: parseInt(data[0]),
      percentage: parseInt(data[1]), // Basis points
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
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Call totalShares() view function
    const response = await client.callContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'totalShares()',
      abiParameters: [],
    });

    return parseInt(response.data as string);
  } catch (error) {
    console.error('Error reading total shares:', error);
    throw error;
  }
}

/**
 * Get treasury USDC balance from the blockchain
 */
export async function getTreasuryBalance(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<string> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Call getTreasuryBalance() view function
    const response = await client.callContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'getTreasuryBalance()',
      abiParameters: [],
    });

    return response.data as string;
  } catch (error) {
    console.error('Error reading treasury balance:', error);
    throw error;
  }
}

/**
 * Get payment history count from the blockchain
 */
export async function getPaymentCount(contractAddress: string = TREASURY_DAO_ADDRESS): Promise<number> {
  const client = getCircleClient();

  try {
    const wallets = await client.listWallets({});
    const arcWallet = wallets.data?.wallets?.find(w => w.blockchain === 'ARC-TESTNET');

    if (!arcWallet) {
      throw new Error('No ARC-TESTNET wallet found');
    }

    // Call getPaymentCount() view function
    const response = await client.callContractFunction({
      walletId: arcWallet.id,
      contractAddress: contractAddress,
      abiFunctionSignature: 'getPaymentCount()',
      abiParameters: [],
    });

    return parseInt(response.data as string);
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
