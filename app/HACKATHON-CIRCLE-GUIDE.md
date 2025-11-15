# Circle Technologies for Arc Hackathon - Track 1 & 3

## What You Have Working ✅

1. **Circle Developer-Controlled Wallets** - Fully integrated
   - Creating wallets on ETH-SEPOLIA and ARC-TESTNET
   - Reading token balances (USDC, EURC)
   - Listing wallets with filtering

2. **Stablecoins** - Funded and ready
   - 20 USDC on wallet `0x3c4b268b88ca7374e2f597b6627011225263d8b4`
   - 10 EURC on the same wallet
   - Both on ETH-SEPOLIA testnet

3. **Arc Testnet Wallet** - Created
   - Address: `0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37`
   - Ready for Arc blockchain deployment

---

## Track 1: Smart Contracts on Arc with Advanced Stablecoin Logic

### What This Track Needs

**Circle Technologies:**
- USDC/EURC stablecoins ✅ (you have)
- Circle Wallets ✅ (you have)
- Smart contract interaction capabilities ✅ (SDK supports)

### What You Can Build

#### 1. Conditional Payment System
Execute payments only when conditions are met:

```javascript
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

// Deploy a smart contract that holds USDC and releases based on conditions
const ciphertext = await client.generateEntitySecretCiphertext();

await client.createContractExecutionTransaction({
  walletId: "your-wallet-id",
  contractAddress: "0x...", // Your deployed contract on Arc
  abiFunctionSignature: "executeConditionalPayment(address,uint256,bytes32)",
  abiParameters: [
    recipientAddress,
    amount,
    conditionHash  // e.g., hash of delivery confirmation
  ],
  feeLevel: "MEDIUM",
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});
```

#### 2. Automated Recurring Payments
Schedule payments that execute automatically:

```javascript
// Smart contract: RecurringPayments
// Function: setupSubscription(address recipient, uint256 amount, uint256 interval)

await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: recurringPaymentsContract,
  abiFunctionSignature: "setupSubscription(address,uint256,uint256)",
  abiParameters: [
    employeeAddress,
    "1000", // 1000 USDC per month
    "2592000" // 30 days in seconds
  ],
  entitySecretCiphertext: ciphertext
});

// Then trigger payments via cron/webhook
await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: recurringPaymentsContract,
  abiFunctionSignature: "executePayment(uint256)",
  abiParameters: [subscriptionId]
});
```

#### 3. Multi-Signature Treasury
Require multiple approvals before releasing funds:

```javascript
// 1. Create proposal
await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: multiSigContract,
  abiFunctionSignature: "propose(address,uint256,bytes)",
  abiParameters: [destination, amount, data]
});

// 2. Signers approve via signTypedData
const signature = await client.signTypedData({
  walletId: signerWalletId,
  typedData: {
    types: {
      EIP712Domain: [/* ... */],
      Proposal: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "nonce", type: "uint256" }
      ]
    },
    domain: {/* ... */},
    message: {
      to: destination,
      value: amount,
      data: data,
      nonce: proposalNonce
    }
  }
});

// 3. Execute after threshold met
await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: multiSigContract,
  abiFunctionSignature: "execute(uint256,bytes[])",
  abiParameters: [proposalId, signatures]
});
```

#### 4. Escrow with Dispute Resolution

```javascript
// Buyer deposits USDC into escrow
await client.createTransaction({
  amounts: ["100"],
  destinationAddress: escrowContractAddress,
  tokenId: usdcTokenId,
  walletId: buyerWalletId,
  entitySecretCiphertext: ciphertext
});

// Seller confirms delivery
await client.createContractExecutionTransaction({
  walletId: sellerWalletId,
  contractAddress: escrowContractAddress,
  abiFunctionSignature: "confirmDelivery(uint256)",
  abiParameters: [orderId]
});

// Auto-release after timeout or manual approval
await client.createContractExecutionTransaction({
  walletId: arbitratorWalletId,
  contractAddress: escrowContractAddress,
  abiFunctionSignature: "resolveDispute(uint256,bool)",
  abiParameters: [orderId, releaseToBuyer]
});
```

---

## Track 3: Treasury Management with Gateway & Arc

### What This Track Needs

**Circle Technologies:**
- **Circle Gateway** ⚠️ (need to integrate - see below)
- Circle Wallets ✅ (you have)
- Smart Contract Accounts ✅ (SDK supports)
- Arc blockchain ✅ (wallet ready)

### Circle Gateway - What You Need to Know

**Gateway enables:**
1. **Unified USDC balance** across multiple chains
2. **Instant cross-chain transfers** (<500ms)
3. **No manual bridging** - deposits on one chain, withdraw on another
4. **Trustless withdrawals** - users always own their funds

**How it works:**
```
1. Deposit USDC → Gateway Wallet Contract (on any supported chain)
2. Get attestation → Gateway API (sign burn intent)
3. Mint USDC → Destination chain (<500ms)
```

### Treasury Management Features You Can Build

#### 1. Multi-Chain Treasury with Gateway

