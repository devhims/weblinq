'use server';

import { redirect } from 'next/navigation';
import { APIError } from 'better-auth/api';
import { config } from '@/config/env';
import { validatePassword } from '@/lib/utils/password-validation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { userApi } from '@/lib/studio-api';
import { cookies } from 'next/headers';

interface State {
  errorMessage?: string | null;
  successMessage?: string | null;
  requiresVerification?: boolean;
  email?: string;
}

// Helper function to make authenticated requests to backend auth API
async function backendAuthRequest(endpoint: string, options: RequestInit = {}) {
  const headersList = await headers();

  return fetch(`${config.backendUrl}/api/auth/${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      // Forward cookies for session authentication
      cookie: headersList.get('cookie') || '',
      'content-type': 'application/json',
      ...headersList,
    },
    credentials: 'include',
  });
}

export async function signUp(_: any, formData: FormData): Promise<State> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  try {
    const response = await backendAuthRequest('sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { errorMessage: result.message || 'Sign up failed' };
    }

    if (result.user && !result.user.emailVerified) {
      return {
        requiresVerification: true,
        email: result.user.email,
      };
    }

    // If user is created and verified, redirect to dashboard
    redirect('/dashboard');
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      errorMessage: error.message || 'An error occurred during sign up',
    };
  }
}

export async function signIn(_: any, formData: FormData): Promise<State> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const response = await backendAuthRequest('sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        return {
          requiresVerification: true,
          email: email,
        };
      }
      return { errorMessage: result.message || 'Sign in failed' };
    }

    redirect('/dashboard');
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      errorMessage: error.message || 'An error occurred during sign in',
    };
  }
}

export async function forgotPassword(
  _: any,
  formData: FormData,
): Promise<State> {
  const email = formData.get('email') as string;

  try {
    const response = await backendAuthRequest('forget-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });

    if (!response.ok) {
      const result = await response.json();
      return { errorMessage: result.message || 'Password reset failed' };
    }

    return {
      errorMessage: null,
      successMessage: 'Password reset email sent! Please check your inbox.',
      email: email,
    };
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return { errorMessage: error.message || 'An error occurred' };
  }
}

export async function resetPassword(
  _: any,
  formData: FormData,
): Promise<State> {
  const password = formData.get('password') as string;
  const token = formData.get('token') as string;

  const validation = validatePassword(password);
  if (!validation.isValid) {
    return { errorMessage: validation.errors[0] };
  }

  try {
    const response = await backendAuthRequest('reset-password', {
      method: 'POST',
      body: JSON.stringify({ password, token }),
    });

    if (!response.ok) {
      const result = await response.json();
      return { errorMessage: result.message || 'Password reset failed' };
    }

    redirect('/sign-in');
  } catch (error: any) {
    console.error('Reset password error:', error);
    return { errorMessage: error.message || 'An error occurred' };
  }
}

// Note: These functions below are simplified since they primarily use client-side auth
// For production, consider moving these operations entirely to the client-side

export async function changePassword(_: any, formData: FormData): Promise<any> {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      currentPassword,
      errorMessage: validation.errors[0],
    };
  }

  try {
    // Get current user session
    const sessionResponse = await backendAuthRequest('get-session');
    const session = sessionResponse.ok ? await sessionResponse.json() : null;

    if (!session?.user) {
      return {
        currentPassword,
        errorMessage: 'You must be signed in to change your password.',
      };
    }

    // Verify current password first
    const verifyResponse = await backendAuthRequest('sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        password: currentPassword,
      }),
    });

    if (!verifyResponse.ok) {
      return {
        currentPassword,
        errorMessage: 'Current password is incorrect.',
      };
    }

    // Change password
    const changeResponse = await backendAuthRequest('change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword,
        currentPassword,
      }),
    });

    if (!changeResponse.ok) {
      const result = await changeResponse.json();
      return {
        currentPassword,
        errorMessage: result.message || 'Failed to change password.',
      };
    }

    redirect('/dashboard/settings');
  } catch (error: any) {
    console.error('Change password error:', error);
    return {
      currentPassword,
      errorMessage:
        error.message || 'An error occurred while changing your password.',
    };
  }
}

export async function deleteAccount(_: any, formData: FormData): Promise<any> {
  const password = formData.get('password') as string;

  try {
    // Get current user session
    const sessionResponse = await backendAuthRequest('get-session');
    const session = sessionResponse.ok ? await sessionResponse.json() : null;

    if (!session?.user) {
      return {
        password,
        errorMessage: 'You must be signed in to delete your account.',
      };
    }

    // Verify password using better-auth
    const verifyResponse = await backendAuthRequest('sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        password,
      }),
    });

    if (!verifyResponse.ok) {
      return {
        password,
        errorMessage: 'Incorrect password. Account deletion failed.',
      };
    }

    // Delete user account (Note: This endpoint may need to be implemented on backend)
    const deleteResponse = await backendAuthRequest('delete-user', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

    if (!deleteResponse.ok) {
      const result = await deleteResponse.json();
      return {
        password,
        errorMessage: result.message || 'Failed to delete account.',
      };
    }

    redirect('/');
  } catch (error: any) {
    console.error('Delete account error:', error);
    return {
      password,
      errorMessage:
        error.message || 'An error occurred while deleting your account.',
    };
  }
}

// Alias for backwards compatibility
export const updatePassword = changePassword;

// Email verification is now handled entirely by Better Auth backend
// No server action needed - use authClient.sendVerificationEmail() instead

// Server action to check if email exists
export async function checkEmailExists(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;

  if (!email || !email.includes('@')) {
    return {
      errorMessage: 'Please enter a valid email address',
      emailExists: false,
      email: '',
    };
  }

  try {
    // Make server-side API call to backend
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/v1/user/verify-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        body: JSON.stringify({ email }),
      },
    );

    if (!response.ok) {
      return {
        errorMessage: 'Unable to verify email. Please try again.',
        emailExists: false,
        email: '',
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        errorMessage: 'Unable to verify email. Please try again.',
        emailExists: false,
        email: '',
      };
    }

    return {
      errorMessage: null,
      emailExists: result.data.exists,
      email: email,
    };
  } catch (error) {
    console.error('Email check error:', error);
    return {
      errorMessage: 'Something went wrong. Please try again.',
      emailExists: false,
      email: '',
    };
  }
}
