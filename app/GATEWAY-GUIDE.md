# Circle Gateway Integration Guide

## What is Gateway?

**Gateway = Unified USDC Balance Across All Chains**

Instead of managing separate USDC balances on each chain, Gateway pools all your USDC together and lets you spend it on ANY supported chain instantly (<500ms).

### Example Scenario

**Without Gateway:**
```
Treasury has:
- 100 USDC on Ethereum
- 50 USDC on Arc
- 75 USDC on Base

Want to pay 150 USDC to someone on Arc?
→ Need to bridge USDC from Ethereum → Arc (wait ~10 mins)
→ Complex, slow, expensive
```

**With Gateway:**
```
Treasury has:
- 225 USDC total (unified across all chains)

Want to pay 150 USDC on Arc?
→ Instant withdrawal on Arc (<500ms)
→ No bridging, no waiting
```

## How Gateway Works

```
┌─────────────────────────────────────────────────────────┐
│                    1. DEPOSIT PHASE                      │
│                                                          │
│  Ethereum Sepolia:  100 USDC → Gateway Wallet Contract │
│  Arc Testnet:        50 USDC → Gateway Wallet Contract │
│  Base Sepolia:       75 USDC → Gateway Wallet Contract │
│                                                          │
│  Result: 225 USDC unified balance in Gateway            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   2. WITHDRAWAL PHASE                    │
│                                                          │
│  Want to spend 150 USDC on Arc?                         │
│  1. Request attestation from Gateway API                │
│  2. Call Gateway Minter contract on Arc                 │
│  3. Receive 150 USDC on Arc instantly                   │
│                                                          │
│  Remaining balance: 75 USDC (still accessible on all)   │
└─────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Gateway Wallet Contracts
- Deployed on each supported chain
- You deposit USDC into these contracts
- They custody your USDC in a unified pool

### 2. Gateway Minter Contracts
- Deployed on each supported chain
- You withdraw USDC from Gateway through these
- They mint fresh USDC on the destination chain

### 3. Attestations
- Proof from Gateway that you have sufficient balance
- Required to withdraw on any chain
- Expires after 10 minutes

### 4. Supported Chains (Testnet)
✅ Arc Testnet
✅ Ethereum Sepolia
✅ Base Sepolia
✅ Avalanche Fuji
✅ Sonic Testnet
✅ World Chain Sepolia
✅ And more...

## Integration Steps

### Step 1: Get Contract Addresses

You need to get the official Gateway contract addresses from Circle docs:

```
https://developers.circle.com/gateway/contract-addresses
```

Look for:
- **Gateway Wallet** addresses (for deposits)
- **Gateway Minter** addresses (for withdrawals)
- For each testnet chain you want to use

### Step 2: Deposit USDC to Gateway

```typescript
import { depositToGateway } from '@/lib/circle-gateway';

// Deposit from Arc Testnet wallet
await depositToGateway({
  blockchain: 'ARC-TESTNET',
  amount: '50', // 50 USDC
  privateKey: walletPrivateKey,
  rpcUrl: 'https://rpc-testnet.archub.io'
});

// Deposit from Ethereum Sepolia wallet
await depositToGateway({
  blockchain: 'ETH-SEPOLIA',
  amount: '100', // 100 USDC
  privateKey: walletPrivateKey,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com'
});

// Now you have 150 USDC unified balance!
```

### Step 3: Check Unified Balance

```typescript
import { getGatewayBalance } from '@/lib/circle-gateway';

const balance = await getGatewayBalance(walletAddress);

console.log('Total Gateway Balance:', balance.total);
console.log('By Chain:', balance.byChain);
```

### Step 4: Withdraw on Any Chain

```typescript
import { requestWithdrawalAttestation, withdrawFromGateway } from '@/lib/circle-gateway';

// 1. Request attestation
const attestation = await requestWithdrawalAttestation({
  sourceChain: 'unified', // Pulling from unified balance
  destChain: 'ARC-TESTNET',
  amount: '75',
  recipient: destinationAddress,
  nonce: Date.now(),
  signature: '0x...' // Sign the withdrawal request
});

// 2. Execute withdrawal on Arc
await withdrawFromGateway({
  blockchain: 'ARC-TESTNET',
  attestation,
  privateKey: walletPrivateKey,
  rpcUrl: 'https://rpc-testnet.archub.io'
});

