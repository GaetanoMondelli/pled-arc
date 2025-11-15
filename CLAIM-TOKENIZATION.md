# Claim Tokenization Architecture

## Overview

This system tokenizes workflow claims as verifiable NFTs with cryptographic proofs using Merkle trees. Each claim represents an aggregated value from a sink node in a workflow execution, backed by cryptographic evidence.

## Architecture Components

### 1. **Claims Types** (`app/src/core/types/claims.ts`)

Extended the `Claim` interface with tokenization support:

```typescript
interface Claim {
  // ... existing fields
  tokenization?: ClaimTokenization;  // New: Merkle trees & proofs
}

interface ClaimTokenization {
  // Full Ledger Merkle Tree
  fullLedgerMerkleRoot: string;     // Root hash of ALL execution events
  fullLedgerEventCount: number;

  // Sink-Specific Merkle Tree
  sinkMerkleRoot: string;           // Root hash of ONLY this sink's events
  sinkEventCount: number;
  sinkEventHashes: string[];        // Individual event hashes

  // Inclusion Proofs
  inclusionProofs?: MerkleProof[];  // Proves sink events ⊆ full ledger

  // NFT Metadata
  tokenMetadata: ClaimTokenMetadata;

  // On-chain data (if minted)
  onChain?: OnChainClaimData;
}
```

### 2. **Merkle Tree Service** (`app/src/lib/services/merkleTreeService.ts`)

Provides cryptographic operations:

#### Core Functions:

**`buildFullLedgerTree(events)`**
- Hashes ALL execution events
- Builds complete Merkle tree
- Returns root hash + all layers

**`buildSinkTree(sinkEvents)`**
- Hashes ONLY sink-specific events
- Builds sink Merkle tree
- Returns root hash + all layers

**`generateInclusionProof(event, fullTree)`**
- Proves a specific event exists in full ledger
- Returns: `{ eventHash, proof[], path[], root }`
- Path indicates left (1) or right (0) siblings

**`verifyProof(proof)`**
- Reconstructs root from event hash + proof
- Returns true if computed root matches expected root

**`tokenizeClaim(claim, fullLedger, sinkEvents, options)`**
- Orchestrates full tokenization process
- Generates both Merkle trees
- Optionally creates inclusion proofs
- Returns updated claim with tokenization data

#### Example Usage:

```typescript
import { tokenizeClaim, merkleTreeService } from '@/lib/services/merkleTreeService';

// Get events from execution
const fullLedger = execution.globalActivityLog;
const sinkEvents = fullLedger.filter(e => e.nodeId === 'sink_compliance');

// Tokenize the claim
const result = await tokenizeClaim(
  claim,
  fullLedger,
  sinkEvents,
  {
    includeProofs: true,  // Generate inclusion proofs
    attributes: [         // Custom NFT attributes
      { traitType: 'Risk Level', value: 'Low' }
    ]
  }
);

// Verify proofs
const { valid, errors } = verifyTokenizedClaim(result.claim);
console.log('Proofs valid:', valid);
```

### 3. **Smart Contract** (`web3/contracts/VerifiableClaim.sol`)

ERC721-like NFT contract with Merkle proof verification:

#### Key Features:

**Minting Claims**
```solidity
function mintClaim(
  address to,
  string memory claimId,
  string memory workflowId,
  string memory executionId,
  bytes32 fullLedgerRoot,      // ← Merkle root of ALL events
  bytes32 sinkRoot,             // ← Merkle root of sink events
  uint256 fullLedgerCount,
  uint256 sinkEventCount,
  string memory aggregateValue,
  string memory metadataUri     // ← IPFS link to metadata
) public onlyOwner returns (uint256 tokenId)
```

**On-Chain Verification**
```solidity
// Verify an event exists in the full ledger
function verifyEventInFullLedger(
  uint256 tokenId,
  bytes32 eventHash,
  bytes32[] memory proof,
  uint256[] memory path
) public view returns (bool)

// Verify an event exists in the sink
function verifyEventInSink(
  uint256 tokenId,
  bytes32 eventHash,
  bytes32[] memory proof,
  uint256[] memory path
) public view returns (bool)
```

**Stored Data Per Token**
```solidity
struct ClaimData {
  string claimId;           // Off-chain claim ID
  string workflowId;        // Template ID
  string executionId;       // Execution instance
  bytes32 fullLedgerRoot;   // Root of ALL events
  bytes32 sinkRoot;         // Root of sink events
  uint256 fullLedgerCount;  // Event counts
  uint256 sinkEventCount;
  string aggregateValue;    // Computed claim value
  uint256 issuedAt;         // Timestamp
  string metadataUri;       // IPFS metadata
  bool verified;            // Verification status
}
```

## How It Works

### Step 1: Execute Workflow
```
User → Workflow Template → Execution → Events → Ledger
                                           ↓
                                      Sink Node
                                           ↓
                                    Aggregate Value
```

### Step 2: Create Claim
```typescript
const claim = {
  id: "claim-123",
  title: "Safety Compliance Q4",
  sinks: ["sink_safety"],
  aggregatedValue: { score: 95, status: "passed" },
  templateId: "workflow-abc",
  executionId: "exec-xyz"
};
```

### Step 3: Tokenize Claim

