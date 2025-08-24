import { createHash } from 'node:crypto';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/user-do';
import type { WebOperation } from '@/lib/constants';
import type { AppRouteHandler } from '@/lib/types';

import { deductCredits, getUserCredits, logError } from '@/db/queries';
import { CREDIT_COSTS } from '@/lib/constants';
import { createStandardErrorResponse, ERROR_CODES } from '@/lib/response-utils';

import type { SearchRoute } from './web-2.routes';

/* ========================================================================== */
/*  Cloudflare Cache API Implementation                                      */
/* ========================================================================== */

/**
 * Cache TTL configuration (in seconds for Cache API)
 * Using the same values from CACHE_CONFIG but converted to seconds
 */
const CACHE_TTL_SECONDS = {
  SCREENSHOT: 5 * 60, // 5 minutes
  MARKDOWN: 1 * 60, // 1 minute
  JSON_EXTRACTION: 5 * 60, // 5 minutes
  CONTENT: 1 * 60, // 1 minute
  SCRAPE: 1 * 60, // 1 minute
  LINKS: 1 * 60, // 1 minute
  SEARCH: 2 * 60, // 2 minutes
  PDF: 5 * 60, // 5 minutes
} as const;

/**
 * Result wrapper that includes credit information
 */
interface CreditAwareResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  creditsCost: number;
  creditsRemaining: number;
  fromCache?: boolean;
}

/**
 * Get or create a WebDurableObject instance
 */
function getWebDurableObject(c: any, userId: string): WebDurableObject {
  const namespace = c.env.WEBLINQ_DURABLE_OBJECT;
  console.log('user id', userId);

  // Use stable versioned IDs for consistent DO access across signup and runtime
  // This ensures the same DO is accessed during signup and handler calls
  const id = namespace.idFromName(`web:${userId}:v3`);
  console.log(`🆔 Using stable DO ID for user ${userId}: web:${userId}:v3`);

  return namespace.get(id);
}

/**
 * Generate a cache key for Cloudflare Cache API
 * Uses a dummy internal URL as recommended by Cloudflare docs
 * Includes base64 preference for binary operations to ensure correct format caching
 */
function generateCacheKey(operation: WebOperation, userId: string, params: Record<string, any>): string {
  // Create a normalized parameter string for consistent caching
  const normalizedParams = { ...params };

  // Remove userId from cache key params since it's handled separately
  delete normalizedParams.userId;

  // Sort keys for consistent hashing
  const sortedParams = Object.keys(normalizedParams)
    .sort()
    .reduce((obj, key) => {
      obj[key] = normalizedParams[key];
      return obj;
    }, {} as Record<string, any>);

  // Create hash of parameters
  const paramString = JSON.stringify(sortedParams);
  const paramHash = createHash('sha256').update(paramString).digest('hex').substring(0, 16);

  // Use dummy internal URL as cache key - this is just for string identification
  // and doesn't represent an actual endpoint (as per Cloudflare best practices)
  return `https://cache.weblinq.internal/${operation.toLowerCase()}/${userId}/${paramHash}`;
}

/**
 * Store result in Cloudflare Cache with custom TTL
 * Adds Cache-Tag headers for user-specific purging
 */
