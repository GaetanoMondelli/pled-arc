# Carbon Credits App - Improvements

## Changes Made

### 1. **Wallet Dropdown**
Added a dropdown selector that shows all your Circle wallets:

```typescript
// New API endpoint
GET /api/carbon-credits/wallets
// Returns list of ARC-TESTNET wallets from Circle

// UI Component
<Select value={walletAddress} onValueChange={setWalletAddress}>
  {availableWallets.map(wallet => ...)}
</Select>
```

**Features:**
- Auto-loads all Circle wallets on page load
- Shows wallet address in dropdown (0x1234...5678 format)
- Shows wallet state (LIVE, FROZEN, etc.)
- Auto-selects first wallet if available
- Option to enter custom address manually

### 2. **Better Error Handling**

**API Level:**
```typescript
// Detailed logging
console.log("[Carbon Credits API] Loading wallet data for address");
console.log("[Carbon Credits API] Found X token IDs");

// Specific error messages
if (error.message?.includes("401")) {
  errorMessage = "Invalid Circle API credentials";
}
if (error.message?.includes("ECONNREFUSED")) {
  errorMessage = "Cannot connect to Circle API";
}
```

**UI Level:**
```typescript
// Error state display
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### 3. **Improved UX**

- Loading states for all actions
- Toast notifications for success/error
- Clear error messages in red alert boxes
- Disabled states while loading
- Better visual feedback

## How to Debug 500 Errors

### Step 1: Check Browser Console
```javascript
// Open DevTools > Console
// Look for error messages
```

### Step 2: Check Server Logs
```bash
cd app
npm run dev

# Watch for output like:
# [Carbon Credits API] Loading wallet data for 0x...
# [Carbon Credits API] Circle client initialized
# [Carbon Credits API] Found X token IDs
```

### Step 3: Common Errors & Fixes

**Error: "Invalid Circle API credentials"**
```bash
# Check .env file has correct values
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
```

**Error: "Cannot connect to Circle API"**
- Network issue
- Check if Circle API is accessible
- Try: `curl https://api.circle.com/v1/w3s/config/entity/publicKey`

**Error: "Failed to load wallet data"**
- Contract might not be deployed
- Wrong contract address
- Check NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS

**Error: "Address required"**
- Make sure wallet address is selected
- Check dropdown has wallets loaded

## Testing the App

### 1. Start the Development Server
```bash
cd app
npm run dev
```

### 2. Open the Page
```
http://localhost:3000/carbon-credits
```

### 3. Expected Behavior

**On Page Load:**
1. Dropdown should populate with your Circle wallets
2. First wallet auto-selected
3. No errors in console

**When Clicking "Load Wallet":**
1. Loading spinner shows
2. API call to `/api/carbon-credits/wallet?address=0x...`
3. Claims are displayed
4. Balances shown in cards

**If No Claims:**
```
Alert: "No verifiable claims found for this wallet"
```

**If Claims Exist:**
```
Cards show:
- Carbon Credits: X
- Reward: Y USDC
- Claim button (if claimable)
```

### 4. Check Server Logs

Good output looks like:
```
[Carbon Credits API] Loading wallet data for 0x431a68d...
[Carbon Credits API] Circle client initialized
[Carbon Credits API] Fetching all token IDs...
[Carbon Credits API] Found 5 total token IDs
[Carbon Credits API] Successfully loaded 2 claims for wallet
```

Bad output looks like:
```
[Carbon Credits API] Error loading wallet data: <error details>
```

## Files Updated

### New Files
- `app/src/app/api/carbon-credits/wallets/route.ts` - List Circle wallets

### Updated Files
- `app/src/app/carbon-credits/page.tsx` - Added dropdown, error handling
- `app/src/app/api/carbon-credits/wallet/route.ts` - Better logging, error messages

## UI Improvements

### Before
- Manual address input only
- Generic error messages
- No visual feedback for errors

### After
- Dropdown selector with Circle wallets
- Manual input still available
- Specific error messages
- Red alert box for errors
- Loading states everywhere
- Console logs for debugging

## Next Steps for Debugging

If you're still seeing 500 errors:

1. **Check the exact error message** in browser DevTools > Network tab
2. **Look at server console** for detailed logs
3. **Verify environment variables** are set correctly
4. **Test Circle API directly** using scripts in `app/scripts/`

### Quick Test
```bash
# Test if Circle SDK works
cd app
node scripts/test-circle-api.ts
```

If this works, the issue is in the carbon credits API logic.
If this fails, the issue is with Circle SDK configuration.
