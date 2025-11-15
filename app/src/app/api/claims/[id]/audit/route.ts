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

// GET /api/claims/[id]/audit - Get audit trail for claim
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
    const auditTrail = await storage.getAuditTrail(params.id);

    return NextResponse.json(auditTrail);
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
}

// POST /api/claims/[id]/audit - Add audit entry
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entryData = await request.json();
    entryData.claimId = params.id;
    entryData.userId = userId;

    const storage = new FirebaseStorageClaimsStorage(userId);
    await storage.addAuditEntry(entryData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding audit entry:', error);
    return NextResponse.json(
      { error: 'Failed to add audit entry' },
      { status: 500 }
    );
  }
}