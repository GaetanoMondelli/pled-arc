'use client';

import { useState, useEffect } from 'react';
import { Loader2, Wallet, TrendingUp, Users, Building } from 'lucide-react';

interface TreasuryWallet {
  walletId: string;
  address: string;
  blockchain: string;
  balance: string;
  token: string;
}

interface TreasuryTabProps {
  companyId: string;
}

const NETWORK_INFO: Record<string, { icon: string; color: string; label: string }> = {
  'ETH-SEPOLIA': { icon: '⟠', color: 'bg-blue-500', label: 'Ethereum Sepolia' },
  'ARC-TESTNET': { icon: '⭕', color: 'bg-purple-500', label: 'Arc Testnet' },
  'MATIC-AMOY': { icon: '⬣', color: 'bg-purple-600', label: 'Polygon Amoy' },
  'BASE-SEPOLIA': { icon: '🔵', color: 'bg-blue-600', label: 'Base Sepolia' },
  'ARB-SEPOLIA': { icon: '◆', color: 'bg-blue-400', label: 'Arbitrum Sepolia' },
};

export function TreasuryTab({ companyId }: TreasuryTabProps) {
  const [loading, setLoading] = useState(true);
  const [treasuryBalance, setTreasuryBalance] = useState<string>('0');
  const [wallets, setWallets] = useState<TreasuryWallet[]>([]);
  const [totalShares, setTotalShares] = useState<number>(0);
  const [totalOfficers, setTotalOfficers] = useState<number>(0);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadTreasuryData();
  }, [companyId]);

  const loadTreasuryData = async () => {
    try {
      setLoading(true);

      // Fetch treasury balance from blockchain
      const treasuryResponse = await fetch('/api/treasury?action=balance');
      const treasuryData = await treasuryResponse.json();

      if (treasuryData.success && treasuryData.data?.balance) {
        setTreasuryBalance(treasuryData.data.balance);
      }

      // Fetch total shares
      const sharesResponse = await fetch('/api/treasury?action=shares');
      const sharesData = await sharesResponse.json();

      if (sharesData.success && sharesData.data?.totalShares) {
        setTotalShares(sharesData.data.totalShares);
      }

      // Fetch officers to get wallet information
      const officersResponse = await fetch('/api/treasury?action=officers');
      const officersData = await officersResponse.json();

      if (officersData.success && officersData.data?.officers) {
        setTotalOfficers(officersData.data.officers.length);
      }

      // Fetch company data to get wallet details
      const companyResponse = await fetch(`/api/dao-house/companies`);
      const companyData = await companyResponse.json();

      if (companyData.success && companyData.data) {
        const company = companyData.data.find((c: any) => c.id === companyId);
        if (company?.officers) {
          // Extract all wallets from officers
          const allWallets: TreasuryWallet[] = [];
          company.officers.forEach((officer: any) => {
            if (officer.wallets) {
              allWallets.push(...officer.wallets);
            }
          });
          setWallets(allWallets);

          // Fetch balances for each wallet
          const balanceMap: Record<string, number> = {};
          for (const wallet of allWallets) {
            try {
              const response = await fetch(`/api/circle/wallet/${wallet.walletId}/balance`);
              const data = await response.json();

              if (data.success && data.data?.tokenBalances) {
                const usdcBalance = data.data.tokenBalances.find((b: any) =>
                  b.token.symbol.includes('USDC') || b.token.name.includes('USDC')
                );

                if (usdcBalance) {
                  balanceMap[wallet.walletId] = parseFloat(usdcBalance.amount);
                } else {
                  balanceMap[wallet.walletId] = 0;
                }
              }
            } catch (error) {
              console.error(`Error fetching balance for ${wallet.walletId}:`, error);
              balanceMap[wallet.walletId] = 0;
            }
          }
          setWalletBalances(balanceMap);
        }
      }

    } catch (error) {
      console.error('Error loading treasury data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalWalletBalance = Object.values(walletBalances).reduce((sum, balance) => sum + balance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading treasury data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Treasury Overview - Companies House Style */}
      <div className="bg-white border border-gray-300 p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Treasury overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Treasury Contract Balance */}
          <div className="bg-gray-50 border border-gray-300 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Building className="h-5 w-5 text-gray-600" />
              <h4 className="font-bold text-sm text-gray-700">Treasury contract</h4>
            </div>
            <p className="text-3xl font-bold text-gray-900">{parseFloat(treasuryBalance).toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-1">USDC</p>
          </div>

          {/* Total Shares */}
          <div className="bg-gray-50 border border-gray-300 p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              <h4 className="font-bold text-sm text-gray-700">Total shares</h4>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalShares}</p>
            <p className="text-sm text-gray-600 mt-1">shares issued</p>
          </div>

          {/* Total Officers */}
          <div className="bg-gray-50 border border-gray-300 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-gray-600" />
              <h4 className="font-bold text-sm text-gray-700">Officers</h4>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalOfficers}</p>
            <p className="text-sm text-gray-600 mt-1">shareholders</p>
          </div>
        </div>

        {/* Officer Wallets */}
        <div className="mt-6">
          <h4 className="font-bold text-lg text-gray-900 mb-4">Officer wallets</h4>

          {wallets.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 border border-gray-300">
              <p className="text-gray-600">No wallets found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-300">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-sm">Network</th>
                    <th className="px-4 py-3 text-left font-bold text-sm">Address</th>
                    <th className="px-4 py-3 text-right font-bold text-sm">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet, index) => {
                    const networkInfo = NETWORK_INFO[wallet.blockchain];
                    const balance = walletBalances[wallet.walletId] || 0;

                    return (
                      <tr
                        key={wallet.walletId}
                        className={`border-b border-gray-200 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full ${networkInfo?.color || 'bg-gray-400'} flex items-center justify-center text-white font-bold text-xs`}>
                              {networkInfo?.icon || '💼'}
                            </div>
                            <span className="text-sm font-medium">
                              {networkInfo?.label || wallet.blockchain}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            {wallet.address}
                          </code>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold">
                            {balance.toFixed(2)} USDC
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right font-bold text-sm">
                      Total wallet balance:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-lg">
                      {totalWalletBalance.toFixed(2)} USDC
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Treasury Contract Information */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <h4 className="font-bold text-sm text-blue-900 mb-2">Treasury contract information</h4>
        <p className="text-sm text-blue-800">
          The treasury contract manages company funds on the Arc Testnet blockchain. Profit distributions
          are automatically executed based on shareholder allocations when approved filings are processed.
        </p>
        <p className="text-xs text-blue-700 mt-2 font-mono">
          Contract: 0x1eFcECc47a6D5b90F330F07206ace54beD871D16
        </p>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={loadTreasuryData}
          disabled={loading}
          className="px-6 py-2 bg-[#1d70b8] hover:bg-[#1d4d7d] text-white font-bold rounded disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Refresh treasury data
            </>
          )}
        </button>
      </div>
    </div>
  );
}
