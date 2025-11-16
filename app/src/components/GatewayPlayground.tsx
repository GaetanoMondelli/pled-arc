    'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, TrendingUp, Globe, ChevronDown, ChevronUp } from 'lucide-react';

interface Wallet {
  id: string;
  address: string;
  blockchain: string;
}

interface GatewayPlaygroundProps {
  wallets: Wallet[];
}

const NETWORK_INFO: Record<string, { icon: string; color: string; label: string }> = {
  'ETH-SEPOLIA': { icon: '⟠', color: 'bg-blue-500', label: 'Ethereum Sepolia' },
  'ARC-TESTNET': { icon: '⭕', color: 'bg-purple-500', label: 'Arc Testnet' },
  'MATIC-AMOY': { icon: '⬣', color: 'bg-purple-600', label: 'Polygon Amoy' },
  'BASE-SEPOLIA': { icon: '🔵', color: 'bg-blue-600', label: 'Base Sepolia' },
  'ARB-SEPOLIA': { icon: '◆', color: 'bg-blue-400', label: 'Arbitrum Sepolia' },
};

export function GatewayPlayground({ wallets }: GatewayPlaygroundProps) {
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [totalBalance, setTotalBalance] = useState(0);
  const [walletsByChain, setWalletsByChain] = useState<Record<string, Wallet[]>>({});

  useEffect(() => {
    fetchBalances();
  }, [wallets]);

  const fetchBalances = async () => {
    setLoading(true);
    let total = 0;
    const balanceMap: Record<string, number> = {};
    const walletMap: Record<string, Wallet[]> = {};

    for (const wallet of wallets) {
      try {
        // Group wallets by chain
        if (!walletMap[wallet.blockchain]) {
          walletMap[wallet.blockchain] = [];
        }
        walletMap[wallet.blockchain].push(wallet);

        // Fetch balances
        const response = await fetch(`/api/circle/wallet/${wallet.id}/balance`);
        const data = await response.json();

        if (data.success && data.data?.tokenBalances) {
          const usdcBalance = data.data.tokenBalances.find((b: any) =>
            b.token.symbol.includes('USDC') || b.token.name.includes('USDC')
          );

          if (usdcBalance) {
            const amount = parseFloat(usdcBalance.amount);
            balanceMap[wallet.blockchain] = (balanceMap[wallet.blockchain] || 0) + amount;
            total += amount;
          }
        }
      } catch (error) {
        console.error(`Error fetching balance for ${wallet.id}:`, error);
      }
    }

    setBalances(balanceMap);
    setTotalBalance(total);
    setWalletsByChain(walletMap);
    setLoading(false);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
            <Image
              src="/arclogo.png"
              alt="Arc Logo"
              width={48}
              height={48}
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Circle Gateway</h2>
            <p className="text-sm text-gray-600">Unified USDC Across All Chains</p>
          </div>
        </div>
        <Button onClick={fetchBalances} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Current State (Without Gateway) */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          Current State (Fragmented Across Chains)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(balances).map(([blockchain, balance]) => {
            const networkInfo = NETWORK_INFO[blockchain];
            return (
              <div
                key={blockchain}
                className="p-3 bg-white rounded-lg border border-gray-200 flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-full ${networkInfo?.color || 'bg-gray-400'} flex items-center justify-center text-white font-bold`}>
                  {networkInfo?.icon || '💼'}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600">{networkInfo?.label || blockchain}</div>
                  <div className="text-lg font-bold text-gray-900">{balance.toFixed(2)} USDC</div>
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(balances).length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No USDC balances found. Request testnet tokens first!
          </div>
        )}
      </div>

      {/* Arrow Down */}
      <div className="flex justify-center mb-6">
        <div className="flex flex-col items-center">
          <Zap className="h-6 w-6 text-purple-500 mb-1" />
          <div className="text-xs font-semibold text-purple-600">WITH GATEWAY</div>
        </div>
      </div>

      {/* With Gateway (Unified) */}
      <div className="p-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Unified Balance
          </h3>
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold">
            INSTANT ACCESS
          </span>
        </div>

        <div className="text-5xl font-bold mb-6">
          {totalBalance.toFixed(2)} <span className="text-2xl">USDC</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-white/10 rounded-lg">
            <div className="text-xs opacity-80 mb-1">Available on</div>
            <div className="text-lg font-semibold">ALL chains</div>
          </div>
          <div className="p-3 bg-white/10 rounded-lg">
            <div className="text-xs opacity-80 mb-1">Withdrawal Speed</div>
            <div className="text-lg font-semibold">&lt; 500ms</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            <span>Pay on any chain instantly</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            <span>No manual bridging required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            <span>Perfect for treasury management</span>
          </div>
        </div>
      </div>

      {/* Example Scenarios */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">💡 Example Use Cases</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-purple-600 mb-1">SCENARIO 1</div>
            <div className="text-sm font-medium text-gray-900">Cross-Chain Payment</div>
            <div className="text-xs text-gray-600 mt-1">
              Treasury needs to pay 15 USDC on Arc → Instant withdrawal from unified balance
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-blue-600 mb-1">SCENARIO 2</div>
            <div className="text-sm font-medium text-gray-900">Multi-Chain Operations</div>
            <div className="text-xs text-gray-600 mt-1">
              Deploy contract on Arc, pay fees from Gateway balance on any chain
            </div>
          </div>
        </div>
      </div>

      {/* Gateway Operations */}
      {totalBalance > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ What You Can Do With Unified Balance</h3>

          {/* Withdraw to Any Chain */}
          <GatewayWithdraw totalBalance={totalBalance} />

          {/* Allocation Planner */}
          <AllocationPlanner totalBalance={totalBalance} currentBalances={balances} walletsByChain={walletsByChain} />
        </div>
      )}

      {/* Learn More */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm">
          <span className="font-semibold text-blue-900">📚 Learn More:</span>{' '}
          <span className="text-blue-800">
            Check out <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">GATEWAY-GUIDE.md</code> for
            implementation details and integration code.
          </span>
        </div>
      </div>
    </Card>
  );
}

// Gateway Withdraw Component
function GatewayWithdraw({ totalBalance }: { totalBalance: number }) {
  const [selectedChain, setSelectedChain] = useState('ARC-TESTNET');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  const chains = [
    { value: 'ARC-TESTNET', label: 'Arc Testnet', icon: '⭕' },
    { value: 'ETH-SEPOLIA', label: 'Ethereum Sepolia', icon: '⟠' },
    { value: 'BASE-SEPOLIA', label: 'Base Sepolia', icon: '🔵' },
  ];

  const handleWithdraw = () => {
    alert(`🌉 Gateway Cross-Chain Withdrawal\n\n` +
      `How it works:\n` +
      `1. You have ${totalBalance.toFixed(2)} USDC pooled across multiple chains\n` +
      `2. Gateway lets you withdraw ${amount} USDC to ${selectedChain}\n` +
      `3. Doesn't matter which chain it came from!\n\n` +
      `Withdrawal Details:\n` +
      `From: Unified Balance (${totalBalance.toFixed(2)} USDC)\n` +
      `To: ${selectedChain}\n` +
      `Amount: ${amount} USDC\n` +
      `Recipient: ${recipient}\n` +
      `Speed: < 500ms\n\n` +
      `In production:\n` +
      `1. Request attestation from Gateway API\n` +
      `2. Gateway burns USDC from pool\n` +
      `3. Gateway Minter mints fresh USDC on ${selectedChain}\n` +
      `4. You receive USDC on ${selectedChain} instantly!`
    );
  };

  return (
    <div className="p-4 bg-white rounded-lg border-2 border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-gray-900">Withdraw from Gateway</h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Destination Chain
          </label>
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {chains.map(chain => (
              <option key={chain.value} value={chain.value}>
                {chain.icon} {chain.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              max={totalBalance}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Available
            </label>
            <div className="px-3 py-2 bg-purple-50 rounded-md text-sm font-semibold text-purple-900">
              {totalBalance.toFixed(2)} USDC
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <Button
          onClick={handleWithdraw}
          disabled={!amount || !recipient || parseFloat(amount) > totalBalance}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
        >
          <Zap className="h-4 w-4 mr-2" />
          Instant Withdraw (&lt; 500ms)
        </Button>

        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 p-3 rounded">
          <div className="font-semibold text-blue-900 mb-1">🌉 How Gateway Works:</div>
          <div className="space-y-1">
            <div>• Your USDC from ALL chains is pooled together</div>
            <div>• Withdraw to ANY chain you want instantly</div>
            <div>• No manual bridging - Gateway handles it!</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Allocation Planner Component
function AllocationPlanner({ totalBalance, currentBalances, walletsByChain }: {
  totalBalance: number;
  currentBalances: Record<string, number>;
  walletsByChain: Record<string, Wallet[]>;
}) {
  // Only include chains where you have wallets!
  const availableChains = Object.keys(walletsByChain).filter(chain => walletsByChain[chain].length > 0);

  const allPossibleChains = [
    { chain: 'ARC-TESTNET', label: 'Arc Testnet', icon: '⭕', purpose: 'Smart Contracts' },
    { chain: 'ETH-SEPOLIA', label: 'Ethereum Sepolia', icon: '⟠', purpose: 'Treasury Reserve' },
    { chain: 'BASE-SEPOLIA', label: 'Base Sepolia', icon: '🔵', purpose: 'Operations' },
    { chain: 'ARB-SEPOLIA', label: 'Arbitrum Sepolia', icon: '◆', purpose: 'Development' },
  ];

  // Filter to only chains with wallets
  const chainsWithWallets = allPossibleChains.filter(c => availableChains.includes(c.chain));

  const initialPercentage = chainsWithWallets.length > 0 ? Math.floor(100 / chainsWithWallets.length) : 0;
  const remainder = chainsWithWallets.length > 0 ? 100 - (initialPercentage * chainsWithWallets.length) : 0;

  const [allocations, setAllocations] = useState(
    chainsWithWallets.map((c, index) => ({
      ...c,
      percentage: index === 0 ? initialPercentage + remainder : initialPercentage
    }))
  );

  // Wallet-level allocations: { chainName: { walletId: percentage } }
  const [walletAllocations, setWalletAllocations] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {};
    chainsWithWallets.forEach(chainInfo => {
      const walletsOnChain = walletsByChain[chainInfo.chain] || [];
      if (walletsOnChain.length > 0) {
        initial[chainInfo.chain] = {};
        const equalShare = Math.floor(100 / walletsOnChain.length);
        const walletRemainder = 100 - (equalShare * walletsOnChain.length);
        walletsOnChain.forEach((wallet, idx) => {
          initial[chainInfo.chain][wallet.id] = idx === 0 ? equalShare + walletRemainder : equalShare;
        });
      }
    });
    return initial;
  });

  // Track which chains are expanded
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

  const toggleChainExpansion = (chain: string) => {
    const newExpanded = new Set(expandedChains);
    if (newExpanded.has(chain)) {
      newExpanded.delete(chain);
    } else {
      newExpanded.add(chain);
    }
    setExpandedChains(newExpanded);
  };

  const handleNetworkPercentageChange = (index: number, newNetworkPercentage: number) => {
    const allocation = allocations[index];
    const chain = allocation.chain;

    // Update network-level percentage
    const newAllocations = [...allocations];
    newAllocations[index].percentage = newNetworkPercentage;
    setAllocations(newAllocations);

    // Proportionally update wallet-level percentages within this network
    // Keep the same proportions, but scale to match new network percentage
    const walletsOnChain = walletsByChain[chain] || [];
    if (walletsOnChain.length > 0 && walletAllocations[chain]) {
      const currentWalletPercentages = walletAllocations[chain];
      const walletTotal = Object.values(currentWalletPercentages).reduce((sum, p) => sum + p, 0);

      // Scale each wallet's percentage proportionally
      const newWalletPercentages: Record<string, number> = {};
      walletsOnChain.forEach((wallet, idx) => {
        const currentPct = currentWalletPercentages[wallet.id] || 0;
        const proportion = walletTotal > 0 ? currentPct / walletTotal : 1 / walletsOnChain.length;
        newWalletPercentages[wallet.id] = Math.round(proportion * 100);
      });

      // Adjust for rounding errors
      const newTotal = Object.values(newWalletPercentages).reduce((sum, p) => sum + p, 0);
      if (newTotal !== 100 && walletsOnChain.length > 0) {
        newWalletPercentages[walletsOnChain[0].id] += (100 - newTotal);
      }

      setWalletAllocations({
        ...walletAllocations,
        [chain]: newWalletPercentages
      });
    }
  };

  const handleWalletPercentageChange = (chain: string, walletId: string, newPercentage: number) => {
    setWalletAllocations({
      ...walletAllocations,
      [chain]: {
        ...walletAllocations[chain],
        [walletId]: newPercentage
      }
    });
  };

  const distributeEqually = () => {
    if (allocations.length === 0) return;

    const equalPercentage = Math.floor(100 / allocations.length);
    const remainder = 100 - (equalPercentage * allocations.length);

    const newAllocations = allocations.map((a, index) => ({
      ...a,
      percentage: index === 0 ? equalPercentage + remainder : equalPercentage
    }));

    setAllocations(newAllocations);
  };

  if (allocations.length === 0) {
    return (
      <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
        <div className="text-center text-orange-900">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-bold mb-2">No Wallets Found</div>
          <div className="text-sm">
            Create wallets on different chains to use treasury allocation.
          </div>
        </div>
      </div>
    );
  }

  const executeAllocations = () => {
    const allocationDetails = allocations.map(a => {
      const networkPlannedAmount = (totalBalance * a.percentage) / 100;
      const walletsOnChain = walletsByChain[a.chain] || [];
      const walletPercentages = walletAllocations[a.chain] || {};

      let chainDetails = `${a.icon} ${a.label}: ${networkPlannedAmount.toFixed(2)} USDC (${a.percentage}%)`;

      if (walletsOnChain.length > 1) {
        chainDetails += '\n';
        walletsOnChain.forEach(wallet => {
          const walletPct = walletPercentages[wallet.id] || 0;
          const walletAmount = (networkPlannedAmount * walletPct) / 100;
          chainDetails += `\n     → ${wallet.address.slice(0, 10)}...${wallet.address.slice(-8)}: ${walletAmount.toFixed(2)} USDC (${walletPct}%)`;
        });
      } else if (walletsOnChain.length === 1) {
        chainDetails += `\n     → ${walletsOnChain[0].address}`;
      }

      return chainDetails;
    }).join('\n\n');

    alert(`🏦 Multi-Chain Treasury Allocation\n\n` +
      `Total: ${totalBalance.toFixed(2)} USDC\n\n` +
      allocationDetails + '\n\n' +
      `Execution:\n` +
      `✅ ALL ${allocations.length} chains receive USDC in parallel\n` +
      `✅ Individual wallet allocations respected\n` +
      `✅ Total time: < 500ms for ALL withdrawals\n\n` +
      `Example Timeline:\n` +
      `0ms: Request attestations from Gateway\n` +
      `100ms: All attestations received\n` +
      `200ms: Gateway mints to specific wallets\n` +
      `500ms: DONE! Check your wallet balances`
    );
  };

  return (
    <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Treasury Allocation Planner</h4>
        </div>
        <Button
          onClick={distributeEqually}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          ⚖️ Distribute Equally
        </Button>
      </div>

      <div className="space-y-3 mb-4">
        {allocations.map((allocation, index) => {
          const networkPlannedAmount = (totalBalance * allocation.percentage) / 100;
          const currentAmount = currentBalances[allocation.chain] || 0;
          const difference = networkPlannedAmount - currentAmount;
          const isIncrease = difference > 0;

          const walletsOnChain = walletsByChain[allocation.chain] || [];
          const hasMultipleWallets = walletsOnChain.length > 1;
          const isExpanded = expandedChains.has(allocation.chain);
          const walletPercentages = walletAllocations[allocation.chain] || {};

          return (
            <div key={allocation.chain} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              {/* Network Header */}
              <div
                className="flex items-center justify-between mb-2 cursor-pointer"
                onClick={() => hasMultipleWallets && toggleChainExpansion(allocation.chain)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{allocation.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      {allocation.label}
                      {hasMultipleWallets && (
                        isExpanded ?
                          <ChevronUp className="h-4 w-4 text-gray-500" /> :
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="text-xs text-gray-600">{allocation.purpose}</div>
                    {hasMultipleWallets && (
                      <div className="text-xs text-purple-600 font-semibold">
                        {walletsOnChain.length} wallets • Click to expand
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {networkPlannedAmount.toFixed(2)} USDC
                  </div>
                  <div className="text-xs text-gray-600">{allocation.percentage}%</div>
                  {difference !== 0 && (
                    <div className={`text-xs font-semibold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncrease ? '+' : ''}{difference.toFixed(2)} USDC
                    </div>
                  )}
                </div>
              </div>

              {/* Network-Level Slider */}
              <div className="mb-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={allocation.percentage}
                  onChange={(e) => handleNetworkPercentageChange(index, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${allocation.percentage}%, rgb(229, 231, 235) ${allocation.percentage}%, rgb(229, 231, 235) 100%)`
                  }}
                />
              </div>

              {difference !== 0 && (
                <div className="mb-2 text-xs">
                  <span className="text-gray-500">Current: {currentAmount.toFixed(2)} USDC → </span>
                  <span className={`font-semibold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncrease ? `Receive ${difference.toFixed(2)}` : `Send out ${Math.abs(difference).toFixed(2)}`}
                  </span>
                </div>
              )}

              {/* Expanded Wallet-Level Sliders */}
              {hasMultipleWallets && isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-300 space-y-3">
                  <div className="text-xs font-semibold text-purple-700 mb-2">
                    Wallet-Level Allocation (% of {networkPlannedAmount.toFixed(2)} USDC)
                  </div>
                  {walletsOnChain.map(wallet => {
                    const walletPct = walletPercentages[wallet.id] || 0;
                    const walletAmount = (networkPlannedAmount * walletPct) / 100;

                    return (
                      <div key={wallet.id} className="p-2 bg-white rounded border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs font-mono text-gray-700">
                            {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                          </div>
                          <div className="text-xs font-bold text-purple-900">
                            {walletAmount.toFixed(2)} USDC ({walletPct}%)
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={walletPct}
                          onChange={(e) => handleWalletPercentageChange(allocation.chain, wallet.id, parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${walletPct}%, rgb(229, 231, 235) ${walletPct}%, rgb(229, 231, 235) 100%)`
                          }}
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-xs p-2 bg-purple-50 rounded">
                    <span className="font-semibold text-purple-900">Wallet Total:</span>
                    <span className={`font-bold ${Object.values(walletPercentages).reduce((sum, p) => sum + p, 0) === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      {Object.values(walletPercentages).reduce((sum, p) => sum + p, 0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <span className="text-sm font-semibold text-gray-700">Total Allocation:</span>
        <span className={`text-lg font-bold ${totalPercentage === 100 ? 'text-green-600' : 'text-orange-600'}`}>
          {totalPercentage}%
        </span>
      </div>

      <Button
        onClick={executeAllocations}
        disabled={totalPercentage !== 100}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        Execute Treasury Allocation
      </Button>

      {totalPercentage !== 100 && (
        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2">
          ⚠️ Adjust sliders to reach 100% before executing
        </div>
      )}
    </div>
  );
}
