import { NextRequest, NextResponse } from 'next/server';
import { daoHouseService } from '@/lib/services/dao-house-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    // Get people directory
    const people = await daoHouseService.getPeopleDirectory();

    return NextResponse.json({
      success: true,
      people,
    });
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch people' },
      { status: 500 }
    );
  }
}
