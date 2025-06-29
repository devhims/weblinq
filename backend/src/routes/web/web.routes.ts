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
      // Note: While this option is accepted for Puppeteer compatibility,
      // the API always returns base64-encoded images regardless of this setting
      encoding: z.enum(['binary', 'base64']).optional().default('base64'),
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
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

const jsonExtractionInputSchema = z
  .object({
    url: z.string().url('Must be a valid URL'),
    waitTime: z.number().int().min(0).max(5000).optional().default(0),
    // Response type: 'json' for structured data, 'text' for natural language
    responseType: z.enum(['json', 'text']).optional().default('json'),
    // Option 1: Natural language prompt for extraction
    prompt: z.string().min(1).max(1000).optional(),
    // Option 2: Structured JSON schema for extraction (only valid when responseType is 'json')
    response_format: z
      .object({
        type: z.literal('json_schema'),
        json_schema: z.record(z.any()),
      })
      .optional(),
    // Additional instructions for the AI
    instructions: z.string().max(500).optional(),
  })
  .refine((data) => data.prompt || data.response_format, {
    message: "Either 'prompt' or 'response_format' must be provided",
    path: ['prompt'],
  })
  .refine((data) => data.responseType !== 'json' || data.prompt || data.response_format, {
    message: "For JSON responses, either 'prompt' or 'response_format' must be provided",
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
  visibleLinksOnly: z.boolean().optional().default(false),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

const searchInputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(20).optional().default(10),
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
    permanentUrl: z.string().optional().describe('Permanent R2 storage URL for the image'),
    fileId: z.string().optional().describe('Unique file ID for tracking'),
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

// Add PDF input schema
export const pdfInputSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  // Optional delay before generating the PDF (ms)
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  // Return format preference - binary (Uint8Array) by default for optimal performance
  base64: z.boolean().optional().default(false).describe('Return base64 string instead of binary Uint8Array'),
});

// PDF output schema
const pdfOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    pdf: z.string().describe('Base64 encoded PDF'),
    metadata: z.object({
      size: z.number(),
      url: z.string(),
      timestamp: z.string(),
    }),
    permanentUrl: z.string().optional().describe('Permanent R2 storage URL for the PDF'),
    fileId: z.string().optional().describe('Unique file ID for tracking'),
  }),
  creditsCost: z.number(),
});

// Debug input schema
const debugFilesInputSchema = z.object({
  type: z.enum(['screenshot', 'pdf']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// Debug output schema
const debugFilesOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    sqliteStatus: z.object({
      enabled: z.boolean(),
      available: z.boolean(),
      userId: z.string(),
    }),
    files: z.array(
      z.object({
        id: z.string(),
        type: z.enum(['screenshot', 'pdf']),
        url: z.string(),
        filename: z.string(),
        r2_key: z.string(),
        public_url: z.string(),
        metadata: z.string(),
        created_at: z.string(),
        expires_at: z.string().optional(),
      }),
    ),
    totalFiles: z.number(),
  }),
});

// Debug delete input schema
const debugDeleteInputSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  deleteFromR2: z.boolean().optional().default(false).describe('Also delete the file from R2 storage'),
});

// Debug delete output schema
const debugDeleteOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    fileId: z.string(),
    wasFound: z.boolean(),
    deletedFromDatabase: z.boolean(),
    deletedFromR2: z.boolean(),
    deletedFile: z
      .object({
        id: z.string(),
        type: z.enum(['screenshot', 'pdf']),
        url: z.string(),
        filename: z.string(),
        r2_key: z.string(),
        public_url: z.string(),
        metadata: z.string(),
        created_at: z.string(),
        expires_at: z.string().optional(),
      })
      .optional(),
    error: z.string().optional(),
  }),
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
    [HttpStatusCodes.OK]: jsonContent(screenshotOutputSchema, 'Screenshot captured successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(screenshotInputSchema), 'Validation error'),
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
    body: jsonContentRequired(markdownInputSchema, 'Markdown extraction parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(markdownOutputSchema, 'Markdown extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(markdownInputSchema), 'Validation error'),
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
    body: jsonContentRequired(jsonExtractionInputSchema, 'JSON extraction parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(jsonExtractionOutputSchema, 'JSON data extracted successfully'),
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
    body: jsonContentRequired(contentInputSchema, 'Content extraction parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(contentOutputSchema, 'HTML content retrieved successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(contentInputSchema), 'Validation error'),
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
    [HttpStatusCodes.OK]: jsonContent(scrapeOutputSchema, 'Elements scraped successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(scrapeInputSchema), 'Validation error'),
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
    [HttpStatusCodes.OK]: jsonContent(linksOutputSchema, 'Links extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(linksInputSchema), 'Validation error'),
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
    [HttpStatusCodes.OK]: jsonContent(searchOutputSchema, 'Search completed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(searchInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const pdf = createRoute({
  path: '/web/pdf',
  method: 'post',
  request: {
    body: jsonContentRequired(pdfInputSchema, 'PDF generation parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(pdfOutputSchema, 'PDF generated successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(pdfInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const debugFiles = createRoute({
  path: '/web/debug/files',
  method: 'post',
  request: {
    body: jsonContentRequired(debugFilesInputSchema, 'Debug files query parameters'),
  },
  tags: ['Debug'],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(debugFilesOutputSchema, 'Files listed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(debugFilesInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const debugDelete = createRoute({
  path: '/web/debug/delete',
  method: 'post',
  request: {
    body: jsonContentRequired(debugDeleteInputSchema, 'Debug delete file parameters'),
  },
  tags: ['Debug'],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(debugDeleteOutputSchema, 'File deleted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(debugDeleteInputSchema), 'Validation error'),
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
export type PdfRoute = typeof pdf;
export type DebugFilesRoute = typeof debugFiles;
export type DebugDeleteRoute = typeof debugDelete;
