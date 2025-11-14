# Circle Developer Controlled Wallets SDK - Reference

Complete reference for `@circle-fin/developer-controlled-wallets` v9.3.0

## Installation

```bash
npm install @circle-fin/developer-controlled-wallets
```

## Initialization

```javascript
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
});
```

**Requirements:**
- Node.js 16+
- API Key from Circle Console
- 32-byte Entity Secret (64 hex chars)

---

## Entity Secret Management

### `generateEntitySecret()`
Generate a new 32-byte entity secret
```javascript
const secret = await client.generateEntitySecret();
// Returns: 64-char hex string
```

### `getPublicKey()`
Get RSA public key for encryption
```javascript
const { data } = await client.getPublicKey();
// Returns: { publicKey: "string" }
```

### `generateEntitySecretCiphertext()`
Generate encrypted ciphertext for API requests
```javascript
const ciphertext = await client.generateEntitySecretCiphertext();
```

### `registerEntitySecretCiphertext()`
Register entity secret with Circle
```javascript
const response = await client.registerEntitySecretCiphertext();
// Downloads recovery file - STORE SECURELY
```

---

## Wallet Management

### `createWalletSet({ name? })`
Create a logical wallet grouping
```javascript
const { data } = await client.createWalletSet({
  name: "My Wallet Set"
});
// Returns: { walletSet: { id, custodyType, createDate, updateDate } }
```

### `createWallets({ accountType, blockchains, count, walletSetId })`
Create one or more wallets
```javascript
const { data } = await client.createWallets({
  accountType: "SCA" | "EOA",
  blockchains: ["ETH-SEPOLIA", "ARC-TESTNET"],
  count: 2,
  walletSetId: "uuid"
});
// Returns: { wallets: [{ id, address, blockchain, state, ... }] }
```

**Supported Blockchains:**
- **Mainnet:** ARB, AVAX, BASE, ETH, MATIC, OP, UNI, SOL, NEAR, APTOS, EVM
- **Testnet:** ARB-SEPOLIA, AVAX-FUJI, BASE-SEPOLIA, ETH-SEPOLIA, MATIC-AMOY, OP-SEPOLIA, UNI-SEPOLIA, ARC-TESTNET, SOL-DEVNET, NEAR-TESTNET, APTOS-TESTNET, EVM-TESTNET

### `getWallet({ id })`
Get specific wallet by ID
```javascript
const { data } = await client.getWallet({ id: "uuid" });
```

### `listWallets({ blockchain?, walletSetId?, address?, pageSize? })`
List all wallets with filtering
```javascript
const { data } = await client.listWallets({
  blockchain: "ETH-SEPOLIA",
  pageSize: 20
});
```

### `updateWallet({ id, name?, refId? })`
Update wallet metadata
```javascript
const { data } = await client.updateWallet({
  id: "uuid",
  name: "Updated Name",
  refId: "ref-123"
});
```

---

## Balance & Token Methods

### `getWalletsWithBalances({ blockchain, address?, tokenAddress?, walletSetId?, amountGte? })`
Get wallets with native and token balances
```javascript
const { data } = await client.getWalletsWithBalances({
  blockchain: "ETH-SEPOLIA",
  amountGte: "1"  // Min balance threshold
});
// Returns: { wallets: [{ ...wallet, tokenBalances: [...] }] }
```

### `getWalletTokenBalance({ id })`
Get token balance for specific wallet
```javascript
const { data } = await client.getWalletTokenBalance({ id: "uuid" });
// Returns: { tokenBalances: [{ token, amount, updateDate }] }
```

### `getWalletNFTBalance({ id })`
Get NFT balance (ERC-721, ERC-1155)
```javascript
const { data } = await client.getWalletNFTBalance({ id: "uuid" });
```

---

## Token Monitoring

### `getToken({ id })`
Get token information by UUID
```javascript
const { data } = await client.getToken({ id: "token-uuid" });
```

### `createMonitoredTokens()`
Add tokens to monitoring list
```javascript
await client.createMonitoredTokens({ /* params */ });
```

### `listMonitoredTokens()`
List all monitored tokens
```javascript
const { data } = await client.listMonitoredTokens();
```

### `updateMonitoredTokensScope({ scope })`
Update monitoring scope
```javascript
await client.updateMonitoredTokensScope({
  scope: "MONITOR_ALL"
});
```

### `deleteMonitoredTokens()`
Remove tokens from monitoring

---

## Transaction Methods

