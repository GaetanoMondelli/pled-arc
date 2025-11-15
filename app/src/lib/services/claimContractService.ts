/**
 * Claim Contract Service
 *
 * Handles interactions with the IncrementalVerifiableClaim smart contract
 * Integrates with Circle Developer Controlled Wallets for Arc Testnet
 */

import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toHex } from 'viem';
import { arcTestnet } from 'viem/chains';
import { getCircleClient } from '../circle-wallet';

// Arc Testnet chain config
const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    public: { http: ['https://rpc.testnet.arc.network'] },
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const;

// Contract ABI (minimal for minting and appending)
const CLAIM_CONTRACT_ABI = parseAbi([
  'function mintClaim(address to, string claimId, string workflowId, string executionId, bytes32[] initialLedgerEvents, bytes32[] initialSinkEvents, string aggregateValue, string metadataUri) public returns (uint256)',
  'function appendEvents(uint256 tokenId, bytes32[] newLedgerEvents, bytes32[] newSinkEvents, string newAggregateValue) public',
  'function getClaimState(uint256 tokenId) public view returns (bytes32 ledgerRoot, uint256 ledgerEventCount, bytes32 sinkRoot, uint256 sinkEventCount, string aggregateValue)',
  'function getClaimMetadata(uint256 tokenId) public view returns (string claimId, string workflowId, string executionId, string aggregateValue, string metadataUri, uint256 createdAt, uint256 lastUpdatedAt, address owner)',
  'function ownerOf(uint256 tokenId) public view returns (address)',
  'function totalSupply() public view returns (uint256)',
  'event ClaimMinted(uint256 indexed tokenId, address indexed to, string claimId, uint256 initialLedgerEvents, uint256 initialSinkEvents)',
  'event EventsAppended(uint256 indexed tokenId, uint256 newLedgerCount, uint256 newSinkCount, bytes32 newLedgerRoot, bytes32 newSinkRoot, string newAggregateValue)',
]);

/**
 * Hash an event deterministically using keccak256 (Ethereum-compatible)
 */
export function hashEvent(event: any): `0x${string}` {
  // Sort keys to ensure deterministic JSON
  const sortedKeys = Object.keys(event).sort();
  const sortedEvent: any = {};
  sortedKeys.forEach(key => {
    sortedEvent[key] = event[key];
  });

  const eventString = JSON.stringify(sortedEvent);
  return keccak256(toHex(eventString));
}

/**
 * Hash an array of events
 */
export function hashEvents(events: any[]): `0x${string}`[] {
  return events.map(hashEvent);
}

/**
 * Get contract address from environment
 */
function getContractAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS not set in environment');
  }
  return address as `0x${string}`;
}

/**
 * Create a public client for reading contract state
 */
export function getPublicClient() {
  return createPublicClient({
    chain: ARC_TESTNET_CHAIN,
    transport: http(),
  });
}

/**
 * Mint a new claim NFT on-chain
 *
 * @param ownerAddress Circle wallet address to mint to
 * @param claimId Off-chain claim ID
 * @param workflowId Workflow template ID
 * @param executionId Execution instance ID
 * @param ledgerEvents All execution events
 * @param sinkEvents Sink-specific events
 * @param aggregateValue Computed claim value (JSON string)
 * @param metadataUri IPFS URI for metadata
 * @returns Transaction hash and token ID
 */