```
Full Ledger (100 events)        Sink Events (15 events)
        ↓                                ↓
   Hash each event                  Hash each event
        ↓                                ↓
   Build Merkle Tree                Build Merkle Tree
        ↓                                ↓
   Root: 0xabc...                   Root: 0xdef...
        ↓                                ↓
        └──────────┬────────────────────┘
                   ↓
          Generate Inclusion Proofs
                   ↓
          Prove: sink events ⊆ full ledger
```

### Step 4: Mint NFT On-Chain

```typescript
// Deploy contract
const contract = await deployer.deploy(VerifiableClaim);

// Mint claim NFT
const tx = await contract.mintClaim(
  userAddress,
  claim.id,
  claim.templateId,
  claim.executionId,
  fullLedgerRoot,    // 0xabc...
  sinkRoot,          // 0xdef...
  100,               // full ledger count
  15,                // sink event count
  JSON.stringify(claim.aggregatedValue),
  "ipfs://Qm..."     // metadata URI
);

const tokenId = tx.value;
```

### Step 5: Off-Chain Verification

```typescript
// Anyone can verify a claim's proofs
const claim = await claimService.getClaim('claim-123');
const { valid, errors } = verifyTokenizedClaim(claim);

if (valid) {
  console.log('✅ All sink events verified in full ledger');
}
```

### Step 6: On-Chain Verification

```solidity
// Verify specific event on-chain
bool isValid = contract.verifyEventInFullLedger(
  tokenId,
  eventHash,
  proof,
  path
);

// Or verify against sink root
bool isSinkEvent = contract.verifyEventInSink(
  tokenId,
  eventHash,
  proof,
  path
);
```

## NFT Metadata Structure

Each claim NFT has metadata (stored on IPFS):

```json
{
  "name": "Safety Compliance Claim #123",
  "description": "Q4 2024 Foundation Safety Compliance",
  "image": "ipfs://Qm.../claim-image.png",
  "attributes": [
    {
      "trait_type": "Claim ID",
      "value": "claim-123"
    },
    {
      "trait_type": "Status",
      "value": "passed"
    },
    {
      "trait_type": "Aggregate Value",
      "value": 95,
      "display_type": "number",
      "max_value": 100
    },
    {
      "trait_type": "Event Count",
      "value": 15,
      "display_type": "number"
    },
    {
      "trait_type": "Full Ledger Events",
      "value": 100,
      "display_type": "number"
    }
  ],
  "issuer": "user@example.com",
  "issuedAt": "2024-11-15T00:00:00Z",
  "workflowId": "workflow-abc",
  "executionId": "exec-xyz",
  "sinkIds": ["sink_safety"],
  "merkleRoots": {
    "fullLedger": "0xabc...",
    "sink": "0xdef..."
  }
}
```

## Use Cases

### 1. **Compliance Auditing**
- Mint compliance claims as NFTs
- Auditors verify proofs on-chain
- Immutable record of compliance

### 2. **Supply Chain Provenance**
- Each stage creates events in workflow
- Final claim aggregates all stages
- Merkle proofs prove every step happened

### 3. **Insurance Claims**
- Workflow processes insurance application
- Claim represents final decision
- All supporting evidence cryptographically proven

### 4. **Legal Documents**
- Notarize document workflows
- Each review/approval creates events
- Final claim is verifiable certificate

### 5. **Quality Assurance**
- Manufacturing workflow with inspections
- Each inspection is an event
- Quality certificate is tokenized claim

## Security Properties

✅ **Integrity**: Merkle roots ensure events cannot be tampered with
✅ **Inclusion**: Proofs verify sink events are subset of full ledger
✅ **Non-repudiation**: On-chain storage prevents denial
✅ **Transparency**: Anyone can verify proofs
✅ **Efficiency**: Only roots stored on-chain, full data off-chain

## File Structure

```
app/src/
├── core/types/
│   └── claims.ts                 # Extended with tokenization types
├── lib/services/
│   ├── claimsService.ts          # CRUD operations for claims
│   └── merkleTreeService.ts      # NEW: Cryptographic operations
└── components/claims/
    └── ClaimsRegistry.tsx        # UI for managing claims

web3/
└── contracts/
    └── VerifiableClaim.sol       # NEW: On-chain NFT contract
```

## Next Steps

To use this system:

1. **Off-chain workflow**: Execute workflows and collect events in ledger
2. **Create claim**: Aggregate sink data into claim
3. **Tokenize**: Generate Merkle trees and proofs
4. **Verify off-chain**: Validate proofs locally
5. **Mint NFT**: Deploy contract and mint claim
6. **Verify on-chain**: Anyone can verify proofs via contract

## Example Integration

```typescript
// 1. User executes workflow
const execution = await executeWorkflow(template, inputs);

// 2. Create claim from sink
const claim = await createClaim({
  title: "Compliance Certificate",
  sinks: ["compliance_sink"],
  executionId: execution.id,
  templateId: template.id
});

// 3. Tokenize claim
const tokenized = await tokenizeClaim(
  claim,
  execution.globalActivityLog,
  execution.globalActivityLog.filter(e => e.nodeId === 'compliance_sink'),
  { includeProofs: true }
);

// 4. Verify proofs locally
const { valid } = verifyTokenizedClaim(tokenized.claim);
console.log('Proofs valid:', valid);

// 5. Mint on Arc Testnet
const tx = await mintClaimNFT(tokenized, userWallet);
console.log('NFT minted:', tx.tokenId);
```

This creates a **verifiable, transferable, cryptographically-backed certificate** of workflow completion!