```javascript
// Example: Treasury deposits on Ethereum, instant access on Arc

// Step 1: Deposit USDC to Gateway on Ethereum
await client.createTransaction({
  amounts: ["10000"], // 10k USDC to treasury
  destinationAddress: GATEWAY_WALLET_CONTRACT_ETH,
  tokenId: usdcEthTokenId,
  walletId: ethWalletId,
  entitySecretCiphertext: ciphertext
});

// Step 2: Access on Arc instantly via Gateway API
// (You'll need to integrate Gateway API - see below)
const attestation = await fetch('https://gateway-api.circle.com/v1/attestation', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CIRCLE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sourceChain: 'ethereum',
    destChain: 'arc',
    amount: '5000', // Use 5k on Arc
    recipient: arcTreasuryAddress,
    signature: burnIntentSignature
  })
});

// Step 3: Mint on Arc using attestation
await client.createContractExecutionTransaction({
  walletId: arcWalletId,
  contractAddress: GATEWAY_MINTER_CONTRACT_ARC,
  abiFunctionSignature: "mint(bytes)",
  abiParameters: [attestation.data.attestationData]
});
```

#### 2. Automated Treasury Allocations

```javascript
// Smart contract: TreasuryAllocator
// Automatically distribute funds based on budget rules

const budgetRules = {
  marketing: { allocation: 30, wallet: marketingWalletAddress },
  development: { allocation: 50, wallet: devWalletAddress },
  operations: { allocation: 20, wallet: opsWalletAddress }
};

// Deploy allocation
await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: treasuryAllocatorContract,
  abiFunctionSignature: "allocate(address[],uint256[])",
  abiParameters: [
    [marketingWallet, devWallet, opsWallet],
    [3000, 5000, 2000] // USDC amounts
  ],
  entitySecretCiphertext: ciphertext
});
```

#### 3. Scheduled Payroll System

```javascript
// Set up monthly payroll
const employees = [
  { address: "0x123...", salary: "5000" },
  { address: "0x456...", salary: "7000" },
  { address: "0x789...", salary: "6000" }
];

await client.createContractExecutionTransaction({
  walletId: treasuryWalletId,
  contractAddress: payrollContract,
  abiFunctionSignature: "executePayroll(address[],uint256[])",
  abiParameters: [
    employees.map(e => e.address),
    employees.map(e => e.salary)
  ]
});

// Monitor via webhooks
await client.createSubscription({
  endpoint: "https://yourapp.com/webhooks/payroll",
  subscriptionDetails: [
    "transactions.outbound",
    "challenges.createTransaction"
  ]
});
```

#### 4. Real-Time Treasury Dashboard

```javascript
// Get all treasury balances across chains
async function getTreasuryBalances() {
  const wallets = await client.listWallets({});

  const balances = await Promise.all(
    wallets.data.wallets.map(async (wallet) => {
      const tokenBalances = await client.getWalletTokenBalance({
        id: wallet.id
      });

      return {
        blockchain: wallet.blockchain,
        address: wallet.address,
        balances: tokenBalances.data.tokenBalances
      };
    })
  );

  return balances;
}

// Calculate total treasury value
const allBalances = await getTreasuryBalances();
const totalUSDC = allBalances.reduce((sum, wallet) => {
  const usdc = wallet.balances.find(b => b.token.symbol === 'USDC');
  return sum + (usdc ? parseFloat(usdc.amount) : 0);
}, 0);

console.log(`Total Treasury: $${totalUSDC.toLocaleString()} USDC`);
```

---

## What You Need to Integrate Next

### For Track 3: Circle Gateway Integration

Gateway is permissionless but requires API integration:

1. **Gateway Smart Contracts** (deployed by Circle):
   - Gateway Wallet contracts (for deposits)
   - Gateway Minter contracts (for withdrawals)
   - Addresses: https://developers.circle.com/gateway/addresses

2. **Gateway API Endpoints**:
   ```
   Base URL: https://gateway-api.circle.com (testnet)

   GET  /v1/balances/{address}           - Get unified balance
   POST /v1/attestation                  - Request mint attestation
   GET  /v1/transactions/{txHash}        - Get transaction status
   ```

3. **Integration Steps**:
   ```javascript
   // a. Deposit to Gateway Wallet
   const GATEWAY_WALLET_ETH = "0x..."; // From Circle docs

   await client.createTransaction({
     amounts: ["1000"],
     destinationAddress: GATEWAY_WALLET_ETH,
     tokenId: usdcTokenId,
     walletId: ethWalletId
   });

   // b. Sign burn intent for destination chain
   const burnIntent = {
     sourceChain: "ethereum",
     destChain: "arc",
     amount: "1000",
     recipient: arcAddress,
     nonce: Date.now()
   };

   const signature = await client.signTypedData({
     walletId: ethWalletId,
     typedData: {
       types: { /* EIP-712 for burn intent */ },
       message: burnIntent
     }
   });

   // c. Get attestation from Gateway API
   const attestation = await fetch('https://gateway-api.circle.com/v1/attestation', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`
     },
     body: JSON.stringify({
       ...burnIntent,
       signature
     })
   });

   // d. Mint on destination chain
   const GATEWAY_MINTER_ARC = "0x..."; // From Circle docs

   await client.createContractExecutionTransaction({
     walletId: arcWalletId,
     contractAddress: GATEWAY_MINTER_ARC,
     abiFunctionSignature: "receiveMessage(bytes)",
     abiParameters: [attestation.data.message]
   });
   ```

---

## Advanced Circle SDK Features for Both Tracks

### 1. Batch Operations (SCA Only)

```javascript
// Create Smart Contract Account wallet
const scaWallet = await client.createWallets({
  accountType: "SCA",  // Not EOA
  blockchains: ["ARC-TESTNET"],
  count: 1
});