export async function mintClaimOnChain(params: {
  walletId: string;
  ownerAddress: `0x${string}`;
  claimId: string;
  workflowId: string;
  executionId: string;
  ledgerEvents: any[];
  sinkEvents: any[];
  aggregateValue: any;
  metadataUri: string;
  claimTitle?: string;
}): Promise<{
  txHash: `0x${string}`;
  tokenId: bigint;
  contractAddress: `0x${string}`;
  transactionId: string;
}> {
  const {
    walletId,
    ownerAddress,
    claimId,
    workflowId,
    executionId,
    ledgerEvents,
    sinkEvents,
    aggregateValue,
    metadataUri,
    claimTitle,
  } = params;

  // Hash all events using keccak256
  const ledgerEventHashes = hashEvents(ledgerEvents);
  const sinkEventHashes = hashEvents(sinkEvents);

  // Convert aggregate value to JSON string
  const aggregateValueString = typeof aggregateValue === 'string'
    ? aggregateValue
    : JSON.stringify(aggregateValue);

  const contractAddress = getContractAddress();

  console.log('🔐 Minting claim on Arc Testnet via Circle SDK...');
  console.log(`  Wallet ID: ${walletId}`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Claim ID: ${claimId}`);
  console.log(`  Owner: ${ownerAddress}`);
  console.log(`  Ledger events: ${ledgerEventHashes.length}`);
  console.log(`  Sink events: ${sinkEventHashes.length}`);

  // Call API route to execute contract via Circle SDK
  const response = await fetch('/api/circle/contract-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletId,
      contractAddress,
      abiFunctionSignature: 'mintClaim(address,string,string,string,bytes32[],bytes32[],string,string)',
      abiParameters: [
        ownerAddress,
        claimId,
        workflowId,
        executionId,
        ledgerEventHashes,
        sinkEventHashes,
        aggregateValueString,
        metadataUri,
      ],
    }),
  });

  const result = await response.json();

  console.log('📦 [Circle Response]:', JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error('❌ [Circle Error]:', result.error);
    console.error('   Details:', result.details);
    throw new Error(result.error || 'Failed to mint claim on-chain');
  }

  // Circle SDK only returns transactionId initially, NOT txHash
  const transactionId = result.data?.id || result.data?.transactionId || 'unknown';

  console.log('✅ [Circle SDK] Transaction created!');
  console.log('  Transaction ID:', transactionId);

  // IMPORTANT: Contract hashes the claimId parameter to get tokenId
  // Frontend MUST hash the SAME claimId to poll for the token
  const tokenIdHash = keccak256(toHex(claimId));
  const tokenId = BigInt(tokenIdHash);

  console.log('  Token ID from claimId:', claimId);
  console.log('  Token ID (hash):', tokenId.toString());
  console.log('  Contract:', contractAddress);
  console.log('  Strategy: Poll blockchain directly to verify token exists');

  // Return with transactionId - frontend will poll blockchain to verify token exists
  return {
    txHash: '' as `0x${string}`, // Empty initially
    tokenId,
    contractAddress,
    transactionId,
  };
}

/**
 * Append new events to an existing tokenized claim
 *
 * @param tokenId On-chain token ID
 * @param newLedgerEvents New execution events to append
 * @param newSinkEvents New sink events to append
 * @param newAggregateValue Updated aggregate value
 * @returns Transaction hash
 */
export async function appendEventsOnChain(params: {
  walletId: string;
  tokenId: bigint;
  newLedgerEvents: any[];
  newSinkEvents: any[];
  newAggregateValue: any;
}): Promise<{
  txHash: `0x${string}`;
  transactionId: string;
}> {
  const { walletId, tokenId, newLedgerEvents, newSinkEvents, newAggregateValue } = params;

  // Hash new events using keccak256
  const newLedgerHashes = hashEvents(newLedgerEvents);
  const newSinkHashes = hashEvents(newSinkEvents);

  const aggregateValueString = typeof newAggregateValue === 'string'
    ? newAggregateValue
    : JSON.stringify(newAggregateValue);

  const contractAddress = getContractAddress();

  console.log('🔄 Appending events to claim on Arc Testnet via Circle SDK...');
  console.log(`  Wallet ID: ${walletId}`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Token ID: ${tokenId}`);
  console.log(`  New ledger events: ${newLedgerHashes.length}`);
  console.log(`  New sink events: ${newSinkHashes.length}`);

  // Call API route to execute contract via Circle SDK
  const response = await fetch('/api/circle/contract-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletId,
      contractAddress,
      abiFunctionSignature: 'appendEvents(uint256,bytes32[],bytes32[],string)',
      abiParameters: [
        tokenId.toString(), // Convert BigInt to string for JSON
        newLedgerHashes,
        newSinkHashes,
        aggregateValueString,
      ],
    }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to append events on-chain');
  }

  // Extract transaction data from Circle response
  const transactionId = result.data?.id || 'unknown';
  const txHash = result.data?.txHash as `0x${string}` || '0x' as `0x${string}`;

  console.log(`✅ Events append transaction submitted!`);
  console.log(`  Transaction ID: ${transactionId}`);
  console.log(`  Transaction Hash: ${txHash || 'Pending...'}`);

  return {
    txHash: txHash || ('0x' + '0'.repeat(64)) as `0x${string}`,
    transactionId,
  };
}

