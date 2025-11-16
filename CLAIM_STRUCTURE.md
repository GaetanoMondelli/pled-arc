# Claim Structure: On-Chain vs Off-Chain

This document explains the complete structure of verifiable claims in your system, both on-chain (Solidity smart contract) and off-chain (TypeScript application).

---

## 🔗 ON-CHAIN STRUCTURE (Solidity)

**Contract**: `IncrementalVerifiableClaim.sol` on Arc Testnet
**Address**: `0xa31c26368B181F02Cbf463cee7a67c16b003fA2d`
**Standard**: ERC-721 compatible with enumeration

### ClaimData Struct (Stored on-chain)

```solidity
struct ClaimData {
    // ===== IDENTIFIERS =====
    string claimId;              // Off-chain claim ID (e.g., "1.3.1")
    string workflowId;           // Template/workflow ID
    string executionId;          // Execution instance ID

    // ===== MERKLE TREES (Incremental & Append-Only) =====
    IncrementalMerkleTree.Bytes32IMT ledgerTree;  // ALL execution events
    IncrementalMerkleTree.Bytes32IMT sinkTree;    // ONLY sink events

    // ===== AGGREGATE & METADATA =====
    string aggregateValue;       // Computed claim value (stringified JSON)
                                 // Example: '{"value": 32, "unit": "carbon_credits"}'
    string metadataUri;          // URI to off-chain metadata (IPFS)

    // ===== TIMESTAMPS =====
    uint256 createdAt;           // Unix timestamp when claim was minted
    uint256 lastUpdatedAt;       // Unix timestamp when last events were appended

    // ===== OWNERSHIP =====
    address owner;               // Current owner (can transfer like NFT)
}
```

### Key On-Chain Methods

```solidity
// Mint new claim with initial events
function mintClaim(
    address to,
    string memory claimId,
    string memory workflowId,
    string memory executionId,
    bytes32[] memory initialLedgerEvents,    // Hashes of ALL execution events
    bytes32[] memory initialSinkEvents,      // Hashes of ONLY sink events
    string memory aggregateValue,
    string memory metadataUri
) returns (uint256 tokenId)

// Append new events (incremental updates)
function appendEvents(
    uint256 tokenId,
    bytes32[] memory newLedgerEvents,
    bytes32[] memory newSinkEvents,
    string memory newAggregateValue
)

// Get claim metadata
function getClaimMetadata(uint256 tokenId) returns (
    string claimId,
    string workflowId,
    string executionId,
    string aggregateValue,
    string metadataUri,
    uint256 createdAt,
    uint256 lastUpdatedAt,
    address owner
)

// Get Merkle roots for verification
function getLedgerRoot(uint256 tokenId) returns (bytes32)
function getSinkRoot(uint256 tokenId) returns (bytes32)

// Verify event inclusion
function verifyLedgerEvent(
    uint256 tokenId,
    bytes32 eventHash,
    bytes32[] memory proof,
    uint256[] memory path
) returns (bool)
```

### Token ID Generation

```solidity
// Deterministic token ID from claim ID hash
uint256 tokenId = uint256(keccak256(abi.encodePacked(claimId)));
```

---

## 💾 OFF-CHAIN STRUCTURE (TypeScript)

**Location**: `app/src/core/types/claims.ts`

### Core Claim Interface

```typescript
export interface Claim {
    // ===== IDENTIFIERS =====
    id: string;                        // Hierarchical: "1.3.1", "1.3.1.7"
    title: string;                     // "Foundation Safety Compliance"
    description: string;               // Human-readable explanation

    // ===== OWNERSHIP & METADATA =====
    owner?: string;                    // User responsible
    createdBy: string;
    modifiedBy?: string;
    createdAt: Date;
    lastUpdated: Date;

    // ===== REFERENCES =====
    resources: string[];               // Links to docs, templates
    references: string[];              // External standards, regulations
    tags?: string[];                   // Categorization
    metadata?: Record<string, any>;    // Additional custom data

    // ===== WORKFLOW BINDING =====
    templateId?: string;               // Template ID for sink monitoring
    executionId?: string;              // Execution ID for sink monitoring

    // ===== EVALUATION FORMULA =====
    formula: ClaimFormula;             // How claim is validated
    status: ClaimStatus;               // Current state

    // ===== HIERARCHY =====
    childClaimIds?: string[];          // ["1.3.1.1", "1.3.1.2"]
    parentClaimId?: string;            // "1.3" for parent

    // ===== SINK AGGREGATION =====
    aggregatedValue?: any;             // Computed value from sinks
    aggregationFormula?: AggregationFormula;
    lastSinkUpdate?: Date;
    sinks?: string[];                  // Sink node IDs

    // ===== TOKENIZATION =====
    tokenization?: ClaimTokenization;  // Merkle proofs & on-chain data
}
```

