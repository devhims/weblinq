import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import {
  getCurrentSession,
  getCurrentUser,
  isAuthenticated,
} from '@/lib/auth-utils';

import type {
  EmailSignInRoute,
  EmailSignUpRoute,
  GetSessionRoute,
  GithubCallbackRoute,
  GithubSignInRoute,
  SignOutRoute,
} from './auth.routes';

export const githubSignIn: AppRouteHandler<GithubSignInRoute> = async (c) => {
  const auth = c.get('auth');
  const { callbackURL } = c.req.query();

  try {
    // Use Better Auth's signInSocial API method
    const result = await auth.api.signInSocial({
      body: {
        provider: 'github',
        callbackURL: callbackURL || '/auth/demo', // Where to redirect after successful signin
      },
    });

    // The result should contain a redirect URL
    if (
      result
      && typeof result === 'object'
      && 'url' in result
      && typeof result.url === 'string'
    ) {
      return c.redirect(result.url);
    }

    // Fallback: redirect to Better Auth's social signin endpoint
    const baseUrl = c.env.BETTER_AUTH_URL || 'http://localhost:3000';
    return c.redirect(`${baseUrl}/api/auth/sign-in/social?provider=github`);
  }
  catch (error) {
    console.error('GitHub signin error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        error: 'Failed to initiate GitHub signin',
        details: errorMessage,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const githubCallback: AppRouteHandler<GithubCallbackRoute> = async (c) => {
  const { code, state, error } = c.req.query();

  if (error) {
    console.error('GitHub OAuth error:', error);
    return c.json(
      { error: 'GitHub OAuth failed', details: error },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!code) {
    return c.json(
      { error: 'Missing authorization code' },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  try {
    const baseUrl = c.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/api/auth/callback/github?code=${code}&state=${state || ''}`;

    return c.redirect(redirectUrl);
  }
  catch (error) {
    console.error('GitHub callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        error: 'Failed to process GitHub callback',
        details: errorMessage,
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
};

export const emailSignIn: AppRouteHandler<EmailSignInRoute> = async (c) => {
  const auth = c.get('auth');
  const { email, password, callbackURL } = await c.req.json();

  try {
    // Use asResponse: true to get the full response with headers
    const response = await auth.api.signInEmail({
      body: {
        email,
        password,
        callbackURL: callbackURL || '/dashboard',
      },
      asResponse: true,
    });

    // Forward the Set-Cookie headers from Better Auth to the client
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        c.header('Set-Cookie', cookie);
      });
    }

    // Check if the response is successful
    if (response.ok) {
      const data = await response.json() as { user?: any; session?: any };
      return c.json(
        {
          success: true,
          message: 'Sign-in successful',
          redirectUrl: callbackURL || '/dashboard',
          user: data.user,
        },
        HttpStatusCodes.OK,
      );
    }

    // Handle authentication errors
    if (response.status === 401) {
      return c.json(
        { error: 'Invalid email or password' },
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    return c.json(
      { error: 'Sign-in failed' },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
  catch (error) {
    console.error('Email signin error:', error);

    if (
      error instanceof Error
      && error.message.includes('Invalid email or password')
    ) {
      return c.json(
        { error: 'Invalid email or password' },
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const errorMessage
      = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      {
        error: 'Sign-in failed',
        details: errorMessage,
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
};

export const emailSignUp: AppRouteHandler<EmailSignUpRoute> = async (c) => {
  const auth = c.get('auth');
  const { email, password, name, callbackURL } = await c.req.json();

  try {
    // Use asResponse: true to get the full response with headers
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name || email.split('@')[0],
        callbackURL: callbackURL || '/dashboard',
      },
      asResponse: true,
    });

    // Forward the Set-Cookie headers from Better Auth to the client
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        c.header('Set-Cookie', cookie);
      });
    }

    // Check if the response is successful
    if (response.ok) {
      const data = await response.json() as { user?: any; session?: any };
      return c.json(
        {
          success: true,
          message: 'Account created successfully',
          redirectUrl: callbackURL || '/dashboard',
          user: data.user,
        },
        HttpStatusCodes.CREATED,
      );
    }

    // Handle specific error cases
    if (response.status === 409) {
      return c.json(
        { error: 'Email already exists' },
        HttpStatusCodes.CONFLICT,
      );
    }

    return c.json(
      { error: 'Failed to create account' },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
  catch (error) {
    console.error('Email signup error:', error);

    if (error instanceof Error) {
      const isDuplicateError
        = error.message.includes('already exists')
          || error.message.includes('duplicate');

      if (isDuplicateError) {
        return c.json(
          { error: 'Email already exists' },
          HttpStatusCodes.CONFLICT,
        );
      }
    }

    const errorMessage
      = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      {
        error: 'Sign-up failed',
        details: errorMessage,
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
};

export const signOut: AppRouteHandler<SignOutRoute> = async (c) => {
  const auth = c.get('auth');
  const { callbackURL } = await c.req.json().catch(() => ({ callbackURL: undefined }));

  try {
    // Use asResponse: true to get the full response with headers
    const response = await auth.api.signOut({
      headers: c.req.raw.headers,
      asResponse: true,
    });

    // Forward the Set-Cookie headers from Better Auth to the client
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        c.header('Set-Cookie', cookie);
      });
    }

    return c.json(
      {
        success: true,
        message: 'Sign-out successful',
        redirectUrl: callbackURL || '/',
      },
      HttpStatusCodes.OK,
    );
  }
  catch (error) {
    console.error('Sign-out error:', error);
    const errorMessage
      = error instanceof Error ? error.message : 'Unknown error';

    return c.json(
      {
        error: 'Sign-out failed',
        details: errorMessage,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getSession: AppRouteHandler<GetSessionRoute> = async (c) => {
  const user = getCurrentUser(c);
  const session = getCurrentSession(c);

  return c.json(
    {
      user,
      session,
      isAuthenticated: isAuthenticated(c),
    },
    HttpStatusCodes.OK,
  );
};
