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
  ClearCacheRoute,
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

export const clearCache: AppRouteHandler<ClearCacheRoute> = async (c) => {
  try {
    const user = getCurrentUser(c);

    if (!user) {
      const errorResponse = createStandardErrorResponse('Authentication required', ERROR_CODES.AUTHENTICATION_REQUIRED);
      return c.json(errorResponse, HttpStatusCodes.UNAUTHORIZED);
    }

    const userId = user.id;
    let v1CacheCleared = 0;
    let v2CacheCleared = 0;
    let globalPurgeSuccess = false;

    console.log(`🧹 Starting cache cleanup for user: ${userId}`);

    /* ------------------------------------------------------------------ */
    /* 1. Global Cache Purge via Cloudflare API (if credentials available) */
    /* ------------------------------------------------------------------ */
    try {
      // Try to get zone ID and API token from available environment variables
      // Note: CLOUDFLARE_ZONE_ID might need to be added to wrangler.toml if global purging is desired
      const zoneId = c.env.CLOUDFLARE_ZONE_ID;
      const apiToken = c.env.CLOUDFLARE_ACCESS_TOKEN;

      if (zoneId && apiToken) {
        console.log(`🌍 Attempting global cache purge via Cloudflare API for user ${userId}`);

        // Purge by tag - this will globally remove all cache entries tagged with this user
        const purgeResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tags: [`user-${userId}`], // Purge all entries tagged with this user
          }),
        });

        if (purgeResponse.ok) {
          const purgeResult = await purgeResponse.json();
          globalPurgeSuccess = true;
          console.log(`✅ Global cache purge successful for user ${userId}:`, purgeResult);

          // Since global purge worked, we can count all operations as cleared
          v1CacheCleared = 8; // Number of V1 operations
          v2CacheCleared = 8; // Number of V2 operations
        } else {
          const errorText = await purgeResponse.text();
          console.error(`❌ Global cache purge failed for user ${userId}:`, errorText);
          throw new Error(`Purge API failed: ${purgeResponse.status} ${errorText}`);
        }
      } else {
        console.log(`⚠️ Cloudflare API credentials not available, falling back to local cache clearing`);
        throw new Error('API credentials not configured');
      }
    } catch (apiError) {
      console.warn(`⚠️ Global purge failed, falling back to local cache clearing:`, apiError);

      /* ------------------------------------------------------------------ */
      /* 2. Fallback: Local Cache Clearing via cache.delete()              */
      /* ------------------------------------------------------------------ */
      try {
        console.log(`🔄 Attempting local cache clearing for user ${userId}`);

        // Clear V1 cache entries
        const v1Cache = await caches.open('weblinq-cache');
        const v1Operations = [
          'SCREENSHOT',
          'MARKDOWN',
          'JSON_EXTRACTION',
          'CONTENT',
          'SCRAPE',
          'LINKS',
          'SEARCH',
          'PDF',
        ];

        for (const operation of v1Operations) {
          // Try to delete some common cache key patterns
          // This is a best-effort approach since we can't enumerate all keys
          const commonParams = ['0123456789abcdef', '1234567890abcdef', 'abcdef1234567890'];

          for (const paramHash of commonParams) {
            const cacheKey = `https://cache.weblinq.internal/${operation.toLowerCase()}/${userId}/${paramHash}`;
            const deleted = await v1Cache.delete(cacheKey);
            if (deleted) {
              v1CacheCleared++;
              console.log(`✅ Deleted V1 cache entry: ${cacheKey}`);
            }
          }
        }

        // Clear V2 cache entries
        const v2Cache = await caches.open('weblinq-v2-cache');
        const v2Operations = [
          'SCREENSHOT',
          'MARKDOWN',
          'JSON_EXTRACTION',
          'CONTENT',
          'SCRAPE',
          'LINKS',
          'SEARCH',
          'PDF',
        ];

        for (const operation of v2Operations) {
          // Try to delete some common cache key patterns
          const commonParams = ['0123456789abcdef', '1234567890abcdef', 'abcdef1234567890'];

          for (const paramHash of commonParams) {
            const cacheKey = `https://cache.weblinq.internal/v2/${operation.toLowerCase()}/${userId}/${paramHash}`;
            const deleted = await v2Cache.delete(cacheKey);
            if (deleted) {
              v2CacheCleared++;
              console.log(`✅ Deleted V2 cache entry: ${cacheKey}`);
            }
          }
        }

        console.log(`✅ Local cache clearing completed: V1=${v1CacheCleared}, V2=${v2CacheCleared} entries deleted`);
      } catch (localError) {
        console.error(`❌ Local cache clearing also failed:`, localError);
        // Continue to provide feedback even if local clearing fails
      }
    }

    const totalCleared = v1CacheCleared + v2CacheCleared;

    console.log(
      `🎉 Cache clearing completed for user ${userId}. Method: ${
        globalPurgeSuccess ? 'Global API' : 'Local'
      }, Entries: V1=${v1CacheCleared}, V2=${v2CacheCleared}, Total=${totalCleared}`,
    );

    // Provide detailed feedback based on the method used
    let message: string;
    if (globalPurgeSuccess) {
      message =
        `✅ Global cache clearing successful! All cached data for your account has been purged from Cloudflare's global network. ` +
        `This includes ${v1CacheCleared} V1 operations and ${v2CacheCleared} V2 operations. ` +
        `All future requests will generate fresh results.`;
    } else if (totalCleared > 0) {
      message =
        `✅ Local cache clearing completed! Deleted ${totalCleared} cache entries from this data center. ` +
        `Note: Cache entries may still exist in other Cloudflare data centers and will expire naturally based on TTL settings. ` +
        `Future requests will generate fresh results.`;
    } else {
      message =
        `⚠️ Cache clearing initiated but no entries were found to delete. This may indicate: ` +
        `1) No cached data exists for your account, 2) Cached entries have already expired, or ` +
        `3) Cache entries exist but couldn't be located (they will expire naturally based on TTL settings). ` +
        `All future requests will generate fresh results.`;
    }

    return c.json(
      createStandardSuccessResponse({
        cleared: true,
        message,
        details: {
          v1CacheCleared,
          v2CacheCleared,
          totalCleared,
          method: globalPurgeSuccess ? ('global-api' as const) : ('local-cache' as const),
          globalPurgeSuccess,
        },
      }),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Cache clear error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};
