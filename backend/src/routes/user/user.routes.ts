import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { createStandardSuccessSchema, StandardErrorSchema } from '@/lib/response-utils';
import { createRoute, z } from '@hono/zod-openapi';

const tags = ['User'];

// Security requirement for protected routes
const security = [{ bearerAuth: [] }];

// Schema for user session response that works with both auth methods
const userInfoSchema = z.object({
  user: z.any().nullable(),
  session: z.any().nullable(),
  apiToken: z.any().nullable(),
  authType: z.enum(['session', 'api-token', 'none']),
  isAuthenticated: z.boolean(),
  message: z.string().optional(),
});

export const getMe = createRoute({
  path: '/me',
  method: 'get',
  tags,
  security,
  summary: 'Get current user information',
  description:
    'Returns the current user information. Works with both session-based authentication (browser) and API token-based authentication (server-to-server). Returns user details if authenticated, or guest info if not authenticated.',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createStandardSuccessSchema(userInfoSchema), 'User information'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export type GetMeRoute = typeof getMe;
