import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { StandardErrorSchema } from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['User'];

// Security requirement for protected routes
const security = [{ bearerAuth: [] }];

// Schema for user session response
const userSessionSchema = z.object({
  user: z.any().nullable(),
  session: z.any().nullable(),
  apiToken: z.any().nullable(),
  authType: z.enum(['session', 'api-token', 'none']),
  isAuthenticated: z.boolean(),
});

// Schema for protected user response
const userProfileSchema = z.object({
  user: z.any(),
  session: z.any().nullable(),
  authType: z.enum(['session', 'api-token']),
  message: z.string(),
});

export const getMe = createRoute({
  path: '/me',
  method: 'get',
  tags,
  summary: 'Get current user information',
  description:
    'Returns the current authenticated user information or null if not authenticated. Supports both session-based (browser) and API token-based (server-to-server) authentication.',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(userSessionSchema, 'User information'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const getProfile = createRoute({
  path: '/profile',
  method: 'get',
  tags,
  security,
  summary: 'Get user profile (protected)',
  description:
    'Returns detailed user profile information. Requires authentication via either session cookies or API token (Bearer token in Authorization header).',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(userProfileSchema, 'User profile information'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export type GetMeRoute = typeof getMe;
export type GetProfileRoute = typeof getProfile;
