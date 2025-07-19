import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import { deductCredits, getUserCredits, logError } from '@/db/queries';
import { createStandardErrorResponse, ERROR_CODES } from '@/lib/response-utils';
import { jsonExtractionV2 as jsonExtractionV2Function } from '@/lib/v2/json-extraction-v2';

import type {
  ContentV2Route,
  JsonExtractionV2Route,
  LinksV2Route,
  MarkdownV2Route,
  PdfV2Route,
  ScrapeV2Route,
  ScreenshotV2Route,
  SearchV2Route,
} from './web-v2.routes';

/* ========================================================================== */
/*  V2 Cloudflare Cache API Implementation                                   */
/* ========================================================================== */

/**
 * Cache TTL configuration (in seconds for Cache API)
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

type V2Operation = keyof typeof CREDIT_COSTS;

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
 * Generate a cache key for V2 operations
 */
function generateV2CacheKey(operation: V2Operation, userId: string, params: Record<string, any>): string {
  const normalizedParams = { ...params };
  delete normalizedParams.userId;

  const sortedParams = Object.keys(normalizedParams)
    .sort()
    .reduce((obj, key) => {
      obj[key] = normalizedParams[key];
      return obj;
    }, {} as Record<string, any>);

  const paramString = JSON.stringify(sortedParams);
  const paramHash = createHash('sha256').update(paramString).digest('hex').substring(0, 16);

  return `https://cache.weblinq.internal/v2/${operation.toLowerCase()}/${userId}/${paramHash}`;
}

/**
 * Store V2 result in Cloudflare Cache with custom TTL
 */
