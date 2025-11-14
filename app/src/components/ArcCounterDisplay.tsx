'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ARC_CONTRACT_ADDRESS = '0xB070f8E15B34333A70C9Ac3158363a1d8667e617';
const ARC_EXPLORER_URL = `https://testnet.arcscan.app/address/${ARC_CONTRACT_ADDRESS}`;

// Counter ABI (minimal for reading)
const COUNTER_ABI = [
  {
    "inputs": [],
    "name": "x",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "by", "type": "uint256"}],
    "name": "Increment",
    "type": "event"
  }
];

interface Wallet {
  id: string;
  address: string;
  blockchain: string;
}

export function ArcCounterDisplay() {
  const [counterValue, setCounterValue] = useState<string>('...');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('5');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null);

  const fetchCounterValue = async () => {
    setIsLoading(true);
    try {
      // Use ethers.js to read from Arc testnet
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
      const contract = new ethers.Contract(ARC_CONTRACT_ADDRESS, COUNTER_ABI, provider);

      const value = await contract.x();
      setCounterValue(value.toString());
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching counter:', error);
      setCounterValue('Error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Circle wallets
  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/circle/wallet');
      const result = await response.json();
      if (result.success) {
        const arcWallets = (result.data?.wallets || []).filter(
          (w: Wallet) => w.blockchain === 'ARC-TESTNET'
        );
        setWallets(arcWallets);
        if (arcWallets.length > 0 && !selectedWallet) {
          setSelectedWallet(arcWallets[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    }
  };

  // Execute contract function
  const executeContract = async (functionSig: string, params: any[] = []) => {
    if (!selectedWallet) {
      setExecutionResult({ success: false, message: 'Please select a wallet first' });
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch('/api/circle/contract-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet,
          contractAddress: ARC_CONTRACT_ADDRESS,
          abiFunctionSignature: functionSig,
          abiParameters: params
        })
      });

      const result = await response.json();

      if (result.success) {
        setExecutionResult({
          success: true,
          message: 'Transaction submitted successfully!',
          txId: result.data?.id
        });
        // Refresh counter after 3 seconds
        setTimeout(() => {
          fetchCounterValue();
        }, 3000);
      } else {
        setExecutionResult({
          success: false,
          message: result.error || 'Transaction failed'
        });
      }
    } catch (error: any) {
      setExecutionResult({
        success: false,
        message: error.message || 'Failed to execute transaction'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    fetchCounterValue();
    fetchWallets();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchCounterValue, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🔢</span>
          <span>Arc Testnet Counter</span>
        </CardTitle>
        <CardDescription className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono bg-gray-100 px-2 py-1 rounded border">
              {ARC_CONTRACT_ADDRESS.slice(0, 6)}...{ARC_CONTRACT_ADDRESS.slice(-4)}
            </span>
            <a
              href={ARC_EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View on Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="text-xs text-gray-500">
            Chain ID: 5042002 • RPC: Arc Testnet • Gas: USDC
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Counter Value Display */}
        <div className="p-6 bg-white rounded-lg border-2 border-gray-200 text-center">
          <div className="text-sm font-medium text-gray-600 mb-2">Current Count</div>
          <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {counterValue}
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-400 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <Button
          onClick={fetchCounterValue}
          disabled={isLoading}
          className="w-full"
          variant="outline"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Value
            </>
          )}
        </Button>

        {/* Wallet Selection */}
        <div className="space-y-2">
          <Label htmlFor="wallet" className="text-sm font-medium">
            Select Circle Wallet (Arc Testnet)
          </Label>
          <select
            id="wallet"
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            disabled={wallets.length === 0}
          >
            {wallets.length === 0 ? (
              <option>No Arc testnet wallets found</option>
            ) : (
              wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Actions</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => executeContract('inc()', [])}
              disabled={isExecuting || wallets.length === 0}
              variant="outline"
              className="w-full"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              +1
            </Button>
            <Button
              onClick={() => executeContract('incBy(uint256)', [5])}
              disabled={isExecuting || wallets.length === 0}
              variant="outline"
              className="w-full"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              +5
            </Button>
          </div>
        </div>

        {/* Custom Increment */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-sm font-medium">
            Custom Amount
          </Label>
          <div className="flex gap-2">
            <Input
              id="amount"
              type="number"
              min="1"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="flex-1"
              placeholder="Enter amount..."
            />
            <Button
              onClick={() => executeContract('incBy(uint256)', [parseInt(customAmount) || 1])}
              disabled={isExecuting || wallets.length === 0 || !customAmount}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Increment
            </Button>
          </div>
        </div>

        {/* Execution Result */}
        {executionResult && (
          <div className={`p-3 rounded-lg border ${
            executionResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="text-sm font-semibold mb-1">
              {executionResult.success ? '✅ Success' : '❌ Error'}
            </div>
            <div className="text-xs">{executionResult.message}</div>
            {executionResult.txId && (
              <div className="text-xs mt-1 font-mono">
                TX: {executionResult.txId.slice(0, 8)}...
              </div>
            )}
          </div>
        )}

        {/* Contract Info */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
          <div className="text-xs font-semibold text-gray-700">Contract Details</div>
          <div className="text-xs text-gray-600 space-y-0.5 font-mono">
            <div>• Deployed: Arc Testnet</div>
            <div>• Functions: inc(), incBy(uint), x()</div>
            <div>• Event: Increment(uint by)</div>
            <div>• Gas Token: USDC</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
