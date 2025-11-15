import { NextRequest, NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export async function GET(request: NextRequest) {
  try {
    // Initialize Circle SDK
    const walletClient = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });

    // Get the first ARC wallet as the session wallet
    const walletsResponse = await walletClient.listWallets({});
    const arcWallet = walletsResponse.data?.wallets?.find(
      (w) => w.blockchain === "ARC-TESTNET"
    );

    if (arcWallet) {
      return NextResponse.json({
        address: arcWallet.address,
        walletId: arcWallet.id,
      });
    }

    return NextResponse.json({ address: null });
  } catch (error: any) {
    console.error("Error loading session:", error);
    return NextResponse.json({ address: null });
  }
}
