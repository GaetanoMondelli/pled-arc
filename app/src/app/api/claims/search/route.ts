import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { options } from '@/app/api/configAuth';
import { FirebaseStorageClaimsStorage } from '@/lib/services/firebaseStorageClaimsStorage';
import {
  ClaimSearchCriteria,
  ClaimStatus,
  ClaimFormulaType,
} from '@/core/types/claims';

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return null;
    }
    return session.user.email;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// GET /api/claims/search - Search claims with criteria
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse search criteria from query parameters
    const criteria: ClaimSearchCriteria = {};

    if (searchParams.get('query')) {
      criteria.query = searchParams.get('query')!;
    }

    if (searchParams.get('status')) {
      criteria.status = searchParams.get('status')!.split(',') as ClaimStatus[];
    }

    if (searchParams.get('formulaType')) {
      criteria.formulaType = searchParams.get('formulaType')!.split(',') as ClaimFormulaType[];
    }

    if (searchParams.get('owner')) {
      criteria.owner = searchParams.get('owner')!.split(',');
    }

    if (searchParams.get('tags')) {
      criteria.tags = searchParams.get('tags')!.split(',');
    }

    if (searchParams.get('sortBy')) {
      criteria.sortBy = searchParams.get('sortBy') as any;
    }

    if (searchParams.get('sortOrder')) {
      criteria.sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc';
    }

    if (searchParams.get('limit')) {
      criteria.limit = parseInt(searchParams.get('limit')!);
    }

    if (searchParams.get('offset')) {
      criteria.offset = parseInt(searchParams.get('offset')!);
    }

    const storage = new FirebaseStorageClaimsStorage(userId);
    const result = await storage.searchClaims(criteria);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching claims:', error);
    return NextResponse.json(
      { error: 'Failed to search claims' },
      { status: 500 }
    );
  }
}