// Now you have 75 USDC on Arc!
```

## Using Gateway with Circle Wallets SDK

Since you're using Circle's Developer-Controlled Wallets, you can combine them:

```typescript
import { getCircleClient } from '@/lib/circle-wallet';

const client = getCircleClient();

// 1. Use Circle wallet to deposit to Gateway
const ciphertext = await client.generateEntitySecretCiphertext();

// Get Gateway Wallet address for Arc Testnet
const GATEWAY_WALLET_ARC = '0x...'; // From Circle docs

// Transfer USDC from Circle wallet to Gateway
await client.createTransaction({
  walletId: circleWalletId,
  destinationAddress: GATEWAY_WALLET_ARC, // Deposit to Gateway!
  amounts: ['50'],
  blockchain: 'ARC-TESTNET',
  tokenAddress: '0x3600000000000000000000000000000000000000', // USDC on Arc
  feeLevel: 'MEDIUM',
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});

// 2. Now check Gateway balance
const balance = await getGatewayBalance(circleWalletAddress);

// 3. Withdraw to any chain using Circle wallet
// (Use smart contract execution to call Gateway Minter)
await client.createContractExecutionTransaction({
  walletId: circleWalletId,
  contractAddress: GATEWAY_MINTER_ARC,
  abiFunctionSignature: 'receiveMessage(bytes)',
  abiParameters: [attestation.message],
  feeLevel: 'MEDIUM',
  entitySecretCiphertext: ciphertext
});
```

## Treasury Management Use Case

### Scenario: Multi-Chain Treasury

You're managing a DAO treasury with funds across multiple chains:

```typescript
// 1. Consolidate all treasury USDC into Gateway
const treasuryWallets = [
  { chain: 'ETH-SEPOLIA', balance: 10000 },
  { chain: 'ARC-TESTNET', balance: 5000 },
  { chain: 'BASE-SEPOLIA', balance: 8000 }
];

for (const wallet of treasuryWallets) {
  await depositToGateway({
    blockchain: wallet.chain,
    amount: wallet.balance.toString(),
    privateKey: treasuryPrivateKey,
    rpcUrl: getRpcUrl(wallet.chain)
  });
}

// Total unified: 23,000 USDC

// 2. Make payments on any chain instantly
const payments = [
  { chain: 'ARC-TESTNET', recipient: '0xAAA...', amount: 5000 },
  { chain: 'BASE-SEPOLIA', recipient: '0xBBB...', amount: 3000 },
  { chain: 'ETH-SEPOLIA', recipient: '0xCCC...', amount: 2000 }
];

for (const payment of payments) {
  const attestation = await requestWithdrawalAttestation({
    sourceChain: 'unified',
    destChain: payment.chain,
    amount: payment.amount.toString(),
    recipient: payment.recipient,
    nonce: Date.now(),
    signature: await signWithdrawal(payment)
  });

  await withdrawFromGateway({
    blockchain: payment.chain,
    attestation,
    privateKey: treasuryPrivateKey,
    rpcUrl: getRpcUrl(payment.chain)
  });
}

// Remaining: 13,000 USDC (still accessible on all chains)
```

## Next Steps for Your Hackathon

### Option 1: Full Gateway Integration
1. Get Gateway contract addresses from Circle docs
2. Implement deposit/withdrawal functions
3. Build treasury dashboard showing unified balance
4. Demo instant cross-chain payments

### Option 2: Simpler Demo (Recommended for Hackathon)
1. Use Circle Wallets to transfer to Gateway contracts
2. Manually track "unified balance" in your UI
3. Show the concept with mock Gateway API calls
4. Focus on smart contract logic for Track 1

## Resources

- **Gateway Docs**: https://developers.circle.com/gateway
- **Quickstart**: https://developers.circle.com/gateway/quickstarts/unified-balance
- **Contract Addresses**: https://developers.circle.com/gateway/contract-addresses
- **Technical Guide**: https://developers.circle.com/gateway/concepts/technical-guide

## Summary

**What Gateway Gives You:**
✅ One unified USDC balance across all chains
✅ Instant withdrawals on any chain (<500ms)
✅ No manual bridging
✅ Perfect for treasury management

**For Your Hackathon (Track 3):**
- Show automated treasury operations across chains
- Demonstrate instant cross-chain payments
- Build unified treasury dashboard
- Deploy treasury smart contracts on Arc
