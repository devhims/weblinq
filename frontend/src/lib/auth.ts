import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db } from '@/db';

// Detect environment
const isProduction = process.env.NODE_ENV === 'production';

// Environment-specific URLs
const frontendUrl =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  (isProduction ? 'https://www.weblinq.dev' : 'http://localhost:3000');
const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (isProduction ? 'https://api.weblinq.dev' : 'http://localhost:8787');

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
  baseURL: frontendUrl,

  // ✅ Environment-specific trusted origins
  trustedOrigins: [
    frontendUrl,
    backendUrl,
    // Always include localhost for development
    'http://localhost:3000',
    'http://localhost:8787',
    // Production domains
    'https://www.weblinq.dev',
    'https://api.weblinq.dev',
  ],

  // ✅ Environment-specific cookie configuration
  advanced: {
    // Only enable cross-subdomain cookies in production
    ...(isProduction && {
      crossSubDomainCookies: {
        enabled: true,
      },
    }),
    defaultCookieAttributes: {
      // Only set domain in production for subdomain sharing
      ...(isProduction && { domain: '.weblinq.dev' }),
      // In development, don't set domain to work with localhost
      secure: isProduction, // Only secure in production
      httpOnly: true,
      sameSite: 'lax', // Use 'lax' for both dev and prod
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    useSecureCookies: isProduction,
  },

  // GitHub OAuth configuration
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Frontend handles the OAuth callback
      redirectURI: `${frontendUrl}/api/auth/callback/github`,
    },
  },

  // Email/password auth for development
  emailAndPassword: {
    enabled: true,
  },

  // Session configuration that supports both local dev and production
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    freshAge: 10 * 60, // 10 minutes
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // Use Next.js cookies plugin and bearer plugin
  plugins: [bearer(), nextCookies()],
});

export const { handler, api } = auth;