### ClaimFormula

```typescript
export interface ClaimFormula {
    type: ClaimFormulaType;            // 'AND' | 'OR' | 'THRESHOLD' | etc.
    sinks: string[];                   // Required sink IDs
    expression?: string;               // Custom JavaScript/DSL
    threshold?: number;                // For THRESHOLD type
    parameters?: Record<string, any>;
    timeWindow?: TimeWindow;
    consumptionPolicy?: ConsumptionPolicy;
}

export type ClaimFormulaType =
    | 'AND'                           // All sinks must be satisfied
    | 'OR'                            // Any sink satisfies
    | 'THRESHOLD'                     // N out of M sinks
    | 'CUSTOM'                        // Custom JS expression
    | 'WEIGHTED'                      // Weighted sum
    | 'TEMPORAL'                      // Time-based sequencing
    | 'MAJORITY';                     // >50% of sinks
```

### ClaimStatus

```typescript
export type ClaimStatus =
    | 'pending'                       // Not yet evaluated
    | 'in_progress'                   // Partially satisfied
    | 'passed'                        // All requirements met
    | 'failed'                        // Requirements not met
    | 'expired'                       // Time window passed
    | 'suspended'                     // Temporarily inactive
    | 'under_review';                 // Manual review needed
```

### ClaimTokenization (Merkle Tree Data)

```typescript
export interface ClaimTokenization {
    // ===== FULL LEDGER MERKLE TREE =====
    fullLedgerMerkleRoot: string;      // Root of ALL execution events
    fullLedgerEventCount: number;      // Total events in ledger

    // ===== SINK-SPECIFIC MERKLE TREE =====
    sinkMerkleRoot: string;            // Root of ONLY sink events
    sinkEventCount: number;            // Number of sink events
    sinkEventHashes: string[];         // Individual event hashes

    // ===== INCLUSION PROOFS =====
    inclusionProofs?: MerkleProof[];   // Proves sink events ⊆ ledger

    // ===== NFT METADATA =====
    tokenMetadata: ClaimTokenMetadata;

    // ===== ON-CHAIN DATA =====
    onChain?: OnChainClaimData;

    // ===== VERIFICATION =====
    verified: boolean;
    verifiedAt?: Date;
    verificationMethod?: 'local' | 'on-chain' | 'oracle';
}
```

### OnChainClaimData

```typescript
export interface OnChainClaimData {
    // ===== CONTRACT INFO =====
    contractAddress: string;           // "0xa31c26368B181F02Cbf463cee7a67c16b003fA2d"
    tokenId: string;                   // NFT token ID
    blockchain: string;                // "arc-testnet"
    standard: 'ERC721' | 'ERC1155' | 'custom';

    // ===== TRANSACTION INFO =====
    txHash: string;                    // Minting transaction hash
    mintedAt: Date;

    // ===== OWNERSHIP =====
    ownerAddress: string;              // Wallet address
    walletId?: string;                 // Circle wallet ID

    // ===== VERIFICATION =====
    merkleRootOnChain: string;         // Merkle root in contract
    verificationMethod?: string;       // Function to call

    // ===== SYNC STATE =====
    onChainLedgerEventCount: number;   // Events stored on-chain
    onChainSinkEventCount: number;
    onChainAggregateValue?: string;
    lastOnChainUpdate?: Date;
    lastSyncCheck?: Date;

    // ===== EXPLORER =====
    blockExplorerUrl?: string;         // Link to view on Arcscan
}
```

### ClaimTokenMetadata (NFT-style)

```typescript
export interface ClaimTokenMetadata {
    // ===== STANDARD NFT FIELDS =====
    name: string;                      // "Foundation Safety Claim #123"
    description: string;
    image?: string;                    // IPFS/URL to visual
    externalUrl?: string;              // Link to claim details

    // ===== ATTRIBUTES =====
    attributes: ClaimAttribute[];      // NFT-style traits

    // ===== PROVENANCE =====
    issuer: string;                    // Who issued
    issuedAt: Date;
    expiresAt?: Date;

    // ===== VERIFICATION DATA =====
    aggregateValue: any;               // Computed value
    workflowId: string;
    executionId: string;
    sinkIds: string[];

    // ===== CONTENT ADDRESSING =====
    metadataIpfsHash?: string;         // IPFS hash of metadata
    ledgerIpfsHash?: string;           // IPFS hash of full ledger
}
```

