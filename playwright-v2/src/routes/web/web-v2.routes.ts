import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import {
  createStandardSuccessSchema,
  StandardErrorSchema,
} from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Web V2', 'Playwright'];

// Common security requirement for all V2 web routes
const security = [{ bearerAuth: [] }];

// Binary schema helper
const binarySchema = z
  .string()
  .openapi({ type: 'string', format: 'binary' })
  .describe('Raw bytes; default response.');

/* ========================================================================== */
/*  V2 Input Schemas - Reuse from V1 but optimized for Playwright            */
/* ========================================================================== */

export const screenshotV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  base64: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return base64 string instead of binary Uint8Array'),

  // Advanced screenshot options (matching V1 but optimized for Playwright)
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
      fullPage: z.boolean().optional().default(true), // Default to full page like V1
      omitBackground: z.boolean().optional(),
      optimizeForSpeed: z.boolean().optional(),
      quality: z.number().int().min(1).max(100).optional(),
      type: z.enum(['png', 'jpeg', 'webp']).optional().default('png'), // Support all formats like V1
    })
    .optional()
    .default({
      encoding: 'binary',
      fullPage: true,
      type: 'png',
    }),

  viewport: z
    .object({
      height: z.number().int().min(100).max(2160).default(800),
      width: z.number().int().min(100).max(3840).default(1280),
      deviceScaleFactor: z.number().min(0.1).max(10).optional().default(1),
      hasTouch: z.boolean().optional().default(false),
      isLandscape: z.boolean().optional().default(false),
      isMobile: z.boolean().optional().default(false),
    })
    .optional(),
});

export const markdownV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const contentV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const scrapeV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  elements: z.array(
    z.object({
      selector: z.string(),
      attributes: z.array(z.string()).optional(),
    }),
  ),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const linksV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  includeExternal: z.boolean().optional().default(true),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const searchV2InputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(10).optional().default(5),
});

export const jsonExtractionV2InputSchema = z
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
  .refine(
    (data) =>
      data.responseType !== 'json' || data.prompt || data.response_format,
    {
      message:
        "JSON responses require either 'prompt' or 'response_format' (or both)",
      path: ['responseType'],
    },
  )
  .refine((data) => data.responseType !== 'text' || !data.response_format, {
    message: "Schema-based 'response_format' is only valid for JSON responses",
    path: ['response_format'],
  });

export const pdfV2InputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  base64: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return base64 string instead of binary Uint8Array'),
});

/* ========================================================================== */
/*  V2 Output Schemas - Enhanced with V2 metadata                            */
/* ========================================================================== */

