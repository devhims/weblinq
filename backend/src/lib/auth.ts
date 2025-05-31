/* eslint-disable node/no-process-env */

/**
 * Auth configuration for better-auth.
 *
 * This module provides a shared configuration that can be used both:
 * 1. In Cloudflare Workers (via createAuth function with env bindings)
 * 2. By the better-auth CLI (via exported auth instance with process.env)
 *
 * This ensures a single source of truth for auth configuration.
 */

import type { BetterAuthOptions } from 'better-auth';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';

import { createDb } from '@/db';
import * as schema from '@/db/schema';

interface AuthConfigParams {
  githubClientId: string;
  githubClientSecret: string;
  secret?: string;
  baseURL?: string;
  database?: any;
  frontendUrl?: string;
}

export function createAuthConfig(params: AuthConfigParams): BetterAuthOptions {
  const trustedOrigins = [params.frontendUrl!, 'http://localhost:3000'];

  return {
    secret: params.secret,
    baseURL: params.baseURL,
    // Allow requests from the frontend - use environment variable
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: params.githubClientId,
        clientSecret: params.githubClientSecret,
        // OAuth-specific configuration for incognito mode
        redirectURI: `${params.baseURL}/api/auth/callback/github`,
      },
    },
    database: params.database,
    // Configure cookies for cross-domain requests
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
        // Enable partitioning for incognito mode compatibility
        partitioned: true,
        // Let browser handle domain for better compatibility
        domain: undefined,
        // Add httpOnly for security
        httpOnly: true,
      },
      // OAuth-specific cookie configuration
      cookies: {
        // Configure the OAuth state cookie specifically for incognito mode
        'oauth-state': {
          name: 'better-auth.oauth-state',
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            partitioned: true,
            // Shorter maxAge for OAuth state (5 minutes)
            maxAge: 300,
          },
        },
        // Configure PKCE cookies for OAuth flow
        'pkce-code-verifier': {
          name: 'better-auth.pkce-code-verifier',
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            partitioned: true,
            maxAge: 300,
          },
        },
      },
    },
    plugins: [
      // API Key plugin - supports ONLY Authorization: Bearer headers
      apiKey({
        enableMetadata: true,
        // Extract API key from Authorization: Bearer header using the correct property
        customAPIKeyGetter(ctx) {
          const bearer_token = ctx.headers?.get('Authorization');
          if (!bearer_token) {
            return null;
          }
          const token = bearer_token.split(' ');
          if (token[0] !== 'Bearer') {
            return null;
          }
          if (token.length !== 2) {
            return null;
          }
          return token[1];
        },
        rateLimit: {
          enabled: true,
          timeWindow: 1000 * 60 * 60 * 24, // 24 hours
          maxRequests: 1000,
        },
      }),
    ],
  };
}

export type { AuthConfigParams };

export function createAuth(env: CloudflareBindings) {
  const db = createDb(env); // create db per request
  const config = createAuthConfig({
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    frontendUrl: env.FRONTEND_URL,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
  });

  return betterAuth(config);
}

export const auth = betterAuth(
  createAuthConfig({
    githubClientId: process.env.GITHUB_CLIENT_ID!,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET!,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter({} as any, {
      provider: 'sqlite',
    }),
  }),
);

// API Key object type based on better-auth plugin schema
export interface ApiKey {
  id: string;
  name?: string;
  start?: string;
  prefix?: string;
  userId: string;
  refillInterval?: number;
  refillAmount?: number;
  lastRefillAt?: Date;
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitTimeWindow?: number;
  rateLimitMax?: number;
  requestCount: number;
  remaining?: number;
  lastRequest?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  permissions?: Record<string, string[]>;
  metadata?: Record<string, any>;
}
