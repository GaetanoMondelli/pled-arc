import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { defineChain } from "viem";

const CLAIM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS!;
const REWARD_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CARBON_CREDIT_REWARD_ADDRESS!;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Define Arc Testnet chain
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "ARC",
    symbol: "ARC",
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// ABI fragments
const CLAIM_ABI = [
  {
    inputs: [],
    name: "getAllTokenIds",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getClaimMetadata",
    outputs: [
      { name: "claimId", type: "string" },
      { name: "workflowId", type: "string" },
      { name: "executionId", type: "string" },
      { name: "aggregateValue", type: "string" },
      { name: "metadataUri", type: "string" },
      { name: "createdAt", type: "uint256" },
      { name: "lastUpdatedAt", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const REWARD_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "calculateReward",
    outputs: [
      { name: "claimValue", type: "uint256" },
      { name: "rewardAmount", type: "uint256" },
      { name: "canClaim", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "isRewardClaimed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEscrowBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const USDC_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

function parseAggregateValue(aggregateValue: string): number {
  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(aggregateValue);
    if (parsed.value !== undefined) {
      return parseInt(parsed.value);
    }
  } catch {
    // If not JSON, try extracting first number
    const match = aggregateValue.match(/\d+/);
    if (match) {
      return parseInt(match[0]);
    }
  }
  return 0;
}

function formatUsdc(amount: bigint): string {
  return (Number(amount) / 1_000_000).toFixed(6);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    console.log(`[Carbon Credits API] Loading wallet data for ${address}`);

    // Initialize Viem public client
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    console.log("[Carbon Credits API] Viem client initialized");

    // Get all token IDs
    console.log("[Carbon Credits API] Fetching all token IDs...");
    const allTokenIds = (await publicClient.readContract({
      address: CLAIM_CONTRACT_ADDRESS as `0x${string}`,
      abi: CLAIM_ABI,
      functionName: "getAllTokenIds",
    })) as bigint[];

    console.log(`[Carbon Credits API] Found ${allTokenIds.length} total token IDs`);

    // Filter tokens owned by this address and get their metadata
    const claims = [];
    for (const tokenId of allTokenIds) {
      try {
        // Check ownership
        const owner = (await publicClient.readContract({
          address: CLAIM_CONTRACT_ADDRESS as `0x${string}`,
          abi: CLAIM_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        })) as string;

        if (owner?.toLowerCase() !== address.toLowerCase()) {
          continue;
        }

        // Get claim metadata
        const metadata = (await publicClient.readContract({
          address: CLAIM_CONTRACT_ADDRESS as `0x${string}`,
          abi: CLAIM_ABI,
          functionName: "getClaimMetadata",
          args: [tokenId],
        })) as any[];

        const [
          claimId,
          workflowId,
          executionId,
          aggregateValue,
          metadataUri,
          createdAt,
          lastUpdatedAt,
          ownerAddr,
        ] = metadata;

        // Calculate reward
        const [claimValue, rewardAmount, canClaim] = (await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS as `0x${string}`,
          abi: REWARD_ABI,
          functionName: "calculateReward",
          args: [tokenId],
        })) as [bigint, bigint, boolean];

        // Check if already claimed
        const alreadyClaimed = (await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS as `0x${string}`,
          abi: REWARD_ABI,
          functionName: "isRewardClaimed",
          args: [tokenId],
        })) as boolean;

        const parsedValue = parseAggregateValue(aggregateValue);

        claims.push({
          tokenId: tokenId.toString(),
          claimId,
          workflowId,
          executionId,
          aggregateValue,
          rewardAmount: formatUsdc(rewardAmount),
          canClaim: canClaim && !alreadyClaimed,
          alreadyClaimed,
          parsedValue,
        });
      } catch (error) {
        console.error(`Error processing token ${tokenId}:`, error);
      }
    }

    // Get USDC balance
    const usdcBalance = (await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;

    // Get escrow balance
    const escrowBalance = (await publicClient.readContract({
      address: REWARD_CONTRACT_ADDRESS as `0x${string}`,
      abi: REWARD_ABI,
      functionName: "getEscrowBalance",
    })) as bigint;

    // Calculate total potential reward
    const totalPotentialReward = claims.reduce((sum, claim) => {
      if (!claim.alreadyClaimed) {
        return sum + parseFloat(claim.rewardAmount);
      }
      return sum;
    }, 0);

    console.log(`[Carbon Credits API] Successfully loaded ${claims.length} claims for wallet`);

    return NextResponse.json({
      address,
      usdcBalance: formatUsdc(usdcBalance),
      claims,
      totalPotentialReward: totalPotentialReward.toFixed(6),
      escrowBalance: formatUsdc(escrowBalance),
    });
  } catch (error: any) {
    console.error("[Carbon Credits API] Error loading wallet data:", error);

    // Better error messages
    let errorMessage = "Failed to load wallet data";
    if (error.message?.includes("ECONNREFUSED")) {
      errorMessage = "Cannot connect to Circle API - check network connection";
    } else if (error.message?.includes("401") || error.message?.includes("403")) {
      errorMessage = "Invalid Circle API credentials - check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, details: error.toString() },
      { status: 500 }
    );
  }
}
