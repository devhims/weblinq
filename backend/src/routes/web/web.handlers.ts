import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/user-do';
import type { AppRouteHandler } from '@/lib/types';

import { deductCredits, getUserCredits, logError } from '@/db/queries';
import { createStandardErrorResponse, ERROR_CODES } from '@/lib/response-utils';

import type {
  ContentRoute,
  JsonExtractionRoute,
  LinksRoute,
  MarkdownRoute,
  PdfRoute,
  ScrapeRoute,
  ScreenshotRoute,
  SearchRoute,
} from './web.routes';

/* ========================================================================== */
/*  Cloudflare Cache API Implementation                                      */
/* ========================================================================== */

/**
 * Cache TTL configuration (in seconds for Cache API)
 * Using the same values from CACHE_CONFIG but converted to seconds
 */
const CACHE_TTL_SECONDS = {
  SCREENSHOT: 12 * 60 * 60, // 12 hours
  MARKDOWN: 30 * 60, // 30 minutes
  JSON_EXTRACTION: 30 * 60, // 30 minutes
  CONTENT: 30 * 60, // 30 minutes
  SCRAPE: 10 * 60, // 10 minutes
  LINKS: 30 * 60, // 30 minutes
  SEARCH: 10 * 60, // 10 minutes
  PDF: 12 * 60 * 60, // 12 hours
} as const;

/**
 * Credit costs for different web operations
 */
const CREDIT_COSTS = {
  SCREENSHOT: 1,
  MARKDOWN: 1,
  JSON_EXTRACTION: 2, // Higher cost due to AI processing
  CONTENT: 1,
  SCRAPE: 1,
  LINKS: 1,
  SEARCH: 1,
  PDF: 1,
} as const;

type WebOperation = keyof typeof CREDIT_COSTS;

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
 * Handles binary data by converting to base64 for JSON storage
 * Automatically detects base64 preference from cache parameters for binary operations
 * Adds Cache-Tag headers for user-specific purging
 */
async function setCachedResult<T>(
  cacheKey: string,
  operation: WebOperation,
  data: T,
  cacheParams?: Record<string, any>,
): Promise<void> {
  try {
    const ttlSeconds = CACHE_TTL_SECONDS[operation];

    // Handle binary data for screenshot and PDF operations
    let processedData = data;
    if (operation === 'SCREENSHOT' || operation === 'PDF') {
      const wantsBase64 = cacheParams?.base64 === true;
      processedData = convertBinaryToBase64ForCache(data as any, wantsBase64) as T;
    }

    // Create the response to cache
    const cacheData = {
      success: true,
      data: processedData,
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
        'Cache-Tag': `user-${userId},operation-${operation.toLowerCase()},weblinq-v1`, // Add tags for selective purging
        'X-Operation': operation,
        'X-Cached-At': new Date().toISOString(),
        'X-TTL-Seconds': ttlSeconds.toString(),
      },
    });

    // Store in Cloudflare Cache
    const cache = await caches.open('weblinq-cache');
    await cache.put(cacheKey, response);

    console.log(
      `💾 Cached result for ${operation} (TTL: ${ttlSeconds}s, Key: ${cacheKey}, Tags: user-${userId},operation-${operation.toLowerCase()},weblinq-v1)`,
    );
  } catch (error) {
    console.error(`❌ Error caching result for ${operation}:`, error);
    // Don't throw - caching failures shouldn't break operations
  }
}

/**
 * Convert binary data to base64 for JSON storage
 * Only converts if the original request wanted binary (not base64)
 */
function convertBinaryToBase64ForCache(data: any, wantsBase64?: boolean): any {
  if (!data) return data;

  const result = { ...data };

  // Handle screenshot data - only convert if the response was originally binary (not base64)
  if (result.image instanceof Uint8Array) {
    result.image = Buffer.from(result.image).toString('base64');
    result._imageBinary = !wantsBase64; // Flag to indicate this should be converted back to binary
  }

  // Handle PDF data - only convert if the response was originally binary (not base64)
  if (result.pdf instanceof Uint8Array) {
    result.pdf = Buffer.from(result.pdf).toString('base64');
    result._pdfBinary = !wantsBase64; // Flag to indicate this should be converted back to binary
  }

  return result;
}

/**
 * Convert base64 data back to binary for cached results
 */
