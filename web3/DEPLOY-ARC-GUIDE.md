# Deploy Counter Contract to Arc Testnet

## Step 1: Create Deployment Wallet

You need a regular EOA wallet (with private key) to deploy contracts.

```bash
# Generate a new wallet
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

**Save the output:**
- Address: `0x...` (fund this with Arc testnet ETH)
- Private Key: `0x...` (add to .env.local)

## Step 2: Get Arc Testnet ETH

Your deployment wallet needs ETH for gas fees.

**Arc Testnet Faucet Options:**
1. Check Arc documentation: https://arc.xyz/faucet (if available)
2. Or bridge some Sepolia ETH if Arc has a testnet bridge
3. Ask in Arc Discord for testnet tokens

Send ~0.1 ETH to your deployment wallet address from Step 1.

## Step 3: Add Private Key to Environment

Edit `/web3/.env.local`:

```bash
# Existing
SEPOLIA_RPC_URL=https://rpc.sepolia.org
SEPOLIA_PRIVATE_KEY=0x...

# Add this
ARC_TESTNET_PRIVATE_KEY=0x...  # From Step 1
```

## Step 4: Deploy Contract

```bash
cd /Users/gaetano/dev/archackathon/web3

# Compile
npx hardhat compile

# Deploy to Arc testnet
npx hardhat ignition deploy ignition/modules/Counter.ts --network arcTestnet
```

**Output will show:**
```
Deployed Counter to: 0xABCD...1234
```

**Save this contract address!** You'll use it with Circle SDK.

## Step 5: Interact with Circle SDK

Now you can use your Circle wallets to call the deployed contract!

### Using the UI (Homepage)

1. Go to http://localhost:3000
2. Open "Contract Executor" section
3. Fill in:
   - **Executing Wallet:** Select your Circle wallet
   - **Contract Address:** `0xABCD...1234` (from Step 4)
   - **Function Signature:** `inc()`
   - **Parameters:** `[]`
4. Click "Execute Contract"

### Using Code

```javascript
const { getCircleClient } = await import('@/lib/circle-wallet');
const client = getCircleClient();

const ciphertext = await client.generateEntitySecretCiphertext();

// Increment counter using Circle wallet
const tx = await client.createContractExecutionTransaction({
  walletId: "your-circle-wallet-id",
  contractAddress: "0xABCD...1234", // Deployed contract
  abiFunctionSignature: "inc()",
  abiParameters: [],
  feeLevel: "MEDIUM",
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});

console.log("Transaction:", tx.data.id);
```

## Summary

```
Deployment Wallet (EOA)  →  Deploy contract to Arc
        ↓
Contract Address: 0x...
        ↓
Circle Wallet  →  Execute contract functions
```

---

## Troubleshooting

### "Insufficient funds for gas"
- Fund your deployment wallet with Arc testnet ETH

### "Network not found"
- Make sure `arcTestnet` is in hardhat.config.ts
- Check RPC URL is correct: https://rpc-testnet.archub.io

### "Private key not set"
- Make sure `ARC_TESTNET_PRIVATE_KEY` is in web3/.env.local
- Include the `0x` prefix

### Can't find Arc faucet
- Check Arc official docs
- Ask in Arc Discord/Telegram
- Bridge from another testnet if available
