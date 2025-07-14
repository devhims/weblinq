import { Buffer } from 'node:buffer';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/user-do';
import type { AppRouteHandler } from '@/lib/types';

import { logError } from '@/db/queries';
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
    /* 1. get binary from the Durable Object (always)                      */
    /* ------------------------------------------------------------------ */
    const webDO = getWebDurableObject(c, user.id);
    await webDO.initializeUser(user.id);

    const result: any = await webDO.screenshotV1({ ...body, base64: false });

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
    /* 2. Persist to R2 (optional)                                         */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.data.image instanceof Uint8Array) {
      try {
        const stored = await webDO.storeFileAndCreatePermanentUrl(
          result.data.data.image,
          body.url,
          'screenshot',
          result.data.data.metadata,
          result.data.data.metadata.format,
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
    if (wantsBinary && result.data.data.image instanceof Uint8Array) {
      const binaryBody = result.data.data.image.buffer as ArrayBuffer; // <- Cast via ArrayBuffer
      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': `image/${result.data.data.metadata.format}`,
          'Content-Length': result.data.data.metadata.size.toString(),
          'Content-Disposition': `inline; filename="screenshot.${result.data.data.metadata.format}"`,
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Metadata': JSON.stringify(result.data.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b.  Base-64 envelope (only when asked for)
    if (wantsBase64 && result.data.data.image instanceof Uint8Array) {
      const base64Image = Buffer.from(result.data.data.image).toString('base64');
      return c.json(
        {
          ...result,
          data: {
            ...result.data.data,
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
    return c.json({ ...result, data: { ...result.data.data, permanentUrl, fileId } }, HttpStatusCodes.OK);
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result: any = await webDurableObject.markdownV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    // Use the new AI-powered v1 implementation
    const result: any = await webDurableObject.jsonExtractionV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result: any = await webDurableObject.contentV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result: any = await webDurableObject.scrapeV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result: any = await webDurableObject.linksV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result: any = await webDurableObject.searchV1(body);

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

    return c.json(result.data, HttpStatusCodes.OK, {
      'X-Credits-Cost': result.creditsCost.toString(),
      'X-Credits-Remaining': result.creditsRemaining.toString(),
    });
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
    /* 1. Fetch binary from Durable Object                                */
    /* ------------------------------------------------------------------ */
    const webDO = getWebDurableObject(c, user.id);
    await webDO.initializeUser(user.id);

    const result: any = await webDO.pdfV1({ ...body, base64: false });

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
    /* 2. Optional R2 persistence                                         */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.data.pdf instanceof Uint8Array) {
      try {
        const stored = await webDO.storeFileAndCreatePermanentUrl(
          result.data.data.pdf,
          body.url,
          'pdf',
          result.data.data.metadata,
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
    if (wantsBinary && result.data.data.pdf instanceof Uint8Array) {
      const binaryBody = result.data.data.pdf as unknown as BodyInit; // safe cast

      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': result.data.data.metadata.size.toString(),
          'Content-Disposition': 'attachment; filename="page.pdf"',
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Credits-Remaining': result.creditsRemaining.toString(),
          'X-Metadata': JSON.stringify(result.data.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b. Base-64  (only when asked for)
    if (wantsBase64 && result.data.data.pdf instanceof Uint8Array) {
      const base64Pdf = Buffer.from(result.data.data.pdf).toString('base64');

      return c.json(
        {
          ...result,
          data: {
            ...result.data.data,
            pdf: base64Pdf,
            permanentUrl,
            fileId,
          },
        },
        HttpStatusCodes.OK,
      );
    }

    /* 3c. Fallback – should never hit */
    return c.json({ ...result, data: { ...result.data.data, permanentUrl, fileId } }, HttpStatusCodes.OK);
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
