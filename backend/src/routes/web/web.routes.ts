import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Web'];

/**
 * request/response contracts (schemas) for web routes
 * any change to the Zod route schemas instantly propagates to handlers
 * schema is the single source of truth for request/response validation
 */
// Input schemas for different web operations
export const screenshotInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  // Optional delay (in ms) before taking the screenshot
  waitTime: z.number().int().min(0).max(30000).optional().default(0),

  // Advanced Cloudflare/Puppeteer compatible screenshot options
  screenshotOptions: z
    .object({
      captureBeyondViewport: z.boolean().optional(),
      clip: z
        .object({
          height: z.number().int().min(1),
          width: z.number().int().min(1),
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          scale: z.number().min(0.1).max(10).optional(),
        })
        .optional(),
      encoding: z.enum(['binary', 'base64']).optional().default('binary'),
      fromSurface: z.boolean().optional(),
      fullPage: z.boolean().optional(),
      omitBackground: z.boolean().optional(),
      optimizeForSpeed: z.boolean().optional(),
      quality: z.number().int().min(1).max(100).optional(),
      type: z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
    })
    .optional()
    .default({}),

  // Viewport configuration
  viewport: z
    .object({
      height: z.number().int().min(100).max(2160),
      width: z.number().int().min(100).max(3840),
      deviceScaleFactor: z.number().min(0.1).max(10).optional(),
      hasTouch: z.boolean().optional(),
      isLandscape: z.boolean().optional(),
      isMobile: z.boolean().optional(),
    })
    .optional(),
});

export const markdownInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(30000).optional().default(0),
  includeImages: z.boolean().optional().default(true),
  includeLinks: z.boolean().optional().default(true),
});

const jsonExtractionInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  schema: z.record(z.any()),
  waitTime: z.number().int().min(0).max(30000).optional().default(0),
  instructions: z.string().optional(),
});

const contentInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(30000).optional().default(0),
  includeMetadata: z.boolean().optional().default(true),
});

const scrapeInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  elements: z.array(
    z.object({
      selector: z.string(),
      attributes: z.array(z.string()).optional(),
    }),
  ),
  waitTime: z.number().int().min(0).max(30000).optional().default(0),
  headers: z.record(z.string()).optional(),
});

const linksInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  includeExternal: z.boolean().optional().default(true),
  waitTime: z.number().int().min(0).max(30000).optional().default(0),
});

const searchInputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(50).optional().default(10),
});

// Output schemas
const screenshotOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    image: z.string().describe('Base64 encoded image'),
    metadata: z.object({
      width: z.number(),
      height: z.number(),
      format: z.string(),
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
    }),
  }),
  creditsCost: z.number(),
});

const markdownOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    markdown: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      wordCount: z.number(),
    }),
  }),
  creditsCost: z.number(),
});

const jsonExtractionOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    extracted: z.record(z.any()),
    metadata: z.object({
      url: z.string(),
      timestamp: z.string(),
      fieldsExtracted: z.number(),
    }),
  }),
  creditsCost: z.number(),
});

const contentOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      contentType: z.string(),
    }),
  }),
  creditsCost: z.number(),
});

const scrapeOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    elements: z.array(
      z.object({
        selector: z.string(),
        data: z.record(z.any()),
      }),
    ),
    metadata: z.object({
      url: z.string(),
      timestamp: z.string(),
      elementsFound: z.number(),
    }),
  }),
  creditsCost: z.number(),
});

const linksOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    links: z.array(
      z.object({
        url: z.string(),
        text: z.string(),
        type: z.enum(['internal', 'external']),
      }),
    ),
    metadata: z.object({
      url: z.string(),
      timestamp: z.string(),
      totalLinks: z.number(),
      internalLinks: z.number(),
      externalLinks: z.number(),
    }),
  }),
  creditsCost: z.number(),
});

const searchOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        snippet: z.string(),
        source: z.enum(['duckduckgo', 'startpage', 'yandex', 'bing']),
      }),
    ),
    metadata: z.object({
      query: z.string(),
      totalResults: z.number(),
      searchTime: z.number(),
      sources: z.array(z.string()),
      timestamp: z.string(),
    }),
  }),
  creditsCost: z.number(),
});

// Route definitions
export const screenshot = createRoute({
  path: '/web/screenshot',
  method: 'post',
  request: {
    body: jsonContentRequired(screenshotInputSchema, 'Screenshot parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      screenshotOutputSchema,
      'Screenshot captured successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(screenshotInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const markdown = createRoute({
  path: '/web/markdown',
  method: 'post',
  request: {
    body: jsonContentRequired(
      markdownInputSchema,
      'Markdown extraction parameters',
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      markdownOutputSchema,
      'Markdown extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(markdownInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const jsonExtraction = createRoute({
  path: '/web/extract-json',
  method: 'post',
  request: {
    body: jsonContentRequired(
      jsonExtractionInputSchema,
      'JSON extraction parameters',
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      jsonExtractionOutputSchema,
      'JSON data extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(jsonExtractionInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const content = createRoute({
  path: '/web/content',
  method: 'post',
  request: {
    body: jsonContentRequired(
      contentInputSchema,
      'Content extraction parameters',
    ),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      contentOutputSchema,
      'HTML content retrieved successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(contentInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const scrape = createRoute({
  path: '/web/scrape',
  method: 'post',
  request: {
    body: jsonContentRequired(scrapeInputSchema, 'Element scraping parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      scrapeOutputSchema,
      'Elements scraped successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(scrapeInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const links = createRoute({
  path: '/web/links',
  method: 'post',
  request: {
    body: jsonContentRequired(linksInputSchema, 'Link extraction parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      linksOutputSchema,
      'Links extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(linksInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const search = createRoute({
  path: '/web/search',
  method: 'post',
  request: {
    body: jsonContentRequired(searchInputSchema, 'Search parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      searchOutputSchema,
      'Search completed successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(searchInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

// Export all route types for handlers
export type ScreenshotRoute = typeof screenshot;
export type MarkdownRoute = typeof markdown;
export type JsonExtractionRoute = typeof jsonExtraction;
export type ContentRoute = typeof content;
export type ScrapeRoute = typeof scrape;
export type LinksRoute = typeof links;
export type SearchRoute = typeof search;
