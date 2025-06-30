import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Monitoring'];

/**
 * Monitoring routes for API endpoint testing and performance analysis
 */

// Input schemas
const startMonitoringInputSchema = z.object({
  config: z
    .object({
      intervalMs: z
        .number()
        .int()
        .min(60000)
        .max(24 * 60 * 60 * 1000)
        .optional(), // 1 minute to 24 hours
      apiKey: z.string().min(1).optional(),
      timeoutMs: z.number().int().min(5000).max(120000).optional(), // 5 seconds to 2 minutes
      enabledEndpoints: z
        .array(z.enum(['screenshot', 'markdown', 'content', 'scrape', 'links', 'search', 'pdf']))
        .optional(),
    })
    .optional(),
});

const getResultsInputSchema = z.object({
  endpoint: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  successOnly: z.boolean().optional(),
  since: z.string().datetime().optional(),
});

// Output schemas
const monitoringResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

const monitoringStatusSchema = z.object({
  success: z.boolean(),
  data: z.object({
    isActive: z.boolean(),
    config: z.object({
      intervalMs: z.number(),
      apiBaseUrl: z.string(),
      apiKey: z.string(),
      timeoutMs: z.number(),
      enabledEndpoints: z.array(z.string()),
    }),
    sqlEnabled: z.boolean(),
    nextTestIn: z.number().nullable(),
    nextTestAt: z.string().nullable(),
  }),
  error: z.string().optional(),
});

const testResultsSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        endpoint: z.string(),
        testUrl: z.string(),
        success: z.boolean(),
        responseTimeMs: z.number(),
        statusCode: z.number().optional(),
        errorMessage: z.string().optional(),
        responseSize: z.number().optional(),
        creditsCost: z.number().optional(),
        timestamp: z.string(),
      }),
    ),
    totalCount: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
  error: z.string().optional(),
});

const endpointStatsSchema = z.object({
  success: z.boolean(),
  data: z.object({
    endpointStats: z.array(
      z.object({
        endpoint: z.string(),
        totalTests: z.number(),
        successfulTests: z.number(),
        failedTests: z.number(),
        successRate: z.string(),
        avgResponseTimeMs: z.number(),
        minResponseTimeMs: z.number(),
        maxResponseTimeMs: z.number(),
        lastSuccessTime: z.string().nullable(),
        lastFailureTime: z.string().nullable(),
        lastUpdated: z.string(),
      }),
    ),
    generatedAt: z.string(),
  }),
  error: z.string().optional(),
});

// Route definitions
export const startMonitoring = createRoute({
  path: '/monitoring/start',
  method: 'post',
  request: {
    body: jsonContentRequired(startMonitoringInputSchema, 'Monitoring configuration'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(monitoringResponseSchema, 'Monitoring started successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(startMonitoringInputSchema),
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

export const stopMonitoring = createRoute({
  path: '/monitoring/stop',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({}), 'Empty request body'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(monitoringResponseSchema, 'Monitoring stopped successfully'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const getMonitoringStatus = createRoute({
  path: '/monitoring/status',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({}), 'Empty request body'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(monitoringStatusSchema, 'Monitoring status retrieved successfully'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const getTestResults = createRoute({
  path: '/monitoring/results',
  method: 'post',
  request: {
    body: jsonContentRequired(getResultsInputSchema, 'Results query parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(testResultsSchema, 'Test results retrieved successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(getResultsInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const getEndpointStats = createRoute({
  path: '/monitoring/stats',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({}), 'Empty request body'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(endpointStatsSchema, 'Endpoint statistics retrieved successfully'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const runManualTest = createRoute({
  path: '/monitoring/test',
  method: 'post',
  request: {
    body: jsonContentRequired(z.object({}), 'Empty request body'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(monitoringResponseSchema, 'Manual test completed successfully'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export type StartMonitoringRoute = typeof startMonitoring;
export type StopMonitoringRoute = typeof stopMonitoring;
export type GetMonitoringStatusRoute = typeof getMonitoringStatus;
export type GetTestResultsRoute = typeof getTestResults;
export type GetEndpointStatsRoute = typeof getEndpointStats;
export type RunManualTestRoute = typeof runManualTest;
