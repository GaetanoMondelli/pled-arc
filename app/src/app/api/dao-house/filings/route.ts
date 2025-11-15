import { NextRequest, NextResponse } from 'next/server';
import { daoHouseService } from '@/lib/services/dao-house-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const filings = await daoHouseService.listFilings(companyId);

    return NextResponse.json({
      success: true,
      data: filings,
    });
  } catch (error) {
    console.error('Error fetching filings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch filings' },
      { status: 500 }
    );
  }
}
