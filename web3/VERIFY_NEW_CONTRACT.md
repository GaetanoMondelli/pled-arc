# Verify IncrementalVerifiableClaim on ArcScan (NEW CONTRACT)

## Contract Details
- **Address**: `0xa31c26368B181F02Cbf463cee7a67c16b003fA2d`
- **Network**: Arc Testnet
- **Chain ID**: 5042002
- **Block Explorer**: https://testnet.arcscan.app

## Verification Steps

1. Go to: https://testnet.arcscan.app/address/0xa31c26368B181F02Cbf463cee7a67c16b003fA2d#code

2. Click "Verify & Publish" button

3. Fill in the form:

### Contract Address
```
0xa31c26368B181F02Cbf463cee7a67c16b003fA2d
```

### Compiler Type
- Select: **Solidity (Single file)**

### Compiler Version
- Select: **v0.8.28+commit.7893614a**

### Open Source License Type
- Select: **MIT License (MIT)**

### Optimization
- Select: **No** (optimization disabled)

### Solidity Contract Code
- Copy the ENTIRE contents of `IncrementalVerifiableClaim-flattened-new.sol`

4. Click "Verify & Publish"

## Alternative: Using ABI Only

If full verification fails, you can import just the ABI:

1. Copy the contents of `IncrementalVerifiableClaim-abi-new.json`
2. Paste it in the ABI import section on ArcScan

## New Features in This Contract

This version includes ERC-721 enumeration support:
- ✅ `totalSupply()` - Returns actual count of minted tokens
- ✅ `tokenByIndex(uint256 index)` - Get token ID by index
- ✅ `getAllTokenIds()` - Get all token IDs at once
- ✅ Full ERC-721 compliance while maintaining deterministic token IDs

## Notes

- The contract uses Solidity 0.8.28
- Optimization is DISABLED (important for verification)
- The flattened file combines IncrementalMerkleTree.sol and IncrementalVerifiableClaim.sol
