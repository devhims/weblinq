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

const isProd = process.env.NODE_ENV === 'production';

/* ------------------------------------------------------------------ */
/* 1.  Values you share with the Cloudflare-Worker back-end            */
/* ------------------------------------------------------------------ */
const FRONTEND_URL = isProd
  ? 'https://www.weblinq.dev'
  : 'http://localhost:3000'; // Fixed: was missing 'www'
const BACKEND_URL = isProd
  ? 'https://api.weblinq.dev'
  : 'http://localhost:8787';
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
  trustedOrigins: [FRONTEND_URL, BACKEND_URL],

  /* cookie settings that survive Safari + Incognito */
  advanced: {
    /*  ← one flag to spread the cookie to every sub-domain in prod   */
    crossSubDomainCookies: { enabled: isProd },

    // Global cookie attributes for Better Auth
    defaultCookieAttributes: {
      domain: isProd ? '.weblinq.dev' : undefined, // leading "." = any sub-domain
      sameSite: 'lax', // "same-site", so Safari accepts it
      secure: isProd, // Safari requires Secure for cross-sub-domain cookies
      httpOnly: true, // Security best practice
      path: '/', // Available site-wide
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
