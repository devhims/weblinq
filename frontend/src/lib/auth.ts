import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';

/* ------------------------------------------------------------------ */
/*  Environment Detection for Preview vs Production                   */
/* ------------------------------------------------------------------ */

// Use VERCEL_ENV when it exists, otherwise fall back to NODE_ENV
const runtimeEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

const isPreview = runtimeEnv === 'preview';
const isProd = runtimeEnv === 'production';
const isDev = runtimeEnv === 'development';

const previewHost = process.env.VERCEL_URL;
const productionHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || 'www.weblinq.dev';

const FRONTEND_URL = isPreview
  ? `https://${previewHost}`
  : isProd
    ? `https://${productionHost}`
    : 'http://localhost:3000';

const SECRET = process.env.BETTER_AUTH_SECRET!;

/* ------------------------------------------------------------------ */
/*  Frontend Better Auth Instance (Preview Environments Only)        */
/*  This handles email/password auth when backend cookies don't work  */
/* ------------------------------------------------------------------ */

export const auth = betterAuth({
  /* Local database for preview environments */
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),

  /* Use same secret as backend for consistency */
  secret: SECRET,

  /* Frontend URL for callbacks */
  baseURL: FRONTEND_URL,

  /* Allow requests from current environment */
  trustedOrigins: [FRONTEND_URL],

  /* Cookie settings for current domain only */
  advanced: {
    crossSubDomainCookies: { enabled: false }, // Host-only cookies
    defaultCookieAttributes: {
      domain: undefined, // Host-only cookies for preview domains
      sameSite: 'lax',
      secure: isProd || isPreview, // secure if HTTPS
      httpOnly: true,
      path: '/',
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh after 24 h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  /* Email/password authentication for preview environments */
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: false, // Simplified for preview
  },

  /* Next.js integration */
  plugins: [nextCookies()],
});

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check if we're in production where we should use backend auth
 */
export function shouldUseBackendAuth(): boolean {
  return isProd;
}
