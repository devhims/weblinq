import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['System'];

/**
 * Input schemas for system operations
 */
const browserStatusInputSchema = z.object({});

const sessionHealthInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

const createBrowsersInputSchema = z.object({
  count: z.number().int().min(1).max(4).optional().default(1).describe('Number of browsers to create (1-4)'),
});

const cleanupDoInputSchema = z.object({
  doId: z.string().min(1, 'Browser DO ID is required'),
});

const deleteAllBrowsersInputSchema = z.object({});

/**
 * Output schemas for system operations
 */
const browserStatusOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    totalDOs: z.number(),
    maxCapacity: z.number(),
    queuedRequests: z.number(),
    browserDOs: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string().nullable(),
        status: z.enum(['idle', 'busy', 'error']),
        errorMessage: z.string().nullable(),
        errorCount: z.number(),
        lastActivity: z.string(),
        created: z.string(),
        ageMinutes: z.number(),
        inactiveMinutes: z.number(),
      }),
    ),
  }),
  creditsCost: z.number(),
});

const sessionHealthOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    sessionId: z.string(),
    healthy: z.boolean(),
    responseTime: z.number(),
    error: z.string().optional(),
    browserInfo: z
      .object({
        product: z.string(),
        protocolVersion: z.string(),
        revision: z.string(),
        userAgent: z.string(),
        jsVersion: z.string(),
      })
      .optional(),
    testTimestamp: z.string(),
  }),
  creditsCost: z.number(),
});

const createBrowsersOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    requested: z.number(),
    created: z.number(),
    skipped: z.number(),
    details: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        error: z.string().optional(),
      }),
    ),
  }),
  creditsCost: z.number(),
});

const cleanupDoOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    action: z.literal('cleanup-do'),
    doId: z.string(),
    message: z.string(),
  }),
  creditsCost: z.number(),
});

const deleteAllBrowsersOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    action: z.literal('delete-all'),
    message: z.string(),
    totalFound: z.number(),
    successCount: z.number(),
    failureCount: z.number(),
    details: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
      }),
    ),
    storageCleared: z.boolean(),
  }),
  creditsCost: z.number(),
});

/**
 * Route definitions
 */
export const browserStatus = createRoute({
  path: '/system/browser-status',
  method: 'post',
  request: {
    body: jsonContentRequired(browserStatusInputSchema, 'Browser status query parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(browserStatusOutputSchema, 'Browser status retrieved successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(browserStatusInputSchema),
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

export const sessionHealth = createRoute({
  path: '/system/session-health',
  method: 'post',
  request: {
    body: jsonContentRequired(sessionHealthInputSchema, 'Session health test parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(sessionHealthOutputSchema, 'Session health test completed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(sessionHealthInputSchema),
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

export const createBrowsers = createRoute({
  path: '/system/create-browsers',
  method: 'post',
  request: {
    body: jsonContentRequired(createBrowsersInputSchema, 'Browser creation parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createBrowsersOutputSchema, 'Browsers created successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createBrowsersInputSchema),
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

export const cleanupDo = createRoute({
  path: '/system/cleanup-do',
  method: 'post',
  request: {
    body: jsonContentRequired(cleanupDoInputSchema, 'Browser DO cleanup parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(cleanupDoOutputSchema, 'Browser DO cleaned up successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(cleanupDoInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const deleteAllBrowsers = createRoute({
  path: '/system/delete-all-browsers',
  method: 'post',
  request: {
    body: jsonContentRequired(deleteAllBrowsersInputSchema, 'Delete all browsers parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(deleteAllBrowsersOutputSchema, 'All browsers deleted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(deleteAllBrowsersInputSchema),
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

// Export route types for handlers
export type BrowserStatusRoute = typeof browserStatus;
export type SessionHealthRoute = typeof sessionHealth;
export type CreateBrowsersRoute = typeof createBrowsers;
export type CleanupDoRoute = typeof cleanupDo;
export type DeleteAllBrowsersRoute = typeof deleteAllBrowsers;
