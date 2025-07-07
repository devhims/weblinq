import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get('token');

  console.log('Verification route called with:', token ?? 'no token');

  // -------- 1. Manual-verification path (token present) --------
  if (token) {
    try {
      console.log('Attempting to verify email with token');

      const result = await auth.api.verifyEmail({
        query: { token },
      });

      console.log('Email verification successful:', result);

      const destPath = '/dashboard?new_user=true&verified=true';
      console.log('Redirecting to:', destPath);

      return NextResponse.redirect(new URL(destPath, req.url));
    } catch (error) {
      console.error('Email verification failed:', error);
      return NextResponse.redirect(
        new URL('/sign-in?error=verification-failed', req.url),
      );
    }
  }

  // -------- 2. Callback-URL path (already verified, no token) --------
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (session?.user) {
      console.log('Active session found. Redirecting to dashboard.');
      return NextResponse.redirect(
        new URL('/dashboard?verified=true', req.url),
      );
    }
  } catch (error) {
    console.log('No active session found:', error);
  }

  // -------- 3. Fallback redirect --------
  return NextResponse.redirect(new URL('/sign-in', req.url));
}
