import { NextResponse } from 'next/server';
import { daoHouseService } from '@/lib/services/dao-house-service';

export async function GET() {
  try {
    const companies = await daoHouseService.listCompanies();
    return NextResponse.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error listing companies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list companies' },
      { status: 500 }
    );
  }
}
