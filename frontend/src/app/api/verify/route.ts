import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  console.log('Verification route called with token:', token);

  if (!token) {
    console.log('No token provided, redirecting to sign-in');
    return redirect('/sign-in?error=invalid-token');
  }

  try {
    console.log('Attempting to verify email with token:', token);
    const result = await auth.api.verifyEmail({
      query: { token },
    });

    console.log('Email verification successful:', result);

    // Auto sign in after verification is now enabled in auth config
    // So user should be automatically signed in
  } catch (error) {
    console.error('Email verification failed:', error);
    return redirect('/verify-email?error=verification-failed');
  }

  // Redirect outside of try-catch to avoid catching NEXT_REDIRECT error
  return redirect('/dashboard?verified=true');
}
