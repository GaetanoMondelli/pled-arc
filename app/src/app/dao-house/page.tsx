'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { OfficersTab } from '@/components/dao-house/OfficersTab';
import { FilingHistoryTab } from '@/components/dao-house/FilingHistoryTab';
import { TreasuryTab } from '@/components/dao-house/TreasuryTab';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'filing' | 'people' | 'treasury' | 'charges'>('overview');

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
    <div className="min-h-screen bg-white">
      {/* Header - Blue with Logo */}
      <header className="bg-[#1d70b8] text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-8">
            <Image
              src="/daohouse.png"
              alt="DAO House"
              width={280}
              height={280}
              className="object-contain"
            />
            <div>
              <h1 className="text-4xl font-bold">DAO House</h1>
              <p className="text-lg text-gray-100 mt-2">
                Decentralized Autonomous Organization Registry
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Black navigation bar */}
      <div className="bg-black text-white py-3">
        <div className="container mx-auto px-4">
          <nav className="flex gap-6 text-sm font-normal">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/registry" className="hover:underline">
              Claims Registry
            </Link>
            <Link href="/template-editor" className="hover:underline">
              Template Editor
            </Link>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-2">Find and update company information</h2>
          <p className="text-sm text-gray-600 mb-6">
            DAO House does not verify the accuracy of the information filed
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a company or officer"
                className="flex-1 px-4 py-3 border-2 border-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[#00703c] hover:bg-[#005a30] text-white font-bold"
              >
                Search
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-center py-12">
              <div className="loading loading-spinner loading-lg"></div>
              <p className="mt-4 text-gray-600">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No companies found.</p>
              <button
                onClick={initialize}
                className="px-6 py-3 bg-[#1d70b8] hover:bg-[#1d4d7d] text-white font-bold"
              >
                Initialize DAO House
              </button>
            </div>
          ) : selectedCompany ? (
            <div>
              {/* Company header */}
              <h1 className="text-4xl font-bold mb-4">{selectedCompany.name}</h1>
              <p className="text-lg mb-2">
                Company number{' '}
                <span className="font-bold">{selectedCompany.number}</span>
              </p>

              <div className="flex gap-4 mb-8">
                <button className="px-4 py-2 bg-[#00703c] hover:bg-[#005a30] text-white font-bold text-sm">
                  Follow this company
                </button>
                <button className="px-4 py-2 bg-[#1d70b8] hover:bg-[#1d4d7d] text-white font-bold text-sm">
                  File for this company
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-300 mb-6">
                <nav className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-3 font-bold hover:bg-gray-100 ${
                      activeTab === 'overview' ? 'border-b-4 border-gray-900' : ''
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('filing')}
                    className={`px-6 py-3 hover:bg-gray-100 ${
                      activeTab === 'filing' ? 'border-b-4 border-gray-900 font-bold' : ''
                    }`}
                  >
                    Filing history
                  </button>
                  <button
                    onClick={() => setActiveTab('people')}
                    className={`px-6 py-3 hover:bg-gray-100 ${
                      activeTab === 'people' ? 'border-b-4 border-gray-900 font-bold' : ''
                    }`}
                  >
                    People
                  </button>
                  <button
                    onClick={() => setActiveTab('treasury')}
                    className={`px-6 py-3 hover:bg-gray-100 ${
                      activeTab === 'treasury' ? 'border-b-4 border-gray-900 font-bold' : ''
                    }`}
                  >
                    Treasury
                  </button>
                  <button
                    onClick={() => setActiveTab('charges')}
                    className={`px-6 py-3 hover:bg-gray-100 ${
                      activeTab === 'charges' ? 'border-b-4 border-gray-900 font-bold' : ''
                    }`}
                  >
                    Charges
                  </button>
                </nav>
              </div>

              {/* Tab content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold mb-2">Registered office address</h3>
                    <p className="text-gray-800">{selectedCompany.registeredOfficeAddress}</p>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2">Company status</h3>
                    <p className="text-gray-800 font-bold">{selectedCompany.status}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-bold mb-2">Company type</h3>
                      <p className="text-gray-800 font-bold">{selectedCompany.companyType}</p>
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">Incorporated on</h3>
                      <p className="text-gray-800 font-bold">{selectedCompany.incorporatedOn}</p>
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
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">No execution ID found. Please re-initialize.</p>
                </div>
              )}

              {activeTab === 'people' && (
                <OfficersTab companyId={selectedCompany.id} />
              )}

              {activeTab === 'treasury' && (
                <TreasuryTab companyId={selectedCompany.id} />
              )}

              {activeTab === 'charges' && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">No charges registered</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
