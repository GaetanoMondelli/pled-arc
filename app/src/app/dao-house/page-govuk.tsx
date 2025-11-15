'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { OfficersTab } from '@/components/dao-house/OfficersTab';
import { FilingHistoryTab } from '@/components/dao-house/FilingHistoryTab';

export interface Officer {
  id: string;
  name: string;
  role: string;
  appointedDate: string;
  wallets: WalletInfo[];
  allocationPercentage: number;
}

export interface WalletInfo {
  walletId: string;
  address: string;
  blockchain: string;
  balance: string;
  token: string;
}

export interface Company {
  id: string;
  number: string;
  name: string;
  status: string;
  registeredOfficeAddress: string;
  companyType: string;
  incorporatedOn: string;
  officers: Officer[];
  executionId?: string;
}

export default function DAOHousePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'filing' | 'people' | 'charges'>('overview');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await fetch('/api/dao-house/companies');
      const result = await response.json();
      if (result.success) {
        setCompanies(result.data);
        if (result.data.length > 0) {
          setSelectedCompany(result.data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = companies.find(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.number.includes(searchQuery)
    );
    if (found) {
      setSelectedCompany(found);
    }
  };

  const initialize = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dao-house/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'dao-house-template' })
      });
      const result = await response.json();
      if (result.success) {
        await loadCompanies();
      } else {
        console.error('Initialization error:', result.error);
        alert(`Failed to initialize: ${result.error}`);
      }
    } catch (error) {
      console.error('Error initializing:', error);
      alert('Failed to initialize DAO House');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2f1]">
      {/* Header - Blue with yellow border */}
      <header className="bg-[#1d70b8] text-white border-b-[10px] border-[#ffdd00]">
        <div className="max-w-[960px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/daohouse.png"
              alt="DAO House"
              width={48}
              height={48}
              className="object-contain"
            />
            <h1 className="text-xl font-bold leading-tight">DAO House</h1>
          </div>
        </div>
      </header>

      {/* Black navigation bar */}
      <div className="bg-[#0b0c0c] text-white">
        <div className="max-w-[960px] mx-auto px-4">
          <nav className="flex gap-5 text-base py-2.5">
            <Link href="/" className="hover:underline focus:underline">
              Home
            </Link>
            <Link href="/registry" className="hover:underline focus:underline">
              Claims Registry
            </Link>
            <Link href="/template-editor" className="hover:underline focus:underline">
              Template Editor
            </Link>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[960px] mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-3 text-[#0b0c0c]">
          Find and update company information
        </h2>
        <p className="text-base text-[#505a5f] mb-8 leading-relaxed">
          DAO House does not verify the accuracy of the information filed
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-10">
          <label htmlFor="search" className="block text-lg font-bold mb-2 text-[#0b0c0c]">
            Company name or number
          </label>
          <div className="flex gap-0">
            <input
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-[#0b0c0c] text-lg focus:outline-none focus:border-[#ffdd00] focus:shadow-[0_0_0_3px_#ffdd00]"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-[#00703c] hover:bg-[#005a30] text-white font-normal text-lg shadow-[0_2px_0_#002d18]"
            >
              Search
            </button>
          </div>
        </form>

        {loading ? (
          <div className="bg-white border-l-4 border-[#1d70b8] p-8">
            <p className="text-[#0b0c0c] text-lg">Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white border-l-4 border-[#1d70b8] p-8">
            <p className="text-[#0b0c0c] mb-6 text-lg">No companies found.</p>
            <button
              onClick={initialize}
              className="px-6 py-3 bg-[#00703c] hover:bg-[#005a30] text-white font-normal text-lg shadow-[0_2px_0_#002d18]"
            >
              Initialize DAO House
            </button>
          </div>
        ) : selectedCompany ? (
          <div>
            {/* Company header */}
            <h1 className="text-4xl font-bold mb-2 text-[#0b0c0c]">{selectedCompany.name}</h1>
            <p className="text-xl mb-6 text-[#505a5f]">
              Company number <span className="font-bold text-[#0b0c0c]">{selectedCompany.number}</span>
            </p>

            <div className="flex gap-4 mb-8">
              <button className="px-5 py-2.5 bg-[#00703c] hover:bg-[#005a30] text-white font-normal shadow-[0_2px_0_#002d18]">
                Follow this company
              </button>
              <button className="px-5 py-2.5 bg-[#1d70b8] hover:bg-[#003078] text-white font-normal shadow-[0_2px_0_#003078]">
                File for this company
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b-2 border-[#b1b4b6] mb-8">
              <nav className="flex gap-0 -mb-0.5">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-5 py-3 text-lg ${
                    activeTab === 'overview'
                      ? 'border-b-[5px] border-[#1d70b8] font-bold text-[#0b0c0c]'
                      : 'text-[#1d70b8] hover:text-[#003078] font-normal'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('filing')}
                  className={`px-5 py-3 text-lg ${
                    activeTab === 'filing'
                      ? 'border-b-[5px] border-[#1d70b8] font-bold text-[#0b0c0c]'
                      : 'text-[#1d70b8] hover:text-[#003078] font-normal'
                  }`}
                >
                  Filing history
                </button>
                <button
                  onClick={() => setActiveTab('people')}
                  className={`px-5 py-3 text-lg ${
                    activeTab === 'people'
                      ? 'border-b-[5px] border-[#1d70b8] font-bold text-[#0b0c0c]'
                      : 'text-[#1d70b8] hover:text-[#003078] font-normal'
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => setActiveTab('charges')}
                  className={`px-5 py-3 text-lg ${
                    activeTab === 'charges'
                      ? 'border-b-[5px] border-[#1d70b8] font-bold text-[#0b0c0c]'
                      : 'text-[#1d70b8] hover:text-[#003078] font-normal'
                  }`}
                >
                  Charges
                </button>
              </nav>
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="bg-white p-6 border-l-4 border-[#b1b4b6]">
                  <h3 className="text-xl font-bold mb-3 text-[#0b0c0c]">Registered office address</h3>
                  <p className="text-base text-[#0b0c0c] leading-relaxed">
                    {selectedCompany.registeredOfficeAddress}
                  </p>
                </div>

                <div className="bg-white p-6 border-l-4 border-[#b1b4b6]">
                  <h3 className="text-xl font-bold mb-3 text-[#0b0c0c]">Company status</h3>
                  <p className="text-lg font-bold text-[#00703c]">{selectedCompany.status}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-6 border-l-4 border-[#b1b4b6]">
                    <h3 className="text-xl font-bold mb-3 text-[#0b0c0c]">Company type</h3>
                    <p className="text-base text-[#0b0c0c]">{selectedCompany.companyType}</p>
                  </div>
                  <div className="bg-white p-6 border-l-4 border-[#b1b4b6]">
                    <h3 className="text-xl font-bold mb-3 text-[#0b0c0c]">Incorporated on</h3>
                    <p className="text-base text-[#0b0c0c]">{selectedCompany.incorporatedOn}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'filing' && selectedCompany.executionId && (
              <FilingHistoryTab
                companyId={selectedCompany.id}
                executionId={selectedCompany.executionId}
              />
            )}

            {activeTab === 'filing' && !selectedCompany.executionId && (
              <div className="bg-white border-l-4 border-[#d4351c] p-8">
                <p className="text-[#0b0c0c]">No execution ID found. Please re-initialize.</p>
              </div>
            )}

            {activeTab === 'people' && (
              <OfficersTab companyId={selectedCompany.id} />
            )}

            {activeTab === 'charges' && (
              <div className="bg-white border-l-4 border-[#b1b4b6] p-8">
                <p className="text-[#505a5f]">No charges registered</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
