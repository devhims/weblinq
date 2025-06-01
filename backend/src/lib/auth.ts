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

  // Detect if we're running in local development
  const isLocalDevelopment =
    params.baseURL?.includes('localhost') ||
    params.baseURL?.includes('127.0.0.1');

  // Detect if we're in production environment
  const isProduction = !isLocalDevelopment;

  // For production, check if frontend and backend are on different domains
  let isDifferentDomain = false;
  let cookieDomain: string | undefined;

  if (!isLocalDevelopment && params.frontendUrl && params.baseURL) {
    try {
      const frontendUrl = new URL(params.frontendUrl);
      const backendUrl = new URL(params.baseURL);

      // Extract root domain (e.g., "example.com" from "app.example.com")
      const frontendDomain = frontendUrl.hostname
        .split('.')
        .slice(-2)
        .join('.');
      const backendDomain = backendUrl.hostname.split('.').slice(-2).join('.');

      // Check if they're completely different domains
      isDifferentDomain = frontendDomain !== backendDomain;

      // Only set cookieDomain if they share the same root domain (subdomain case)
      if (!isDifferentDomain) {
        cookieDomain = `.${frontendDomain}`;
      }

      console.warn('🔧 Domain analysis:', {
        frontend: frontendUrl.hostname,
        backend: backendUrl.hostname,
        frontendDomain,
        backendDomain,
        isDifferentDomain,
        cookieDomain,
      });
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
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: params.githubClientId,
        clientSecret: params.githubClientSecret,
        redirectURI: `${params.baseURL}/api/auth/callback/github`,
      },
    },
    database: params.database,
    // Enable cookie cache for better performance and disable in debug if needed
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      // ✅ CRITICAL: Disable freshness check for cross-domain
      freshAge: 0,
    },
    // ✅ CRITICAL: Backend cookie config must support cross-domain cookies
    advanced: {
      defaultCookieAttributes: {
        // ✅ CRITICAL: For cross-domain (different domains), always use 'none'
        // For same domain/subdomain, use 'lax'
        sameSite: isProduction && isDifferentDomain ? 'none' : 'lax',
        // ✅ CRITICAL: Must be secure for SameSite=none and production
        secure: isProduction,
        // ✅ CRITICAL: Enable partitioned cookies for cross-domain requests
        partitioned: isProduction && isDifferentDomain,
        // Only set domain for subdomain sharing, not cross-domain
        domain: cookieDomain,
        httpOnly: true,
        path: '/',
        // ✅ CRITICAL: Same maxAge as frontend for session consistency
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      // Force secure cookies in production
      useSecureCookies: isProduction,
      // ✅ CRITICAL: Only enable cross-subdomain for same root domain
      crossSubDomainCookies: cookieDomain
        ? {
            enabled: true,
            domain: cookieDomain,
          }
        : undefined,
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
