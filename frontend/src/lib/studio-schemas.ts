// Studio request schemas built with Zod – runtime validation that mirrors the
// TypeScript interfaces in `studio-api.ts`.  These schemas are used by the
// new schema-driven api builder so that we have a single source of truth for
// both compile-time types and runtime validation.

import { z } from 'zod';

// Enhanced URL validation that requires proper domain names with TLDs
const strictUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Must have at least one dot (for TLD) unless it's localhost
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          return true; // Allow local development URLs
        }

        // Must contain at least one dot for TLD
        if (!hostname.includes('.')) {
          return false;
        }

        // Must have a valid TLD (at least 2 characters after the last dot)
        const parts = hostname.split('.');
        const tld = parts[parts.length - 1];

        return tld.length >= 2 && /^[a-zA-Z]+$/.test(tld);
      } catch {
        return false;
      }
    },
    {
      message:
        'URL must include a valid domain name with a top-level domain (e.g., .com, .org, etc.)',
    },
  );

// IMPORTANT: Keep this union in sync with `EndpointAction` in api-builder.ts.
export type EndpointAction =
  | 'scrape/markdown'
  | 'scrape/html'
  | 'scrape/links'
  | 'scrape/elements'
  | 'visual/screenshot'
  | 'structured/json'
  | 'structured/text'
  | 'search/web'
  | 'visual/pdf';

/* ──────────────────────────────────────────────────────────────
   Individual request schemas
──────────────────────────────────────────────────────────────── */

export const MarkdownRequestSchema = z.object({
  url: strictUrlSchema,
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const ContentRequestSchema = z.object({
  url: strictUrlSchema,
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const LinksRequestSchema = z.object({
  url: strictUrlSchema,
  includeExternal: z.boolean().optional().default(true),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const ScrapeRequestSchema = z.object({
  url: strictUrlSchema,
  elements: z
    .array(
      z.object({
        selector: z.string(),
        attributes: z.array(z.string()).optional(),
      }),
    )
    .min(1),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  headers: z.record(z.string()).optional(),
});

export const ScreenshotRequestSchema = z.object({
  url: strictUrlSchema,
  waitTime: z.number().int().min(0).max(5000).optional().default(0),

  // Return format preference - binary for optimal performance by default
  base64: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return base64 string instead of binary data'),

  // Legacy convenience fields (all optional)
  fullPage: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  quality: z.number().optional(),

  // Unified prop variants
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
      // Note: API returns binary by default for optimal performance
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

export const JsonExtractionRequestSchema = z
  .object({
    url: strictUrlSchema,
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

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional().default(10),
});

export const PdfRequestSchema = z.object({
  url: strictUrlSchema,
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  // Return format preference - binary for optimal performance by default
  base64: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return base64 string instead of binary data'),
});

/* ──────────────────────────────────────────────────────────────
   Mapping between endpoint/action and schema
──────────────────────────────────────────────────────────────── */
export const endpointActionSchemas: Record<EndpointAction, z.ZodTypeAny> = {
  'scrape/markdown': MarkdownRequestSchema,
  'scrape/html': ContentRequestSchema,
  'scrape/links': LinksRequestSchema,
  'scrape/elements': ScrapeRequestSchema,
  'visual/screenshot': ScreenshotRequestSchema,
  'structured/json': JsonExtractionRequestSchema,
  'structured/text': JsonExtractionRequestSchema,
  'search/web': SearchRequestSchema,
  'visual/pdf': PdfRequestSchema,
};
