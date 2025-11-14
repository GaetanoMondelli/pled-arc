'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

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
  tokenBalances?: TokenBalance[];
}

interface CircleTransferProps {
  wallets: Wallet[];
  onTransferComplete?: () => void;
}

const NETWORK_INFO: Record<string, { icon: string; color: string; label: string }> = {
  'ETH-SEPOLIA': { icon: '⟠', color: 'bg-blue-500', label: 'Ethereum Sepolia' },
  'ARC-TESTNET': { icon: '⭕', color: 'bg-purple-500', label: 'Arc Testnet' },
  'MATIC-AMOY': { icon: '⬣', color: 'bg-purple-600', label: 'Polygon Amoy' },
  'BASE-SEPOLIA': { icon: '🔵', color: 'bg-blue-600', label: 'Base Sepolia' },
  'ARB-SEPOLIA': { icon: '◆', color: 'bg-blue-400', label: 'Arbitrum Sepolia' },
};

export function CircleTransfer({ wallets, onTransferComplete }: CircleTransferProps) {
  const [fromWallet, setFromWallet] = useState<string>('');
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [tokenType, setTokenType] = useState<'USDC' | 'EURC'>('USDC');
  const [loading, setLoading] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [walletBalances, setWalletBalances] = useState<Record<string, TokenBalance[]>>({});
  const [result, setResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null);

  // Fetch balances for all wallets
  useEffect(() => {
    const fetchBalances = async () => {
      setLoadingBalances(true);
      const balances: Record<string, TokenBalance[]> = {};

      for (const wallet of wallets) {
        try {
          const response = await fetch(`/api/circle/wallet/${wallet.id}/balance`);
          const data = await response.json();
          if (data.success && data.data?.tokenBalances) {
            balances[wallet.id] = data.data.tokenBalances;
          }
        } catch (error) {
          console.error(`Error fetching balance for wallet ${wallet.id}:`, error);
        }
      }

      setWalletBalances(balances);
      setLoadingBalances(false);
    };

    if (wallets.length > 0) {
      fetchBalances();
    }
  }, [wallets]);

  const getWalletBalance = (walletId: string, token: 'USDC' | 'EURC') => {
    const balances = walletBalances[walletId];
    if (!balances) return null;

    const balance = balances.find(b =>
      b.token.symbol.includes(token) || b.token.name.includes(token)
    );

    return balance ? parseFloat(balance.amount) : 0;
  };

  const selectedWalletBalance = fromWallet ? getWalletBalance(fromWallet, tokenType) : null;

  const handleTransfer = async () => {
    if (!fromWallet || !toAddress || !amount) {
      setResult({ success: false, message: 'Please fill all fields' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/circle/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: fromWallet,
          destinationAddress: toAddress,
          amount,
          tokenType
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Transfer initiated! Transaction ID: ${data.data?.id}`,
          txId: data.data?.id
        });
        setAmount('');
        setToAddress('');
        if (onTransferComplete) onTransferComplete();
      } else {
        // Show detailed error information
        const errorMsg = data.error || 'Transfer failed';
        const details = data.details ? JSON.stringify(data.details, null, 2) : '';
        console.error('Transfer failed:', { error: errorMsg, details: data.details });
        setResult({
          success: false,
          message: `${errorMsg}${details ? '\n\nDetails:\n' + details : ''}`
        });
      }
    } catch (error: any) {
      console.error('Transfer exception:', error);
      setResult({ success: false, message: error.message || 'Transfer failed' });
    } finally {
      setLoading(false);
    }
  };

  // Quick fill buttons for testing
  const fillTestTransfer = () => {
    const sourceWallet = wallets.find(w => w.blockchain === 'ETH-SEPOLIA');
    const targetWallet = wallets.find(w => w.blockchain === 'ARC-TESTNET');

    if (sourceWallet) setFromWallet(sourceWallet.id);
    if (targetWallet) setToAddress(targetWallet.address);
    setAmount('1');
    setTokenType('USDC');
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transfer USDC/EURC</h2>
        <Button onClick={fillTestTransfer} variant="outline" size="sm">
          Quick Test
        </Button>
      </div>

      <div className="space-y-4">
        {/* From Wallet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Wallet
          </label>
          <select
            value={fromWallet}
            onChange={(e) => setFromWallet(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select wallet...</option>
            {wallets.map(wallet => {
              const networkInfo = NETWORK_INFO[wallet.blockchain];
              const balance = getWalletBalance(wallet.id, tokenType);
              const balanceText = balance !== null ? ` • ${balance.toFixed(2)} ${tokenType}` : '';

              return (
                <option key={wallet.id} value={wallet.id}>
                  {networkInfo?.icon || ''} {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)} ({networkInfo?.label || wallet.blockchain}){balanceText}
                </option>
              );
            })}
          </select>

          {/* Show balance for selected wallet */}
          {fromWallet && selectedWalletBalance !== null && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">Available: </span>
              <span className={`font-semibold ${selectedWalletBalance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedWalletBalance.toFixed(2)} {tokenType}
              </span>
              {selectedWalletBalance === 0 && (
                <span className="ml-2 text-xs text-red-500">
                  (No balance - request testnet tokens first)
                </span>
              )}
            </div>
          )}
        </div>

        {/* To Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To Address
          </label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-2 text-xs text-gray-500">
            Quick select your wallet:
            <div className="flex flex-wrap gap-2 mt-1">
              {wallets.slice(0, 3).map(wallet => {
                const networkInfo = NETWORK_INFO[wallet.blockchain];
                return (
                  <button
                    key={wallet.id}
                    onClick={() => setToAddress(wallet.address)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs flex items-center gap-1"
                  >
                    <span>{networkInfo?.icon || '💼'}</span>
                    <span>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Amount and Token */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              max={selectedWalletBalance !== null ? selectedWalletBalance : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedWalletBalance !== null && parseFloat(amount) > selectedWalletBalance && (
              <p className="mt-1 text-xs text-red-600">
                Insufficient balance
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token
            </label>
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value as 'USDC' | 'EURC')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
            </select>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'} whitespace-pre-wrap font-mono`}>
              {result.message}
            </p>
            {result.txId && (
              <p className="text-xs text-gray-600 mt-1">
                Track on blockchain explorer
              </p>
            )}
          </div>
        )}

        {/* Transfer Button */}
        <Button
          onClick={handleTransfer}
          disabled={loading || !fromWallet || !toAddress || !amount}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transferring...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Transfer {tokenType}
            </>
          )}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>💡 <strong>Track 1:</strong> This is basic transfer. For advanced logic, deploy a smart contract on Arc.</p>
          <p>🎯 <strong>Next:</strong> Use contract execution to interact with your deployed contracts.</p>
        </div>
      </div>
    </Card>
  );
}