function convertBase64ToBinaryFromCache(data: any): any {
  if (!data) return data;

  const result = { ...data };

  // Handle screenshot data
  if (result._imageBinary && typeof result.image === 'string') {
    result.image = new Uint8Array(Buffer.from(result.image, 'base64'));
    delete result._imageBinary;
  }

  // Handle PDF data
  if (result._pdfBinary && typeof result.pdf === 'string') {
    result.pdf = new Uint8Array(Buffer.from(result.pdf, 'base64'));
    delete result._pdfBinary;
  }

  return result;
}

/**
 * Get cached result from Cloudflare Cache
 * Handles binary data by converting from base64 back to Uint8Array
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

    let cachedData = (await cachedResponse.json()) as CreditAwareResult<T>;

    // Convert base64 back to binary for screenshot and PDF operations
    if (operation === 'SCREENSHOT' || operation === 'PDF') {
      cachedData = {
        ...cachedData,
        data: convertBase64ToBinaryFromCache(cachedData.data as any) as T,
      };
    }

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

  // 2. Check credits for new operation
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
        await deductCreditsForOperation(c.env, userId, operation, cacheParams);
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
    await deductCreditsForOperation(c.env, userId, operation, cacheParams);

    const updatedBalance = creditCheck.balance - creditCheck.cost;

    // 5. Cache the successful result in background (skip in development mode)
    if (!isDevelopment) {
      try {
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(setCachedResult(cacheKey, operation, result.data, cacheParams));
          console.log(`✅ Background caching initiated for ${operation}`);
        } else {
          // Fallback: cache asynchronously (non-blocking for user)
          setCachedResult(cacheKey, operation, result.data, cacheParams).catch((error) => {
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

/* ========================================================================== */
/*  Helper Functions (Original)                                              */
/* ========================================================================== */

/**
 * Helper to extract common request context for error logging
 */
function extractRequestContext(c: any, body?: any) {
  return {
    userId: c.get('user')?.id,
    url: c.req.url,
    method: c.req.method || 'POST',
    userAgent: c.req.header('User-Agent'),
    ipAddress: c.req.header('CF-Connecting-IP'),
    environment: c.env.NODE_ENV || 'unknown',
    requestBody: body,
  };
}

/**
 * Helper to log operation failures from Durable Object results
 */
async function logOperationFailure(c: any, operation: string, result: any, body?: any, targetUrl?: string) {
  const errorMessage = result.error || `${operation} operation failed`;
  const errorCode = result.error?.includes('Insufficient credits')
    ? 'INSUFFICIENT_CREDITS'
    : `${operation.toUpperCase()}_FAILED`;
  const statusCode = result.error?.includes('Insufficient credits')
    ? HttpStatusCodes.PAYMENT_REQUIRED
    : HttpStatusCodes.INTERNAL_SERVER_ERROR;

  const context = extractRequestContext(c, body);

  await logError(c.env, {
    ...context,
    source: 'web_handler',
    operation,
    level: 'error',
    message: errorMessage,
    statusCode,
    errorCode,
    url: targetUrl || context.url,
    context: {
      requestBody: body,
      durableObjectResult: result,
    },
  });
}

/**
 * Helper to log critical errors from try/catch blocks
 */
