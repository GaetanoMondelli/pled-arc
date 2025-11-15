'use client';

import { useEffect, useState } from 'react';

interface Officer {
  address: string;
  shares: number;
  percentage: number;
  percentageFormatted: string;
  name?: string;
  role?: string;
  appointedDate?: string;
}

interface OfficersTabProps {
  companyId: string;
}

export function OfficersTab({ companyId }: OfficersTabProps) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOfficers();
  }, [companyId]);

  const loadOfficers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Read live allocations from blockchain
      const response = await fetch('/api/treasury?action=officers');

      if (!response.ok) {
        throw new Error('Failed to fetch officers from blockchain');
      }

      const { data } = await response.json();

      if (!data?.officers) {
        throw new Error('No officer data received');
      }

      // Match with officer names from DAO House
      const peopleResponse = await fetch(`/api/dao-house/people?companyId=${companyId}`);
      const peopleData = await peopleResponse.json();
      const people = peopleData.people || [];

      // Officer name mapping (fallback)
      const officerNames: Record<string, { name: string; role: string; appointedDate: string }> = {
        '0x5a79daf48e3b02e62bdaf8554b50083617f4a359': {
          name: 'Michael Burry',
          role: 'Director',
          appointedDate: '1 September 2020'
        },
        '0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37': {
          name: 'Richard Branson',
          role: 'Shareholder',
          appointedDate: '15 March 2019'
        },
        '0x3c4b268b88ca7374e2f597b6627011225263d8b4': {
          name: 'Ray Dalio',
          role: 'Shareholder',
          appointedDate: '10 June 2021'
        },
      };

      // Merge blockchain data with officer details
      const merged = data.officers.map((o: Officer) => {
        const addressLower = o.address.toLowerCase();

        // Try to find from people data first
        const person = people.find((p: any) =>
          p.wallets?.some((w: any) => w.address?.toLowerCase() === addressLower)
        );

        // Fallback to hardcoded mapping
        const fallback = officerNames[addressLower];

        return {
          ...o,
          name: person?.name || fallback?.name || 'Unknown Officer',
          role: person?.role || fallback?.role || 'Officer',
          appointedDate: person?.appointedDate || fallback?.appointedDate || 'Unknown',
        };
      });

      setOfficers(merged);
    } catch (err) {
      console.error('Error loading officers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load officers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading officers from blockchain...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Officers</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadOfficers}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Officers & Shareholding</h3>
          <p className="text-sm text-gray-600 mt-1">
            Live data from Treasury DAO contract on Arc Testnet
          </p>
        </div>
        <button
          onClick={loadOfficers}
          className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
        >
          Refresh
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Share allocations are read directly from the blockchain smart contract.
              This ensures tamper-proof ownership tracking.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {officers.map((officer) => (
          <div
            key={officer.address}
            className="bg-white border-l-4 border-blue-500 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-bold text-gray-900">{officer.name}</h4>
                <p className="text-sm text-gray-600">{officer.role}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {officer.percentageFormatted}
                </div>
                <div className="text-xs text-gray-500">Ownership</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Appointed:</span>
                <span className="ml-2 font-medium text-gray-900">{officer.appointedDate}</span>
              </div>
              <div>
                <span className="text-gray-600">Shares:</span>
                <span className="ml-2 font-medium text-gray-900">{officer.shares}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-mono">Wallet Address:</span>
                <a
                  href={`https://testnet.arcscan.app/address/${officer.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 font-mono hover:underline"
                >
                  {officer.address}
                </a>
              </div>
            </div>

            {/* Visual share bar */}
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: officer.percentageFormatted }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {officers.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No officers found</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Share Distribution Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Shares:</span>
            <span className="font-medium">
              {officers.reduce((sum, o) => sum + o.shares, 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Number of Shareholders:</span>
            <span className="font-medium">{officers.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Contract Address:</span>
            <a
              href={`https://testnet.arcscan.app/address/${process.env.NEXT_PUBLIC_TREASURY_DAO_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono text-xs"
            >
              {process.env.NEXT_PUBLIC_TREASURY_DAO_ADDRESS}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
