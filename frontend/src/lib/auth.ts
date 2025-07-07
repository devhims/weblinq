import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import { Polar } from '@polar-sh/sdk';
import {
  createOrUpdatePolarSubscription,
  createPaymentRecord,
  processMonthlyRefill,
} from '@/db/queries';
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from '@polar-sh/better-auth';
import { assignInitialCredits } from '@/db/queries';

/* ------------------------------------------------------------------ */
/*  Env helpers                                                        */
/* ------------------------------------------------------------------ */

// Use VERCEL_ENV when it exists, otherwise fall back to NODE_ENV
const runtimeEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

const isPreview = runtimeEnv === 'preview';
const isProd = runtimeEnv === 'production';

const previewHost = process.env.VERCEL_URL;
const productionHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || 'www.weblinq.dev';

const FRONTEND_URL = isPreview
  ? `https://${previewHost}`
  : isProd
    ? `https://${productionHost}`
    : 'http://localhost:3000';

const BACKEND_URL = isProd
  ? 'https://api.weblinq.dev'
  : 'http://localhost:8787';

const SECRET = process.env.BETTER_AUTH_SECRET!;

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  // Use 'sandbox' for testing, 'production' for live
  server:
    process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
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

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes in-server cache via cookie
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
              `✅ Successfully assigned initial credits to user ${user.id} (${user.email})`,
            );
          } catch (error) {
            console.error(
              `❌ Failed to assign initial credits to user ${user.id}:`,
              error,
            );
            // Don't throw error to prevent user creation from failing
            // Credits can be assigned manually if needed
          }
        },
      },
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
      getCustomerCreateParams: async ({ user }) => {
        console.log('🧑‍💻 Creating Polar customer for user:', user.id);
        return {
          metadata: {
            userId: user.id,
            email: user.email,
            createdAt: new Date().toISOString(),
          },
        };
      },
      use: [
        checkout({
          products: [
            {
              productId: process.env.POLAR_PRO_PRODUCT_ID!, // Update this with your actual product ID from Polar
              slug: 'pro', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
            },
          ],
          successUrl: '/dashboard/success?checkout_id={CHECKOUT_ID}',
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,

          /* ------------------------------------------------------------------ */
          /*  🎯 UNIFIED ORDER-BASED WEBHOOK APPROACH                            */
          /*  Uses order.created + billing_reason for ALL subscription events    */
          /* ------------------------------------------------------------------ */

          onOrderCreated: handleOrderCreated,
          // Keep only cancellation since that doesn't create orders
          onSubscriptionCanceled: handleSubscriptionCanceled,

          // ✅ REMOVED: subscription.created, subscription.updated (handled by order.created)
          // ❌ onSubscriptionCreated: causes duplicates with order.created
          // ❌ onSubscriptionUpdated: causes duplicates

          /* optional catch-all logger */
          onPayload: async (payload) => {
            // Enhanced logging for debugging
            console.log('📨 Polar webhook received:', {
              type: payload.type,
              timestamp: new Date().toISOString(),
              hasData: !!payload.data,
              dataKeys: payload.data ? Object.keys(payload.data) : [],
            });
          },
        }),
      ],
    }),
    nextCookies(),
  ],
});

/* ------------------------------------------------------------------ */
/*  🎯 UNIFIED WEBHOOK HANDLERS - Order-Based Approach                  */
/*  - order.created handles: subscription_create, subscription_cycle, subscription_update */
/*  - subscription.canceled handles: downgrades (no order created)      */
/* ------------------------------------------------------------------ */

/**
 * Handle subscription cancellations
 * This fires when a user cancels their subscription
 */
async function handleSubscriptionCanceled(payload: any) {
  try {
    console.log('❌ Processing subscription.canceled webhook:', {
      subscriptionId: payload.data?.id,
      status: payload.data?.status,
      timestamp: new Date().toISOString(),
    });

    const { userId, status } = await extractUserAndStatus(payload);
    if (!userId) return;

    // Update subscription status + downgrade to free plan (preserve credits)
    await createOrUpdatePolarSubscription({
      userId,
      subscriptionId: payload.data.id,
      status: 'cancelled', // Normalize status
      plan: 'free',
      startedAt: payload.data.startedAt
        ? new Date(payload.data.startedAt)
        : new Date(),
      currentPeriodEnd: payload.data.currentPeriodEnd
        ? new Date(payload.data.currentPeriodEnd)
        : undefined,
      cancelledAt: payload.data.cancelledAt
        ? new Date(payload.data.cancelledAt)
        : new Date(), // Use current time if not provided
    });

    console.log(
      `✅ Successfully processed subscription.canceled for ${payload.data.id}`,
    );
  } catch (error) {
    console.error('❌ Error in handleSubscriptionCanceled:', error);
    throw error;
  }
}

/**
 * 🎯 UNIFIED ORDER HANDLER - Handles ALL subscription lifecycle events
 * Uses billing_reason to determine the type of transaction:
 * - subscription_create: Initial subscription purchase
 * - subscription_cycle: Monthly renewal
 * - subscription_update: Upgrade/downgrade with proration
 * - purchase: One-time purchases (we skip these)
 */
