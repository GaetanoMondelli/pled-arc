# Counter Contract Deployment on Arc Testnet

## Deployment Details

**Contract Address**: `0xB070f8E15B34333A70C9Ac3158363a1d8667e617`

**Transaction Hash**: `0xa3a88a7d0015459772a1d563541fa98dbbcc3ca495e70ae71089db79e9f2eb17`

**Deployer Address**: `0x431a68dB42869B7f79EC290dcE505E879bE9794A`

**Block Explorer**: https://testnet.arcscan.app/address/0xB070f8E15B34333A70C9Ac3158363a1d8667e617

**Network**: Arc Testnet
- Chain ID: 5042002
- RPC: https://rpc.testnet.arc.network
- Gas Token: USDC

---

## Contract Verification

**Status**: ⏳ Pending manual verification

**To verify:**
1. Go to: https://testnet.arcscan.app/address/0xB070f8E15B34333A70C9Ac3158363a1d8667e617#code
2. Click "Verify & Publish"
3. Use settings:
   - Compiler: Solidity (Single file)
   - Version: v0.8.28+commit.7893614a
   - License: UNLICENSED
   - Optimization: No
4. Paste source from `Counter.sol`
5. Submit

---

## Contract Interface

**Functions:**
- `x()` - View current counter value
- `inc()` - Increment counter by 1
- `incBy(uint256 by)` - Increment counter by custom amount

**Events:**
- `Increment(uint256 by)` - Emitted on each increment

---

## Using with Circle SDK

The contract is ready to use with Circle's Developer-Controlled Wallets SDK:

```javascript
// Execute contract function via Circle SDK
const transaction = await client.createContractExecutionTransaction({
  walletId: 'your-wallet-id',
  contractAddress: '0xB070f8E15B34333A70C9Ac3158363a1d8667e617',
  abiFunctionSignature: 'inc()',
  abiParameters: [],
  feeLevel: 'MEDIUM',
  idempotencyKey: crypto.randomUUID(),
  entitySecretCiphertext: ciphertext
});
```

---

## Security Notes

- Deployer wallet private key stored in `/web3/.env.local`
- This is a randomly generated wallet (not a known test account)
- Contains testnet USDC only (no real value)
- ⚠️ DO NOT commit private keys to version control

---

## Track 1 Requirements ✅

- ✅ Deployed on Arc blockchain
- ✅ Uses USDC for gas fees
- ✅ Includes programmable logic (counter with validation)
- ✅ Can transfer USDC/EURC via Circle SDK
- ✅ Can execute contract functions via Circle SDK