### `createTransaction({ amounts, destinationAddress, tokenId, walletId, feeLevel?, entitySecretCiphertext, idempotencyKey })`
Create a transfer transaction
```javascript
const ciphertext = await client.generateEntitySecretCiphertext();

const { data } = await client.createTransaction({
  amounts: ["0.01"],
  destinationAddress: "0x...",
  tokenId: "token-uuid",
  walletId: "wallet-uuid",
  feeLevel: "LOW" | "MEDIUM" | "HIGH",
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext,
  refId: "payment-123"  // Optional tracking ID
});
// Returns: { id, state: "INITIATED" }
```

**Gas Options:**
- `feeLevel`: "LOW" | "MEDIUM" | "HIGH" (recommended)
- OR manual: `gasLimit`, `gasPrice`, `maxFee`, `priorityFee`

### `createContractExecutionTransaction({ walletId, contractAddress, abiFunctionSignature, abiParameters?, feeLevel?, entitySecretCiphertext })`
Execute smart contract function
```javascript
const { data } = await client.createContractExecutionTransaction({
  walletId: "uuid",
  contractAddress: "0x...",
  abiFunctionSignature: "transfer(address,uint256)",
  abiParameters: ["0x...", "1000000"],
  feeLevel: "HIGH",
  amount: "0",  // For payable functions
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});
```

### `getTransaction({ id })`
Get transaction details
```javascript
const { data } = await client.getTransaction({ id: "tx-uuid" });
// Returns: { id, state, blockchain, txHash, ... }
```

**Transaction States:**
- `INITIATED` → `QUEUED` → `SENT` → `CONFIRMED` → `COMPLETED`
- Failed states: `FAILED`, `DENIED`, `CANCELLED`, `STUCK`

### `listTransactions({ walletIds?, blockchain?, tokenId?, pageSize? })`
List transactions with filtering
```javascript
const { data } = await client.listTransactions({
  walletIds: ["uuid1", "uuid2"],
  blockchain: "ETH-SEPOLIA",
  pageSize: 50
});
```

### `estimateTransferFee({ destinationAddress, amounts, tokenId })`
Estimate gas fees before transaction
```javascript
const { data } = await client.estimateTransferFee({
  destinationAddress: "0x...",
  amounts: ["0.01"],
  tokenId: "token-uuid"
});
// Returns: { low: {...}, medium: {...}, high: {...} }
// Each tier includes: gasLimit, gasPrice, maxFee, priorityFee, networkFee
```

### `estimateContractExecutionFee({ walletId, contractAddress, abiFunctionSignature, abiParameters? })`
Estimate gas for contract execution
```javascript
const { data } = await client.estimateContractExecutionFee({
  walletId: "uuid",
  contractAddress: "0x...",
  abiFunctionSignature: "mint(address,uint256)",
  abiParameters: ["0x...", "1"]
});
```

### `accelerateTransaction({ id, entitySecretCiphertext })`
Speed up pending transaction (increases gas)
```javascript
await client.accelerateTransaction({
  id: "tx-uuid",
  entitySecretCiphertext: ciphertext
});
```

### `cancelTransaction({ id, entitySecretCiphertext })`
Cancel pending transaction (submits cancellation with higher gas)
```javascript
await client.cancelTransaction({
  id: "tx-uuid",
  entitySecretCiphertext: ciphertext
});
```

### `validateAddress({ address, blockchain, tokenId? })`
Validate blockchain address
```javascript
const { data } = await client.validateAddress({
  address: "0x...",
  blockchain: "ETH-SEPOLIA"
});
// Returns: { isValid: boolean }
```

---

## Signing Methods

### `signMessage({ walletId, message, isHex?, memo? })`
Sign EIP-191 message (Ethereum & EVM only)
```javascript
const { data } = await client.signMessage({
  walletId: "uuid",
  message: "Hello, World!",
  isHex: false,
  memo: "User authentication"
});
```

### `signTypedData({ walletId, typedData })`
Sign EIP-712 typed structured data (Ethereum & EVM only)
```javascript
const { data } = await client.signTypedData({
  walletId: "uuid",
  typedData: {
    types: { /* EIP-712 types */ },
    domain: { /* domain separator */ },
    message: { /* message data */ }
  }
});
```

---

## Webhook Subscriptions

### `createSubscription({ endpoint, subscriptionDetails? })`
Create webhook for notifications
```javascript
const { data } = await client.createSubscription({
  endpoint: "https://myapp.com/webhook",  // Must be HTTPS
  subscriptionDetails: [
    "transactions.*",
    "challenges.createWallet",
    "modularWallet.inboundTransfer"
  ]
});
```

