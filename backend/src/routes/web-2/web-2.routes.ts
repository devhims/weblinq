import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createStandardSuccessSchema, StandardErrorSchema } from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Web v2'];

// Common security requirement for all web v2 routes
const security = [{ bearerAuth: [] }];

/**
 * request/response contracts (schemas) for web v2 routes
 * any change to the Zod route schemas instantly propagates to handlers
 * schema is the single source of truth for request/response validation
 */

// Input schemas for different web operations
const searchInputSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(20).optional().default(10),
});

const youtubeCaptionsInputSchema = z.object({
  videoId: z.string().min(1).max(100).describe('YouTube video ID'),
  lang: z
    .string()
    .min(2)
    .max(5)
    .optional()
    .default('en')
    .describe('Language code for subtitles (e.g., "en", "fr", "de")'),
  includeVideoDetails: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include video details along with captions'),
});

// Output schemas
const searchOutputSchema = createStandardSuccessSchema(
  z.object({
    results: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        url: z.string().url(),
        snippet: z.string(),
        favicon: z.string().optional(),
        publishedDate: z.string().optional(),
      }),
    ),
    metadata: z.object({
      query: z.string(),
      totalResults: z.number(),
      searchTime: z.number(),
      timestamp: z.string(),
      requestId: z.string().optional(),
      // debug: z.record(z.any()).optional(),
    }),
  }),
);

const youtubeCaptionsOutputSchema = createStandardSuccessSchema(
  z.object({
    videoId: z.string(),
    language: z.string(),
    captions: z.array(
      z.object({
        start: z.string(),
        dur: z.string(),
        text: z.string(),
      }),
    ),
    videoDetails: z
      .object({
        title: z.string(),
        description: z.string(),
      })
      .optional(),
    metadata: z.object({
      totalCaptions: z.number(),
      extractionTime: z.number(),
      timestamp: z.string(),
    }),
  }),
);

export const search = createRoute({
  path: '/web/search',
  method: 'post',
  tags,
  security,
  summary: 'Search the web (v2)',
  description: 'Perform a web search and return results using the v2 API',
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

export const youtubeCaptions = createRoute({
  path: '/web/yt-captions',
  method: 'post',
  tags,
  security,
  summary: 'Extract YouTube captions',
  description: 'Extract captions/subtitles from a YouTube video using video ID',
  request: {
    body: jsonContentRequired(youtubeCaptionsInputSchema, 'YouTube caption extraction parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(youtubeCaptionsOutputSchema, 'Captions extracted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(youtubeCaptionsInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

// Export all route types for handlers
export type SearchRoute = typeof search;
export type YoutubeCaptionsRoute = typeof youtubeCaptions;
