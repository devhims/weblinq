import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

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

// Schema for user credits response
const userCreditsSchema = z.object({
  balance: z.number(),
  plan: z.enum(['free', 'pro']),
  lastRefill: z.date().nullable(),
});

// Schema for email verification request
const verifyEmailSchema = z.object({
  email: z.string().email(),
});

// Schema for email verification response
const emailVerificationSchema = z.object({
  exists: z.boolean(),
  email: z.string().email(),
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

export const getCredits = createRoute({
  path: '/credits',
  method: 'get',
  tags,
  security,
  summary: 'Get user credit information',
  description: 'Returns the current user credit balance, plan, and last refill date.',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createStandardSuccessSchema(userCreditsSchema), 'User credits information'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const bootstrapCredits = createRoute({
  path: '/bootstrap-credits',
  method: 'post',
  tags,
  security,
  summary: 'Bootstrap credits for existing users',
  description: 'Assign initial credits to existing users who do not have credits yet.',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createStandardSuccessSchema(z.object({})), 'Credits bootstrapped successfully'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(StandardErrorSchema, 'Authentication required'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const verifyEmail = createRoute({
  path: '/verify-email',
  method: 'post',
  tags,
  summary: 'Verify if email exists',
  description: 'Check if a user account exists for the given email address.',
  request: {
    body: jsonContent(verifyEmailSchema, 'Email verification parameters'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createStandardSuccessSchema(emailVerificationSchema),
      'Email verification result',
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(verifyEmailSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export const verifyEmailToken = createRoute({
  path: '/verify-email-token',
  method: 'get',
  tags,
  summary: 'Verify email with token and redirect',
  description:
    'Custom email verification handler that processes the token and redirects to frontend dashboard with new_user parameter.',
  request: {
    query: z.object({
      token: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: 'Redirect to dashboard or sign-in',
      headers: z.object({
        Location: z.string(),
      }),
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(StandardErrorSchema, 'Missing or invalid token'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(StandardErrorSchema, 'Internal server error'),
  },
});

export type GetMeRoute = typeof getMe;
export type GetCreditsRoute = typeof getCredits;
export type BootstrapCreditsRoute = typeof bootstrapCredits;
export type VerifyEmailRoute = typeof verifyEmail;
export type VerifyEmailTokenRoute = typeof verifyEmailToken;
