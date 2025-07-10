import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createStandardSuccessSchema, StandardErrorSchema } from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Web'];

// Common security requirement for all web routes
const security = [{ bearerAuth: [] }];

// A tiny helper for binary bodies
const binarySchema = z.string().openapi({ type: 'string', format: 'binary' }).describe('Raw bytes; default response.');

/**
 * request/response contracts (schemas) for web routes
 * any change to the Zod route schemas instantly propagates to handlers
 * schema is the single source of truth for request/response validation
 */
// Input schemas for different web operations
export const screenshotInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  // Optional delay (in ms) before taking the screenshot
  waitTime: z.number().int().min(0).max(5000).optional().default(0),

  // Return format preference - binary (Uint8Array) by default for optimal performance
  base64: z.boolean().optional().default(false).describe('Return base64 string instead of binary Uint8Array'),

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
      fullPage: z.boolean().optional().default(true),
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
      height: z.number().int().min(100).max(2160).default(1080),
      width: z.number().int().min(100).max(3840).default(1920),
      deviceScaleFactor: z.number().min(0.1).max(10).optional().default(1),
      hasTouch: z.boolean().optional().default(false),
      isLandscape: z.boolean().optional().default(false),
      isMobile: z.boolean().optional().default(false),
    })
    .optional(),
});

export const markdownInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

const jsonExtractionInputSchema = z
  .object({
    url: z.string().url('Must be a valid URL'),
    waitTime: z.number().int().min(0).max(5000).optional().default(0),
    // Response type: 'json' for structured data, 'text' for natural language
    responseType: z.enum(['json', 'text']).optional().default('json'),
    // Natural language prompt for extraction (required for text responses, optional for JSON with schema)
    prompt: z.string().min(1).max(1000).optional(),
    // Structured JSON schema for extraction (only valid when responseType is 'json')
    response_format: z
      .object({
        type: z.literal('json_schema'),
        json_schema: z.record(z.any()),
      })
      .optional(),
    // Additional instructions for the AI
    instructions: z.string().max(500).optional(),
  })
  .refine((data) => data.responseType !== 'text' || data.prompt, {
    message: "Text responses require a 'prompt'",
    path: ['prompt'],
  })
  .refine((data) => data.responseType !== 'json' || data.prompt || data.response_format, {
    message: "JSON responses require either 'prompt' or 'response_format' (or both)",
    path: ['responseType'],
  })
  .refine((data) => data.responseType !== 'text' || !data.response_format, {
    message: "Schema-based 'response_format' is only valid for JSON responses",
    path: ['response_format'],
  });

const contentInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

const scrapeInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  elements: z.array(
    z.object({
      selector: z.string(),
      attributes: z.array(z.string()).optional(),
    }),
  ),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  headers: z.record(z.string()).optional(),
});

export const linksInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  includeExternal: z.boolean().optional().default(true),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

const searchInputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(10).optional().default(5),
});

// Output schemas
const screenshotOutputSchema = createStandardSuccessSchema(
  z.object({
    image: z.string().describe('Base-64 image. Present only when `"base64": true`.').optional(),
    metadata: z.object({
      width: z.number(),
      height: z.number(),
      format: z.string(),
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
    }),
    permanentUrl: z.string().url().optional().describe('Permanent R2 storage URL for the image'),
    fileId: z.string().optional().describe('Unique file ID for tracking'),
  }),
);

const markdownOutputSchema = createStandardSuccessSchema(
  z.object({
    markdown: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      wordCount: z.number(),
    }),
  }),
);

const jsonExtractionOutputSchema = createStandardSuccessSchema(
  z.object({
    // For JSON responses: structured data object
    extracted: z.record(z.any()).optional(),
    // For text responses: natural language text
    text: z.string().optional(),
    metadata: z.object({
      url: z.string(),
      timestamp: z.string(),
      model: z.string(),
      responseType: z.enum(['json', 'text']),
      extractionType: z.enum(['prompt', 'schema']),
      fieldsExtracted: z.number().optional(),
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
    }),
  }),
);

