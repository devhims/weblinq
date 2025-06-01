import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';
import { db } from '@/db'; // your drizzle instance

// Detect environment for cookie configuration
const isProduction = process.env.NODE_ENV === 'production';

// ✅ CRITICAL: Backend URL for cross-domain requests
const backendUrl = isProduction
  ? 'https://weblinq-production.thinktank-himanshu.workers.dev'
  : 'http://localhost:8787';

export const auth = betterAuth({
  // ✅ CRITICAL: Set baseURL to backend for cross-domain auth
  baseURL: `${backendUrl}/api/auth`,

  // ✅ CRITICAL: Set trusted origins for CSRF protection
  trustedOrigins: [
    'https://weblinq.vercel.app', // Production frontend
    'http://localhost:3000', // Development frontend
    backendUrl, // Backend URL
  ],

  database: drizzleAdapter(db, {
    provider: 'sqlite',
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

  // ✅ CRITICAL: Cross-domain cookie configuration
  advanced: {
    defaultCookieAttributes: {
      // MUST be 'none' for cross-domain requests in production
      sameSite: isProduction ? 'none' : 'lax',
      // MUST be true for production HTTPS cross-domain
      secure: isProduction,
      httpOnly: true,
      path: '/',
      // Enable partitioned cookies for cross-site requests
      partitioned: isProduction,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    // Force secure cookies in production
    useSecureCookies: isProduction,
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

// For frontend components, you'll need to create a client that connects to this auth server
// The auth server handles requests at /api/auth/* routes

/**
 * Helper function to create a session token for backend API calls
 * This encodes the current user session into a format the backend can validate
 */
export async function createSessionToken(): Promise<string | null> {
  try {
    // Get current session from frontend auth
    const session = await auth.api.getSession({
      headers: new Headers(), // Empty headers for client-side call
    });

    if (!session) {
      return null;
    }

    // Create token payload
    const tokenData = {
      userId: session.user.id,
      email: session.user.email,
      timestamp: Date.now(),
    };

    // Encode as base64
    return btoa(JSON.stringify(tokenData));
  } catch (error) {
    console.error('Failed to create session token:', error);
    return null;
  }
}

/**
 * Helper function to make authenticated requests to the backend
 * Automatically includes the session token header
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const sessionToken = await createSessionToken();

  const headers = new Headers(options.headers);
  if (sessionToken) {
    headers.set('X-Session-Token', sessionToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Also send any cookies
  });
}
