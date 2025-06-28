import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['API Keys'];

// Schema for API key creation request - simplified to only user-configurable fields
const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

// Schema for API key response - shows what users can see
const apiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable().describe('First few characters of the key for identification'),
  prefix: z.string().nullable(),
  userId: z.string(),
  enabled: z.boolean(),
  requestCount: z.number(),
  remaining: z.number().nullable().describe('Remaining uses (if limited)'),
  lastRequest: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.any()).nullable(),
  // Note: Rate limiting details, permissions, and internal configs are not exposed
});

// Schema for API key creation response (includes the actual key)
const apiKeyCreationResponseSchema = apiKeyResponseSchema.extend({
  key: z.string().describe('Complete API key - shown only once during creation'),
});

// Schema for error response
const errorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

// Create API Key Route
export const createApiKey = createRoute({
  path: '/create',
  method: 'post',
  tags,
  summary: 'Create a new API key',
  description:
    'Create a new API key for the authenticated user. System defaults: wq_ prefix, 1000 requests per 24 hours rate limit, no expiration, free plan metadata.',
  request: {
    body: jsonContent(createApiKeySchema, 'API key creation parameters'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(apiKeyCreationResponseSchema, 'API key created successfully'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema, 'Invalid request data'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, 'Authentication required'),
  },
});

// List API Keys Route
export const listApiKeys = createRoute({
  path: '/list',
  method: 'get',
  tags,
  summary: 'List user API keys',
  description: 'Get all API keys for the authenticated user',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        apiKeys: z.array(apiKeyResponseSchema),
        total: z.number(),
      }),
      'List of API keys',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, 'Authentication required'),
  },
});

// Get API Key Route
export const getApiKey = createRoute({
  path: '/{id}',
  method: 'get',
  tags,
  summary: 'Get API key details',
  description: 'Get details of a specific API key',
  request: {
    params: z.object({
      id: z.string().min(1, 'API key ID is required'),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(apiKeyResponseSchema, 'API key details'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'API key not found'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, 'Authentication required'),
  },
});

// Delete API Key Route
export const deleteApiKey = createRoute({
  path: '/{id}',
  method: 'delete',
  tags,
  summary: 'Delete API key',
  description: 'Delete an existing API key. Note: API keys cannot be updated - create a new one if needed.',
  request: {
    params: z.object({
      id: z.string().min(1, 'API key ID is required'),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      'API key deleted successfully',
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'API key not found'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema, 'Authentication required'),
  },
});

export type CreateApiKeyRoute = typeof createApiKey;
export type ListApiKeysRoute = typeof listApiKeys;
export type GetApiKeyRoute = typeof getApiKey;
export type DeleteApiKeyRoute = typeof deleteApiKey;

// Note: UpdateApiKey route removed - users should create new keys instead
