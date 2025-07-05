import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import { Polar } from '@polar-sh/sdk';
import { createOrUpdatePolarSubscription } from '@/db/queries';
import { polar, checkout, portal, usage, webhooks } from '@polar-sh/better-auth';

/* ------------------------------------------------------------------ */
/*  Env helpers                                                        */
/* ------------------------------------------------------------------ */

// Use VERCEL_ENV when it exists, otherwise fall back to NODE_ENV
const runtimeEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

const isPreview = runtimeEnv === 'preview';
const isProd = runtimeEnv === 'production';

const previewHost = process.env.VERCEL_URL;
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || 'www.weblinq.dev';

const FRONTEND_URL = isPreview
  ? `https://${previewHost}`
  : isProd
  ? `https://${productionHost}`
  : 'http://localhost:3000';

const BACKEND_URL = isProd ? 'https://api.weblinq.dev' : 'http://localhost:8787';

const SECRET = process.env.BETTER_AUTH_SECRET!;

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  // Use 'sandbox' for testing, 'production' for live
  server: process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

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
      secure: isProd || isPreview, // secure if we are on HTTPS (prod or preview)
      httpOnly: true,
      path: '/',
    },
  },

  /* built-in auth modes – _no_ plugin calls needed in v1 */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(url, user.email);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
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
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      getCustomerCreateParams: async ({ user }) => ({
        metadata: {
          userId: user.id,
          email: user.email,
          createdAt: new Date().toISOString(),
        },
      }),
      use: [
        checkout({
          products: [
            {
              productId: process.env.POLAR_PRO_PRODUCT_ID!, // Update this with your actual product ID from Polar
              slug: 'pro', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
            },
          ],
          successUrl: '/success?checkout_id={CHECKOUT_ID}',
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,

          /*  create / update / cancel use the same helper  */
          onSubscriptionCreated: handleSub,
          onSubscriptionUpdated: handleSub,
          onSubscriptionCanceled: handleSub,

          /* optional catch-all logger */
          onPayload: async (payload) => {
            // Optional: Log all webhook events for debugging (remove in production)
            console.log('📨 Polar webhook received:', payload.type);
          },
        }),
      ],
    }),
    nextCookies(),
  ],
});

/* ------------------------------------------------------------------ */
/*  Webhook handler shared by create / update / cancel                 */
/* ------------------------------------------------------------------ */

async function handleSub(payload: any) {
  const rawStatus: string = payload.data.status; // 'active' | 'canceled' | …
  const status = rawStatus === 'canceled' ? 'cancelled' : (rawStatus as any);

  const userId = (payload.data.customer?.metadata?.userId as string) ?? (payload.data.customer?.externalId as string);

  if (!userId) {
    console.error('❌ User ID missing in webhook payload');
    return;
  }

  await createOrUpdatePolarSubscription({
    userId,
    subscriptionId: payload.data.id,
    status, // normalised spelling
    plan: status === 'active' ? 'pro' : 'free',
    currentPeriodStart: payload.data.currentPeriodStart ? new Date(payload.data.currentPeriodStart) : undefined,
    currentPeriodEnd: payload.data.currentPeriodEnd ? new Date(payload.data.currentPeriodEnd) : undefined,
  });

  console.log(`✅ Synced subscription ${payload.data.id} for ${userId}`);
}

/* typed helpers you'll import elsewhere */
export const { handler, api } = auth;
