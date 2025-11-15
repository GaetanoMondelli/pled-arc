import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { options } from '@/app/api/configAuth';
import { FirebaseStorageClaimsStorage } from '@/lib/services/firebaseStorageClaimsStorage';
import {
  Claim,
  ClaimSearchCriteria,
} from '@/core/types/claims';

// Helper function to get authenticated user ID
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    const session = await getServerSession(options);
    if (!session?.user?.email) {
      return null;
    }
    return session.user.email;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// Helper function to get file storage for user
async function getUserStorage(userId: string): Promise<FirebaseStorageClaimsStorage> {
  return new FirebaseStorageClaimsStorage(userId);
}

// GET /api/claims - Get all claims for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = await getUserStorage(userId);
    const claims = await storage.getAllClaims();

    return NextResponse.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// POST /api/claims - Create new claim
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const claimData = await request.json();

    // Add the current user as the creator if not specified
    if (!claimData.createdBy) {
      claimData.createdBy = userId;
    }

    const storage = await getUserStorage(userId);
    const claim = await storage.createClaim(claimData);

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error('Error creating claim:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create claim' },
      { status: 500 }
    );
  }
}