async function handleOrderCreated(payload: any) {
  try {
    const billingReason = payload.data?.billingReason;
    const orderId = payload.data?.id;
    const subscriptionId = payload.data?.subscriptionId;

    console.log('💰 Processing order.created webhook:', {
      orderId,
      billingReason,
      subscriptionId,
      timestamp: new Date().toISOString(),
    });

    // Extract user info from the order
    const { userId } = await extractUserAndStatus(payload);
    if (!userId) return;

    switch (billingReason) {
      case 'subscription_create':
        // 🎉 Initial subscription purchase
        await handleInitialSubscription(payload, userId);
        break;

      case 'subscription_cycle':
        // 🔁 Monthly renewal
        await handleMonthlyRenewal(payload, userId);
        break;

      case 'subscription_update':
        // ⚙️ Plan change with proration
        await handleSubscriptionUpdate(payload, userId);
        break;

      case 'purchase':
        // 🛒 One-time purchase - we don't handle these
        console.log('ℹ️ Skipping one-time purchase order:', orderId);
        return;

      default:
        console.log('ℹ️ Unknown billing reason, skipping:', billingReason);
        return;
    }

    console.log(
      `✅ Successfully processed order.created (${billingReason}) for ${orderId}`,
    );
  } catch (error) {
    console.error('❌ Error in handleOrderCreated:', error);
    throw error;
  }
}

/**
 * Handle initial subscription creation from order.created
 */
async function handleInitialSubscription(payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error(
      '❌ Subscription ID missing in initial subscription order:',
      payload.data,
    );
    return;
  }

  // Create subscription record + assign Pro credits (5000)
  await createOrUpdatePolarSubscription({
    userId,
    subscriptionId,
    status: 'active', // Order exists = subscription is active
    plan: 'pro',
    startedAt: new Date(payload.data.createdAt),
    currentPeriodStart: payload.data.subscription?.currentPeriodStart
      ? new Date(payload.data.subscription.currentPeriodStart)
      : undefined,
    currentPeriodEnd: payload.data.subscription?.currentPeriodEnd
      ? new Date(payload.data.subscription.currentPeriodEnd)
      : undefined,
    cancelledAt: undefined,
  });

  // Create payment record for successful subscription
  if (payload.data.amount) {
    await createPaymentRecordSafely(payload, userId);
  }

  console.log(
    `🎉 Initial subscription processed for user ${userId}, subscription ${subscriptionId}`,
  );
}

/**
 * Handle monthly renewals from order.created
 */
async function handleMonthlyRenewal(payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error('❌ Subscription ID missing in renewal order:', payload.data);
    return;
  }

  // Process monthly credit refill for Pro subscribers
  await processMonthlyRefill({
    userId,
    subscriptionId,
    orderId: payload.data.id,
  });

  console.log(
    `🔁 Monthly renewal processed for user ${userId}, subscription ${subscriptionId}`,
  );
}

/**
 * Handle subscription updates (upgrades/downgrades) from order.created
 */
async function handleSubscriptionUpdate(payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error('❌ Subscription ID missing in update order:', payload.data);
    return;
  }

  // For now, treat updates similar to initial subscriptions
  // In the future, you might want to handle partial credits based on proration
  await createOrUpdatePolarSubscription({
    userId,
    subscriptionId,
    status: 'active',
    plan: 'pro',
    startedAt: new Date(payload.data.createdAt),
    currentPeriodStart: payload.data.subscription?.currentPeriodStart
      ? new Date(payload.data.subscription.currentPeriodStart)
      : undefined,
    currentPeriodEnd: payload.data.subscription?.currentPeriodEnd
      ? new Date(payload.data.subscription.currentPeriodEnd)
      : undefined,
    cancelledAt: undefined,
  });

  // Create payment record for the update
  if (payload.data.amount) {
    await createPaymentRecordSafely(payload, userId);
  }

  console.log(
    `⚙️ Subscription update processed for user ${userId}, subscription ${subscriptionId}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helper functions                                            */
/* ------------------------------------------------------------------ */

async function extractUserAndStatus(payload: any) {
  const rawStatus: string = payload.data.status;
  const status = rawStatus === 'canceled' ? 'cancelled' : (rawStatus as any);

  // Try multiple ways to get the userId
  const userId =
    (payload.data.customer?.metadata?.userId as string) ??
    (payload.data.customer?.externalId as string) ??
    (payload.data.customer?.email as string);

  if (!userId) {
    console.error('❌ User ID missing in webhook payload:', {
      customer: payload.data.customer,
      metadata: payload.data.customer?.metadata,
      externalId: payload.data.customer?.externalId,
    });
    return { userId: null, status };
  }

  return { userId, status };
}

async function createPaymentRecordSafely(payload: any, userId: string) {
  try {
    console.log('🔍 Creating payment record for successful subscription...');
    await createPaymentRecord({
      paymentId: payload.data.checkoutId || `payment_${payload.data.id}`,
      userId,
      amountCents: payload.data.amount, // Polar sends amount in cents
      currency: payload.data.currency || 'usd',
      billingCountry: payload.data.customer?.billingAddress?.country,
      paidAt: new Date(payload.data.startedAt || payload.data.createdAt),
      type: 'charge',
    });
  } catch (paymentError) {
    console.error(
      '❌ Failed to create payment record (non-critical):',
      paymentError,
    );
    // Don't throw - payment record creation failure shouldn't break subscription processing
  }
}

/* typed helpers you'll import elsewhere */
export const { handler, api } = auth;
