import { NextRequest, NextResponse } from "next/server";
import { listWallets } from "@/lib/circle-wallet";

export async function GET(request: NextRequest) {
  try {
    const response = await listWallets();
    const wallets = response.data?.wallets || [];

    // Filter for ARC-TESTNET wallets and format
    const arcWallets = wallets
      .filter((w) => w.blockchain === "ARC-TESTNET")
      .map((w) => ({
        id: w.id,
        address: w.address,
        blockchain: w.blockchain,
        state: w.state,
        createDate: w.createDate,
      }));

    return NextResponse.json({ wallets: arcWallets });
  } catch (error: any) {
    console.error("Error listing wallets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list wallets" },
      { status: 500 }
    );
  }
}
