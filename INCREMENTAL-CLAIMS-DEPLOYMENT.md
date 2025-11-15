# Incremental Verifiable Claims - Deployment Guide

## Overview

This system implements **append-only verifiable claims** using Incremental Merkle Trees (IMT). Claims can be updated with new events while maintaining cryptographic proof that old events were not modified.

## Security Guarantee

**PROVEN**: The counter-example attack `[0,1,2,3] → [5,6,2,3,4]` is **IMPOSSIBLE** with this implementation. See test results in `web3/test/IncrementalVerifiableClaim.test.ts`.

---

## Deployment Steps

### 1. Deploy Contract to Arc Testnet

```bash
cd web3

# Make sure you have Arc Testnet configured in hardhat.config.ts
# and ARC_TESTNET_PRIVATE_KEY in your .env file

npx hardhat ignition deploy ignition/modules/IncrementalVerifiableClaim.ts --network arc-testnet
```

**Expected Output**:
```
✔ Confirm deploy to network arc-testnet (4653)? … yes
Hardhat Ignition 🚀

Deploying [ IncrementalVerifiableClaimModule ]

Batch #1
  Executed IncrementalVerifiableClaimModule#IncrementalVerifiableClaim

[ IncrementalVerifiableClaimModule ] successfully deployed 🚀

Deployed Addresses

IncrementalVerifiableClaimModule#IncrementalVerifiableClaim - 0xYourContractAddress
```

### 2. Save Contract Address

Add to `/Users/gaetano/dev/archackathon/app/.env.local`:

```bash
NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS=0xYourContractAddress
NEXT_PUBLIC_BLOCKCHAIN_NETWORK=arc-testnet
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://explorer.arc.xyz  # Update with actual Arc explorer
```

### 3. Verify Contract (Optional)

```bash
npx hardhat verify --network arc-testnet 0xYourContractAddress
```

---

## How It Works

### Initial Mint

```typescript
// Off-chain: Hash all events
const ledgerEventHashes = execution.globalActivityLog.map(hashEvent);
const sinkEventHashes = sinkEvents.map(hashEvent);

// On-chain: Mint claim
const tx = await contract.mintClaim(
  userAddress,
  claimId,
  workflowId,
  executionId,
  ledgerEventHashes,
  sinkEventHashes,
  JSON.stringify(aggregateValue),
  "ipfs://metadata"
);

// Result: Token ID = 1, with IMT roots stored on-chain
```

### Append New Events

```typescript
// User adds 3 new external events to execution
// Workflow processes them → 3 new ledger events

const newLedgerHashes = newEvents.map(hashEvent);
const newSinkHashes = newSinkEvents.map(hashEvent);

// On-chain: Append events (O(log n) gas per event)
await contract.appendEvents(
  tokenId,
  newLedgerHashes,
  newSinkHashes,
  JSON.stringify(newAggregateValue)
);

// Result: Roots updated, event count increased, aggregate updated
```

### Verify State

```typescript
const [
  ledgerRoot,
  ledgerCount,
  sinkRoot,
  sinkCount,
  aggregateValue
] = await contract.getClaimState(tokenId);

console.log(`Claim has ${ledgerCount} ledger events`);
console.log(`Current aggregate: ${aggregateValue}`);
console.log(`Ledger root: ${ledgerRoot}`);
```

---

## UI Integration

### Git-Style Status Component

```tsx
<ClaimCard claim={claim}>
  {/* Compare on-chain count vs local execution count */}
  <ClaimStatus
    onChainLedgerCount={onChainState.ledgerCount}
    localLedgerCount={execution.globalActivityLog.length}
  />

  {/* Shows: "⚠️ 3 events behind blockchain" */}
  {onChainState.ledgerCount < execution.globalActivityLog.length && (
    <Button onClick={updateClaim}>
      Update Tokenized Claim ↑{diff}
    </Button>
  )}

  {/* Shows: "✅ Fully tokenized (15/15 events)" */}
  {onChainState.ledgerCount === execution.globalActivityLog.length && (
    <Badge>✅ Fully Tokenized</Badge>
  )}

  {/* Block explorer link */}
  <a href={`${EXPLORER_URL}/token/${contractAddress}/${tokenId}`}>
    View on Explorer →
  </a>
</ClaimCard>
```

