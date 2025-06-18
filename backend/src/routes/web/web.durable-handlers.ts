import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/web-durable-object';
import type { AppRouteHandler } from '@/lib/types';

// Route types – generated alongside schemas in web.routes.ts
import type {
  ContentRoute,
  JsonExtractionRoute,
  LinksRoute,
  MarkdownRoute,
  ScrapeRoute,
  ScreenshotRoute,
  SearchRoute,
} from './web.routes';

/**
 * Helper function to get the WebDurableObject stub for a user
 */
function getWebDurableObject(c: { env: CloudflareBindings }, userId: string): DurableObjectStub<WebDurableObject> {
  const namespace = c.env.WEBLINQ_DURABLE_OBJECT;
  const id = namespace.idFromName(`web:${userId}`);
  return namespace.get(id);
}

/**
 * Screenshot endpoint - Capture webpage screenshots
 */
export const screenshot: AppRouteHandler<ScreenshotRoute> = async (c: any) => {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = c.req.valid('json');

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    // const result = await webDurableObject.screenshot(body);
    const result = await webDurableObject.screenshotV2(body);
    return c.json(result, HttpStatusCodes.OK);
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
    console.log('Markdown result:', result.data);
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

    const result = await webDurableObject.getContent(body);
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

    const result = await webDurableObject.scrapeElements(body);
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

    const result = await webDurableObject.extractLinks(body);
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
