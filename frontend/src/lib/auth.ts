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

  // ✅ CRITICAL: Frontend auth cookie config for same-domain
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
