import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// Initialize Circle Client
export function getCircleClient() {
  // After entity secret registration, use API Key (not Client Key)
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey) {
    throw new Error('CIRCLE_SDK_API_KEY (or CIRCLE_API_KEY) is not set in environment variables');
  }

  if (!entitySecret) {
    throw new Error('CIRCLE_ENTITY_SECRET is not set in environment variables');
  }

  // Use default Circle API URL (works for both test and production keys)
  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

// Get public key from Circle
export async function getCirclePublicKey() {
  try {
    const client = getCircleClient();
    const response = await client.getPublicKey();
    return response;
  } catch (error) {
    console.error('Error getting Circle public key:', error);
    throw error;
  }
}

// Create a new wallet
export async function createWallet(params: {
  idempotencyKey: string;
  entitySecretCiphertext: string;
  blockchains?: string[];
  count?: number;
  walletSetId?: string;
}) {
  try {
    const client = getCircleClient();
    const response = await client.createWallets(params);
    return response;
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
}

// Get wallet by ID
export async function getWallet(walletId: string) {
  try {
    const client = getCircleClient();
    const response = await client.getWallet({ id: walletId });
    return response;
  } catch (error) {
    console.error('Error getting wallet:', error);
    throw error;
  }
}

// List all wallets
export async function listWallets() {
  try {
    const client = getCircleClient();
    const response = await client.listWallets({});
    return response;
  } catch (error) {
    console.error('Error listing wallets:', error);
    throw error;
  }
}

// Get wallet balance
export async function getWalletBalance(walletId: string) {
  try {
    const client = getCircleClient();
    const response = await client.getWalletTokenBalance({
      id: walletId,
    });
    return response;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw error;
  }
}

// Get all balances for a wallet
export async function getWalletBalances(walletId: string) {
  try {
    const client = getCircleClient();
    const response = await client.getWalletTokenBalance({
      id: walletId,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting wallet balances:', error);
    throw error;
  }
}
