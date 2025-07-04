import { Buffer } from 'node:buffer';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/user-do';
import type { AppRouteHandler } from '@/lib/types';

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

    const result = await webDO.screenshotV1({ ...body, base64: false });

    if (!result.success) {
      console.error('📤 Screenshot failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    /* ------------------------------------------------------------------ */
    /* 2. Persist to R2 (optional)                                         */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.image instanceof Uint8Array) {
      try {
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
    if (wantsBinary && result.data.image instanceof Uint8Array) {
      const binaryBody = result.data.image.buffer as ArrayBuffer; // <- Cast via ArrayBuffer
      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': `image/${result.data.metadata.format}`,
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': `inline; filename="screenshot.${result.data.metadata.format}"`,
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b.  Base-64 envelope (only when asked for)
    if (wantsBase64 && result.data.image instanceof Uint8Array) {
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

    // const result = await webDurableObject.extractMarkdown(body);
    const result = await webDurableObject.markdownV1(body);

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Markdown error:', error);
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
    const result = await webDurableObject.jsonExtractionV1(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('JSON extraction error:', error);
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

    const result = await webDurableObject.contentV1(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Content error:', error);
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

    // const result = await webDurableObject.scrapeElements(body);
    const result = await webDurableObject.scrapeV1(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Scrape error:', error);
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

    const result = await webDurableObject.linksV1(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Links error:', error);
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

    // const result = await webDurableObject.search(body, clientIp);
    const result = await webDurableObject.searchV1(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Search error:', error);
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

    const result = await webDO.pdfV1({ ...body, base64: false });

    if (!result.success) {
      console.error('📤 PDF generation failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    /* ------------------------------------------------------------------ */
    /* 2. Optional R2 persistence                                         */
    /* ------------------------------------------------------------------ */
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.pdf instanceof Uint8Array) {
      try {
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
    if (wantsBinary && result.data.pdf instanceof Uint8Array) {
      const binaryBody = result.data.pdf as unknown as BodyInit; // safe cast

      return new Response(binaryBody, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': 'attachment; filename="page.pdf"',
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl ?? '',
          'X-File-Id': fileId ?? '',
        },
      });
    }

    // 3b. Base-64  (only when asked for)
    if (wantsBase64 && result.data.pdf instanceof Uint8Array) {
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
    const errResp = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errResp, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errResp.error.requestId!,
    });
  }
};
