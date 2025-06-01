import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';
import { db } from '@/db'; // your drizzle instance

// Detect environment for cookie configuration
const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  // NO baseURL needed - uses current domain's /api/auth/* routes
  database: drizzleAdapter(db, {
    provider: 'sqlite', // or "mysql", "sqlite"
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },

  // ✅ CRITICAL: Even same-domain needs cookie config for Safari/incognito
  advanced: {
    defaultCookieAttributes: {
      // Use 'lax' for same-domain (works better than 'strict' for redirects)
      sameSite: 'lax',
      // Only secure in production (HTTPS required)
      secure: isProduction,
      httpOnly: true,
      path: '/',
      // Longer maxAge for better session persistence
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },

  plugins: [
    // API Key plugin for consistency with backend
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
});
