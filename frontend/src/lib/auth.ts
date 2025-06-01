import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
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

  // Trust origins (only frontend for now)
  trustedOrigins: [
    process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
  ],

  // Enable email/password authentication
  emailAndPassword: {
    enabled: true,
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

  // Session configuration optimized for frontend
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    freshAge: 10 * 60, // 10 minutes
  },

  // Cookie configuration for same-domain (much simpler!)
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax', // Can use lax since it's same domain
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
  },

  // Use Next.js cookies plugin for better integration
  plugins: [nextCookies()],
});
