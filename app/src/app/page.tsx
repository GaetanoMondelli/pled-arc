'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CounterDisplay } from '@/components/counter-display';
import { CircleWalletDisplay } from '@/components/CircleWalletDisplay';
import { CircleTransfer } from '@/components/CircleTransfer';
import { ContractExecutor } from '@/components/ContractExecutor';
import { GatewayPlayground } from '@/components/GatewayPlayground';
import { counterAddress, defaultChain } from '@/lib/contracts';
import { useAccount } from 'wagmi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const address = counterAddress[defaultChain.id];
  const { address: walletAddress, isConnected } = useAccount();
  const [wallets, setWallets] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('transfer');

  // Fetch wallets for transfer/contract components
  useEffect(() => {
    fetchWallets();
  }, [refreshKey]);

  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/circle/wallet');
      const result = await response.json();
      if (result.success) {
        setWallets(result.data?.wallets || []);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="z-10 max-w-7xl w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl">
                🎮
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Circle SDK Playground
                </h1>
                <p className="text-sm text-gray-600 mt-1">Arc Hackathon - Tracks 1 & 3</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CircleWalletDisplay key={refreshKey} />
            <ConnectButton />
          </div>
        </div>

        {/* Main Playground Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="transfer" className="text-sm md:text-base">
              💸 Transfer
            </TabsTrigger>
            <TabsTrigger value="gateway" className="text-sm md:text-base">
              🌉 Gateway
            </TabsTrigger>
            <TabsTrigger value="contracts" className="text-sm md:text-base">
              📜 Contracts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="mt-0">
            <div className="grid grid-cols-1 gap-6">
              <CircleTransfer
                wallets={wallets}
                onTransferComplete={handleRefresh}
              />
            </div>
          </TabsContent>

          <TabsContent value="gateway" className="mt-0">
            <div className="grid grid-cols-1 gap-6">
              <GatewayPlayground wallets={wallets} />
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContractExecutor wallets={wallets} />
              {address && (
                <CounterDisplay contractAddress={address} />
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Info Footer */}
        <div className="mt-12 p-6 bg-white rounded-xl border-2 border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Hackathon Requirements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="text-xl">📜</span>
                Track 1: Smart Contracts on Arc
              </h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>USDC/EURC stablecoins ready</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>Transfer functionality working</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>Contract execution SDK integrated</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">📋</span>
                  <span>Deploy your contracts on Arc testnet</span>
                </li>
              </ul>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <span className="text-xl">🏦</span>
                Track 3: Treasury with Gateway
              </h4>
              <ul className="space-y-2 text-sm text-purple-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>Multi-wallet treasury ready</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>Balance monitoring across chains</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span>Gateway playground demo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold">📋</span>
                  <span>Integrate Circle Gateway API</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
