# Circle Developer-Controlled Wallets Setup

## Overview

This project integrates Circle's Developer-Controlled Wallets, allowing you to create and manage blockchain wallets programmatically on behalf of your users.

## What Are Developer-Controlled Wallets?

Developer-controlled wallets are blockchain wallets created and managed by your application via Circle's API. Unlike user-controlled wallets (like MetaMask), these wallets:

- Are created programmatically by your backend
- Don't require users to have an existing wallet
- Circle manages the private keys securely
- Perfect for onboarding users new to Web3

## Current Setup

### Installed Packages

```json
"@circle-fin/developer-controlled-wallets": "^latest"
```

### Environment Variables

Located in `/app/.env.local`:

```bash
CIRCLE_API_KEY=TEST_CLIENT_KEY:810fc73501663c0ee13e409022867c0e:c7320a0606e387255789a4a326a52bdf
CIRCLE_ENTITY_SECRET=your-entity-secret-here  # ⚠️ NEEDS TO BE SET
```

## Getting Your Credentials

### 1. Create Circle Account

Visit: https://developers.circle.com/wallets

### 2. Get Your API Key

You already have this: `TEST_CLIENT_KEY:...` (from .env)

### 3. Get Your Entity Secret

**Important:** You need to obtain your Entity Secret from Circle's dashboard:

1. Log in to Circle Console: https://console.circle.com/
2. Navigate to your project settings
3. Find "Developer-Controlled Wallets" section
4. Copy your **Entity Secret**
5. Update `.env.local` with the secret:

```bash
CIRCLE_ENTITY_SECRET=your-actual-entity-secret-here
```

## How It Works

### Architecture

```
┌─────────────────┐
│   Your App      │
│   (Next.js)     │
└────────┬────────┘
         │
         │ API Calls
         ↓
┌─────────────────┐      ┌──────────────────┐
│  Circle API     │─────→│  Blockchain      │
│  (Wallets)      │      │  (ETH, Polygon)  │
└─────────────────┘      └──────────────────┘
```

### Files Created

1. **`/app/src/lib/circle-wallet.ts`** - Circle SDK wrapper with helper functions:
   - `getCircleClient()` - Initialize Circle client
   - `getCirclePublicKey()` - Get encryption public key
   - `createWallet()` - Create new wallet
   - `listWallets()` - List all wallets
   - `getWallet()` - Get specific wallet
   - `getWalletBalance()` - Get wallet balance

2. **`/app/src/app/api/circle/wallet/route.ts`** - API endpoints:
   - `GET /api/circle/wallet` - List all wallets
   - `GET /api/circle/wallet?action=publicKey` - Get public key
   - `POST /api/circle/wallet` - Create new wallet

3. **`/app/src/components/CircleWalletDisplay.tsx`** - UI component:
   - Displays all Circle wallets
   - "Create Wallet" button
   - Shows wallet address, blockchain, status
   - Error handling and loading states

## Usage

### Homepage Display

The Circle wallet component is already integrated into your homepage at `/app/src/app/page.tsx`:

```tsx
import { CircleWalletDisplay } from '@/components/CircleWalletDisplay';

export default function Home() {
  return (
    <main>
      {/* Your existing content */}
      <CircleWalletDisplay />
    </main>
  );
}
```

### Creating a Wallet Programmatically

```typescript
import { createWallet, getCirclePublicKey } from '@/lib/circle-wallet';

// 1. Get public key for encryption
const publicKey = await getCirclePublicKey();

// 2. Create wallet
const wallet = await createWallet({
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: 'encrypted-entity-secret', // Encrypt with public key
  blockchains: ['ETH-SEPOLIA'], // or 'MATIC-AMOY', 'ETH', etc.
  count: 1,
});

console.log('Wallet created:', wallet.data.wallets[0].address);
```

### Listing Wallets

```typescript
import { listWallets } from '@/lib/circle-wallet';

const response = await listWallets();
const wallets = response.data.wallets;

wallets.forEach(wallet => {
  console.log(`Address: ${wallet.address}`);
  console.log(`Blockchain: ${wallet.blockchain}`);
  console.log(`State: ${wallet.state}`);
});
```

## RainbowKit vs Circle Wallets

Your app now supports **BOTH**:

### RainbowKit (User-Controlled)
- Users connect their own wallets (MetaMask, Coinbase, etc.)
- Users manage their own private keys
- Great for experienced Web3 users
- Already configured in `/app/src/components/providers.tsx`

### Circle Wallets (Developer-Controlled)
- You create wallets for users programmatically
- Circle manages private keys
- Perfect for Web3 newcomers
- Just set up!

## Next Steps

1. **Set Entity Secret**
   - Get from Circle Console
   - Update `.env.local`

2. **Implement Encryption**
   - The current implementation uses a placeholder for `entitySecretCiphertext`
   - You need to encrypt your entity secret with Circle's public key
   - See: https://developers.circle.com/wallets/dev-controlled/quickstart

3. **Test Wallet Creation**
   ```bash
   npm run dev
   ```
   - Visit http://localhost:3000
   - Click "Create Wallet" button
   - Check for errors in console

4. **Add Wallet Operations**
   - Send transactions
   - Check balances
   - Sign messages
   - Transfer tokens

## API Reference

### Circle SDK Methods

```typescript
// Initialize client
const client = initiateDeveloperControlledWalletsClient({
  apiKey: 'your-api-key',
  entitySecret: 'your-entity-secret'
});

// Get public key
await client.getPublicKey();

// Create wallets
await client.createWallets({
  idempotencyKey: string,
  entitySecretCiphertext: string,
  blockchains: string[],
  count: number,
});

// List wallets
await client.listWallets({});

// Get wallet
await client.getWallet({ id: 'wallet-id' });

// Get balance
await client.getWalletTokenBalance({ id: 'wallet-id' });
```

## Supported Blockchains

- `ETH` - Ethereum Mainnet
- `ETH-SEPOLIA` - Ethereum Sepolia Testnet
- `MATIC` - Polygon Mainnet
- `MATIC-AMOY` - Polygon Amoy Testnet
- `AVAX` - Avalanche C-Chain
- And more...

## Resources

- **Circle Docs**: https://developers.circle.com/wallets
- **Quickstart Guide**: https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
- **API Reference**: https://developers.circle.com/wallets/reference
- **Circle Console**: https://console.circle.com/

## Troubleshooting

### "CIRCLE_ENTITY_SECRET is not set"

**Solution:** Get your entity secret from Circle Console and add it to `.env.local`

### "Failed to create wallet"

**Possible causes:**
- Entity secret not set
- Invalid API key
- entitySecretCiphertext not properly encrypted
- Network issues

**Debug:**
```bash
# Check API route logs
npm run dev
# Check browser console for detailed errors
```

### "No wallets found"

This is normal if you haven't created any wallets yet. Click "Create Wallet" to get started.

## Security Notes

- **Never commit** `.env.local` to git (it's in `.gitignore`)
- **Entity Secret** is sensitive - treat it like a password
- **API Key** should only be used server-side (in API routes)
- Consider implementing rate limiting for wallet creation
