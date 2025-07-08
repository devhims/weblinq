import { eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import { createDb } from '@/db/index';
import { assignInitialCredits, getUserCredits } from '@/db/queries';
import { user } from '@/db/schema';
import { getAuthType, getCurrentApiToken, getCurrentSession, getCurrentUser, isAuthenticated } from '@/lib/auth-utils';
import { createStandardErrorResponse, createStandardSuccessResponse, ERROR_CODES } from '@/lib/response-utils';

import type {
  BootstrapCreditsRoute,
  GetCreditsRoute,
  GetMeRoute,
  VerifyEmailRoute,
  VerifyEmailTokenRoute,
} from './user.routes';

export const getMe: AppRouteHandler<GetMeRoute> = async (c) => {
  const user = getCurrentUser(c);
  const session = getCurrentSession(c);
  const apiToken = getCurrentApiToken(c);
  const authType = getAuthType(c);
  const authenticated = isAuthenticated(c);

  // Provide a helpful message based on authentication status
  let message: string | undefined;
  if (authenticated) {
    message = `Authenticated via ${authType}. ${
      authType === 'session' ? 'Browser session active.' : 'API token valid.'
    }`;
  } else {
    message = 'Not authenticated. Use session login or provide API token in Authorization header.';
  }

  return c.json(
    createStandardSuccessResponse({
      user,
      session,
      apiToken: apiToken ? { id: 'hidden-for-security' } : null, // Don't expose full token
      authType,
      isAuthenticated: authenticated,
      message,
    }),
    HttpStatusCodes.OK,
  );
};

export const getCredits: AppRouteHandler<GetCreditsRoute> = async (c) => {
  try {
    const user = getCurrentUser(c);

    if (!user) {
      const errorResponse = createStandardErrorResponse('Authentication required', ERROR_CODES.AUTHENTICATION_REQUIRED);
      return c.json(errorResponse, HttpStatusCodes.UNAUTHORIZED);
    }

    // Get user credits using the environment from context
    const env = c.env;
    const credits = await getUserCredits(env, user.id);

    return c.json(createStandardSuccessResponse(credits), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Get credits error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const bootstrapCredits: AppRouteHandler<BootstrapCreditsRoute> = async (c) => {
  try {
    const user = getCurrentUser(c);

    if (!user) {
      const errorResponse = createStandardErrorResponse('Authentication required', ERROR_CODES.AUTHENTICATION_REQUIRED);
      return c.json(errorResponse, HttpStatusCodes.UNAUTHORIZED);
    }

    // Get environment from context and assign initial credits
    const env = c.env;
    await assignInitialCredits(env, user.id);

    return c.json(createStandardSuccessResponse({}), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Bootstrap credits error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const verifyEmail: AppRouteHandler<VerifyEmailRoute> = async (c) => {
  try {
    const body = c.req.valid('json');
    const { email } = body;

    // Get database connection using the same pattern as other handlers
    const env = c.env;
    const db = createDb(env);

    // Check if user with this email exists
    const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);

    const exists = existingUser.length > 0;

    return c.json(
      createStandardSuccessResponse({
        exists,
        email,
      }),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Verify email error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const verifyEmailToken: AppRouteHandler<VerifyEmailTokenRoute> = async (c) => {
  try {
    const query = c.req.query();
    const token = query.token;
    const auth = c.get('auth');
    const env = c.env;

    console.log('Custom verification route called with:', token ?? 'no token');

    // -------- 1. Manual-verification path (token present) --------
    if (token) {
      try {
        console.log('Attempting to verify email with token');

        const result = await auth.api.verifyEmail({
          query: { token },
        });

        console.log('Email verification successful:', result);

        // Instead of redirecting to dashboard directly, redirect to a frontend callback
        // that can handle setting the session properly
        const callbackPath = `${env.FRONTEND_URL}/auth/callback?verified=true&new_user=true&token=${encodeURIComponent(
          token,
        )}`;
        console.log('Redirecting to frontend callback:', callbackPath);

        return c.redirect(callbackPath, 302);
      } catch (error) {
        console.error('Email verification failed:', error);
        return c.redirect(`${env.FRONTEND_URL}/sign-in?error=verification-failed`, 302);
      }
    }

    // -------- 2. Callback-URL path (already verified, no token) --------
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (session?.user) {
        console.log('Active session found. Redirecting to dashboard.');
        return c.redirect(`${env.FRONTEND_URL}/dashboard?verified=true`, 302);
      }
    } catch (error) {
      console.log('No active session found:', error);
    }

    // -------- 3. Fallback redirect --------
    return c.redirect(`${env.FRONTEND_URL}/sign-in`, 302);
  } catch (error) {
    console.error('Verify email token error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};
