'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { CircleWalletDisplay } from '@/components/CircleWalletDisplay';
import { CircleTransfer } from '@/components/CircleTransfer';
import { ContractExecutor } from '@/components/ContractExecutor';
import { GatewayPlayground } from '@/components/GatewayPlayground';
import { ArcCounterDisplay } from '@/components/ArcCounterDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
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
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-auto">
        <div className="max-w-7xl w-full mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Circle SDK Playground
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Interact with Circle Developer APIs and Arc Testnet contracts
              </p>
            </div>
            <CircleWalletDisplay key={refreshKey} />
          </div>

          {/* Main Playground Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-white">
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
              <ArcCounterDisplay />
            </div>
          </TabsContent>
        </Tabs>

          {/* Info Footer */}
          <div className="mt-12 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
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
                    <span>Counter contract deployed on Arc testnet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✅</span>
                    <span>USDC/EURC transfers working</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✅</span>
                    <span>Contract execution via Circle SDK</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✅</span>
                    <span>Programmable logic with USDC gas</span>
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
    </div>
  );
}
