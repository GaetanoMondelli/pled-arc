import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { FirebaseStorageClaimsStorage } from '@/lib/services/firebaseStorageClaimsStorage';

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

// GET /api/claims/[id] - Get single claim
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = new FirebaseStorageClaimsStorage(userId);
    const claim = await storage.getClaim(params.id);

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error('Error fetching claim:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claim' },
      { status: 500 }
    );
  }
}

// PUT /api/claims/[id] - Update claim
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();

    // Add the current user as the modifier
    updates.modifiedBy = userId;

    const storage = new FirebaseStorageClaimsStorage(userId);
    const claim = await storage.updateClaim(params.id, updates);

    return NextResponse.json(claim);
  } catch (error) {
    console.error('Error updating claim:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update claim' },
      { status: 500 }
    );
  }
}

// DELETE /api/claims/[id] - Delete claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = new FirebaseStorageClaimsStorage(userId);
    await storage.deleteClaim(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting claim:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete claim' },
      { status: 500 }
    );
  }
}