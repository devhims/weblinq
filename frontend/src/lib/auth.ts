import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db } from '@/db';

export const auth = betterAuth({
  // Simple database setup for frontend auth
  // In development, this creates a local SQLite file
  // In production, you'd use your production database URL
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),

  // Secret for JWT signing and session encryption
  secret: process.env.BETTER_AUTH_SECRET || 'your-secret-key-here',

  // Base URL for the frontend auth endpoints
  baseURL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',

  // ✅ Trust both frontend and backend for session verification
  trustedOrigins: [
    process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
    'https://weblinq.vercel.app',
    'https://weblinq-production.thinktank-himanshu.workers.dev',
    'http://localhost:3000',
    'http://localhost:8787',
  ],

  // ✅ Same-domain cookies only - cross-domain won't work with different domains
  advanced: {
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // Use lax for same-domain
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
  },

  // GitHub OAuth configuration
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Now this can be the frontend URL directly (same domain)
      redirectURI: `${
        process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
      }/api/auth/callback/github`,
    },
  },

  // Email/password auth for development
  emailAndPassword: {
    enabled: true,
  },

  // Session configuration that matches backend
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    freshAge: 10 * 60, // 10 minutes
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // Use Next.js cookies plugin and bearer plugin for cross-domain support
  plugins: [nextCookies(), bearer()],
});

export const { handler, api } = auth;
