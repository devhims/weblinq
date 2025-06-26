import { Buffer } from 'node:buffer';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/web-durable-object';
import type { AppRouteHandler } from '@/lib/types';

// Route types – generated alongside schemas in web.routes.ts
import type {
  ContentRoute,
  DebugDeleteRoute,
  DebugFilesRoute,
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
 * Screenshot endpoint - Capture webpage screenshots
 */
export const screenshot: AppRouteHandler<ScreenshotRoute> = async (c: any) => {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = c.req.valid('json');

    console.log('🎯 Screenshot request started:', { userId: user.id, url: body.url });

    // Check if client prefers binary response via Accept header or explicit parameter
    const acceptHeader = c.req.header('Accept');
    const prefersBinary = acceptHeader?.includes('image/') || body.base64 === false;

    console.log('📋 Request details:', { prefersBinary, acceptHeader, bodyBase64: body.base64 });

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    console.log('🚀 Calling Durable Object screenshotV2 method...');

    // Always request binary data from screenshotV2 for R2 storage
    const screenshotParams = {
      ...body,
      base64: false, // Always get binary for R2 storage
    };
    const result = await webDurableObject.screenshotV2(screenshotParams);

    if (!result.success) {
      console.error('📤 Screenshot failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    console.log('📊 Screenshot result:', {
      success: result.success,
      imageType: typeof result.data.image,
      imageSize: result.data.image instanceof Uint8Array ? result.data.image.length : result.data.image.length,
      format: result.data.metadata.format,
    });

    // Try to store in R2 and create permanent URL (if SQLite is available)
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.image instanceof Uint8Array) {
      try {
        console.log('🗄️ Attempting to store screenshot in R2...');
        const storageResult = await webDurableObject.storeFileAndCreatePermanentUrl(
          result.data.image,
          body.url,
          'screenshot',
          result.data.metadata,
          result.data.metadata.format,
        );
        permanentUrl = storageResult.permanentUrl;
        fileId = storageResult.fileId;
        console.log('✅ Screenshot stored in R2:', { fileId, permanentUrl });
      } catch (storageError) {
        console.error('❌ Failed to store screenshot in R2:', storageError);
        // Continue without permanent URL - don't fail the entire operation
      }
    }

    // Handle binary response for optimal performance
    if (prefersBinary && result.data.image instanceof Uint8Array) {
      // Return binary data directly
      return new Response(result.data.image as any, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': `image/${result.data.metadata.format}`,
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': `inline; filename="screenshot.${result.data.metadata.format}"`,
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl || '',
          'X-File-Id': fileId || '',
        },
      });
    }

    // For JSON response, ensure we have base64 data
    if (result.data.image instanceof Uint8Array) {
      // Convert to base64 for JSON response
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

    // JSON response (already base64) - shouldn't happen with our current logic
    console.log('📤 Returning JSON response');
    return c.json(
      {
        ...result,
        data: {
          ...result.data,
          permanentUrl,
          fileId,
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Screenshot error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
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
    const result = await webDurableObject.markdownV2(body);

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Markdown error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * JSON extraction endpoint
 */
export const jsonExtraction: AppRouteHandler<JsonExtractionRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.extractJson(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('JSON extraction error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
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

    const result = await webDurableObject.contentV2(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Content error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
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
    const result = await webDurableObject.scrapeV2(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Scrape error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
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

    const result = await webDurableObject.linksV2(body);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Links error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * Web search endpoint
 */
export const search: AppRouteHandler<SearchRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');
    const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.search(body, clientIp);
    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Search error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * PDF generation endpoint
 */
export const pdf: AppRouteHandler<PdfRoute> = async (c: any) => {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = c.req.valid('json');

    // Check if client prefers binary response via Accept header or explicit parameter
    const acceptHeader = c.req.header('Accept');
    const prefersBinary = acceptHeader?.includes('application/pdf') || body.base64 === false;

    console.log('🚀 Calling Durable Object pdfV2 method...');

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    // Always request binary data from pdfV2 for R2 storage
    const pdfParams = {
      ...body,
      base64: false, // Always get binary for R2 storage
    };
    const result = await webDurableObject.pdfV2(pdfParams);

    if (!result.success) {
      console.error('📤 PDF generation failed:', result.error);
      return c.json(result, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    console.log('📊 PDF result:', {
      success: result.success,
      pdfType: typeof result.data.pdf,
      pdfSize: result.data.pdf instanceof Uint8Array ? result.data.pdf.length : result.data.pdf.length,
      metadata: result.data.metadata,
    });

    // Try to store in R2 and create permanent URL (if SQLite is available)
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (result.data.pdf instanceof Uint8Array) {
      try {
        console.log('🗄️ Attempting to store PDF in R2...');
        const storageResult = await webDurableObject.storeFileAndCreatePermanentUrl(
          result.data.pdf,
          body.url,
          'pdf',
          result.data.metadata,
          'pdf',
        );
        permanentUrl = storageResult.permanentUrl;
        fileId = storageResult.fileId;
        console.log('✅ PDF stored in R2:', { fileId, permanentUrl });
      } catch (storageError) {
        console.error('❌ Failed to store PDF in R2:', storageError);
        // Continue without permanent URL - don't fail the entire operation
      }
    }

    // Handle binary response for optimal performance
    if (prefersBinary && result.data.pdf instanceof Uint8Array) {
      // Return binary data directly
      return new Response(result.data.pdf as any, {
        status: HttpStatusCodes.OK,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': result.data.metadata.size.toString(),
          'Content-Disposition': 'attachment; filename="page.pdf"',
          'X-Credits-Cost': result.creditsCost.toString(),
          'X-Metadata': JSON.stringify(result.data.metadata),
          'X-Permanent-Url': permanentUrl || '',
          'X-File-Id': fileId || '',
        },
      });
    }

    // For JSON response, ensure we have base64 data
    if (result.data.pdf instanceof Uint8Array) {
      // Convert to base64 for JSON response
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

    // JSON response (already base64) - shouldn't happen with our current logic
    console.log('📤 Returning JSON response');
    return c.json(
      {
        ...result,
        data: {
          ...result.data,
          permanentUrl,
          fileId,
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('PDF error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * Debug endpoint to list SQLite files and check status
 */
export const debugFiles: AppRouteHandler<DebugFilesRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🔍 Debug files request:', { userId: user.id, params: body });

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.debugListFiles(body);

    console.log('📋 Debug result:', {
      success: result.success,
      sqliteEnabled: result.data.sqliteStatus.enabled,
      sqliteAvailable: result.data.sqliteStatus.available,
      filesCount: result.data.files.length,
      totalFiles: result.data.totalFiles,
    });

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Debug files error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * Debug endpoint to delete a file from SQLite and optionally from R2
 */
export const debugDelete: AppRouteHandler<DebugDeleteRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🗑️ Debug delete request:', { userId: user.id, fileId: body.fileId, deleteFromR2: body.deleteFromR2 });

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.debugDeleteFile(body);

    console.log('🗑️ Debug delete result:', {
      success: result.success,
      fileId: result.data.fileId,
      wasFound: result.data.wasFound,
      deletedFromDatabase: result.data.deletedFromDatabase,
      deletedFromR2: result.data.deletedFromR2,
      filename: result.data.deletedFile?.filename,
      error: result.data.error,
    });

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Debug delete error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
