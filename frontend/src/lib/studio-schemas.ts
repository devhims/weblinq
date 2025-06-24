// Studio request schemas built with Zod – runtime validation that mirrors the
// TypeScript interfaces in `studio-api.ts`.  These schemas are used by the
// new schema-driven api builder so that we have a single source of truth for
// both compile-time types and runtime validation.

import { z } from 'zod';

// IMPORTANT: Keep this union in sync with `EndpointAction` in api-builder.ts.
export type EndpointAction =
  | 'scrape/markdown'
  | 'scrape/html'
  | 'scrape/links'
  | 'scrape/elements'
  | 'visual/screenshot'
  | 'structured/json'
  | 'search/web';

/* ──────────────────────────────────────────────────────────────
   Individual request schemas
──────────────────────────────────────────────────────────────── */

export const MarkdownRequestSchema = z.object({
  url: z.string().url(),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const ContentRequestSchema = z.object({
  url: z.string().url(),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const LinksRequestSchema = z.object({
  url: z.string().url(),
  includeExternal: z.boolean().optional().default(true),
  visibleLinksOnly: z.boolean().optional().default(false),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
});

export const ScrapeRequestSchema = z.object({
  url: z.string().url(),
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
  url: z.string().url(),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),

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

export const JsonExtractionRequestSchema = z.object({
  url: z.string().url(),
  schema: z.record(z.any()),
  waitTime: z.number().int().min(0).max(5000).optional().default(0),
  instructions: z.string().optional(),
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(10),
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
  'search/web': SearchRequestSchema,
};