const contentOutputSchema = createStandardSuccessSchema(
  z.object({
    content: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      contentType: z.string(),
    }),
  }),
);

const scrapeOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const linksOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const searchOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

// Add PDF input schema
export const pdfInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  // Optional delay before generating the PDF (ms)
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  // Return format preference - binary (Uint8Array) by default for optimal performance
  base64: z.boolean().optional().default(false).describe('Return base64 string instead of binary Uint8Array'),
});

// PDF output schema
const pdfOutputSchema = createStandardSuccessSchema(
  z.object({
    pdf: z.string().describe('Base-64 PDF. Present only when `"base64": true`.').optional(),
    metadata: z.object({
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
    }),
    permanentUrl: z.string().optional().describe('Permanent R2 storage URL for the PDF'),
    fileId: z.string().optional().describe('Unique file ID for tracking'),
  }),
);

// Route definitions
export const screenshot = createRoute({
  path: '/web/screenshot',
  method: 'post',
  tags,
  security,
  summary: 'Capture screenshot of a web page',
  description: 'Capture a screenshot of the specified URL with optional configuration',
  request: {
    body: jsonContentRequired(screenshotInputSchema, 'Screenshot parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'Screenshot captured successfully',
      content: {
        'application/json': {
          schema: screenshotOutputSchema,
        },
        'image/png': {
          schema: binarySchema,
        },
      },
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(screenshotInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const markdown = createRoute({
  path: '/web/markdown',
  method: 'post',
  tags,
  security,
  summary: 'Extract markdown from a web page',
  description: 'Convert web page content to markdown format',
  request: {
    body: jsonContentRequired(markdownInputSchema, 'Markdown extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(markdownOutputSchema, 'Markdown extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(markdownInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const jsonExtraction = createRoute({
  path: '/web/extract-json',
  method: 'post',
  tags,
  security,
  summary: 'Extract structured data from a web page',
  description: 'Extract JSON data or text content using AI-powered parsing',
  request: {
    body: jsonContentRequired(jsonExtractionInputSchema, 'JSON extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(jsonExtractionOutputSchema, 'JSON data extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(jsonExtractionInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const content = createRoute({
  path: '/web/content',
  method: 'post',
  tags,
  security,
  summary: 'Get raw HTML content from a web page',
  description: 'Retrieve the raw HTML content of the specified URL',
  request: {
    body: jsonContentRequired(contentInputSchema, 'Content extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(contentOutputSchema, 'HTML content retrieved successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(contentInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const scrape = createRoute({
  path: '/web/scrape',
  method: 'post',
  tags,
  security,
  summary: 'Scrape specific elements from a web page',
  description: 'Extract specific HTML elements using CSS selectors',
  request: {
    body: jsonContentRequired(scrapeInputSchema, 'Element scraping parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(scrapeOutputSchema, 'Elements scraped successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(scrapeInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const links = createRoute({
  path: '/web/links',
  method: 'post',
  tags,
  security,
  summary: 'Extract links from a web page',
  description: 'Get all links from the specified URL with optional filtering',
  request: {
    body: jsonContentRequired(linksInputSchema, 'Link extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(linksOutputSchema, 'Links extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(linksInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const search = createRoute({
  path: '/web/search',
  method: 'post',
  tags,
  security,
  summary: 'Search the web',
  description: 'Perform a web search and return results',
  request: {
    body: jsonContentRequired(searchInputSchema, 'Search parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(searchOutputSchema, 'Search completed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(searchInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const pdf = createRoute({
  path: '/web/pdf',
  method: 'post',
  tags,
  security,
  summary: 'Generate PDF from a web page',
  description: 'Convert a web page to PDF format',
  request: {
    body: jsonContentRequired(pdfInputSchema, 'PDF generation parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'PDF generated successfully',
      content: {
        // base-64 envelope (opt-in)
        'application/json': {
          schema: pdfOutputSchema,
        },
        // binary default
        'application/pdf': {
          schema: binarySchema,
        },
      },
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(pdfInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
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
export type PdfRoute = typeof pdf;
