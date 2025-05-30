import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Authentication'];

// Schema for email/password sign-in request
const emailSignInSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  callbackURL: z.string().optional(),
});

// Schema for email/password sign-up request
const emailSignUpSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').optional(),
  callbackURL: z.string().optional(),
});

// Schema for sign-out request
const signOutSchema = z.object({
  callbackURL: z.string().optional(),
});

// Schema for auth success response
const authSuccessSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  redirectUrl: z.string().optional(),
});

// Schema for auth error response
const authErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

// Email/Password Sign-in Route
export const emailSignIn = createRoute({
  path: '/email/signin',
  method: 'post',
  tags,
  summary: 'Sign in with email and password',
  description: 'Authenticate user with email and password credentials',
  request: {
    body: jsonContent(emailSignInSchema, 'Email sign-in credentials'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(authSuccessSchema, 'Sign-in successful'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      authErrorSchema,
      'Invalid credentials',
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      authErrorSchema,
      'Invalid request data',
    ),
  },
});

// Email/Password Sign-up Route
export const emailSignUp = createRoute({
  path: '/email/signup',
  method: 'post',
  tags,
  summary: 'Sign up with email and password',
  description: 'Create a new user account with email and password',
  request: {
    body: jsonContent(emailSignUpSchema, 'Email sign-up credentials'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      authSuccessSchema,
      'Account created successfully',
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      authErrorSchema,
      'Email already exists',
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      authErrorSchema,
      'Invalid request data',
    ),
  },
});

// Sign-out Route
export const signOut = createRoute({
  path: '/signout',
  method: 'post',
  tags,
  summary: 'Sign out current user',
  description: 'Sign out the currently authenticated user',
  request: {
    body: jsonContent(signOutSchema, 'Sign-out options'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(authSuccessSchema, 'Sign-out successful'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      authErrorSchema,
      'Sign-out failed',
    ),
  },
});

// Session Status Route
export const getSession = createRoute({
  path: '/session',
  method: 'get',
  tags,
  summary: 'Get current session status',
  description: 'Returns the current authentication session information',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        user: z.any().nullable(),
        session: z.any().nullable(),
        isAuthenticated: z.boolean(),
      }),
      'Session information',
    ),
  },
});

// GitHub OAuth Sign-in Route
export const githubSignIn = createRoute({
  path: '/github/signin',
  method: 'get',
  tags,
  summary: 'Initiate GitHub OAuth sign-in',
  description: 'Redirects to GitHub OAuth authorization page',
  request: {
    query: z.object({
      callbackURL: z.string().optional(),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to GitHub OAuth',
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      authErrorSchema,
      'GitHub OAuth initiation failed',
    ),
  },
});

// GitHub OAuth Callback Route
export const githubCallback = createRoute({
  path: '/github/callback',
  method: 'get',
  tags,
  summary: 'Handle GitHub OAuth callback',
  description: 'Processes the callback from GitHub OAuth',
  request: {
    query: z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'Redirect after successful authentication',
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      authErrorSchema,
      'OAuth callback error',
    ),
  },
});

export type GithubSignInRoute = typeof githubSignIn;
export type GithubCallbackRoute = typeof githubCallback;
export type EmailSignInRoute = typeof emailSignIn;
export type EmailSignUpRoute = typeof emailSignUp;
export type SignOutRoute = typeof signOut;
export type GetSessionRoute = typeof getSession;
