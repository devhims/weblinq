// src/lib/auth.ts – minimal Worker-side Better Auth that works in dev & prod
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';

import { createDb } from '@/db';
import * as schema from '@/db/schema';

export function createAuth(env: CloudflareBindings) {
  /* ---------- environment detection ---------- */
  const isLocal = env.BETTER_AUTH_URL?.startsWith('http://localhost');

  /* ---------- database ---------- */
  const db = createDb(env);
  const adapter = drizzleAdapter(db, { provider: 'sqlite', schema });

  /* ---------- cookie block shared with Next.js ---------- */
  const cookieBase = {
    name: 'ba_session',
    sameSite: 'lax' as const, // safe on Safari & Incognito
    httpOnly: true,
    secure: !isLocal, // secure only on HTTPS
    domain: isLocal ? undefined : '.weblinq.dev', // drop Domain on localhost
  };

  return betterAuth({
    /* Where this instance lives */
    baseURL: env.BETTER_AUTH_URL, // e.g. https://api.weblinq.dev or http://localhost:8787

    /* Same secret as the front-end */
    secret: env.BETTER_AUTH_SECRET,

    /* CSRF / open-redirect guard */
    trustedOrigins: isLocal
      ? ['http://localhost:3000', 'http://localhost:8787']
      : ['https://www.weblinq.dev'], // Fixed: added 'www' to match frontend

    /* Share the cookie in prod, host-only in dev */
    advanced: {
      ...(isLocal
        ? { defaultCookieAttributes: cookieBase }
        : {
            crossSubDomainCookies: { enabled: true }, // Better Auth sets Domain=.weblinq.dev
            defaultCookieAttributes: cookieBase,
          }),
    },

    /* Cloudflare D1 via Drizzle */
    database: adapter,

    /* API-key support for backend-only routes */
    plugins: [
      apiKey({
        enableMetadata: true,
        customAPIKeyGetter: (ctx) =>
          ctx.headers?.get('Authorization')?.split(' ')[1] ?? null,
        rateLimit: {
          enabled: true,
          timeWindow: 86_400_000,
          maxRequests: 1_000,
        },
      }),
    ],
  });
}

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
