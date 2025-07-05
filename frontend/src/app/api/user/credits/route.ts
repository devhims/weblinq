import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCredits } from '@/db/queries';

export async function GET(request: NextRequest) {
  try {
    // Get the session from Better Auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user credits
    const credits = await getUserCredits(session.user.id);

    return NextResponse.json({
      balance: credits.balance,
      plan: credits.plan,
      lastRefill: credits.lastRefill,
    });
  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
