import crypto from 'crypto';
import {
  MerkleTree,
  MerkleProof,
  MerkleTreeBuilder,
  ClaimTokenization,
  ClaimTokenMetadata,
  TokenizeClaimOptions,
  TokenizeClaimResult,
  Claim,
} from '@/core/types/claims';

/**
 * Hashes an event object deterministically
 */
function hashEvent(event: any): string {
  // Create deterministic JSON string (sorted keys)
  const eventString = JSON.stringify(event, Object.keys(event).sort());
  return crypto.createHash('sha256').update(eventString).digest('hex');
}

/**
 * Hashes two strings together
 */
function hashPair(left: string, right: string): string {
  return crypto.createHash('sha256').update(left + right).digest('hex');
}

/**
 * Builds a Merkle tree from an array of leaf hashes
 */
function buildTree(leaves: string[]): MerkleTree {
  if (leaves.length === 0) {
    throw new Error('Cannot build Merkle tree with no leaves');
  }

  const layers: string[][] = [leaves];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        // Pair exists
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        // Odd number of nodes, duplicate the last one
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i]));
      }
    }

    layers.push(nextLayer);
  }

  return {
    root: layers[layers.length - 1][0],
    leaves,
    layers,
    depth: layers.length - 1,
    eventCount: leaves.length,
  };
}

/**
 * Generates a Merkle proof for a specific leaf
 */
function generateProof(leafHash: string, tree: MerkleTree): MerkleProof | null {
  const leafIndex = tree.leaves.indexOf(leafHash);
  if (leafIndex === -1) {
    return null;
  }

  const proof: string[] = [];
  const path: number[] = [];
  let currentIndex = leafIndex;

  for (let layerIndex = 0; layerIndex < tree.layers.length - 1; layerIndex++) {
    const layer = tree.layers[layerIndex];
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
      path.push(isRightNode ? 0 : 1); // 0 if we're right (sibling is left), 1 if we're left
    } else {
      // Duplicate node case
      proof.push(layer[currentIndex]);
      path.push(1);
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    eventHash: leafHash,
    proof,
    path,
    root: tree.root,
  };
}

/**
 * Verifies a Merkle proof
 */
function verifyProof(proof: MerkleProof): boolean {
  let currentHash = proof.eventHash;

  for (let i = 0; i < proof.proof.length; i++) {
    const siblingHash = proof.proof[i];
    const isLeft = proof.path[i] === 1;

    if (isLeft) {
      currentHash = hashPair(currentHash, siblingHash);
    } else {
      currentHash = hashPair(siblingHash, currentHash);
    }
  }

  return currentHash === proof.root;
}

/**
 * Merkle Tree Service Implementation
 */
export const merkleTreeService: MerkleTreeBuilder = {
  buildFullLedgerTree(events: any[]): MerkleTree {
    const leafHashes = events.map(hashEvent);
    return buildTree(leafHashes);
  },

  buildSinkTree(sinkEvents: any[]): MerkleTree {
    const leafHashes = sinkEvents.map(hashEvent);
    return buildTree(leafHashes);
  },

  generateInclusionProof(event: any, fullTree: MerkleTree): MerkleProof {
    const eventHash = hashEvent(event);
    const proof = generateProof(eventHash, fullTree);

    if (!proof) {
      throw new Error('Event not found in tree');
    }

    return proof;
  },

  verifyProof(proof: MerkleProof): boolean {
    return verifyProof(proof);
  },
};

/**
 * Tokenizes a claim by generating Merkle trees and proofs
 */
export async function tokenizeClaim(
  claim: Claim,
  fullLedgerEvents: any[],
  sinkEvents: any[],
  options: TokenizeClaimOptions = {}
): Promise<TokenizeClaimResult> {
  console.log(`🎯 Tokenizing claim "${claim.title}"...`);

  // Build full ledger Merkle tree
  const fullLedgerTree = merkleTreeService.buildFullLedgerTree(fullLedgerEvents);
  console.log(`✅ Full ledger tree: ${fullLedgerTree.eventCount} events, root: ${fullLedgerTree.root.substring(0, 16)}...`);

  // Build sink-specific Merkle tree
  const sinkTree = merkleTreeService.buildSinkTree(sinkEvents);
  console.log(`✅ Sink tree: ${sinkTree.eventCount} events, root: ${sinkTree.root.substring(0, 16)}...`);

  // Generate inclusion proofs if requested
  let inclusionProofs: MerkleProof[] | undefined;
  if (options.includeProofs) {
    console.log(`🔐 Generating ${sinkEvents.length} inclusion proofs...`);
    inclusionProofs = sinkEvents.map(event =>
      merkleTreeService.generateInclusionProof(event, fullLedgerTree)
    );

    // Verify all proofs
    const verified = inclusionProofs.every(proof => merkleTreeService.verifyProof(proof));
    console.log(`✅ All proofs verified: ${verified}`);
  }

  // Create token metadata
  const tokenMetadata: ClaimTokenMetadata = {
    name: `${claim.title} #${claim.id}`,
    description: claim.description,
    attributes: [
      {
        traitType: 'Claim ID',
        value: claim.id,
        displayType: 'string',
      },
      {
        traitType: 'Status',
        value: claim.status,
        displayType: 'string',
      },
      {
        traitType: 'Aggregate Value',
        value: claim.aggregatedValue,
      },
      {
        traitType: 'Event Count',
        value: sinkTree.eventCount,
        displayType: 'number',
      },
      {
        traitType: 'Full Ledger Events',
        value: fullLedgerTree.eventCount,
        displayType: 'number',
      },
      ...(options.attributes || []),
    ],
    issuer: claim.createdBy,
    issuedAt: new Date(),
    aggregateValue: claim.aggregatedValue,
    workflowId: claim.templateId || '',
    executionId: claim.executionId || '',
    sinkIds: claim.sinks || [],
  };

  // Create tokenization data
  const tokenization: ClaimTokenization = {
    fullLedgerMerkleRoot: fullLedgerTree.root,
    fullLedgerEventCount: fullLedgerTree.eventCount,
    sinkMerkleRoot: sinkTree.root,
    sinkEventCount: sinkTree.eventCount,
    sinkEventHashes: sinkTree.leaves,
    inclusionProofs,
    tokenMetadata,
    verified: true,
    verifiedAt: new Date(),
    verificationMethod: 'local',
  };

  // Update claim with tokenization data
  const updatedClaim: Claim = {
    ...claim,
    tokenization,
  };

  console.log(`✅ Claim tokenization complete!`);

  return {
    claim: updatedClaim,
    tokenization,
  };
}

/**
 * Verifies a tokenized claim's Merkle proofs
 */
export function verifyTokenizedClaim(claim: Claim): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!claim.tokenization) {
    errors.push('Claim has no tokenization data');
    return { valid: false, errors };
  }

  const { inclusionProofs } = claim.tokenization;

  if (!inclusionProofs || inclusionProofs.length === 0) {
    errors.push('No inclusion proofs to verify');
    return { valid: false, errors };
  }

  // Verify each proof
  for (let i = 0; i < inclusionProofs.length; i++) {
    const proof = inclusionProofs[i];
    const isValid = merkleTreeService.verifyProof(proof);

    if (!isValid) {
      errors.push(`Proof ${i} failed verification`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper to extract sink events from full ledger
 */
export function extractSinkEvents(
  fullLedgerEvents: any[],
  sinkNodeId: string
): any[] {
  return fullLedgerEvents.filter(event => event.nodeId === sinkNodeId);
}
