"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Leaf, Coins, Wallet, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CircleWallet {
  id: string;
  address: string;
  blockchain: string;
  state: string;
}

interface VerifiableClaim {
  tokenId: string;
  claimId: string;
  workflowId: string;
  aggregateValue: string;
  rewardAmount: string;
  canClaim: boolean;
  alreadyClaimed: boolean;
  parsedValue: number;
}

interface WalletData {
  address: string;
  usdcBalance: string;
  claims: VerifiableClaim[];
  totalPotentialReward: string;
  escrowBalance: string;
}

export default function CarbonCreditsPage() {
  const [availableWallets, setAvailableWallets] = useState<CircleWallet[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load wallets on mount
  useEffect(() => {
    loadAvailableWallets();
  }, []);

  // Auto-load wallet data when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      // Auto-load when wallet is first selected or when switching wallets
      loadWalletData(walletAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const loadAvailableWallets = async () => {
    try {
      const response = await fetch("/api/carbon-credits/wallets");
      if (response.ok) {
        const data = await response.json();
        setAvailableWallets(data.wallets || []);
        // Auto-select first wallet if available
        if (data.wallets && data.wallets.length > 0) {
          const firstWallet = data.wallets[0];
          setWalletAddress(firstWallet.address);
        }
      }
    } catch (error: any) {
      console.error("Error loading wallets:", error);
      setError("Failed to load Circle wallets. Please check your API configuration.");
    }
  };

  const loadWalletData = async (address?: string) => {
    const addr = address || walletAddress;
    if (!addr) {
      toast({
        title: "Error",
        description: "Please select a wallet address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/carbon-credits/wallet?address=${addr}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load wallet data");
      }
      const data = await response.json();
      setWalletData(data);
      toast({
        title: "Success",
        description: `Loaded ${data.claims.length} claims`,
      });
    } catch (error: any) {
      console.error("Error loading wallet:", error);
      const errorMessage = error.message || "Failed to load wallet data";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (tokenId: string) => {
    setClaiming(tokenId);
    try {
      const response = await fetch("/api/carbon-credits/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, walletAddress }),
      });

      if (!response.ok) {
        throw new Error("Failed to claim reward");
      }

      const result = await response.json();
      toast({
        title: "Success!",
        description: `Claimed ${result.rewardAmount} USDC`,
      });

      // Reload wallet data
      await loadWalletData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to claim reward",
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  };

  const claimAllRewards = async () => {
    const claimableTokenIds = walletData?.claims
      .filter((c) => c.canClaim && !c.alreadyClaimed)
      .map((c) => c.tokenId) || [];

    if (claimableTokenIds.length === 0) {
      toast({
        title: "No claims available",
        description: "No claimable rewards found",
        variant: "destructive",
      });
      return;
    }

    setClaiming("batch");
    try {
      const response = await fetch("/api/carbon-credits/claim-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds: claimableTokenIds, walletAddress }),
      });

      if (!response.ok) {
        throw new Error("Failed to claim rewards");
      }

      const result = await response.json();
      toast({
        title: "Success!",
        description: `Claimed ${result.totalClaimed} rewards totaling ${result.totalAmount} USDC`,
      });

      await loadWalletData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to claim rewards",
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  };

  const fundEscrow = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setFunding(true);
    try {
      const response = await fetch("/api/carbon-credits/fund-escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: fundAmount }),
      });

      if (!response.ok) {
        throw new Error("Failed to fund escrow");
      }

      const result = await response.json();
      toast({
        title: "Success!",
        description: `Funded escrow with ${fundAmount} USDC`,
      });

      setFundAmount("");
      await loadWalletData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fund escrow",
        variant: "destructive",
      });
    } finally {
      setFunding(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Leaf className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold">Green Energy Carbon Credits</h1>
          <p className="text-muted-foreground">
            Claim USDC rewards for your verified carbon credit claims
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Wallet Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Wallet</CardTitle>
          <CardDescription>
            Choose a Circle wallet or enter a custom address to view verifiable claims
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableWallets.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Circle Wallets</label>
              <Select value={walletAddress} onValueChange={setWalletAddress}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select a wallet" />
                </SelectTrigger>
                <SelectContent>
                  {availableWallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.address} className="font-mono">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} ({wallet.state})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Or Enter Custom Address (auto-loads on change)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono"
              />
              <Button onClick={() => loadWalletData()} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Overview */}
      {walletData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  USDC Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{walletData.usdcBalance}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Leaf className="h-4 w-4" />
                  Total Claims
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{walletData.claims.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Potential Rewards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {walletData.totalPotentialReward} USDC
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Escrow Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{walletData.escrowBalance} USDC</div>
              </CardContent>
            </Card>
          </div>

          {/* Fund Escrow (Admin Only) */}
          <Card>
            <CardHeader>
              <CardTitle>Fund Escrow (Admin)</CardTitle>
              <CardDescription>
                Deposit USDC into the reward pool for users to claim
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount in USDC"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Button onClick={fundEscrow} disabled={funding}>
                  {funding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Funding
                    </>
                  ) : (
                    "Fund Escrow"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Claims List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Your Verifiable Claims</CardTitle>
                  <CardDescription>
                    Claims eligible for carbon credit rewards
                  </CardDescription>
                </div>
                {walletData.claims.some((c) => c.canClaim && !c.alreadyClaimed) && (
                  <Button onClick={claimAllRewards} disabled={claiming === "batch"}>
                    {claiming === "batch" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Claiming All
                      </>
                    ) : (
                      "Claim All Rewards"
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {walletData.claims.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No verifiable claims found for this wallet
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {walletData.claims.map((claim) => (
                    <div
                      key={claim.tokenId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{claim.claimId}</p>
                          {claim.alreadyClaimed ? (
                            <Badge variant="secondary">Claimed</Badge>
                          ) : claim.canClaim ? (
                            <Badge variant="default" className="bg-green-600">
                              Claimable
                            </Badge>
                          ) : (
                            <Badge variant="outline">Insufficient Escrow</Badge>
                          )}
                          <span className="text-green-600 font-semibold ml-auto">
                            {claim.rewardAmount} USDC
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          Token ID: {claim.tokenId.slice(0, 20)}...
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Workflow: {claim.workflowId}
                        </p>
                      </div>
                      {!claim.alreadyClaimed && claim.canClaim && (
                        <Button
                          onClick={() => claimReward(claim.tokenId)}
                          disabled={claiming === claim.tokenId}
                          size="sm"
                        >
                          {claiming === claim.tokenId ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Claiming
                            </>
                          ) : (
                            "Claim Reward"
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