async function setCachedV2Result<T>(
  cacheKey: string,
  operation: V2Operation,
  data: T,
  cacheParams?: Record<string, any>,
): Promise<void> {
  try {
    const ttlSeconds = CACHE_TTL_SECONDS[operation];

    let processedData = data;
    if (operation === 'SCREENSHOT' || operation === 'PDF') {
      const wantsBase64 = cacheParams?.base64 === true;
      processedData = convertBinaryToBase64ForCache(data as any, wantsBase64) as T;
    }

    const cacheData = {
      success: true,
      data: processedData,
      fromCache: true,
      cachedAt: Date.now(),
    };

    const response = new Response(JSON.stringify(cacheData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${ttlSeconds}`,
        'X-Operation': `v2-${operation}`,
        'X-Cached-At': new Date().toISOString(),
        'X-TTL-Seconds': ttlSeconds.toString(),
      },
    });

    const cache = await caches.open('weblinq-v2-cache');
    await cache.put(cacheKey, response);

    console.log(`💾 V2 Cached result for ${operation} (TTL: ${ttlSeconds}s, Key: ${cacheKey})`);
  } catch (error) {
    console.error(`❌ V2 Error caching result for ${operation}:`, error);
  }
}

/**
 * Convert binary data to base64 for JSON storage
 * Only converts if the original request wanted binary (not base64)
 */
function convertBinaryToBase64ForCache(data: any, wantsBase64?: boolean): any {
  if (!data || !data.data) return data;

  const result = { ...data };

  // Handle screenshot data - only convert if the response was originally binary (not base64)
  if (result.data.image instanceof Uint8Array) {
    result.data = {
      ...result.data,
      image: Buffer.from(result.data.image).toString('base64'),
      _imageBinary: !wantsBase64, // Flag to indicate this should be converted back to binary
    };
  }

  // Handle ArrayBuffer images (from V2 screenshot operation)
  if (result.data.image instanceof ArrayBuffer) {
    result.data = {
      ...result.data,
      image: Buffer.from(result.data.image).toString('base64'),
      _imageBinary: !wantsBase64, // Flag to indicate this should be converted back to binary
    };
  }

  // Handle PDF data - only convert if the response was originally binary (not base64)
  if (result.data.pdf instanceof Uint8Array) {
    result.data = {
      ...result.data,
      pdf: Buffer.from(result.data.pdf).toString('base64'),
      _pdfBinary: !wantsBase64, // Flag to indicate this should be converted back to binary
    };
  }

  return result;
}

/**
 * Convert base64 data back to binary for cached results
 */
function convertBase64ToBinaryFromCache(data: any): any {
  if (!data || !data.data) return data;

  const result = { ...data };

  // Handle screenshot data
  if (result.data._imageBinary && typeof result.data.image === 'string') {
    // Convert back to Uint8Array for V2 screenshot operations (will be converted to appropriate format in handler)
    result.data = {
      ...result.data,
      image: new Uint8Array(Buffer.from(result.data.image, 'base64')),
    };
    delete result.data._imageBinary;
  }

  // Handle PDF data
  if (result.data._pdfBinary && typeof result.data.pdf === 'string') {
    result.data = {
      ...result.data,
      pdf: new Uint8Array(Buffer.from(result.data.pdf, 'base64')),
    };
    delete result.data._pdfBinary;
  }

  return result;
}

/**
 * Get cached V2 result from Cloudflare Cache
 */
async function getCachedV2Result<T>(cacheKey: string, operation: V2Operation): Promise<CreditAwareResult<T> | null> {
  try {
    const cache = await caches.open('weblinq-v2-cache');
    const cachedResponse = await cache.match(cacheKey);

    if (!cachedResponse) {
      console.log(`❌ V2 Cache miss for ${operation} (Key: ${cacheKey})`);
      return null;
    }

    const cachedAt = cachedResponse.headers.get('X-Cached-At');
    if (cachedAt) {
      const cacheTime = new Date(cachedAt).getTime();
      const ttlSeconds = CACHE_TTL_SECONDS[operation];
      const expiryTime = cacheTime + ttlSeconds * 1000;

      if (Date.now() > expiryTime) {
        console.log(`🗑️ V2 Cache entry expired for ${operation}, removing`);
        await cache.delete(cacheKey);
        return null;
      }
    }

    let cachedData = (await cachedResponse.json()) as CreditAwareResult<T>;

    if (operation === 'SCREENSHOT' || operation === 'PDF') {
      cachedData = {
        ...cachedData,
        data: convertBase64ToBinaryFromCache(cachedData.data as any) as T,
      };
    }

    console.log(`✅ V2 Cache hit for ${operation} (Key: ${cacheKey})`);
    return cachedData;
  } catch (error) {
    console.error(`❌ V2 Error retrieving cache for ${operation}:`, error);
    return null;
  }
}

/**
 * Check if user has sufficient credits for a V2 operation
 */
async function checkV2Credits(
  env: CloudflareBindings,
  userId: string,
  operation: V2Operation,
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
    console.error(`❌ V2 Failed to check credits for user ${userId}:`, error);
    throw new Error('Failed to check credit balance');
  }
}

/**
 * Deduct credits for a V2 operation
 */
async function deductV2Credits(
  env: CloudflareBindings,
  userId: string,
  operation: V2Operation,
  metadata?: Record<string, any>,
): Promise<void> {
  const cost = CREDIT_COSTS[operation];

  try {
    await deductCredits(env, userId, cost, `${operation.toLowerCase()}V2`, {
      operation,
      version: 'v2',
      engine: 'playwright',
      cost,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    console.log(`✅ V2 Deducted ${cost} credits for ${operation} operation (user: ${userId})`);
  } catch (error) {
    console.error(`❌ V2 Failed to deduct credits for ${operation} operation (user: ${userId}):`, error);
    throw error;
  }
}

/**
 * Execute a V2 web operation with Cloudflare Cache API integration and credit management
 */
async function executeV2WithCache<T>(
  c: any,
  operation: V2Operation,
  operationFn: () => Promise<any>,
  cacheParams: Record<string, any>,
): Promise<CreditAwareResult<T>> {
  const user = c.get('user')!;
  const userId = user.id;

  // Check if we're in development mode to disable caching
  const isDevelopment = c.env.NODE_ENV === 'preview' || c.env.NODE_ENV === 'preview';

  // Check credits first
  const creditCheck = await checkV2Credits(c.env, userId, operation);

  if (!creditCheck.hasCredits) {
    return {
      success: false,
      error: `Insufficient credits. Required: ${creditCheck.cost}, Available: ${creditCheck.balance}`,
      creditsCost: creditCheck.cost,
      creditsRemaining: creditCheck.balance,
      fromCache: false,
    };
  }

  // Generate cache key for both checking and storing
  const cacheKey = generateV2CacheKey(operation, userId, cacheParams);

  // Skip cache in development mode for easier testing
  if (!isDevelopment) {
    const cachedResult = await getCachedV2Result<T>(cacheKey, operation);

    if (cachedResult) {
      try {
        await deductV2Credits(c.env, userId, operation, cacheParams);
        const updatedBalance = creditCheck.balance - creditCheck.cost;

        return {
          ...cachedResult,
          creditsCost: creditCheck.cost,
          creditsRemaining: updatedBalance,
        };
      } catch (error) {
        console.warn('⚠️ V2 Failed to deduct credits for cache hit:', error);
        return {
          ...cachedResult,
          creditsCost: creditCheck.cost,
          creditsRemaining: creditCheck.balance,
        };
      }
    }
  } else {
    console.log(`🧪 V2 Development mode: Skipping cache for ${operation} operation`);
  }

  try {
    console.log(`🚀 V2 Executing ${operation} operation (${isDevelopment ? 'development mode' : 'cache miss'})`);

    const result = await operationFn();

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        creditsCost: creditCheck.cost,
        creditsRemaining: creditCheck.balance,
        fromCache: false,
      };
    }

    await deductV2Credits(c.env, userId, operation, cacheParams);
    const updatedBalance = creditCheck.balance - creditCheck.cost;

    // Cache the successful result in background (skip in development mode)
    if (!isDevelopment) {
      try {
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(setCachedV2Result(cacheKey, operation, result.data, cacheParams));
          console.log(`✅ V2 Background caching initiated for ${operation}`);
        } else {
          setCachedV2Result(cacheKey, operation, result.data, cacheParams).catch((error) => {
            console.error(`❌ V2 Background cache operation failed for ${operation}:`, error);
          });
        }
      } catch (cacheError) {
        console.error(`❌ V2 Failed to initiate background caching for ${operation}:`, cacheError);
      }
    } else {
      console.log(`🧪 V2 Development mode: Skipping cache storage for ${operation}`);
    }

    return {
      success: true,
      data: result.data,
      creditsCost: creditCheck.cost,
      creditsRemaining: updatedBalance,
      fromCache: false,
    };
  } catch (error) {
    console.error(`❌ V2 Operation ${operation} failed:`, error);
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
/*  Helper Functions                                                          */
/* ========================================================================== */

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

async function logV2OperationFailure(c: any, operation: string, result: any, body?: any, targetUrl?: string) {
  const errorMessage = result.error || `V2 ${operation} operation failed`;
  const errorCode = result.error?.includes('Insufficient credits')
    ? 'INSUFFICIENT_CREDITS'
    : `${operation.toUpperCase()}_V2_FAILED`;
  const statusCode = result.error?.includes('Insufficient credits')
    ? HttpStatusCodes.PAYMENT_REQUIRED
    : HttpStatusCodes.INTERNAL_SERVER_ERROR;

  const context = extractRequestContext(c, body);

  await logError(c.env, {
    ...context,
    source: 'web_v2_handler',
    operation,
    level: 'error',
    message: errorMessage,
    statusCode,
    errorCode,
    url: targetUrl || context.url,
    context: {
      requestBody: body,
      playwrightPoolResult: result,
      version: 'v2',
      engine: 'playwright',
    },
  });
}

async function logV2CriticalError(c: any, operation: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  const context = extractRequestContext(c);

  await logError(c.env, {
    ...context,
    source: 'web_v2_handler',
    operation,
    level: 'critical',
    message: errorMessage,
    error: error instanceof Error ? error : undefined,
    statusCode: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    context: {
      version: 'v2',
      engine: 'playwright',
    },
  });
}

/**
 * Get PlaywrightPoolDO instance for a user
 */
function getPlaywrightPoolDO(c: any, userId: string) {
  const playwrightPoolId = c.env.PLAYWRIGHT_POOL_DO.idFromName(`playwright-pool-${userId}`);
  return c.env.PLAYWRIGHT_POOL_DO.get(playwrightPoolId);
}

/* ========================================================================== */
/*  V2 Handlers - Using PlaywrightPoolDO with Caching                        */
/* ========================================================================== */

/**
 * V2 Markdown extraction endpoint using PlaywrightPoolDO with caching
 */
export const markdownV2: AppRouteHandler<MarkdownV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('📄 V2 Markdown extraction request', {
      userId: user.id,
      url: body.url,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'MARKDOWN',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.extractMarkdown({
          url: body.url,
          waitTime: body.waitTime || 0,
        });
      },
      {
        url: body.url,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'markdownV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 Markdown extraction successful', {
      userId: user.id,
      url: body.url,
      wordCount: result.data.metadata.wordCount,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
      fromCache: result.fromCache,
    });

    // Match V1 response structure with creditsCost in body
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 Markdown error:', error);
    await logV2CriticalError(c, 'markdownV2', error);

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
 * V2 Screenshot endpoint using PlaywrightPoolDO with caching
 */
export const screenshotV2: AppRouteHandler<ScreenshotV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const acceptHdr = c.req.header('Accept') ?? '';
    const wantsBase64 = body.base64 === true || acceptHdr.includes('application/json');
    const wantsBinary = !wantsBase64;

    console.log('📸 V2 Screenshot request', {
      userId: user.id,
      url: body.url,
      wantsBase64,
      viewport: body.viewport,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'SCREENSHOT',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.takeScreenshot({
          url: body.url,
          viewport: body.viewport,
          waitTime: body.waitTime || 0,
          base64: false, // Always get binary from DO, convert as needed
        });
      },
      {
        url: body.url,
        viewport: body.viewport,
        waitTime: body.waitTime,
        base64: body.base64,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'screenshotV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const imageData = result.data.image;

    // Handle different image data types (fresh result vs cached result)
    let imageBuffer: Uint8Array;
    if (imageData instanceof ArrayBuffer) {
      imageBuffer = new Uint8Array(imageData);
    } else if (imageData instanceof Uint8Array) {
      imageBuffer = imageData;
    } else if (typeof imageData === 'string') {
      // This is a base64 string from cache that should be converted back to binary
      imageBuffer = new Uint8Array(Buffer.from(imageData, 'base64'));
    } else {
      console.error('❌ V2 Screenshot: Unexpected image data type:', typeof imageData);
      imageBuffer = new Uint8Array();
    }

    // Binary response (default) - matches V1 structure
    if (wantsBinary) {
      console.log('✅ V2 Screenshot successful (binary)', {
        userId: user.id,
        url: body.url,
        size: imageBuffer.length,
        creditsCost: result.creditsCost,
        creditsRemaining: result.creditsRemaining,
        fromCache: result.fromCache,
      });

      return new Response(imageBuffer.buffer as ArrayBuffer, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': `image/${result.data.metadata?.format || 'png'}`,
          'Content-Length': imageBuffer.length.toString(),
          'Content-Disposition': `inline; filename="screenshot.${result.data.metadata?.format || 'png'}"`,
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Engine': 'playwright-v2',
          'X-From-Cache': result.fromCache ? 'true' : 'false',
          'X-Metadata': JSON.stringify(result.data.metadata || {}),
        },
      });
    }

    // Base64 JSON response - matches V1 structure
    if (wantsBase64) {
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      console.log('✅ V2 Screenshot successful (base64)', {
        userId: user.id,
        url: body.url,
        size: imageBuffer.length,
        creditsCost: result.creditsCost,
        creditsRemaining: result.creditsRemaining,
        fromCache: result.fromCache,
      });

      return c.json(
        {
          success: true,
          data: {
            image: base64Image,
            metadata: result.data.metadata || {},
          },
          creditsCost: result.creditsCost,
        },
        HttpStatusCodes.OK,
        {
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Engine': 'playwright-v2',
          'X-From-Cache': result.fromCache ? 'true' : 'false',
        },
      );
    }

    console.warn('⚠️ V2 Screenshot: unexpected response format logic');
    return c.json({ success: false, error: 'Unexpected response format' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  } catch (error) {
    console.error('💥 V2 Screenshot error:', error);
    await logV2CriticalError(c, 'screenshotV2', error);

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
 * V2 Links extraction endpoint using PlaywrightPoolDO with caching
 */
export const linksV2: AppRouteHandler<LinksV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🔗 V2 Links extraction request', {
      userId: user.id,
      url: body.url,
      includeExternal: body.includeExternal,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'LINKS',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.extractLinks({
          url: body.url,
          includeExternal: body.includeExternal,
          waitTime: body.waitTime || 0,
        });
      },
      {
        url: body.url,
        includeExternal: body.includeExternal,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'linksV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 Links extraction successful', {
      userId: user.id,
      url: body.url,
      totalLinks: result.data.metadata.totalLinks,
      internalLinks: result.data.metadata.internalLinks,
      externalLinks: result.data.metadata.externalLinks,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
      fromCache: result.fromCache,
    });

    // Links V2 - Match V1 response structure
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 Links error:', error);
    await logV2CriticalError(c, 'linksV2', error);

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
 * V2 Content extraction endpoint using PlaywrightPoolDO with caching
 */
export const contentV2: AppRouteHandler<ContentV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('📄 V2 Content extraction request', {
      userId: user.id,
      url: body.url,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'CONTENT',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.extractContent({
          url: body.url,
          waitTime: body.waitTime || 0,
        });
      },
      {
        url: body.url,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'contentV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 Content extraction successful', {
      userId: user.id,
      url: body.url,
      contentSize: result.data.content.length,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
      fromCache: result.fromCache,
    });

    // Content V2 - Match V1 response structure
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 Content error:', error);
    await logV2CriticalError(c, 'contentV2', error);

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
 * V2 JSON extraction endpoint using PlaywrightPoolDO
 */
export const jsonExtractionV2: AppRouteHandler<JsonExtractionV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🤖 V2 JSON extraction request', {
      userId: user.id,
      url: body.url,
      responseType: body.responseType || 'json',
      hasPrompt: !!body.prompt,
      hasSchema: !!body.response_format,
      waitTime: body.waitTime,
    });

    /* ------------------------------------------------------------------ */
    /* 1. Execute operation with caching                                  */
    /* ------------------------------------------------------------------ */
    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'JSON_EXTRACTION',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await jsonExtractionV2Function(playwrightPoolDO, c.env, {
          url: body.url,
          waitTime: body.waitTime,
          responseType: body.responseType,
          prompt: body.prompt,
          response_format: body.response_format,
          instructions: body.instructions,
        });
      },
      {
        url: body.url,
        responseType: body.responseType,
        prompt: body.prompt?.substring(0, 100), // Truncate for cache key
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'jsonExtractionV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 JSON extraction successful', {
      userId: user.id,
      url: body.url,
      responseType: body.responseType || 'json',
      fieldsExtracted: result.data.metadata?.fieldsExtracted,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
    });

    // JSON Extraction V2 - Match V1 response structure
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 JSON extraction error:', error);
    await logV2CriticalError(c, 'jsonExtractionV2', error);

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
 * V2 PDF generation endpoint using PlaywrightPoolDO with caching
 */
export const pdfV2: AppRouteHandler<PdfV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const acceptHdr = c.req.header('Accept') ?? '';
    const wantsBase64 = body.base64 === true || acceptHdr.includes('application/json');
    const wantsBinary = !wantsBase64;

    console.log('📄 V2 PDF generation request', {
      userId: user.id,
      url: body.url,
      wantsBase64,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'PDF',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.generatePdf({
          url: body.url,
          waitTime: body.waitTime || 0,
          base64: false, // Always get binary from DO, convert as needed
        });
      },
      {
        url: body.url,
        waitTime: body.waitTime,
        base64: body.base64,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'pdfV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const pdfData = result.data.pdf;

    // Handle different PDF data types (fresh result vs cached result)
    let pdfBuffer: Uint8Array;
    if (pdfData instanceof Uint8Array) {
      pdfBuffer = pdfData;
    } else if (typeof pdfData === 'string') {
      // This is a base64 string from cache that should be converted back to binary
      pdfBuffer = new Uint8Array(Buffer.from(pdfData, 'base64'));
    } else {
      console.error('❌ V2 PDF: Unexpected PDF data type:', typeof pdfData);
      return c.json(
        createStandardErrorResponse('Invalid PDF data format', ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    // Binary response (default) - matches V1 structure
    if (wantsBinary) {
      console.log('✅ V2 PDF generation successful (binary)', {
        userId: user.id,
        url: body.url,
        pdfSize: result.data.metadata?.size || pdfBuffer.length,
        creditsCost: result.creditsCost,
        creditsRemaining: result.creditsRemaining,
        fromCache: result.fromCache,
      });

      const binaryBody = pdfBuffer as unknown as BodyInit;

      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': (result.data.metadata?.size || pdfBuffer.length).toString(),
          'Content-Disposition': 'attachment; filename="page.pdf"',
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Engine': 'playwright-v2',
          'X-From-Cache': result.fromCache ? 'true' : 'false',
          'X-Metadata': JSON.stringify(result.data.metadata || {}),
        },
      });
    }

    // Base64 JSON response (only when asked for) - matches V1 structure
    if (wantsBase64) {
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

      console.log('✅ V2 PDF generation successful (base64)', {
        userId: user.id,
        url: body.url,
        pdfSize: result.data.metadata?.size || pdfBuffer.length,
        creditsCost: result.creditsCost,
        creditsRemaining: result.creditsRemaining,
        fromCache: result.fromCache,
      });

      return c.json(
        {
          success: true,
          data: {
            pdf: base64Pdf,
            metadata: result.data.metadata || {},
          },
          creditsCost: result.creditsCost,
        },
        HttpStatusCodes.OK,
        {
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Engine': 'playwright-v2',
          'X-From-Cache': result.fromCache ? 'true' : 'false',
        },
      );
    }

    // Fallback - matches V1 structure
    console.warn('⚠️ V2 PDF: unexpected response format logic');
    return c.json(
      {
        success: true,
        data: {
          ...result.data,
          metadata: result.data.metadata || {},
        },
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 PDF error:', error);
    await logV2CriticalError(c, 'pdfV2', error);

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
 * V2 Scrape endpoint using PlaywrightPoolDO with caching
 */
export const scrapeV2: AppRouteHandler<ScrapeV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🔍 V2 Scrape request', {
      userId: user.id,
      url: body.url,
      elementCount: body.elements.length,
      waitTime: body.waitTime,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'SCRAPE',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.scrapeElements({
          url: body.url,
          elements: body.elements,
          waitTime: body.waitTime || 0,
          headers: body.headers,
        });
      },
      {
        url: body.url,
        elements: body.elements?.length || 0,
        waitTime: body.waitTime,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'scrapeV2', result, body);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 Scrape successful', {
      userId: user.id,
      url: body.url,
      elementsFound: result.data.metadata.elementsFound,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
      fromCache: result.fromCache,
    });

    // Scrape V2 - Match V1 response structure
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 Scrape error:', error);
    await logV2CriticalError(c, 'scrapeV2', error);

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
 * V2 Search endpoint using PlaywrightPoolDO with caching
 */
export const searchV2: AppRouteHandler<SearchV2Route> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');
    const _clientIp = c.req.header('CF-Connecting-IP') || 'unknown';

    console.log('🔍 V2 Search request', {
      userId: user.id,
      query: body.query,
      limit: body.limit,
    });

    const result: CreditAwareResult<any> = await executeV2WithCache(
      c,
      'SEARCH',
      async () => {
        const playwrightPoolDO = getPlaywrightPoolDO(c, user.id);
        return await playwrightPoolDO.searchWeb({
          query: body.query,
          limit: body.limit || 10,
        });
      },
      {
        query: body.query,
        limit: body.limit,
      },
    );

    if (!result.success) {
      await logV2OperationFailure(c, 'searchV2', result, body, `search:${body.query}`);

      if (result.error?.includes('Insufficient credits')) {
        return c.json(
          createStandardErrorResponse(result.error, 'INSUFFICIENT_CREDITS'),
          HttpStatusCodes.PAYMENT_REQUIRED,
        );
      }
      return c.json(
        createStandardErrorResponse(result.error!, ERROR_CODES.INTERNAL_SERVER_ERROR),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    console.log('✅ V2 Search successful', {
      userId: user.id,
      query: body.query,
      resultsFound: result.data.metadata.totalResults,
      creditsCost: result.creditsCost,
      creditsRemaining: result.creditsRemaining,
      fromCache: result.fromCache,
    });

    // Search V2 - Match V1 response structure
    return c.json(
      {
        success: true,
        data: result.data,
        creditsCost: result.creditsCost,
      },
      HttpStatusCodes.OK,
      {
        'X-Credits-Cost': result.creditsCost.toString(),
        'X-Credits-Remaining': result.creditsRemaining.toString(),
        'X-Engine': 'playwright-v2',
        'X-From-Cache': result.fromCache ? 'true' : 'false',
      },
    );
  } catch (error) {
    console.error('💥 V2 Search error:', error);
    await logV2CriticalError(c, 'searchV2', error);

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};