---

## 🔄 DATA FLOW: Off-Chain → On-Chain

### Step 1: Off-Chain Claim Creation

```typescript
// User creates claim in UI
const claim: Claim = {
    id: "carbon-credit-claim-1",
    title: "Carbon Credit Verification",
    description: "Verified carbon credits from renewable energy",
    formula: {
        type: 'AND',
        sinks: ['energy-meter-sink', 'verification-sink']
    },
    // ... other fields
};
```

### Step 2: Workflow Execution & Event Collection

```typescript
// Execute workflow template
const execution = await executeWorkflow(workflowId);

// Collect ALL events (full ledger)
const allEvents = execution.getAllEvents();

// Collect ONLY sink events
const sinkEvents = execution.getSinkEvents(claim.formula.sinks);

// Compute aggregate value
const aggregateValue = aggregateSinkData(sinkEvents); // e.g., {"value": 32}
```

### Step 3: Build Merkle Trees

```typescript
// Hash all events
const ledgerHashes = allEvents.map(e => keccak256(JSON.stringify(e)));
const sinkHashes = sinkEvents.map(e => keccak256(JSON.stringify(e)));

// Build trees
const ledgerTree = buildIncrementalMerkleTree(ledgerHashes);
const sinkTree = buildIncrementalMerkleTree(sinkHashes);

// Generate inclusion proofs
const inclusionProofs = sinkHashes.map(hash =>
    generateInclusionProof(hash, ledgerTree)
);
```

### Step 4: Tokenize (Prepare for On-Chain)

```typescript
const tokenization: ClaimTokenization = {
    fullLedgerMerkleRoot: ledgerTree.root,
    fullLedgerEventCount: ledgerHashes.length,
    sinkMerkleRoot: sinkTree.root,
    sinkEventCount: sinkHashes.length,
    sinkEventHashes: sinkHashes,
    inclusionProofs: inclusionProofs,
    tokenMetadata: {
        name: claim.title,
        description: claim.description,
        aggregateValue: aggregateValue,
        workflowId: execution.templateId,
        executionId: execution.id,
        // ...
    },
    verified: true,
    verifiedAt: new Date()
};

claim.tokenization = tokenization;
```

### Step 5: Mint On-Chain

```typescript
// Call smart contract
const tx = await claimContract.mintClaim(
    ownerAddress,
    claim.id,
    execution.templateId,
    execution.id,
    ledgerHashes,      // bytes32[] of ALL events
    sinkHashes,        // bytes32[] of ONLY sink events
    JSON.stringify(aggregateValue),
    metadataIpfsUri
);

// Wait for confirmation
const receipt = await tx.wait();
const tokenId = receipt.events.find(e => e.event === 'ClaimMinted').args.tokenId;

// Update off-chain record
claim.tokenization.onChain = {
    contractAddress: claimContract.address,
    tokenId: tokenId.toString(),
    blockchain: 'arc-testnet',
    txHash: tx.hash,
    mintedAt: new Date(),
    ownerAddress: ownerAddress,
    merkleRootOnChain: ledgerTree.root,
    onChainLedgerEventCount: ledgerHashes.length,
    onChainSinkEventCount: sinkHashes.length,
    onChainAggregateValue: JSON.stringify(aggregateValue),
    blockExplorerUrl: `https://testnet.arcscan.app/tx/${tx.hash}`
};
```

---

## 🔍 VERIFICATION FLOW

### On-Chain Verification

Anyone can verify a claim on-chain by:

1. **Fetch claim data**:
```solidity
(claimId, workflowId, executionId, aggregateValue, ...) =
    claimContract.getClaimMetadata(tokenId);
```

2. **Get Merkle roots**:
```solidity
bytes32 ledgerRoot = claimContract.getLedgerRoot(tokenId);
bytes32 sinkRoot = claimContract.getSinkRoot(tokenId);
```

3. **Verify specific event**:
```solidity
bool valid = claimContract.verifyLedgerEvent(
    tokenId,
    eventHash,
    proof,      // Merkle proof path
    pathBits    // Left/right directions
);
```

### Off-Chain Verification

```typescript
// 1. Fetch claim from off-chain storage
const claim = await claimsService.getClaim(claimId);

