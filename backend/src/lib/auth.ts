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
  const trustedOrigins = [
    'https://weblinq.vercel.app/',
    'http://localhost:3000',
  ];

  // Detect if we're running in local development
  const isLocalDevelopment =
    params.baseURL?.includes('localhost') ||
    params.baseURL?.includes('127.0.0.1');

  // Detect if we're in production environment
  const isProduction = !isLocalDevelopment;

  // For production, we need to extract the domain from frontendUrl
  let cookieDomain: string | undefined;
  if (!isLocalDevelopment && params.frontendUrl) {
    try {
      const url = new URL(params.frontendUrl);
      // If frontend and backend are on the same domain, set the domain
      // If they're on different domains (e.g., subdomain), don't set domain
      const backendUrl = new URL(params.baseURL || '');

      // Extract root domain (e.g., "example.com" from "app.example.com")
      const frontendDomain = url.hostname.split('.').slice(-2).join('.');
      const backendDomain = backendUrl.hostname.split('.').slice(-2).join('.');

      // Only set domain if they share the same root domain
      if (frontendDomain === backendDomain) {
        cookieDomain = `.${frontendDomain}`;
      }
    } catch (error) {
      console.warn(
        'Could not parse frontend URL for domain extraction:',
        error,
      );
    }
  }

  return {
    secret: params.secret,
    baseURL: params.baseURL,
    // Allow requests from the frontend - use environment variable
    trustedOrigins: ['https://weblinq.vercel.app', 'http://localhost:3000'],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: params.githubClientId,
        clientSecret: params.githubClientSecret,
      },
    },
    database: params.database,
    // ✅ CRITICAL: Backend cookie config must match frontend for proper session sharing
    advanced: {
      defaultCookieAttributes: {
        // MUST match frontend: Use 'lax' for same-domain compatibility
        sameSite: isLocalDevelopment ? 'lax' : 'none',
        // MUST match frontend: Only secure in production
        secure: isProduction,
        // Enable partitioned cookies for production cross-site requests
        partitioned: !isLocalDevelopment,
        domain: cookieDomain,
        httpOnly: true,
        path: '/',
        // MUST match frontend: Same maxAge for session consistency
        maxAge: 60 * 60 * 24 * 7, // 7 days
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
  console.log('🔧 Creating auth instance...');

  try {
    const db = createDb(env); // create db per request
    console.log('✅ Database instance created:', !!db);
    console.log('🔧 Database binding available:', !!env.D1_DB);

    const adapter = drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    });
    console.log('✅ Drizzle adapter created:', !!adapter);

    const config = createAuthConfig({
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      frontendUrl: env.FRONTEND_URL,
      database: adapter,
    });
    console.log('✅ Auth config created');

    const authInstance = betterAuth(config);
    console.log('✅ Better Auth instance created:', !!authInstance);
    console.log('✅ Auth API available:', !!authInstance.api);

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