/**
 * Get on-chain state for a tokenized claim
 */
export async function getClaimStateOnChain(tokenId: bigint): Promise<{
  ledgerRoot: `0x${string}`;
  ledgerEventCount: bigint;
  sinkRoot: `0x${string}`;
  sinkEventCount: bigint;
  aggregateValue: string;
}> {
  const client = getPublicClient();
  const contractAddress = getContractAddress();

  const result = await client.readContract({
    address: contractAddress,
    abi: CLAIM_CONTRACT_ABI,
    functionName: 'getClaimState',
    args: [tokenId],
  });

  const [ledgerRoot, ledgerEventCount, sinkRoot, sinkEventCount, aggregateValue] = result;

  return {
    ledgerRoot,
    ledgerEventCount,
    sinkRoot,
    sinkEventCount,
    aggregateValue,
  };
}

/**
 * Check if a token exists on-chain by reading the contract
 * Returns the owner address if it exists, null otherwise
 */
export async function checkTokenExists(tokenId: bigint): Promise<{
  exists: boolean;
  owner?: `0x${string}`;
}> {
  try {
    const client = getPublicClient();
    const contractAddress = getContractAddress();

    // Try to get the owner of the token
    const owner = await client.readContract({
      address: contractAddress,
      abi: CLAIM_CONTRACT_ABI,
      functionName: 'ownerOf',
      args: [tokenId],
    }) as `0x${string}`;

    // If we got an owner, token exists
    if (owner && owner !== '0x0000000000000000000000000000000000000000') {
      return { exists: true, owner };
    }

    return { exists: false };
  } catch (error) {
    // If ownerOf reverts, token doesn't exist
    console.log(`Token ${tokenId} does not exist yet`);
    return { exists: false };
  }
}

/**
 * Get Arc Testnet block explorer URL for a transaction
 */
export function getArcExplorerTxUrl(txHash: string): string {
  return `https://testnet.arcscan.app/tx/${txHash}`;
}

/**
 * Get Arc Testnet block explorer URL for a token
 */
export function getArcExplorerTokenUrl(contractAddress: string, tokenId: string): string {
  return `https://testnet.arcscan.app/address/${contractAddress}`;
}

/**
 * Get claim metadata from on-chain
 */
export async function getClaimMetadata(tokenId: bigint): Promise<{
  claimId: string;
  workflowId: string;
  executionId: string;
  aggregateValue: string;
  metadataUri: string;
  createdAt: bigint;
  lastUpdatedAt: bigint;
  owner: string;
}> {
  const client = getPublicClient();
  const contractAddress = getContractAddress();

  const result = await client.readContract({
    address: contractAddress,
    abi: CLAIM_CONTRACT_ABI,
    functionName: 'getClaimMetadata',
    args: [tokenId],
  });

  const [claimId, workflowId, executionId, aggregateValue, metadataUri, createdAt, lastUpdatedAt, owner] = result;

  return {
    claimId,
    workflowId,
    executionId,
    aggregateValue,
    metadataUri,
    createdAt,
    lastUpdatedAt,
    owner,
  };
}

/**
 * Get claim state from on-chain
 */
export async function getClaimState(tokenId: bigint): Promise<{
  ledgerRoot: string;
  ledgerEventCount: bigint;
  sinkRoot: string;
  sinkEventCount: bigint;
  aggregateValue: string;
}> {
  const client = getPublicClient();
  const contractAddress = getContractAddress();

  const result = await client.readContract({
    address: contractAddress,
    abi: CLAIM_CONTRACT_ABI,
    functionName: 'getClaimState',
    args: [tokenId],
  });

  const [ledgerRoot, ledgerEventCount, sinkRoot, sinkEventCount, aggregateValue] = result;

  return {
    ledgerRoot,
    ledgerEventCount,
    sinkRoot,
    sinkEventCount,
    aggregateValue,
  };
}