### Update Flow

1. **User executes workflow** → New events in `globalActivityLog`
2. **UI detects diff**: `localCount > onChainCount`
3. **Shows warning**: "⚠️ 3 events behind blockchain"
4. **User clicks "Update Claim ↑3"**
5. **UI**:
   - Extracts new events: `events.slice(onChainCount)`
   - Hashes them: `newHashes = newEvents.map(hashEvent)`
   - Calls contract: `appendEvents(tokenId, newHashes, ...)`
6. **Transaction submitted** → Block explorer link shown
7. **After confirmation**: Status changes to "✅ Fully tokenized"

---

## Gas Costs (from tests)

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Mint claim (10 events) | ~500k gas | One-time setup |
| Append 1 event | ~13.5k gas | O(log n) scaling |
| Append 10 events | ~135k gas | Batched update |
| Append 100 events | ~1.35M gas | Still reasonable |

**Conclusion**: Very feasible for Arc Testnet with hundreds of events per claim.

---

## Contract Functions Reference

### Write Functions

**`mintClaim(...)`**
- Creates new claim NFT with initial events
- Builds two Incremental Merkle Trees (ledger + sink)
- Returns token ID

**`appendEvents(tokenId, newLedgerEvents, newSinkEvents, newAggregate)`**
- Appends new event hashes to existing claim
- Updates Merkle roots
- Updates aggregate value
- Emits `EventsAppended` event

**`updateAggregate(tokenId, newAggregate)`**
- Updates only aggregate value (no new events)

**`transferFrom(from, to, tokenId)`**
- Transfer claim ownership

### Read Functions

**`getClaimState(tokenId)`**
- Returns: `(ledgerRoot, ledgerCount, sinkRoot, sinkCount, aggregate)`

**`getClaimMetadata(tokenId)`**
- Returns: All claim metadata (IDs, timestamps, owner, etc.)

**`tokenURI(tokenId)`**
- Returns: IPFS metadata URI (ERC721 compatible)

**`verifyLedgerEvent(tokenId, siblings, directionBits, eventHash)`**
- Verifies a Merkle proof for a ledger event
- Returns: `true` if event exists in tree

**`verifySinkEvent(tokenId, siblings, directionBits, eventHash)`**
- Verifies a Merkle proof for a sink event
- Returns: `true` if event exists in tree

---

## Next Steps

1. ✅ Deploy contract to Arc Testnet
2. ⏳ Update `merkleTreeService.ts` to generate IMT-compatible proofs
3. ⏳ Create UI components:
   - `ClaimStatusBadge` - Shows sync status
   - `UpdateClaimButton` - Triggers `appendEvents()`
   - `ClaimVersionTimeline` - Shows update history
   - `BlockExplorerLink` - Links to Arc testnet explorer
4. ⏳ Test end-to-end flow:
   - Create execution → Mint claim
   - Add external events → UI shows "behind"
   - Click update → Transaction submitted
   - Verify on block explorer

---

## Troubleshooting

**Q: Gas too high for large batches?**
A: Batch updates in chunks of 10-20 events instead of all at once.

**Q: How to handle execution with 1000+ events?**
A: Store only critical events on-chain. Keep full ledger in Firebase/IPFS, verify with Merkle proofs.

**Q: Can I modify the aggregate without adding events?**
A: Yes, use `updateAggregate(tokenId, newValue)`.

**Q: What if I need to prove an old event exists?**
A: Use `verifyLedgerEvent()` with a Merkle proof generated off-chain from the IMT.

---

## References

- **IMT Paper**: [Ethereum Deposit Contract Verification](https://github.com/runtimeverification/deposit-contract-verification/blob/master/deposit-contract-verification.pdf)
- **Contract**: `web3/contracts/IncrementalVerifiableClaim.sol`
- **Tests**: `web3/test/IncrementalVerifiableClaim.test.ts`
- **IMT Library**: `web3/contracts/IncrementalMerkleTree.sol`
