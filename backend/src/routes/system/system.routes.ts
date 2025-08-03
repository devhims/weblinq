import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

// Import error schema helper
import { createStandardSuccessSchema, StandardErrorSchema } from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['System'];

// Security requirement for all system routes
const security = [{ bearerAuth: [] }];

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

const checkRemainingInputSchema = z.object({});

const closeBrowserSessionInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

const updateUserPlanInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  plan: z.enum(['free', 'pro'], {
    required_error: 'Plan is required',
    invalid_type_error: 'Plan must be either "free" or "pro"',
  }),
});

/**
 * Standardized output schemas following ApiSuccessResponse<T> format
 */
const browserStatusOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const sessionHealthOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const createBrowsersOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const cleanupDoOutputSchema = createStandardSuccessSchema(
  z.object({
    action: z.literal('cleanup-do'),
    doId: z.string(),
    message: z.string(),
  }),
);

const deleteAllBrowsersOutputSchema = createStandardSuccessSchema(
  z.object({
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
);

const checkRemainingOutputSchema = createStandardSuccessSchema(
  z.object({
    activeSessions: z.number(),
    maxConcurrentSessions: z.number(),
    allowedBrowserAcquisitions: z.number(),
    timeUntilNextAllowedBrowserAcquisition: z.number(),
  }),
);

const closeBrowserSessionOutputSchema = createStandardSuccessSchema(
  z.object({
    action: z.literal('close-session'),
    sessionId: z.string(),
    message: z.string(),
    success: z.boolean(),
  }),
);

const updateUserPlanOutputSchema = createStandardSuccessSchema(
  z.object({
    userId: z.string(),
    plan: z.enum(['free', 'pro']),
    updatedBy: z.string(),
    updatedAt: z.string(),
  }),
);

/**
 * Route definitions
 */
export const browserStatus = createRoute({
  path: '/system/browser-status',
  method: 'post',
  tags,
  security,
  summary: 'Get browser status information',
  description: 'Retrieve status information about all browser durable objects',
  request: {
    body: jsonContentRequired(browserStatusInputSchema, 'Browser status query parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(browserStatusOutputSchema, 'Browser status retrieved successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(browserStatusInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const sessionHealth = createRoute({
  path: '/system/session-health',
  method: 'post',
  tags,
  security,
  summary: 'Test browser session health',
  description: 'Test the health and responsiveness of a specific browser session',
  request: {
    body: jsonContentRequired(sessionHealthInputSchema, 'Session health test parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(sessionHealthOutputSchema, 'Session health test completed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(sessionHealthInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const createBrowsers = createRoute({
  path: '/system/create-browsers',
  method: 'post',
  tags,
  security,
  summary: 'Create new browser instances',
  description: 'Create one or more browser durable object instances',
  request: {
    body: jsonContentRequired(createBrowsersInputSchema, 'Browser creation parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createBrowsersOutputSchema, 'Browsers created successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createBrowsersInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const cleanupDo = createRoute({
  path: '/system/cleanup-do',
  method: 'post',
  tags,
  security,
  summary: 'Cleanup a specific browser DO',
  description: 'Cleanup and reset a specific browser durable object',
  request: {
    body: jsonContentRequired(cleanupDoInputSchema, 'DO cleanup parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(cleanupDoOutputSchema, 'Browser DO cleaned up successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(cleanupDoInputSchema), 'Validation error'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const deleteAllBrowsers = createRoute({
  path: '/system/delete-all-browsers',
  method: 'post',
  tags,
  security,
  summary: 'Delete all browser instances',
  description: 'Delete all browser durable objects and clear storage',
  request: {
    body: jsonContentRequired(deleteAllBrowsersInputSchema, 'Delete all browsers parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(deleteAllBrowsersOutputSchema, 'All browsers deleted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(deleteAllBrowsersInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const checkRemaining = createRoute({
  path: '/system/check-remaining',
  method: 'post',
  tags,
  security,
  summary: 'Check remaining browser resources',
  description: 'Check available browser sessions and acquisition limits',
  request: {
    body: jsonContentRequired(checkRemainingInputSchema, 'Check remaining parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(checkRemainingOutputSchema, 'Remaining resources checked successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(checkRemainingInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const closeBrowserSession = createRoute({
  path: '/system/close-browser-session',
  method: 'post',
  tags,
  security,
  summary: 'Close a browser session',
  description: 'Permanently close a browser session by session ID using browser.close()',
  request: {
    body: jsonContentRequired(closeBrowserSessionInputSchema, 'Browser session close parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(closeBrowserSessionOutputSchema, 'Browser session closed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(closeBrowserSessionInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const updateUserPlan = createRoute({
  path: '/system/update-user-plan',
  method: 'post',
  tags,
  security,
  summary: 'Update user plan',
  description: "Update a user's subscription plan (free/pro) - Admin only",
  request: {
    body: jsonContentRequired(updateUserPlanInputSchema, 'User plan update parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(updateUserPlanOutputSchema, 'User plan updated successfully'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(StandardErrorSchema, 'Invalid input parameters'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(updateUserPlanInputSchema),
      'Validation error',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(StandardErrorSchema, 'Admin access required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export type BrowserStatusRoute = typeof browserStatus;
export type SessionHealthRoute = typeof sessionHealth;
export type CreateBrowsersRoute = typeof createBrowsers;
export type CleanupDoRoute = typeof cleanupDo;
export type DeleteAllBrowsersRoute = typeof deleteAllBrowsers;
export type CheckRemainingRoute = typeof checkRemaining;
export type CloseBrowserSessionRoute = typeof closeBrowserSession;
export type UpdateUserPlanRoute = typeof updateUserPlan;
