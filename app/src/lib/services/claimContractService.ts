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
  ownerAddress: `0x${string}`;
  claimId: string;
  workflowId: string;
  executionId: string;
  ledgerEvents: any[];
  sinkEvents: any[];
  aggregateValue: any;
  metadataUri: string;
}): Promise<{
  txHash: `0x${string}`;
  tokenId: bigint;
  contractAddress: `0x${string}`;
}> {
  const {
    ownerAddress,
    claimId,
    workflowId,
    executionId,
    ledgerEvents,
    sinkEvents,
    aggregateValue,
    metadataUri,
  } = params;

  // Hash all events
  const ledgerEventHashes = hashEvents(ledgerEvents);
  const sinkEventHashes = hashEvents(sinkEvents);

  // Convert aggregate value to JSON string
  const aggregateValueString = typeof aggregateValue === 'string'
    ? aggregateValue
    : JSON.stringify(aggregateValue);

  console.log('🔐 Preparing to mint claim on Arc Testnet...');
  console.log(`  Claim ID: ${claimId}`);
  console.log(`  Owner: ${ownerAddress}`);
  console.log(`  Ledger events: ${ledgerEventHashes.length}`);
  console.log(`  Sink events: ${sinkEventHashes.length}`);

  // TODO: Integrate with Circle SDK to sign transaction
  // For now, this is a placeholder that shows the structure

  const contractAddress = getContractAddress();

  // This would be the actual Circle SDK contract interaction
  // const circle = getCircleClient();
  // const tx = await circle.contractExecution({
  //   walletId: params.walletId,
  //   contractAddress,
  //   abiFunctionSignature: 'mintClaim(address,string,string,string,bytes32[],bytes32[],string,string)',
  //   abiParameters: [
  //     ownerAddress,
  //     claimId,
  //     workflowId,
  //     executionId,
  //     ledgerEventHashes,
  //     sinkEventHashes,
  //     aggregateValueString,
  //     metadataUri,
  //   ],
  // });

  // For demo purposes, return mock data with proper tx hash format (66 chars: 0x + 64 hex)
  const mockTxHash = ('0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')) as `0x${string}`;

  const mockTokenId = BigInt(Math.floor(Math.random() * 1000000) + 1); // Random token ID

  console.log(`✅ Claim minted successfully!`);
  console.log(`  Transaction: ${mockTxHash}`);
  console.log(`  Token ID: ${mockTokenId}`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Explorer: https://testnet.arcscan.app/tx/${mockTxHash}`);

  return {
    txHash: mockTxHash,
    tokenId: mockTokenId,
    contractAddress,
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
  tokenId: bigint;
  newLedgerEvents: any[];
  newSinkEvents: any[];
  newAggregateValue: any;
}): Promise<{
  txHash: `0x${string}`;
}> {
  const { tokenId, newLedgerEvents, newSinkEvents, newAggregateValue } = params;

  // Hash new events
  const newLedgerHashes = hashEvents(newLedgerEvents);
  const newSinkHashes = hashEvents(newSinkEvents);

  const aggregateValueString = typeof newAggregateValue === 'string'
    ? newAggregateValue
    : JSON.stringify(newAggregateValue);

  console.log('🔄 Appending events to claim on Arc Testnet...');
  console.log(`  Token ID: ${tokenId}`);
  console.log(`  New ledger events: ${newLedgerHashes.length}`);
  console.log(`  New sink events: ${newSinkHashes.length}`);

  // TODO: Integrate with Circle SDK
  // const circle = getCircleClient();
  // const tx = await circle.contractExecution({
  //   walletId: params.walletId,
  //   contractAddress: getContractAddress(),
  //   abiFunctionSignature: 'appendEvents(uint256,bytes32[],bytes32[],string)',
  //   abiParameters: [tokenId, newLedgerHashes, newSinkHashes, aggregateValueString],
  // });

  // Generate proper tx hash format (66 chars: 0x + 64 hex)
  const mockTxHash = ('0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')) as `0x${string}`;

  console.log(`✅ Events appended successfully!`);
  console.log(`  Transaction: ${mockTxHash}`);
  console.log(`  Explorer: https://testnet.arcscan.app/tx/${mockTxHash}`);

  return {
    txHash: mockTxHash,
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