async function logCriticalError(c: any, operation: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  const context = extractRequestContext(c);

  await logError(c.env, {
    ...context,
    source: 'web_handler',
    operation,
    level: 'critical',
    message: errorMessage,
    error: error instanceof Error ? error : undefined,
    statusCode: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

/**
 * Helper function to get the WebDurableObject stub for a user
 */
function getWebDurableObject(c: { env: CloudflareBindings }, userId: string): DurableObjectStub<WebDurableObject> {
  const namespace = c.env.WEBLINQ_DURABLE_OBJECT;
  console.log('user id', userId);

  // TEMPORARY: Use random IDs in development to force fresh SQLite-enabled instances
  // This bypasses any migration issues with existing instances
  const isDev = c.env.NODE_ENV !== 'production';

  if (isDev) {
    const randomId = `web:${userId}:temp:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const id = namespace.idFromName(randomId);
    console.log('🧪 DEVELOPMENT: Using random DO ID to guarantee fresh SQLite instance');
    return namespace.get(id);
  } else {
    // Production uses stable versioned IDs
    const id = namespace.idFromName(`web:${userId}:v3`);
    console.log('🏭 PRODUCTION: Using stable versioned DO ID');
    return namespace.get(id);
  }
}

/**
 * Screenshot endpoint – captures a webpage screenshot
 *
 * Binary (`Uint8Array`) is the default.  A base-64 JSON envelope is produced
 * only when the client:
 *   • passes `"base64": true` in the body   – or –
 *   • sends   Accept: application/json
 */
export const screenshot: AppRouteHandler<ScreenshotRoute> = async (c: any) => {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = c.req.valid('json');

    const acceptHdr = c.req.header('Accept') ?? '';
    const wantsBase64 = body.base64 === true || acceptHdr.includes('application/json');
    const wantsBinary = !wantsBase64; // binary is the default

    console.log('🎯 Screenshot', {
      userId: user.id,
      url: body.url,
      wantsBase64,
      acceptHdr,
    });

    /* ------------------------------------------------------------------ */
    /* 1. Execute with cache integration                                   */
    /* ------------------------------------------------------------------ */
    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'SCREENSHOT',
      async () => {
        const webDO = getWebDurableObject(c, user.id);
        await webDO.initializeUser(user.id);
        return await webDO.screenshotV1({ ...body, base64: false });
      },
      {
        url: body.url,
        viewport: body.viewport,
        waitTime: body.waitTime,
        base64: body.base64, // Include base64 preference in cache key
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'screenshot', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      console.error('📤 Screenshot failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    /* ------------------------------------------------------------------ */
    /* 2. Persist to R2 (optional) - only for non-cached results           */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (!result.fromCache && result.data?.image instanceof Uint8Array) {
      try {
        const webDO = getWebDurableObject(c, user.id);
        await webDO.initializeUser(user.id);
        const stored = await webDO.storeFileAndCreatePermanentUrl(
          result.data.image,
          body.url,
          'screenshot',
          result.data.metadata,
          result.data.metadata.format,
        );
        permanentUrl = stored.permanentUrl;
        fileId = stored.fileId;
      } catch (err) {
        console.error('❌ R2 store failed:', err); // non-fatal
      }
    }

    /* ------------------------------------------------------------------ */
    /* 3. Send the response in the format the caller wants                 */
    /* ------------------------------------------------------------------ */

    // 3a.  Binary (default path)
    if (wantsBinary && result.data?.image instanceof Uint8Array) {
      const binaryBody = result.data.image.buffer as ArrayBuffer; // <- Cast via ArrayBuffer
      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': `image/${result.data.metadata.format}`,
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': `inline; filename="screenshot.${result.data.metadata.format}"`,
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-From-Cache': result.fromCache ? 'true' : 'false',
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b.  Base-64 envelope (only when asked for)
    if (wantsBase64 && result.data?.image instanceof Uint8Array) {
      const base64Image = Buffer.from(result.data.image).toString('base64');
      return c.json(
        {
          ...result,
          data: {
            ...result.data,
            image: base64Image,
            permanentUrl,
            fileId,
          },
        },
        HttpStatusCodes.OK,
      );
    }

    /* 3c. Fallback – should never hit this with current logic            */
    console.warn('⚠️ unexpected data type for screenshot response');
    return c.json({ ...result, data: { ...result.data, permanentUrl, fileId } }, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Screenshot error:', error);
    await logCriticalError(c, 'screenshot', error);

    const errResp = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errResp, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errResp.error.requestId!,
    });
  }
};

/**
 * Markdown extraction endpoint
 */
export const markdown: AppRouteHandler<MarkdownRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'MARKDOWN',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.markdownV1(body);
      },
      {
        url: body.url,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'markdown', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Markdown error:', error);
    await logCriticalError(c, 'markdown', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * JSON extraction endpoint - AI-powered extraction using Workers AI
 */
export const jsonExtraction: AppRouteHandler<JsonExtractionRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🤖 AI-powered JSON extraction request:', {
      userId: user.id,
      url: body.url,
      responseType: body.responseType || 'json',
      hasPrompt: !!body.prompt,
      hasResponseFormat: !!body.response_format,
    });

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'JSON_EXTRACTION',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.jsonExtractionV1(body);
      },
      {
        url: body.url,
        responseType: body.responseType,
        prompt: body.prompt?.substring(0, 100), // Truncate for cache key
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'json_extraction', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('JSON extraction error:', error);
    await logCriticalError(c, 'json_extraction', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * Content extraction endpoint
 */
export const content: AppRouteHandler<ContentRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'CONTENT',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.contentV1(body);
      },
      {
        url: body.url,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'content', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Content error:', error);
    await logCriticalError(c, 'content', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * Element scraping endpoint
 */
export const scrape: AppRouteHandler<ScrapeRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'SCRAPE',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.scrapeV1(body);
      },
      {
        url: body.url,
        elements: body.elements?.length || 0,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'scrape', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Scrape error:', error);
    await logCriticalError(c, 'scrape', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * Link extraction endpoint
 */
export const links: AppRouteHandler<LinksRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'LINKS',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.linksV1(body);
      },
      {
        url: body.url,
        includeExternal: body.includeExternal,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'links', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Links error:', error);
    await logCriticalError(c, 'links', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * Web search endpoint
 */
export const search: AppRouteHandler<SearchRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');
    const _clientIp = c.req.header('CF-Connecting-IP') || 'unknown';

    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'SEARCH',
      async () => {
        const webDurableObject = getWebDurableObject(c, user.id);
        await webDurableObject.initializeUser(user.id);
        return await webDurableObject.searchV1(body);
      },
      {
        query: body.query,
        limit: body.limit,
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'search', result, body, `search:${body.query}`);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Search error:', error);
    await logCriticalError(c, 'search', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * PDF generation endpoint
 */
export const pdf: AppRouteHandler<PdfRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const acceptHdr = c.req.header('Accept') ?? '';
    const wantsBase64 = body.base64 === true || acceptHdr.includes('application/json');
    const wantsBinary = !wantsBase64;

    console.log('🚀 PDF request', {
      userId: user.id,
      url: body.url,
      wantsBase64,
      acceptHdr,
    });

    /* ------------------------------------------------------------------ */
    /* 1. Execute with cache integration                                   */
    /* ------------------------------------------------------------------ */
    const result: CreditAwareResult<any> = await executeWithCache(
      c,
      'PDF',
      async () => {
        const webDO = getWebDurableObject(c, user.id);
        await webDO.initializeUser(user.id);
        return await webDO.pdfV1({ ...body, base64: false });
      },
      {
        url: body.url,
        format: body.format,
        waitTime: body.waitTime,
        base64: body.base64, // Include base64 preference in cache key
      },
    );

    if (!result.success) {
      await logOperationFailure(c, 'pdf', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      console.error('📤 PDF generation failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    /* ------------------------------------------------------------------ */
    /* 2. Optional R2 persistence - only for non-cached results           */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (!result.fromCache && result.data?.pdf instanceof Uint8Array) {
      try {
        const webDO = getWebDurableObject(c, user.id);
        await webDO.initializeUser(user.id);
        const stored = await webDO.storeFileAndCreatePermanentUrl(
          result.data.pdf,
          body.url,
          'pdf',
          result.data.metadata,
          'pdf',
        );
        permanentUrl = stored.permanentUrl;
        fileId = stored.fileId;
      } catch (e) {
        console.error('❌ R2 store failed:', e); // non-fatal
      }
    }

    /* ------------------------------------------------------------------ */
    /* 3. Respond in the requested format                                 */
    /* ------------------------------------------------------------------ */

    // 3a. Binary  (default)
    if (wantsBinary && result.data?.pdf instanceof Uint8Array) {
      const binaryBody = result.data.pdf as unknown as BodyInit; // safe cast

      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': 'attachment; filename="page.pdf"',
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-From-Cache': result.fromCache ? 'true' : 'false',
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b. Base-64  (only when asked for)
    if (wantsBase64 && result.data?.pdf instanceof Uint8Array) {
      const base64Pdf = Buffer.from(result.data.pdf).toString('base64');

      return c.json(
        {
          ...result,
          data: {
            ...result.data,
            pdf: base64Pdf,
            permanentUrl,
            fileId,
          },
        },
        HttpStatusCodes.OK,
      );
    }

    /* 3c. Fallback – should never hit */
    return c.json({ ...result, data: { ...result.data, permanentUrl, fileId } }, HttpStatusCodes.OK);
  } catch (error) {
    console.error('PDF error:', error);
    await logCriticalError(c, 'pdf', error);

    const errResp = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errResp, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errResp.error.requestId!,
    });
  }
};
