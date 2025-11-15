import { NextRequest, NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const REWARD_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GREEN_ENERGY_REWARD_ADDRESS!;

export async function POST(request: NextRequest) {
  try {
    const { tokenIds, walletAddress } = await request.json();

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({ error: "Token IDs array required" }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Initialize Circle SDK
    const walletClient = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });

    // Get the wallet that will execute the transaction
    const walletsResponse = await walletClient.listWallets({});
    const arcWallet = walletsResponse.data?.wallets?.find(
      (w) => w.blockchain === "ARC-TESTNET"
    );

    if (!arcWallet) {
      return NextResponse.json({ error: "No ARC-TESTNET wallet found" }, { status: 500 });
    }

    // Generate entity secret ciphertext
    const ciphertext = await walletClient.generateEntitySecretCiphertext();

    // Call claimRewardBatch function
    const response = await walletClient.createContractExecutionTransaction({
      walletId: arcWallet.id!,
      blockchain: "ARC-TESTNET",
      contractAddress: REWARD_CONTRACT_ADDRESS,
      abiFunctionSignature: "claimRewardBatch(uint256[])",
      abiParameters: [tokenIds],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    const txId = response.data?.id;

    // Wait for transaction confirmation
    let attempts = 0;
    const maxAttempts = 30;
    let txStatus = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await walletClient.getTransaction({ id: txId! });
      txStatus = statusResponse.data?.transaction?.state;

      if (txStatus === "COMPLETE") {
        return NextResponse.json({
          success: true,
          transactionId: txId,
          totalClaimed: tokenIds.length,
          message: `Successfully claimed ${tokenIds.length} rewards`,
        });
      } else if (txStatus === "FAILED") {
        throw new Error("Transaction failed");
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: txId,
      message: "Transaction submitted - check status manually",
    });
  } catch (error: any) {
    console.error("Error claiming batch rewards:", error);
    return NextResponse.json(
      { error: error.message || "Failed to claim rewards" },
      { status: 500 }
    );
  }
}