// Batch multiple operations in one transaction
await client.createContractExecutionTransaction({
  walletId: scaWallet.data.wallets[0].id,
  contractAddress: batchExecutorContract,
  abiFunctionSignature: "executeBatch(address[],uint256[],bytes[])",
  abiParameters: [
    [contract1, contract2, contract3],
    [0, 0, 0],
    [calldata1, calldata2, calldata3]
  ]
});
```

### 2. Gas Sponsorship (Paymaster)

```javascript
// SCA wallets can have gas fees paid by a paymaster
// User pays in USDC instead of ETH
await client.createContractExecutionTransaction({
  walletId: scaWalletId,
  contractAddress: targetContract,
  abiFunctionSignature: "transfer(address,uint256)",
  abiParameters: [recipient, amount],
  // Gas will be paid by configured paymaster
  // User's transaction succeeds even with 0 ETH balance
});
```

### 3. Transaction Monitoring & Webhooks

```javascript
// Set up webhook for all treasury events
await client.createSubscription({
  endpoint: "https://yourapp.com/webhooks/treasury",
  subscriptionDetails: [
    "transactions.inbound",      // Deposits
    "transactions.outbound",     // Withdrawals
    "modularWallet.userOperation", // SCA operations
    "challenges.createTransaction" // Approval requests
  ]
});

// Webhook handler in your app
app.post('/webhooks/treasury', async (req, res) => {
  const event = req.body;

  if (event.notificationType === 'transactions.outbound') {
    // Log treasury withdrawal
    await logTreasuryEvent({
      type: 'withdrawal',
      amount: event.transaction.amounts[0],
      destination: event.transaction.destinationAddress,
      txHash: event.transaction.txHash
    });
  }

  res.sendStatus(200);
});
```

### 4. Fee Estimation Before Operations

```javascript
// Always estimate fees before treasury operations
const fees = await client.estimateContractExecutionFee({
  walletId: treasuryWalletId,
  contractAddress: payrollContract,
  abiFunctionSignature: "executePayroll(address[],uint256[])",
  abiParameters: [addresses, amounts]
});

console.log('Gas cost estimates:');
console.log('  Low:', fees.data.low.networkFee, 'ETH');
console.log('  Medium:', fees.data.medium.networkFee, 'ETH');
console.log('  High:', fees.data.high.networkFee, 'ETH');

// Use appropriate fee level
await client.createContractExecutionTransaction({
  // ... params
  feeLevel: fees.data.medium.networkFee > 0.01 ? 'LOW' : 'MEDIUM'
});
```

---

## Recommended Architecture

### For Track 1: Smart Contract DeFi System

```
Frontend (Next.js)
  ↓
Circle Wallet Display (show balances)
  ↓
Smart Contracts on Arc (your logic)
  ↓
Circle SDK (execute transactions)
  ↓
USDC/EURC (payment rails)
```

### For Track 3: Treasury Management System

```
Treasury Dashboard (Next.js)
  ↓
Circle Gateway (unified balance)
  ↓
Circle Wallets (multi-chain accounts)
  ↓
Treasury Smart Contracts (allocation logic)
  ↓
Circle SDK (automation)
  ↓
Webhooks (real-time monitoring)
```

---

## Next Steps

1. **For Track 1**:
   - ✅ You have all Circle pieces
   - Deploy smart contracts on Arc testnet
   - Use `createContractExecutionTransaction()` to interact
   - Show advanced logic (escrow, conditions, automation)

2. **For Track 3**:
   - ✅ You have Circle Wallets
   - 🔲 Integrate Circle Gateway API
   - 🔲 Build treasury smart contracts
   - 🔲 Set up automated distributions
   - 🔲 Add webhook monitoring

3. **Resources**:
   - Gateway Docs: https://developers.circle.com/gateway
   - SDK Explorer: https://developers.circle.com/sdk-explorer
   - Arc Faucet: Get testnet USDC for Arc wallet
   - Your SDK Reference: `CIRCLE-SDK-REFERENCE.md`

---

## Quick Wins

**Today you can:**
1. Create treasury allocator contract on Arc
2. Use your existing USDC to test automated transfers
3. Set up webhooks for transaction monitoring
4. Build treasury dashboard showing balances

**Tomorrow you can:**
1. Integrate Gateway for cross-chain treasury
2. Deploy multi-sig approval system
3. Add automated payroll scheduling
4. Implement escrow with conditions

You're 80% there for Track 1, and 60% there for Track 3! 🚀
