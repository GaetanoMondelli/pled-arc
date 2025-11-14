'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Wallet as WalletIcon, ChevronDown, Check, Plus } from 'lucide-react';

interface TokenBalance {
  token: {
    symbol: string;
    decimals: number;
    name: string;
  };
  amount: string;
  updateDate: string;
}

interface Wallet {
  id: string;
  address: string;
  blockchain: string;
  state: string;
  createDate: string;
  tokenBalances?: TokenBalance[];
}

interface WalletWithBalance extends Wallet {
  balances?: TokenBalance[];
  loadingBalance?: boolean;
}

const SUPPORTED_NETWORKS = [
  { value: 'all', label: 'All Chains', icon: '🌐' },
  { value: 'ETH-SEPOLIA', label: 'Ethereum Sepolia', icon: '⟠', color: 'bg-blue-500' },
  { value: 'ARC-TESTNET', label: 'Arc Testnet', icon: '⭕', color: 'bg-purple-500' },
  { value: 'MATIC-AMOY', label: 'Polygon Amoy', icon: '⬣', color: 'bg-purple-600' },
  { value: 'BASE-SEPOLIA', label: 'Base Sepolia', icon: '🔵', color: 'bg-blue-600' },
  { value: 'ARB-SEPOLIA', label: 'Arbitrum Sepolia', icon: '◆', color: 'bg-blue-400' },
];

export function CircleWalletDisplay() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/circle/wallet');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch wallets');
      }

      const walletsData = result.data?.wallets || [];
      setWallets(walletsData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching wallets:', err);
      setError(String(err.message || 'Failed to fetch wallets'));
    } finally {
      setLoading(false);
    }
  };

  const createNewWallet = async () => {
    try {
      setCreating(true);
      setError(null);

      // Use selected network, or default to ETH-SEPOLIA if "all" is selected
      const blockchain = selectedNetwork === 'all' ? 'ETH-SEPOLIA' : selectedNetwork;

      const response = await fetch('/api/circle/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchains: [blockchain],
          count: 1,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create wallet');
      }

      await fetchWallets();
    } catch (err: any) {
      console.error('Error creating wallet:', err.message || err);
      setError(String(err.message || 'Failed to create wallet'));
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const filteredWallets = selectedNetwork === 'all'
    ? wallets
    : wallets.filter(w => w.blockchain === selectedNetwork);

  const selectedNetworkInfo = SUPPORTED_NETWORKS.find(n => n.value === selectedNetwork);
  const walletCount = filteredWallets.length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-4 bg-white hover:bg-gray-50 border-gray-300 shadow-sm"
        >
          <WalletIcon className="h-4 w-4 mr-2" />
          {selectedWallet ? (
            <span className="font-mono text-sm">
              {selectedWallet.address.slice(0, 6)}...{selectedWallet.address.slice(-4)}
            </span>
          ) : (
            <span>Circle Wallets</span>
          )}
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            {walletCount}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Select Wallet</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Chain Selector */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Select Chain
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_NETWORKS.map((network) => {
                const isSelected = selectedNetwork === network.value;
                const count = network.value === 'all'
                  ? wallets.length
                  : wallets.filter(w => w.blockchain === network.value).length;

                return (
                  <button
                    key={network.value}
                    onClick={() => setSelectedNetwork(network.value)}
                    className={`
                      relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className="text-2xl">{network.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{network.label}</div>
                      <div className="text-xs text-gray-500">{count} wallet{count !== 1 ? 's' : ''}</div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && wallets.length === 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-medium">Error: {error}</p>
              <p className="text-red-600 text-xs mt-1">
                Make sure CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are configured
              </p>
            </div>
          )}

          {/* Wallets Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Available Wallets {selectedNetworkInfo && selectedNetworkInfo.value !== 'all' && (
                  <span className="text-gray-500">on {selectedNetworkInfo.label}</span>
                )}
              </label>
              <Button
                onClick={createNewWallet}
                disabled={creating}
                size="sm"
                variant="outline"
                className="h-8"
                title={`Create wallet on ${selectedNetworkInfo?.label || 'Ethereum Sepolia'}`}
              >
                {creating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                {selectedNetwork === 'all' ? 'New Wallet' : `New on ${selectedNetworkInfo?.icon}`}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className="text-center py-12 px-4">
                <WalletIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {selectedNetwork === 'all'
                    ? 'No wallets found. Create your first wallet!'
                    : `No wallets on ${selectedNetworkInfo?.label}`
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                {filteredWallets.map((wallet) => {
                  const isSelected = selectedWallet?.id === wallet.id;
                  const networkInfo = SUPPORTED_NETWORKS.find(n => n.value === wallet.blockchain);

                  return (
                    <button
                      key={wallet.id}
                      onClick={() => setSelectedWallet(wallet)}
                      className={`
                        group relative flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 bg-white hover:shadow-sm'
                        }
                      `}
                    >
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0
                        ${networkInfo?.color || 'bg-gray-400'}
                      `}>
                        {networkInfo?.icon || '💼'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-gray-900 truncate">
                            {wallet.address}
                          </span>
                          {wallet.state === 'LIVE' && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                              LIVE
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 mb-2">
                          {networkInfo?.label || wallet.blockchain}
                        </div>

                        {wallet.tokenBalances && wallet.tokenBalances.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {wallet.tokenBalances.map((balance, idx) => (
                              <div
                                key={idx}
                                className="bg-white px-2 py-1 rounded border border-gray-300 text-xs"
                              >
                                <span className="font-semibold text-gray-900">
                                  {parseFloat(balance.amount).toFixed(2)}
                                </span>
                                <span className="text-gray-600 ml-1">
                                  {balance.token.symbol}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">No balances</div>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="h-5 w-5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <p className="text-xs text-gray-500 text-center">
            Developer-controlled wallets managed by Circle
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
