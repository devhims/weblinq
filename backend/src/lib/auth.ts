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
import { apiKey, bearer, oAuthProxy } from 'better-auth/plugins';

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
  const trustedOrigins = [
    params.frontendUrl!,
    'http://localhost:3000',
    'https://weblinq.vercel.app',
    'https://weblinq-production.thinktank-himanshu.workers.dev',
  ];

  // Detect if we're running in local development
  const isLocalDevelopment =
    params.baseURL?.includes('localhost') ||
    params.baseURL?.includes('127.0.0.1');

  // Detect if we're in production environment
  const isProduction = !isLocalDevelopment;

  console.warn('🔧 Auth configuration:', {
    isProduction,
    baseURL: params.baseURL,
    frontendUrl: params.frontendUrl,
    trustedOrigins,
  });

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
        redirectURI: `${params.frontendUrl}/api/auth/callback/github`,
      },
    },

    database: params.database,

    // ✅ Session configuration that matches frontend for token compatibility
    session: {
      cookieCache: {
        enabled: true, // Match frontend
        maxAge: 5 * 60, // 5 minutes - match frontend
      },
      freshAge: 10 * 60, // 10 minutes - match frontend
      expiresIn: 60 * 60 * 24 * 7, // 7 days - match frontend
      updateAge: 60 * 60 * 24, // 1 day - match frontend
    },

    // ✅ Standard cookie configuration (no cross-domain complexity needed with proxy)
    advanced: {
      defaultCookieAttributes: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax', // Standard same-site setting
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      useSecureCookies: isProduction,
    },

    plugins: [
      // Bearer plugin - enables session token via Authorization header (for cross-domain)
      bearer(),
      // API Key plugin - supports ONLY Authorization: Bearer headers with API key format
      apiKey({
        enableMetadata: true,
        // ✅ CRITICAL: Only extract API keys, not session tokens
        // Better Auth bearer plugin handles session tokens automatically
        customAPIKeyGetter(ctx) {
          const authHeader = ctx.headers?.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
          }

          const token = authHeader.substring(7); // Remove 'Bearer ' prefix

          // ✅ Only treat as API key if it matches our expected format
          // API keys should have a prefix (like 'wq_') and be longer than session tokens
          // Session tokens are typically shorter and don't have our prefix
          if (
            token.includes('wq_') ||
            (token.length > 40 && token.includes('_'))
          ) {
            console.log(
              '🔑 Treating as API key:',
              `${token.substring(0, 10)}...`,
            );
            return token;
          }

          // Let bearer plugin handle session tokens
          console.log('🔓 Letting bearer plugin handle session token');
          return null;
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
  console.warn('🔧 Creating auth instance...');

  try {
    const db = createDb(env); // create db per request
    console.warn('✅ Database instance created:', !!db);
    console.warn('🔧 Database binding available:', !!env.D1_DB);

    const adapter = drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    });
    console.warn('✅ Drizzle adapter created:', !!adapter);

    const config = createAuthConfig({
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      frontendUrl: env.FRONTEND_URL,
      database: adapter,
    });
    console.warn('✅ Auth config created');

    const authInstance = betterAuth(config);
    console.warn('✅ Better Auth instance created:', !!authInstance);
    console.warn('✅ Auth API available:', !!authInstance.api);

    return authInstance;
  } catch (error) {
    console.error('❌ Error creating auth instance:', error);
    throw error;
  }
}

export const auth = betterAuth(
  createAuthConfig({
    githubClientId: process.env.GITHUB_CLIENT_ID!,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET!,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    frontendUrl: process.env.FRONTEND_URL,
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
