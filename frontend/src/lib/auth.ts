import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import {
  sendEmail,
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from './email';

// Vercel sets NODE_ENV="production" for preview deployments as well, so we
// need a separate flag for them. In preview we *do not* want cross-sub-domain
// cookies or a fixed ".weblinq.dev" cookie domain because the preview host is
// something like "weblinq-pr-123-devhims-projects.vercel.app".

const isPreview = process.env.VERCEL_ENV === 'preview';
const isProd = process.env.NODE_ENV === 'production' && !isPreview; // real prod only

/* ------------------------------------------------------------------ */
/* 1.  Values you share with the Cloudflare-Worker back-end            */
/* ------------------------------------------------------------------ */
const FRONTEND_URL = isPreview
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` // e.g. weblinq-pr-123-devhims-projects.vercel.app
  : isProd
  ? 'https://www.weblinq.dev'
  : 'http://localhost:3000';
const BACKEND_URL = isProd ? 'https://api.weblinq.dev' : 'http://localhost:8787';
const SECRET = process.env.BETTER_AUTH_SECRET!;

/* ------------------------------------------------------------------ */
/* 2.  Better Auth                                                     */
/* ------------------------------------------------------------------ */
export const auth = betterAuth({
  /* database → simple Drizzle adapter for SQLite in dev, Postgres in prod */
  database: drizzleAdapter(db, {
    provider: 'sqlite', // Explicitly set provider for clarity
  }),

  /* cryptographic key that signs every cookie & JWT */
  secret: SECRET,

  /* where Better Auth should generate links & OAuth callbacks */
  baseURL: FRONTEND_URL,

  /* allow only our two origins to hit the built-in auth routes */
  // Accept calls from our own host (prod, preview, or localhost) and from the
  // backend Worker domain. FRONTEND_URL already reflects preview environment.
  trustedOrigins: [FRONTEND_URL, BACKEND_URL],

  /* cookie settings that survive Safari + Incognito */
  advanced: {
    /* Spread cookies only in real production. Preview & dev use host-only cookies */
    crossSubDomainCookies: { enabled: isProd },

    // Global cookie attributes for Better Auth
    defaultCookieAttributes: {
      domain: isProd ? '.weblinq.dev' : undefined,
      sameSite: 'lax',
      secure: isProd, // secure if we are on HTTPS (prod)
      httpOnly: true,
      path: '/',
    },
  },

  /* built-in auth modes – _no_ plugin calls needed in v1 */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendPasswordResetEmail(url, user.email);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      console.log('Sending verification email with URL:', url);
      await sendVerificationEmail(url, user.email);
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Better Auth auto-builds the callback from baseURL, so no redirectURI here
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  /* Next-specific helper that refreshes React cache after auth events */
  plugins: [nextCookies()],
});

/* typed helpers you'll import elsewhere */
export const { handler, api } = auth;
