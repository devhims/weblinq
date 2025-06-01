/* eslint-disable node/no-process-env */

/**
 * Simplified auth configuration for backend API-only use.
 *
 * This handles:
 * - API key validation for protected routes
 * - Session verification (validating sessions created by frontend)
 * - No OAuth or user authentication (handled by frontend)
 */

import type { BetterAuthOptions } from 'better-auth';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';

import { createDb } from '@/db';
import * as schema from '@/db/schema';

interface BackendAuthParams {
  secret?: string;
  baseURL?: string;
  database?: any;
  frontendUrl?: string;
}

export function createBackendAuthConfig(
  params: BackendAuthParams,
): BetterAuthOptions {
  return {
    secret: params.secret,
    baseURL: params.baseURL,

    // Trust frontend for session verification
    trustedOrigins: [params.frontendUrl!, 'http://localhost:3000'],

    // No email/password auth (handled by frontend)
    emailAndPassword: {
      enabled: false,
    },

    // No social providers (handled by frontend)
    socialProviders: {},

    database: params.database,

    // Session config for verification only
    session: {
      cookieCache: {
        enabled: false, // Backend doesn't need cookie cache
      },
      freshAge: 0, // Always verify sessions
    },

    // Simple cookie config for session verification
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: params.baseURL?.includes('https'),
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },

    plugins: [
      // API Key plugin for protected routes
      apiKey({
        enableMetadata: true,
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

export function createBackendAuth(env: CloudflareBindings) {
  console.warn('🔧 Creating backend auth instance (API-only)...');

  try {
    const db = createDb(env);
    console.warn('✅ Database instance created:', !!db);

    const adapter = drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    });
    console.warn('✅ Drizzle adapter created:', !!adapter);

    const config = createBackendAuthConfig({
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      frontendUrl: env.FRONTEND_URL,
      database: adapter,
    });
    console.warn('✅ Backend auth config created');

    const authInstance = betterAuth(config);
    console.warn('✅ Backend auth instance created:', !!authInstance);

    return authInstance;
  } catch (error) {
    console.error('❌ Error creating backend auth instance:', error);
    throw error;
  }
}

// Export for CLI use (simplified)
export const auth = betterAuth(
  createBackendAuthConfig({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    frontendUrl: process.env.FRONTEND_URL,
    database: drizzleAdapter({} as any, {
      provider: 'sqlite',
    }),
  }),
);

// API Key object type
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