**Notification Types:**
- `*` - All events
- `transactions.*` / `transactions.inbound` / `transactions.outbound`
- `challenges.*` / `challenges.createTransaction` / etc
- `modularWallet.*` / `modularWallet.userOperation`
- `contracts.*` / `contracts.eventLog`
- `travelRule.*` / `rampSession.*`

**Webhook Requirements:**
- HTTPS endpoint (publicly accessible)
- Responds to HEAD and POST requests
- Returns 2XX status
- Responds within 5 seconds

### `getSubscription({ id })`
Get subscription details
```javascript
const { data } = await client.getSubscription({ id: "sub-uuid" });
```

### `listSubscriptions()`
List all subscriptions
```javascript
const { data } = await client.listSubscriptions();
```

### `updateSubscription({ id, endpoint?, subscriptionDetails? })`
Update subscription configuration
```javascript
await client.updateSubscription({
  id: "sub-uuid",
  subscriptionDetails: ["transactions.outbound"]
});
```

### `deleteSubscription({ id })`
Delete webhook subscription
```javascript
await client.deleteSubscription({ id: "sub-uuid" });
```

---

## Utility Methods

### `ping()`
Health check to verify service is running
```javascript
await client.ping();
```

---

## Account Types

### EOA (Externally Owned Account)
- Private/public key pair
- No wallet creation fees
- Higher throughput
- **Best for:** Ethereum mainnet, Solana, mass distribution, airdrops
- **Supported:** All blockchains

### SCA (Smart Contract Account)
- Controlled by smart contract logic
- Flexible key configuration
- Key recovery support
- Gas abstraction (ERC-4337 paymaster)
- Batch operations
- **Best for:** Layer 2 chains, Web2-like UX, gas sponsorship
- **Supported:** EVM chains only (not Solana, NEAR, Aptos)

---

## Complete Example

```javascript
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");
const crypto = require('crypto');

// 1. Initialize
const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

// 2. Create wallet set
const walletSet = await client.createWalletSet({
  name: "Production Wallets"
});

// 3. Create wallets
const { data } = await client.createWallets({
  accountType: "SCA",
  blockchains: ["MATIC-AMOY"],
  count: 2,
  walletSetId: walletSet.data.walletSet.id
});

const wallet = data.wallets[0];

// 4. Check balance
const balances = await client.getWalletsWithBalances({
  blockchain: "MATIC-AMOY",
  address: wallet.address
});

// 5. Estimate fee
const fees = await client.estimateTransferFee({
  destinationAddress: "0xa51c9c604b79a0fadbfed35dd576ca1bce71da0a",
  amounts: ["0.01"],
  tokenId: "token-uuid"
});

console.log("Medium fee:", fees.data.medium);

// 6. Create transaction
const ciphertext = await client.generateEntitySecretCiphertext();

const tx = await client.createTransaction({
  amounts: ["0.01"],
  destinationAddress: "0xa51c9c604b79a0fadbfed35dd576ca1bce71da0a",
  tokenId: "token-uuid",
  walletId: wallet.id,
  feeLevel: "MEDIUM",
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});

console.log("Transaction:", tx.data.id, tx.data.state);

// 7. Monitor transaction
const status = await client.getTransaction({ id: tx.data.id });
console.log("State:", status.data.state);
```

---

## Best Practices

**Security:**
- Never commit entity secrets to version control
- Store secrets in environment variables or secret managers
- Use idempotency keys for all mutating operations
- Rotate entity secrets periodically

**Gas Management:**
- Use `feeLevel: "HIGH"` for time-sensitive transactions
- Always estimate fees before transactions
- Monitor stuck transactions, use `accelerateTransaction()` if needed

**Performance:**
- Use pagination for large result sets
- Implement webhooks instead of polling
- Cache token information

**Testing:**
- Always test on testnets first
- Use Circle faucet: https://faucet.circle.com/
- Monitor via Circle Console

**Account Selection:**
- EOAs for Ethereum mainnet (lower cost)
- SCAs for Layer 2 (better UX)
- Solana/NEAR/Aptos only support EOAs

---

## Resources

- **Docs:** https://developers.circle.com/
- **Console:** https://console.circle.com/
- **Faucet:** https://faucet.circle.com/
- **NPM:** https://www.npmjs.com/package/@circle-fin/developer-controlled-wallets