async function setCachedResult<T>(cacheKey: string, operation: WebOperation, data: T): Promise<void> {
  try {
    const ttlSeconds = CACHE_TTL_SECONDS[operation];

    // Create the response to cache
    const cacheData = {
      success: true,
      data,
      fromCache: true,
      cachedAt: Date.now(),
    };

    // Extract userId from cache key for tagging
    const userIdMatch = cacheKey.match(/\/([^/]+)\/[^/]+$/);
    const userId = userIdMatch ? userIdMatch[1] : 'unknown';

    const response = new Response(JSON.stringify(cacheData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${ttlSeconds}`,
        'Cache-Tag': `user-${userId},operation-${operation.toLowerCase()},weblinq-v2`, // Add tags for selective purging
        'X-Operation': operation,
        'X-Cached-At': new Date().toISOString(),
        'X-TTL-Seconds': ttlSeconds.toString(),
      },
    });

    // Store in Cloudflare Cache
    const cache = await caches.open('weblinq-cache');
    await cache.put(cacheKey, response);

    console.log(
      `💾 Cached result for ${operation} (TTL: ${ttlSeconds}s, Key: ${cacheKey}, Tags: user-${userId},operation-${operation.toLowerCase()},weblinq-v2)`,
    );
  } catch (error) {
    console.error(`❌ Error caching result for ${operation}:`, error);
    // Don't throw - caching failures shouldn't break operations
  }
}

/**
 * Get cached result from Cloudflare Cache
 */
async function getCachedResult<T>(cacheKey: string, operation: WebOperation): Promise<CreditAwareResult<T> | null> {
  try {
    const cache = await caches.open('weblinq-cache');
    const cachedResponse = await cache.match(cacheKey);

    if (!cachedResponse) {
      console.log(`❌ Cache miss for ${operation} (Key: ${cacheKey})`);
      return null;
    }

    // Check if cache is still valid (Cloudflare handles TTL, but we can double-check)
    const cachedAt = cachedResponse.headers.get('X-Cached-At');

    if (cachedAt) {
      const cacheTime = new Date(cachedAt).getTime();
      const ttlSeconds = CACHE_TTL_SECONDS[operation];
      const expiryTime = cacheTime + ttlSeconds * 1000;

      if (Date.now() > expiryTime) {
        console.log(`🗑️ Cache entry expired for ${operation}, removing`);
        await cache.delete(cacheKey);
        return null;
      }
    }

    const cachedData = (await cachedResponse.json()) as CreditAwareResult<T>;

    console.log(`✅ Cache hit for ${operation} (Key: ${cacheKey})`);

    return cachedData;
  } catch (error) {
    console.error(`❌ Error retrieving cache for ${operation}:`, error);
    return null;
  }
}

/**
 * Check if user has sufficient credits for an operation
 */
async function checkCredits(
  env: CloudflareBindings,
  userId: string,
  operation: WebOperation,
): Promise<{ hasCredits: boolean; balance: number; cost: number }> {
  const cost = CREDIT_COSTS[operation];

  try {
    const credits = await getUserCredits(env, userId);
    return {
      hasCredits: credits.balance >= cost,
      balance: credits.balance,
      cost,
    };
  } catch (error) {
    console.error(`❌ Failed to check credits for user ${userId}:`, error);
    throw new Error('Failed to check credit balance');
  }
}

/**
 * Deduct credits for an operation
 * Always deducts credits even for cache hits (for performance tracking)
 */
async function deductCreditsForOperation(
  env: CloudflareBindings,
  userId: string,
  operation: WebOperation,
  metadata?: Record<string, any>,
): Promise<void> {
  const cost = CREDIT_COSTS[operation];

  try {
    await deductCredits(env, userId, cost, operation.toLowerCase(), {
      operation,
      cost,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    console.log(`✅ Deducted ${cost} credits for ${operation} operation (user: ${userId})`);
  } catch (error) {
    console.error(`❌ Failed to deduct credits for ${operation} operation (user: ${userId}):`, error);
    throw error; // Re-throw to handle in calling function
  }
}

/**
 * Execute a web operation with Cloudflare Cache API integration and credit management
 */
async function executeWithCache<T>(
  c: any,
  operation: WebOperation,
  operationFn: () => Promise<any>,
  cacheParams: Record<string, any>,
): Promise<CreditAwareResult<T>> {
  const user = c.get('user')!;
  const userId = user.id;

  // Check if we're in development mode to disable caching
  const isDevelopment = c.env.NODE_ENV === 'preview' || c.env.NODE_ENV === 'preview';

  // 2. Check credits before proceeding
  const creditCheck = await checkCredits(c.env, userId, operation);

  if (!creditCheck.hasCredits) {
    return {
      success: false,
      error: `Insufficient credits. Required: ${creditCheck.cost}, Available: ${creditCheck.balance}`,
      creditsCost: creditCheck.cost,
      creditsRemaining: creditCheck.balance,
      fromCache: false,
    };
  }

  // 1. Generate cache key and check cache first (skip in development mode)
  const cacheKey = generateCacheKey(operation, userId, cacheParams);

  if (!isDevelopment) {
    const cachedResult = await getCachedResult<T>(cacheKey, operation);

    if (cachedResult) {
      // Update credits remaining with current balance (cache might be stale)
      try {
        c.executionCtx?.waitUntil(deductCreditsForOperation(c.env, userId, operation, cacheParams));
        const updatedBalance = creditCheck.balance - creditCheck.cost;

        // Return cached result with updated credit information
        return {
          ...cachedResult,
          creditsCost: creditCheck.cost,
          creditsRemaining: updatedBalance,
        };
      } catch (error) {
        console.warn('⚠️ Failed to deduct credits for cache hit:', error);
        // Still return cached result but with warning
        return {
          ...cachedResult,
          creditsCost: creditCheck.cost,
          creditsRemaining: creditCheck.balance, // Use current balance as fallback
        };
      }
    }
  } else {
    console.log(`🧪 Development mode: Skipping cache for ${operation} operation`);
  }

  try {
    console.log(`🚀 Executing ${operation} operation (${isDevelopment ? 'development mode' : 'cache miss'})`);

    // 3. Execute the operation
    const result = await operationFn();

    if (!result.success) {
      // Don't cache or deduct credits for failed operations
      return {
        success: false,
        error: result.error,
        creditsCost: creditCheck.cost,
        creditsRemaining: creditCheck.balance,
        fromCache: false,
      };
    }

    // 4. Deduct credits for successful operation
    c.executionCtx?.waitUntil(deductCreditsForOperation(c.env, userId, operation, cacheParams));

    const updatedBalance = creditCheck.balance - creditCheck.cost;

    // 5. Cache the successful result in background (skip in development mode)
    if (!isDevelopment) {
      try {
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(setCachedResult(cacheKey, operation, result.data));
          console.log(`✅ Background caching initiated for ${operation}`);
        } else {
          // Fallback: cache asynchronously (non-blocking for user)
          setCachedResult(cacheKey, operation, result.data).catch((error) => {
            console.error(`❌ Background cache operation failed for ${operation}:`, error);
          });
        }
      } catch (cacheError) {
        console.error(`❌ Failed to initiate background caching for ${operation}:`, cacheError);
        // Don't throw - caching failures shouldn't break the response
      }
    } else {
      console.log(`🧪 Development mode: Skipping cache storage for ${operation}`);
    }

    return {
      success: true,
      data: result.data,
      creditsCost: creditCheck.cost,
      creditsRemaining: updatedBalance,
      fromCache: false,
    };
  } catch (error) {
    // If operation fails, don't deduct credits or cache the result
    console.error(`❌ Operation ${operation} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Operation failed',
      creditsCost: creditCheck.cost,
      creditsRemaining: creditCheck.balance,
      fromCache: false,
    };
  }
}

/**
 * Log operation failures for analytics
 */
async function logOperationFailure(
  c: any,
  operation: string,
  result: CreditAwareResult<any>,
  input: any,
  operationId: string,
) {
  try {
    await logError(c.env, {
      userId: c.get('user')!.id,
      operation,
      source: 'web-2_handler',
      level: 'error',
      message: result.error || 'Unknown error',
      context: {
        input: JSON.stringify(input),
        operationId,
      },
    });
  } catch (logError) {
    console.error('Failed to log operation failure:', logError);
  }
}

/**
 * Handle operation errors consistently
 */
function handleOperationError(c: any, result: CreditAwareResult<any>, _operation: string, _input: any) {
  if (result.error === 'Insufficient credits') {
    return c.json(
      createStandardErrorResponse('Insufficient credits to perform this operation', 'insufficient_credits'),
      HttpStatusCodes.PAYMENT_REQUIRED,
    );
  }

  return c.json(
    createStandardErrorResponse(result.error || 'Operation failed', ERROR_CODES.INTERNAL_SERVER_ERROR),
    HttpStatusCodes.INTERNAL_SERVER_ERROR,
  );
}

/**
 * Log critical errors that should be monitored
 */
async function logCriticalError(c: any, operation: string, error: unknown) {
  try {
    const user = c.get('user');
    await logError(c.env, {
      userId: user?.id || 'unknown',
      operation,
      source: 'web-2_handler',
      level: 'critical',
      message: error instanceof Error ? error.message : 'Unknown critical error',
      context: {
        operationId: `critical-${operation}-${Date.now()}`,
      },
    });
  } catch (logError) {
    console.error('Failed to log critical error:', logError);
  }
}

/* ========================================================================== */
/*  Route Handlers                                                           */
/* ========================================================================== */

export const search: AppRouteHandler<SearchRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'SEARCH',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        return await webDurableObject.searchV2(body, user.id);
      },
      {
        query: body.query,
        limit: body.limit,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'search', result, body, `search:${body.query}`);
      return handleOperationError(c, result, 'search', body);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Search error:', error);
    await logCriticalError(c, 'search', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );

    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
