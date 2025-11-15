import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { options } from '@/app/api/configAuth';
import { FirebaseStorageClaimsStorage } from '@/lib/services/firebaseStorageClaimsStorage';

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

// GET /api/claims/[id]/json - Get claim JSON file content
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use FirebaseStorageClaimsStorage to get the claim data
    const storage = new FirebaseStorageClaimsStorage(userId);
    const claim = await storage.getClaim(params.id);

    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Format the JSON for better display
    const prettyJson = JSON.stringify(claim, null, 2);

    // Return as plain text for display in the modal
    return new NextResponse(prettyJson, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error reading claim JSON:', error);

    return NextResponse.json(
      { error: 'Failed to read claim JSON' },
      { status: 500 }
    );
  }
}