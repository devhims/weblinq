// src/lib/auth.ts – minimal Worker-side Better Auth that works in dev & prod
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from 'better-auth/plugins';

import { createDb } from '@/db';
import {
  assignInitialCredits,
  createOrUpdatePolarSubscription,
  createPaymentRecord,
  initializeWebDurableObject,
  processMonthlyRefill,
} from '@/db/queries';
import * as schema from '@/db/schema';
import { checkout, polar, portal, usage, webhooks } from '@polar-sh/better-auth';
import { Polar } from '@polar-sh/sdk';

import { getTrustedOrigins } from './auth-utils';
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from './email';

export function createAuth(env: CloudflareBindings) {
  /* ---------- environment detection ---------- */
  const isLocal = env.BETTER_AUTH_URL?.startsWith('http://localhost');

  /* ---------- database ---------- */
  const db = createDb(env);
  const adapter = drizzleAdapter(db, { provider: 'sqlite', schema });

  /* ---------- cookie block shared with Next.js ---------- */
  const cookieBase = {
    name: 'ba_session',
    sameSite: 'lax' as const, // safe on Safari & Incognito
    httpOnly: true,
    secure: !isLocal, // secure only on HTTPS
    domain: isLocal ? undefined : '.weblinq.dev', // drop Domain on localhost
  };

  /* ---------- Polar client setup ---------- */
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN!,
    // Use 'sandbox' for testing, 'production' for live
    server: env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  });

  return betterAuth({
    /* Where this instance lives */
    baseURL: env.BETTER_AUTH_URL, // e.g. https://api.weblinq.dev or http://localhost:8787

    /* Same secret as the front-end */
    secret: env.BETTER_AUTH_SECRET,

    /* CSRF / open-redirect guard - now supports Vercel previews */
    trustedOrigins: getTrustedOrigins(env),

    /* Share the cookie in prod, host-only in dev */
    advanced: {
      ...(isLocal
        ? { defaultCookieAttributes: cookieBase }
        : {
            crossSubDomainCookies: { enabled: true }, // Better Auth sets Domain=.weblinq.dev
            defaultCookieAttributes: cookieBase,
          }),
    },

    /* Cloudflare D1 via Drizzle */
    database: adapter,

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh after 24 h
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 min in-memory cache per Worker
      },
    },

    /* full email/password stack that used to be in Next.js */
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(env, url, user.email);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600, // 1 hour
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(env, url, user.email);
      },
    },

    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
        allowDifferentEmails: false,
      },
    },

    /* Database hooks to handle user lifecycle events */
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              // Assign initial credits to new users
              await assignInitialCredits(env, user.id);
              console.log(`✅ Successfully assigned initial credits to user ${user.id} (${user.email})`);

              // Initialize WebDurableObject for the new user
              await initializeWebDurableObject(env, user.id);
              console.log(`✅ Successfully initialized WebDurableObject for user ${user.id} (${user.email})`);

              // Send welcome email to new user
              // Extract first name from user's name or email
              const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0] || '';
              await sendWelcomeEmail(env, user.email, firstName);
              console.log(`✅ Successfully sent welcome email to user ${user.id} (${user.email})`);
            } catch (error) {
              console.error(`❌ Failed to initialize user ${user.id}:`, error);
              // Don't throw error to prevent user creation from failing
              // Credits, DO initialization, and welcome email can be done manually if needed
            }
          },
        },
      },
    },

    /* API-key support for backend-only routes + Polar integration */
    plugins: [
      apiKey({
        enableMetadata: true,
        customAPIKeyGetter: (ctx) => ctx.headers?.get('Authorization')?.split(' ')[1] ?? null,
        rateLimit: {
          enabled: true,
          timeWindow: 86_400_000,
          maxRequests: 1_000,
        },
      }),
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
                productId: (env as any).POLAR_PRO_PRODUCT_ID!, // Update this with your actual product ID from Polar
                slug: 'pro', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
              },
            ],
            successUrl: `${env.FRONTEND_URL}/dashboard/pricing/success?checkout_id={CHECKOUT_ID}`,
            authenticatedUsersOnly: true,
          }),
          portal(),
          usage(),
          webhooks({
            secret: env.POLAR_WEBHOOK_SECRET!,

            /* ------------------------------------------------------------------ */
            /*  🎯 UNIFIED ORDER-BASED WEBHOOK APPROACH                            */
            /*  Uses order.created + billing_reason for ALL subscription events    */
            /* ------------------------------------------------------------------ */

            onOrderCreated: (payload) => handleOrderCreated(env, payload),
            // Keep only cancellation since that doesn't create orders
            onSubscriptionCanceled: (payload) => handleSubscriptionCanceled(env, payload),

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
    ],
  });
}

/* ------------------------------------------------------------------ */
/*  🎯 UNIFIED WEBHOOK HANDLERS - Order-Based Approach                  */
/*  - order.created handles: subscription_create, subscription_cycle, subscription_update */
/*  - subscription.canceled handles: downgrades (no order created)      */
/* ------------------------------------------------------------------ */

/**
 * Handle subscription cancellations
 * This fires when a user cancels their subscription
 */
