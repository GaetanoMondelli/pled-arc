# Contract Verification Guide for ArcScan

## Contract Details

- **Contract Address**: `0xda413105f138E9390D1B094197f1435478E667d7`
- **Network**: Arc Testnet (Chain ID: 5042002)
- **Explorer**: https://testnet.arcscan.app/address/0xda413105f138E9390D1B094197f1435478E667d7

## Verification Steps

### 1. Navigate to the Contract on ArcScan

Go to: https://testnet.arcscan.app/address/0xda413105f138E9390D1B094197f1435478E667d7

Look for a "Verify Contract" or "Code" tab/button on the contract page.

### 2. Compiler Settings

Use the following exact settings when verifying:

- **Compiler Type**: Solidity (Single file)
- **Compiler Version**: `v0.8.28`
- **License Type**: MIT
- **Optimization**: Disabled (or Enabled with 200 runs - check your deployment)

### 3. Contract Source Code

Use the flattened contract file: `IncrementalVerifiableClaim-flattened.sol`

This file contains all dependencies (IncrementalMerkleTree.sol) merged into a single file.

### 4. Constructor Arguments (if required)

If the verifier asks for constructor arguments (ABI-encoded), the contract has NO constructor arguments.
Leave this field empty or enter: `0x`

### 5. Additional Settings

- **Contract Name**: `IncrementalVerifiableClaim`
- **EVM Version**: `paris` (or leave as default)

## What Verification Enables

Once verified, you'll be able to:

1. **View NFT Metadata**: See the tokenized claims as actual NFTs with metadata
2. **Read Contract Functions**: View all public/view functions directly on the explorer
3. **Human-Readable Events**: See `ClaimMinted` events with decoded parameters
4. **Write Contract Functions**: Interact with the contract directly from the explorer
5. **Source Code Transparency**: Anyone can read and audit the contract code

## Verification via Hardhat (Alternative Method)

If ArcScan supports programmatic verification via Hardhat, you can try:

```bash
npx hardhat verify --network arcTestnet 0xda413105f138E9390D1B094197f1435478E667d7
```

However, this requires ArcScan to be configured in Hardhat's etherscan config, which may not be available yet.

## Troubleshooting

### If verification fails:

1. **Check compiler version**: Must be exactly `0.8.28`
2. **Check optimization**: Our deployment used NO optimization (disabled)
3. **Try with optimization enabled (200 runs)**: If the above fails
4. **Check the flattened file**: Make sure all imports are resolved and there's only one license declaration at the top
5. **Contact ArcScan support**: They may need to manually verify or provide specific instructions

## Expected Result

After successful verification, the contract page should show:

- ✅ Green checkmark indicating "Contract Source Code Verified"
- **Read Contract** tab with all view functions
- **Write Contract** tab for interacting with functions
- **Events** tab showing decoded `ClaimMinted` events
- Full source code visible to everyone

## Token Metadata

Once verified, your minted claims will show up as NFTs with:

- **Token ID**: The keccak256 hash of the claim ID
- **Owner**: The wallet address that minted it
- **Metadata**: Claim title, description, merkle root, etc.
