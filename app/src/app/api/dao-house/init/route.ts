import { NextRequest, NextResponse } from 'next/server';
import { daoHouseService } from '@/lib/services/dao-house-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { templateId } = body;

    // If no templateId provided, try to use a default or create execution without template validation
    if (!templateId) {
      templateId = 'dao-house-default';
    }

    // Try to fetch template, but don't fail if it doesn't exist
    let templateData = null;
    try {
      const templateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/templates/${templateId}`
      );
      if (templateResponse.ok) {
        templateData = await templateResponse.json();
      }
    } catch (err) {
      console.log('Template not found, continuing without it');
    }

    // Fetch Circle wallets
    const walletsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/circle/wallet`);
    const walletsData = await walletsResponse.json();
    const wallets = walletsData.data?.wallets || [];

    // Filter wallets with balances
    const walletsWithBalances = wallets.filter((w: any) =>
      w.tokenBalances && w.tokenBalances.length > 0
    );

    // Create fake people directory (1 wallet per person)
    const people = [
      {
        id: 'person-1',
        name: 'Michael Burry',
        role: 'Director',
        appointedDate: '1 September 2020',
        wallets: walletsWithBalances.slice(0, 1).map((w: any) => ({
          walletId: w.id,
          address: w.address,
          blockchain: w.blockchain,
          balance: w.tokenBalances[0]?.amount || '0',
          token: w.tokenBalances[0]?.token?.symbol || 'USDC',
        })),
        allocationPercentage: 50,
        shares: 50,
      },
      {
        id: 'person-2',
        name: 'Richard Branson',
        role: 'Shareholder',
        appointedDate: '15 March 2019',
        wallets: walletsWithBalances.slice(1, 2).map((w: any) => ({
          walletId: w.id,
          address: w.address,
          blockchain: w.blockchain,
          balance: w.tokenBalances[0]?.amount || '0',
          token: w.tokenBalances[0]?.token?.symbol || 'USDC',
        })),
        allocationPercentage: 30,
        shares: 30,
      },
      {
        id: 'person-3',
        name: 'Ray Dalio',
        role: 'Shareholder',
        appointedDate: '10 June 2021',
        wallets: walletsWithBalances.slice(2, 3).map((w: any) => ({
          walletId: w.id,
          address: w.address,
          blockchain: w.blockchain,
          balance: w.tokenBalances[0]?.amount || '0',
          token: w.tokenBalances[0]?.token?.symbol || 'USDC',
        })),
        allocationPercentage: 20,
        shares: 20,
      },
    ];

    await daoHouseService.savePeopleDirectory(people);

    // Create execution for corporate filings
    const executionResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: templateId,
        name: `Web3 Scion - Corporate Filings`,
        description: 'Process corporate documents and trigger treasury actions for Web3 Scion',
        externalEvents: [],
      }),
    });

    const executionData = await executionResponse.json();

    // Create Web3 Scion company with executionId
    const company = {
      id: 'web3-scion',
      number: '08675309',
      name: 'WEB3 SCION LIMITED',
      status: 'Active',
      registeredOfficeAddress: 'Company Secretariat - The Vhq, Fleming Way, Crawley, West Sussex, United Kingdom, RH10 9DF',
      companyType: 'Private limited Company',
      incorporatedOn: '1 September 2020',
      officers: people,
      executionId: executionData.executionId,
    };

    await daoHouseService.saveCompany(company);

    return NextResponse.json({
      success: true,
      message: 'DAO House initialized successfully',
      data: {
        company,
        people,
        executionId: executionData.executionId,
        walletsCount: walletsWithBalances.length,
      },
    });
  } catch (error) {
    console.error('Error initializing DAO House:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize DAO House' },
      { status: 500 }
    );
  }
}
