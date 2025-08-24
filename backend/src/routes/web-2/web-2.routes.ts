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

// Output schemas
const searchOutputSchema = createStandardSuccessSchema(
  z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        snippet: z.string(),
        source: z.enum(['Weblinq Search']), // V2 only uses Weblinq Search
        favicon: z.string().optional(),
        publishedDate: z.string().optional(),
      }),
    ),
    metadata: z.object({
      query: z.string(),
      totalResults: z.number(),
      searchTime: z.number(),
      sources: z.array(z.string()),
      timestamp: z.string(),
      requestId: z.string().optional(),
      debug: z.record(z.any()).optional(),
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

// Export all route types for handlers
export type SearchRoute = typeof search;