// 2. Fetch on-chain data
const onChainData = await claimContract.getClaimMetadata(tokenId);

// 3. Compare Merkle roots
const rootsMatch =
    claim.tokenization.fullLedgerMerkleRoot === onChainData.ledgerRoot &&
    claim.tokenization.sinkMerkleRoot === onChainData.sinkRoot;

// 4. Verify event inclusion
const eventValid = verifyInclusionProof(
    eventHash,
    proof,
    claim.tokenization.fullLedgerMerkleRoot
);
```

---

## 📊 EXAMPLE: Carbon Credit Claim

### Off-Chain Data

```typescript
{
    id: "carbon-credit-32",
    title: "Carbon Credit Claim #32",
    description: "Verified carbon credits from solar energy production",
    owner: "user@example.com",

    formula: {
        type: 'AND',
        sinks: ['energy-production-sink', 'verification-sink']
    },

    aggregatedValue: {
        value: 32,
        unit: "carbon_credits",
        energyProduced: "1000 kWh",
        verifiedAt: "2025-11-15T10:00:00Z"
    },

    tokenization: {
        fullLedgerMerkleRoot: "0xabc123...",
        fullLedgerEventCount: 145,
        sinkMerkleRoot: "0xdef456...",
        sinkEventCount: 32,

        onChain: {
            contractAddress: "0xa31c26368B181F02Cbf463cee7a67c16b003fA2d",
            tokenId: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
            blockchain: "arc-testnet",
            ownerAddress: "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
            txHash: "0x789abc...",
            blockExplorerUrl: "https://testnet.arcscan.app/token/0xa31c2.../115792..."
        }
    }
}
```

### On-Chain Data (returned from contract)

```solidity
ClaimData {
    claimId: "carbon-credit-32",
    workflowId: "solar-energy-workflow-v1",
    executionId: "exec-2025-11-15-001",

    ledgerTree: {
        root: 0xabc123...,
        length: 145
    },

    sinkTree: {
        root: 0xdef456...,
        length: 32
    },

    aggregateValue: '{"value": 32, "unit": "carbon_credits"}',
    metadataUri: "ipfs://QmX...",

    createdAt: 1731668400,
    lastUpdatedAt: 1731668400,
    owner: 0x5a79daf48e3b02e62bdaf8554b50083617f4a359
}
```

---

## 🎯 KEY DIFFERENCES

| Aspect | Off-Chain | On-Chain |
|--------|-----------|----------|
| **Storage** | JSON in Firebase/memory | Solidity struct in EVM |
| **Merkle Trees** | Full tree with all nodes | Only root hash + leaf count |
| **Events** | Full event objects with data | Only event hashes (bytes32) |
| **Metadata** | Rich TypeScript objects | Stringified JSON |
| **Verification** | Local computation | Smart contract functions |
| **Cost** | Free | Gas fees for minting/updates |
| **Immutability** | Can be edited | Append-only via IMT |
| **Ownership** | Application-level | ERC-721 NFT standard |

---

## 🔐 SECURITY MODEL

### Incremental Merkle Trees (IMT)

- **Append-Only**: Cannot modify old events, only add new ones
- **Gas-Efficient**: O(log n) for updates vs. O(n) for rebuild
- **Cryptographic Proof**: Merkle proofs verify event inclusion

### Trust Model

1. **On-Chain**: Trust the smart contract code (auditable)
2. **Off-Chain**: Trust the application to correctly build trees
3. **IPFS**: Trust content addressing for metadata storage

### Attack Resistance

- ✅ **Cannot forge events**: Merkle roots prevent tampering
- ✅ **Cannot delete events**: Append-only design
- ✅ **Cannot lie about aggregate**: Hash commits to value
- ❌ **Could omit events**: Application must include all
- ❌ **Could lie about off-chain data**: Need external verification

---

## 📚 Related Files

- **Smart Contract**: `/web3/contracts/IncrementalVerifiableClaim.sol`
- **TypeScript Types**: `/app/src/core/types/claims.ts`
- **Claims Service**: `/app/src/lib/services/claimsService.ts`
- **Contract Service**: `/app/src/lib/services/claimContractService.ts`
- **Merkle Service**: `/app/src/lib/services/merkleTreeService.ts`
- **Carbon Credits UI**: `/app/src/app/carbon-credits/page.tsx`
- **Reward Contract**: `/web3/contracts/CarbonCreditReward.sol`