const screenshotV2OutputSchema = createStandardSuccessSchema(
  z.object({
    image: z
      .string()
      .describe('Base-64 image. Present only when `"base64": true`.')
      .optional(),
    metadata: z.object({
      width: z.number(),
      height: z.number(),
      format: z.string(),
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
      fullPage: z.boolean(),
      type: z.enum(['png', 'jpeg', 'webp']),
      quality: z.number().optional(),
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const markdownV2OutputSchema = createStandardSuccessSchema(
  z.object({
    markdown: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      wordCount: z.number(),
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const contentV2OutputSchema = createStandardSuccessSchema(
  z.object({
    content: z.string(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string(),
      timestamp: z.string(),
      contentType: z.string(),
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const scrapeV2OutputSchema = createStandardSuccessSchema(
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
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const linksV2OutputSchema = createStandardSuccessSchema(
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
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const searchV2OutputSchema = createStandardSuccessSchema(
  z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        snippet: z.string(),
        source: z.enum(['duckduckgo', 'startpage', 'bing']),
      }),
    ),
    metadata: z.object({
      query: z.string(),
      totalResults: z.number(),
      searchTime: z.number(),
      sources: z.array(z.string()),
      timestamp: z.string(),
      engine: z.literal('playwright-v2'),
      debug: z.record(z.any()).optional(),
    }),
  }),
);

const jsonExtractionV2OutputSchema = createStandardSuccessSchema(
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
      originalContentTokens: z.number().optional(),
      finalContentTokens: z.number().optional(),
      contentTruncated: z.boolean().optional(),
      engine: z.literal('playwright-v2'),
    }),
  }),
);

const pdfV2OutputSchema = createStandardSuccessSchema(
  z.object({
    pdf: z
      .string()
      .describe('Base-64 PDF. Present only when `"base64": true`.')
      .optional(),
    metadata: z.object({
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
      engine: z.literal('playwright-v2'),
    }),
  }),
);

/* ========================================================================== */
/*  V2 Route Definitions - Clean Playwright-based API                        */
/* ========================================================================== */

export const markdownV2 = createRoute({
  path: '/web/markdown',
  method: 'post',
  tags,
  security,
  summary: 'Extract markdown from a web page (V2 - Playwright)',
  description:
    'Convert web page content to markdown format using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(
      markdownV2InputSchema,
      'Markdown extraction parameters',
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      markdownV2OutputSchema,
      'Markdown extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(markdownV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const screenshotV2 = createRoute({
  path: '/web/screenshot',
  method: 'post',
  tags,
  security,
  summary: 'Capture screenshot of a web page (V2 - Playwright)',
  description:
    'Capture a screenshot using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(screenshotV2InputSchema, 'Screenshot parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'Screenshot captured successfully',
      content: {
        'application/json': {
          schema: screenshotV2OutputSchema,
        },
        'image/png': {
          schema: binarySchema,
        },
      },
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(screenshotV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const linksV2 = createRoute({
  path: '/web/links',
  method: 'post',
  tags,
  security,
  summary: 'Extract links from a web page (V2 - Playwright)',
  description:
    'Get all links using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(linksV2InputSchema, 'Link extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      linksV2OutputSchema,
      'Links extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(linksV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const contentV2 = createRoute({
  path: '/web/content',
  method: 'post',
  tags,
  security,
  summary: 'Get raw HTML content from a web page (V2 - Playwright)',
  description:
    'Retrieve raw HTML content using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(
      contentV2InputSchema,
      'Content extraction parameters',
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      contentV2OutputSchema,
      'HTML content retrieved successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(contentV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const pdfV2 = createRoute({
  path: '/web/pdf',
  method: 'post',
  tags,
  security,
  summary: 'Generate PDF from a web page (V2 - Playwright)',
  description:
    'Convert web pages to PDF using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(pdfV2InputSchema, 'PDF generation parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'PDF generated successfully',
      content: {
        'application/json': {
          schema: pdfV2OutputSchema,
        },
        'application/pdf': {
          schema: binarySchema,
        },
      },
    },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(pdfV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const scrapeV2 = createRoute({
  path: '/web/scrape',
  method: 'post',
  tags,
  security,
  summary: 'Scrape specific elements from a web page (V2 - Playwright)',
  description:
    'Extract specific DOM elements using CSS selectors with Playwright engine, session reuse and caching',
  request: {
    body: jsonContentRequired(
      scrapeV2InputSchema,
      'Element scraping parameters',
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      scrapeV2OutputSchema,
      'Elements scraped successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(scrapeV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const searchV2 = createRoute({
  path: '/web/search',
  method: 'post',
  tags,
  security,
  summary: 'Search the web (V2 - Playwright)',
  description:
    'Perform web search using Playwright engine with parallel search, session reuse and caching',
  request: {
    body: jsonContentRequired(searchV2InputSchema, 'Web search parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      searchV2OutputSchema,
      'Search completed successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(searchV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

export const jsonExtractionV2 = createRoute({
  path: '/web/json-extraction',
  method: 'post',
  tags,
  security,
  summary: 'Extract structured data from a web page (V2 - Playwright)',
  description:
    'Extract structured data (JSON) or natural language text from a web page using Playwright engine with session reuse and caching',
  request: {
    body: jsonContentRequired(
      jsonExtractionV2InputSchema,
      'JSON extraction parameters',
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      jsonExtractionV2OutputSchema,
      'Data extracted successfully',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(jsonExtractionV2InputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      StandardErrorSchema,
      'Authentication required',
    ),
    [HttpStatusCodes.PAYMENT_REQUIRED]: jsonContent(
      StandardErrorSchema,
      'Insufficient credits',
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      StandardErrorSchema,
      'Internal server error',
    ),
  },
});

/* ========================================================================== */
/*  Export V2 Route Types for Handlers                                       */
/* ========================================================================== */

export type MarkdownV2Route = typeof markdownV2;
export type ScreenshotV2Route = typeof screenshotV2;
export type LinksV2Route = typeof linksV2;
export type ContentV2Route = typeof contentV2;
export type PdfV2Route = typeof pdfV2;
export type ScrapeV2Route = typeof scrapeV2;
export type SearchV2Route = typeof searchV2;
export type JsonExtractionV2Route = typeof jsonExtractionV2;
