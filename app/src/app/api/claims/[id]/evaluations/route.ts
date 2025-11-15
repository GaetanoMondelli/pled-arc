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

// GET /api/claims/[id]/evaluations - Get evaluation history for claim
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
    const evaluationHistory = await storage.getEvaluationHistory(params.id);

    return NextResponse.json(evaluationHistory);
  } catch (error) {
    console.error('Error fetching evaluation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation history' },
      { status: 500 }
    );
  }
}

// POST /api/claims/[id]/evaluations - Save evaluation result
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const evaluationResult = await request.json();
    evaluationResult.claimId = params.id;

    // Convert date string to Date object if needed
    if (typeof evaluationResult.evaluatedAt === 'string') {
      evaluationResult.evaluatedAt = new Date(evaluationResult.evaluatedAt);
    }

    const storage = new FirebaseStorageClaimsStorage(userId);
    await storage.saveEvaluationResult(evaluationResult);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving evaluation result:', error);
    return NextResponse.json(
      { error: 'Failed to save evaluation result' },
      { status: 500 }
    );
  }
}