async function handleSubscriptionCanceled(env: CloudflareBindings, payload: any) {
  try {
    console.log('❌ Processing subscription.canceled webhook:', {
      subscriptionId: payload.data?.id,
      status: payload.data?.status,
      timestamp: new Date().toISOString(),
    });

    const { userId } = await extractUserAndStatus(payload);
    if (!userId) return;

    // Update subscription status + downgrade to free plan (preserve credits)
    await createOrUpdatePolarSubscription(env, {
      userId,
      subscriptionId: payload.data.id,
      status: 'cancelled', // Normalize status
      plan: 'free',
      startedAt: payload.data.startedAt ? new Date(payload.data.startedAt) : new Date(),
      currentPeriodEnd: payload.data.currentPeriodEnd ? new Date(payload.data.currentPeriodEnd) : undefined,
      cancelledAt: payload.data.cancelledAt ? new Date(payload.data.cancelledAt) : new Date(), // Use current time if not provided
    });

    console.log(`✅ Successfully processed subscription.canceled for ${payload.data.id}`);
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
async function handleOrderCreated(env: CloudflareBindings, payload: any) {
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
    const { userId, status: _status } = await extractUserAndStatus(payload);
    if (!userId) return;

    switch (billingReason) {
      case 'subscription_create':
        // 🎉 Initial subscription purchase
        await handleInitialSubscription(env, payload, userId);
        break;

      case 'subscription_cycle':
        // 🔁 Monthly renewal
        await handleMonthlyRenewal(env, payload, userId);
        break;

      case 'subscription_update':
        // ⚙️ Plan change with proration
        await handleSubscriptionUpdate(env, payload, userId);
        break;

      case 'purchase':
        // 🛒 One-time purchase - we don't handle these
        console.log('ℹ️ Skipping one-time purchase order:', orderId);
        return;

      default:
        console.log('ℹ️ Unknown billing reason, skipping:', billingReason);
        return;
    }

    console.log(`✅ Successfully processed order.created (${billingReason}) for ${orderId}`);
  } catch (error) {
    console.error('❌ Error in handleOrderCreated:', error);
    throw error;
  }
}

/**
 * Handle initial subscription creation from order.created
 */
async function handleInitialSubscription(env: CloudflareBindings, payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error('❌ Subscription ID missing in initial subscription order:', payload.data);
    return;
  }

  // Create subscription record + assign Pro credits (5000)
  await createOrUpdatePolarSubscription(env, {
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
    await createPaymentRecordSafely(env, payload, userId);
  }

  console.log(`🎉 Initial subscription processed for user ${userId}, subscription ${subscriptionId}`);
}

/**
 * Handle monthly renewals from order.created
 */
async function handleMonthlyRenewal(env: CloudflareBindings, payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error('❌ Subscription ID missing in renewal order:', payload.data);
    return;
  }

  // Process monthly credit refill for Pro subscribers
  await processMonthlyRefill(env, {
    userId,
    subscriptionId,
    orderId: payload.data.id,
  });

  console.log(`🔁 Monthly renewal processed for user ${userId}, subscription ${subscriptionId}`);
}

/**
 * Handle subscription updates (upgrades/downgrades) from order.created
 */
async function handleSubscriptionUpdate(env: CloudflareBindings, payload: any, userId: string) {
  const subscriptionId = payload.data?.subscriptionId;
  if (!subscriptionId) {
    console.error('❌ Subscription ID missing in update order:', payload.data);
    return;
  }

  // For now, treat updates similar to initial subscriptions
  // In the future, you might want to handle partial credits based on proration
  await createOrUpdatePolarSubscription(env, {
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
    await createPaymentRecordSafely(env, payload, userId);
  }

  console.log(`⚙️ Subscription update processed for user ${userId}, subscription ${subscriptionId}`);
}

/* ------------------------------------------------------------------ */
/*  Shared helper functions                                            */
/* ------------------------------------------------------------------ */

async function extractUserAndStatus(payload: any) {
  const rawStatus: string = payload.data.status;
  const _status = rawStatus === 'canceled' ? 'cancelled' : rawStatus;

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
    return { userId: null, status: _status };
  }

  return { userId, status: _status };
}

async function createPaymentRecordSafely(env: CloudflareBindings, payload: any, userId: string) {
  try {
    console.log('🔍 Creating payment record for successful subscription...');
    await createPaymentRecord(env, {
      paymentId: payload.data.checkoutId || `payment_${payload.data.id}`,
      userId,
      amountCents: payload.data.amount, // Polar sends amount in cents
      currency: payload.data.currency || 'usd',
      billingCountry: payload.data.customer?.billingAddress?.country,
      paidAt: new Date(payload.data.startedAt || payload.data.createdAt),
      type: 'charge',
    });
  } catch (paymentError) {
    console.error('❌ Failed to create payment record (non-critical):', paymentError);
    // Don't throw - payment record creation failure shouldn't break subscription processing
  }
}

// API Key object type based on better-auth plugin schema
export interface ApiKey {
  id: string;
  name?: string;
  start?: string;
  prefix?: string;
  userId: string;
  refillInterval?: number;
  refillAmount?: number;
  lastRefillAt?: Date;
  enabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitTimeWindow?: number;
  rateLimitMax?: number;
  requestCount: number;
  remaining?: number;
  lastRequest?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  permissions?: Record<string, string[]>;
  metadata?: Record<string, any>;
}
