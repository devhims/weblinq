import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { assignInitialCredits } from '@/db/queries';

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
/*  Development-specific WebDurableObject initialization             */
/* ------------------------------------------------------------------ */

/**
 * Initialize WebDurableObject for development environment
 *
 * This calls the backend API to handle the initialization since frontend
 * doesn't have access to CloudflareBindings. In development, we use an
 * admin API key to authenticate since durable objects are not stable.
 */
async function initializeWebDurableObjectDev(userId: string): Promise<void> {
  try {
    console.log(
      `🔧 [Frontend] Initializing WebDurableObject for user ${userId} via backend API...`,
    );

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

    // Get admin API key for development environments
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (!adminApiKey && isDev) {
      console.warn(
        `⚠️ [Frontend] No ADMIN_API_KEY found for development. User initialization skipped.`,
      );
      console.warn(
        `💡 [Frontend] Add ADMIN_API_KEY to your .env.local file for automatic user initialization`,
      );
      return;
    }

    // Prepare headers - use admin API key for development, session cookies for preview/prod
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (adminApiKey && isDev) {
      headers['Authorization'] = `Bearer ${adminApiKey}`;
      console.log(
        `🔑 [Frontend] Using admin API key for development user initialization`,
      );
    }

    // Make API call to trigger initialization
    const response = await fetch(`${backendUrl}/v1/user/initialize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
      credentials: 'include', // Include session cookies as fallback
    });

    if (response.ok) {
      console.log(
        `✅ [Frontend] Successfully initialized WebDurableObject for user ${userId}`,
      );
    } else {
      console.warn(
        `⚠️ [Frontend] WebDurableObject initialization failed for user ${userId} (${response.status})`,
      );

      if (response.status === 403) {
        console.warn(
          `🔒 [Frontend] Admin privileges required. Ensure ADMIN_API_KEY is valid.`,
        );
      }

      // Don't throw error - this is non-critical for development
    }
  } catch (error) {
    console.warn(
      `⚠️ [Frontend] Failed to initialize WebDurableObject for user ${userId}:`,
      error,
    );
    // Don't throw error - this is non-critical for development
    // The user can still use the app without the durable object initialization
  }
}

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

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  /* Database hooks to handle user lifecycle events */
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            // Assign initial credits to new users
            await assignInitialCredits(user.id);
            console.log(
              `✅ [Frontend] Successfully assigned initial credits to user ${user.id} (${user.email})`,
            );

            // Initialize WebDurableObject for the new user
            // During development, this calls the backend API
            await initializeWebDurableObjectDev(user.id);
            console.log(
              `✅ [Frontend] Successfully initialized WebDurableObject for user ${user.id} (${user.email})`,
            );
          } catch (error) {
            console.error(
              `❌ [Frontend] Failed to initialize user ${user.id}:`,
              error,
            );
            // Don't throw error to prevent user creation from failing
            // Credits and DO initialization can be done manually if needed
          }
        },
      },
    },
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
