# Green Energy Carbon Credits - USDC Reward System

A complete Web3 application for claiming USDC rewards based on verifiable carbon credit claims on Arc blockchain.

## Architecture

### Smart Contracts (Arc Testnet)

1. **IncrementalVerifiableClaim** (`0xa31c26368B181F02Cbf463cee7a67c16b003fA2d`)
   - NFT-like contract for carbon credit claims
   - Each claim has an aggregate value (e.g., 32 carbon credits)
   - Uses Merkle trees for verifiable event history

2. **GreenEnergyReward** (`0x69c1f9189679155736b434c671260b6622b6f56c`)
   - Escrow contract that holds USDC
   - Distributes rewards: `claim_value × 0.01 USDC`
   - Example: 32 carbon credits = 0.32 USDC

3. **USDC** (`0x3600000000000000000000000000000000000000`)
   - Native USDC on Arc blockchain
   - Used for reward payments

## How It Works

### For Admins (Funding the Escrow)

**Q: Do I need to send USDC to the GreenEnergyReward contract?**
**A: YES!** The contract needs USDC in its escrow before users can claim rewards.

1. Go to `/carbon-credits` page
2. In the "Fund Escrow (Admin)" section, enter amount
3. Click "Fund Escrow"
4. This will:
   - Approve USDC spending
   - Transfer USDC to the reward contract
   - Update escrow balance

### For Users (Claiming Rewards)

1. Go to `/carbon-credits` page
2. Enter your wallet address or it loads automatically
3. Click "Load Wallet"
4. View your carbon credit claims
5. Click "Claim Reward" on individual claims or "Claim All Rewards"
6. USDC is transferred from escrow to your wallet

## Reward Calculation

```
Reward = Carbon Credits × 0.01 USDC
```

Examples:
- 10 credits → 0.10 USDC
- 32 credits → 0.32 USDC
- 100 credits → 1.00 USDC

## Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components

### Backend API Routes
All use Circle SDK for blockchain interactions:

1. **`/api/carbon-credits/wallet`** (GET)
   - Load wallet data
   - Returns: claims, balances, rewards
   - Uses Circle SDK `callContractFunction`

2. **`/api/carbon-credits/claim`** (POST)
   - Claim single reward
   - Uses Circle SDK `createContractExecutionTransaction`

3. **`/api/carbon-credits/claim-batch`** (POST)
   - Claim multiple rewards at once
   - Uses Circle SDK batch transaction

4. **`/api/carbon-credits/fund-escrow`** (POST)
   - Admin function to fund the escrow
   - Approves + transfers USDC

5. **`/api/carbon-credits/session`** (GET)
   - Get current wallet session
   - Auto-loads wallet address

### Smart Contracts
- **Solidity 0.8.28**
- **Hardhat** - Development framework
- **Viem** - Ethereum library for deployment

## Files Created

### Frontend
- `app/src/app/carbon-credits/page.tsx` - Main dashboard

### API Routes
- `app/src/app/api/carbon-credits/wallet/route.ts`
- `app/src/app/api/carbon-credits/claim/route.ts`
- `app/src/app/api/carbon-credits/claim-batch/route.ts`
- `app/src/app/api/carbon-credits/fund-escrow/route.ts`
- `app/src/app/api/carbon-credits/session/route.ts`

### Smart Contracts
- `web3/contracts/GreenEnergyReward.sol`
- `web3/contracts/IncrementalVerifiableClaim.sol` (existing)

### Deployment Scripts
- `web3/deploy-green-energy-viem.js`
- `web3/test-green-energy-reward.js`

## Usage Flow

### 1. Initial Setup (Admin)
```bash
# Fund the escrow with USDC
curl -X POST http://localhost:3000/api/carbon-credits/fund-escrow \
  -H "Content-Type: application/json" \
  -d '{"amount": "100"}'
```

### 2. User Claims Reward
```bash
# Load wallet data
curl http://localhost:3000/api/carbon-credits/wallet?address=0x...

# Claim reward
curl -X POST http://localhost:3000/api/carbon-credits/claim \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "123...", "walletAddress": "0x..."}'
```

## Environment Variables

Required in `app/.env`:
```env
# Circle SDK
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...

# Contracts
NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS=0xa31c26368B181F02Cbf463cee7a67c16b003fA2d
NEXT_PUBLIC_GREEN_ENERGY_REWARD_ADDRESS=0x69c1f9189679155736b434c671260b6622b6f56c
NEXT_PUBLIC_BLOCKCHAIN_NETWORK=arc-testnet
```

## Circle SDK Integration

All blockchain interactions use Circle's Developer-Controlled Wallets SDK:

### Read Operations (View Functions)
```typescript
await walletClient.callContractFunction({
  blockchain: "ARC-TESTNET",
  contractAddress: CONTRACT_ADDRESS,
  abiFunctionSignature: "getClaimMetadata(uint256)",
  abiParameters: [tokenId],
});
```

### Write Operations (Transactions)
```typescript
await walletClient.createContractExecutionTransaction({
  walletId: arcWallet.id,
  blockchain: "ARC-TESTNET",
  contractAddress: REWARD_CONTRACT_ADDRESS,
  abiFunctionSignature: "claimReward(uint256)",
  abiParameters: [tokenId],
  fee: {
    type: "level",
    config: { feeLevel: "MEDIUM" },
  },
  entitySecretCiphertext: ciphertext,
});
```

## Features

### Dashboard Features
- ✅ View all verifiable claims owned by wallet
- ✅ See USDC balance
- ✅ Check escrow balance
- ✅ Calculate potential rewards
- ✅ Claim individual rewards
- ✅ Claim all rewards at once
- ✅ Admin fund escrow functionality
- ✅ Real-time status updates

### Smart Contract Features
- ✅ USDC escrow management
- ✅ Claim-based reward calculation
- ✅ Double-claim prevention
- ✅ Batch claiming support
- ✅ Admin emergency withdrawal
- ✅ Event emission for tracking

## Testing

### Test the Smart Contract
```bash
cd web3
export ARC_TESTNET_PRIVATE_KEY=0x...
node test-green-energy-reward.js
```

### Test the Web App
```bash
cd app
npm run dev
# Open http://localhost:3000/carbon-credits
```

## Deployed Contracts

**Arc Testnet:**
- IncrementalVerifiableClaim: [0xa31c26368B181F02Cbf463cee7a67c16b003fA2d](https://testnet.arcscan.app/address/0xa31c26368B181F02Cbf463cee7a67c16b003fA2d)
- GreenEnergyReward: [0x69c1f9189679155736b434c671260b6622b6f56c](https://testnet.arcscan.app/address/0x69c1f9189679155736b434c671260b6622b6f56c)

## Security Considerations

1. **Access Control**: Only claim owners can claim rewards
2. **Double-Claim Prevention**: Mapping tracks claimed tokens
3. **Admin Controls**: Emergency withdrawal for admin only
4. **Balance Checks**: Ensures sufficient escrow before claiming
5. **Input Validation**: All inputs validated on-chain and API

## Next Steps

1. Fund the escrow with USDC using the admin panel
2. Mint verifiable claims using IncrementalVerifiableClaim
3. Users can view and claim their rewards
4. Monitor escrow balance and refill as needed

## Support

For issues or questions:
- Check contract on [Arc Testnet Explorer](https://testnet.arcscan.app)
- Review transaction logs
- Check API logs in Next.js console
