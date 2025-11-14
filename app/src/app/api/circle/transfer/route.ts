import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Use REST API directly for better Arc Testnet support
const CIRCLE_API_URL = 'https://api.circle.com/v1/w3s';

async function getEntitySecretCiphertext() {
  const response = await fetch(`${CIRCLE_API_URL}/config/entity/publicKey`, {
    headers: {
      'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get public key');
  }

  const { data } = await response.json();

  // Encrypt entity secret with public key
  const { publicKey } = await import('crypto');
  const entitySecret = Buffer.from(process.env.CIRCLE_ENTITY_SECRET || '', 'hex');

  // For simplicity, return base64 encoded (in production, use proper RSA encryption)
  return Buffer.from(entitySecret).toString('base64');
}

// POST - Transfer USDC/EURC between wallets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, destinationAddress, amount, tokenType } = body;

    if (!walletId || !destinationAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try using SDK first, fallback to REST API
    const USE_REST_API = true; // Set to true to test REST API

    if (USE_REST_API) {
      return await transferViaRestAPI(walletId, destinationAddress, amount, tokenType);
    }

    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();

    // Generate entity secret ciphertext for signing
    const ciphertext = await client.generateEntitySecretCiphertext();

    // Determine token ID or address based on blockchain and token type
    // For ETH-SEPOLIA: Use tokenId (UUID)
    // For ARC-TESTNET: Use blockchain + tokenAddress (contract address)

    const tokenIds = {
      'ETH-SEPOLIA': {
        'USDC': '5797fbd6-3795-519d-84ca-ec4c5f80c3b1',
        'EURC': 'c22b378a-843a-59b6-aaf5-bcba622729e6'
      }
    };

    // Arc Testnet uses contract addresses (not token IDs)
    const arcTokenAddresses = {
      'USDC': '0x3600000000000000000000000000000000000000',
      'EURC': '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
    };

    // Get wallet to determine blockchain
    const wallet = await client.getWallet({ id: walletId });
    const blockchain = wallet.data?.blockchain || 'ETH-SEPOLIA';

    console.log('Transfer request:', {
      walletId,
      blockchain,
      destinationAddress,
      amount,
      tokenType
    });

    // Create transaction with different parameters based on blockchain
    let transaction;
    if (blockchain === 'ARC-TESTNET') {
      // Use tokenAddress approach for Arc Testnet
      const tokenAddress = arcTokenAddresses[tokenType as 'USDC' | 'EURC'];
      if (!tokenAddress) {
        return NextResponse.json(
          { success: false, error: `Token ${tokenType} not supported on ${blockchain}` },
          { status: 400 }
        );
      }

      const txParams = {
        amounts: [amount.toString()],
        destinationAddress,
        blockchain: 'ARC-TESTNET' as const,
        tokenAddress,
        walletId,
        fee: {
          type: 'level' as const,
          config: {
            feeLevel: 'MEDIUM' as const
          }
        },
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: ciphertext
      };

      console.log('Arc Testnet transaction params:', JSON.stringify(txParams, null, 2));
      transaction = await client.createTransaction(txParams);
    } else {
      // Use tokenId approach for other blockchains
      const tokenId = tokenIds[blockchain as keyof typeof tokenIds]?.[tokenType as 'USDC' | 'EURC'];
      if (!tokenId) {
        return NextResponse.json(
          { success: false, error: `Token ${tokenType} not supported on ${blockchain}` },
          { status: 400 }
        );
      }

      transaction = await client.createTransaction({
        amounts: [amount],
        destinationAddress,
        tokenId,
        walletId,
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM'
          }
        },
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: ciphertext
      });
    }

    return NextResponse.json({
      success: true,
      data: transaction.data
    });

  } catch (error: any) {
    console.error('Circle transfer error:', error);
    console.error('Error details:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      fullError: JSON.stringify(error, null, 2)
    });
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to create transfer',
        details: error?.response?.data || error,
        stack: error?.stack
      },
      { status: error?.response?.status || 500 }
    );
  }
}

// Transfer via Circle REST API directly
async function transferViaRestAPI(
  walletId: string,
  destinationAddress: string,
  amount: string,
  tokenType: 'USDC' | 'EURC'
) {
  try {
    // Get entity secret ciphertext using SDK
    const { getCircleClient } = await import('@/lib/circle-wallet');
    const client = getCircleClient();
    const ciphertext = await client.generateEntitySecretCiphertext();

    // Get wallet info first
    const walletResponse = await fetch(`${CIRCLE_API_URL}/wallets/${walletId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!walletResponse.ok) {
      const error = await walletResponse.json();
      throw new Error(`Failed to get wallet: ${JSON.stringify(error)}`);
    }

    const walletData = await walletResponse.json();
    const blockchain = walletData.data?.wallet?.blockchain;

    console.log('Wallet info:', { walletId, blockchain, destinationAddress, amount, tokenType });

    // Token addresses for Arc Testnet
    const arcTokenAddresses = {
      'USDC': '0x3600000000000000000000000000000000000000',
      'EURC': '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
    };

    // Token IDs for other chains
    const tokenIds = {
      'ETH-SEPOLIA': {
        'USDC': '5797fbd6-3795-519d-84ca-ec4c5f80c3b1',
        'EURC': 'c22b378a-843a-59b6-aaf5-bcba622729e6'
      }
    };

    // Build request body based on blockchain
    let requestBody: any = {
      walletId,
      destinationAddress,
      amounts: [amount],
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      feeLevel: 'MEDIUM' // Use simple feeLevel instead of nested fee object for REST API
    };

    if (blockchain === 'ARC-TESTNET') {
      requestBody.blockchain = 'ARC-TESTNET';
      requestBody.tokenAddress = arcTokenAddresses[tokenType];
    } else {
      const tokenId = tokenIds[blockchain as keyof typeof tokenIds]?.[tokenType];
      if (!tokenId) {
        return NextResponse.json(
          { success: false, error: `Token ${tokenType} not supported on ${blockchain}` },
          { status: 400 }
        );
      }
      requestBody.tokenId = tokenId;
    }

    console.log('REST API request:', JSON.stringify(requestBody, null, 2));

    // Create transaction via REST API
    const transferResponse = await fetch(`${CIRCLE_API_URL}/developer/transactions/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await transferResponse.text();
    console.log('REST API response status:', transferResponse.status);
    console.log('REST API response:', responseText);

    if (!transferResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Transfer failed',
          details: errorData
        },
        { status: transferResponse.status }
      );
    }

    const transferData = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      data: transferData.data
    });

  } catch (error: any) {
    console.error('REST API transfer error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Transfer failed',
        details: error
      },
      { status: 500 }
    );
  }
}
