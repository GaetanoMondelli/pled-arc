import { NextRequest, NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const REWARD_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GREEN_ENERGY_REWARD_ADDRESS!;
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }

    // Convert USDC amount to wei (6 decimals)
    const amountInWei = (parseFloat(amount) * 1_000_000).toString();

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

    // Step 1: Approve USDC
    console.log("Step 1: Approving USDC...");
    const approveResponse = await walletClient.createContractExecutionTransaction({
      walletId: arcWallet.id!,
      blockchain: "ARC-TESTNET",
      contractAddress: USDC_ADDRESS,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [REWARD_CONTRACT_ADDRESS, amountInWei],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
      entitySecretCiphertext: ciphertext,
    });

    const approveTxId = approveResponse.data?.id;

    // Wait for approval
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await walletClient.getTransaction({ id: approveTxId! });
      const txStatus = statusResponse.data?.transaction?.state;

      if (txStatus === "COMPLETE") {
        break;
      } else if (txStatus === "FAILED") {
        throw new Error("Approval transaction failed");
      }
    }

    // Step 2: Fund escrow
    console.log("Step 2: Funding escrow...");
    const fundResponse = await walletClient.createContractExecutionTransaction({
      walletId: arcWallet.id!,
      blockchain: "ARC-TESTNET",
      contractAddress: REWARD_CONTRACT_ADDRESS,
      abiFunctionSignature: "fundEscrow(uint256)",
      abiParameters: [amountInWei],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
      entitySecretCiphertext: await walletClient.generateEntitySecretCiphertext(),
    });

    const fundTxId = fundResponse.data?.id;

    // Wait for fund transaction
    attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await walletClient.getTransaction({ id: fundTxId! });
      const txStatus = statusResponse.data?.transaction?.state;

      if (txStatus === "COMPLETE") {
        return NextResponse.json({
          success: true,
          transactionId: fundTxId,
          amount,
          message: `Successfully funded escrow with ${amount} USDC`,
        });
      } else if (txStatus === "FAILED") {
        throw new Error("Fund transaction failed");
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: fundTxId,
      message: "Transaction submitted - check status manually",
    });
  } catch (error: any) {
    console.error("Error funding escrow:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fund escrow" },
      { status: 500 }
    );
  }
}
