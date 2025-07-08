import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { createDb } from './index';
import { creditBalances, creditTransactions, payments, subscriptions, user } from './schema';

/* ------------------------------------------------------------------ */
/* Safe environment variable parsing                                  */
/* ------------------------------------------------------------------ */

/**
 * Safely parse credit amounts from environment variables with fallbacks
 */
function getCreditAmounts(env: CloudflareBindings) {
  const parseCredits = (envVar: string | undefined, defaultValue: number): number => {
    if (!envVar) return defaultValue;
    const parsed = Number.parseInt(envVar, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  return {
    INITIAL_FREE: parseCredits(env.INITIAL_FREE_CREDITS, 1000),
    INITIAL_PRO: parseCredits(env.INITIAL_PRO_CREDITS, 5000),
    MONTHLY_PRO_REFILL: parseCredits(env.MONTHLY_PRO_REFILL, 5000),
  } as const;
}

/* ------------------------------------------------------------------ */
/* Credit configuration from environment variables                    */
/* ------------------------------------------------------------------ */

// const CREDIT_AMOUNTS = {
//   INITIAL_FREE: Number.parseInt(env.INITIAL_FREE_CREDITS || '1000', 10),
//   INITIAL_PRO: Number.parseInt(env.INITIAL_PRO_CREDITS || '5000', 10),
//   MONTHLY_PRO_REFILL: Number.parseInt(env.MONTHLY_PRO_REFILL || '5000', 10),
// } as const;

// console.log('💰 Credit configuration loaded:', CREDIT_AMOUNTS);

/* ------------------------------------------------------------------ */
/* 1. Users                                                            */
/* ------------------------------------------------------------------ */

export async function getUserById(env: CloudflareBindings, userId: string) {
  const db = createDb(env);
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return u ?? null;
}

/* ------------------------------------------------------------------ */
/* 2. Credits                                                          */
/* ------------------------------------------------------------------ */

interface CreditSnapshot {
  balance: number;
  plan: 'free' | 'pro';
  lastRefill: Date | null;
}

/**
 * Assign initial credits to a new user
 * This function should be called during user creation
 */
export async function assignInitialCredits(env: CloudflareBindings, userId: string): Promise<void> {
  const db = createDb(env);

  // Check if user already has credits to prevent duplicate assignment
  const existingCredits = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);

  if (existingCredits.length > 0) {
    console.log(`User ${userId} already has credits, skipping initial assignment`);
    return;
  }

  try {
    // Cloudflare D1 (especially inside Durable Objects) does not support BEGIN TRANSACTION statements.
    // Drizzle's `db.transaction` helper internally issues these statements which results in the D1_ERROR
    // we are seeing. For the simple two-statement initial credit assignment we can safely execute the
    // inserts sequentially – the likelihood of partial failure is extremely low and preferable to a
    // hard runtime error.

    // Get credit amounts with safe parsing and fallbacks
    const creditAmounts = getCreditAmounts(env);
    const freeCreditAmount = creditAmounts.INITIAL_FREE;

    // 1️⃣ Create initial credit balance row
    await db.insert(creditBalances).values({
      userId,
      plan: 'free',
      balance: freeCreditAmount,
    });

    // 2️⃣ Record the initial credit transaction
    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      delta: freeCreditAmount,
      reason: 'initial_signup',
      metadata: JSON.stringify({ assignedAt: new Date().toISOString() }),
    });

    console.log(`✅ Assigned ${freeCreditAmount} initial credits to user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to assign initial credits to user ${userId}:`, error);
    throw error;
  }
}

export async function getUserCredits(env: CloudflareBindings, userId: string): Promise<CreditSnapshot> {
  const db = createDb(env);

  // Get existing credit balance
  const [row] = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);

  if (!row) {
    throw new Error(`No credit balance found for user ${userId}. Credits should be assigned during signup.`);
  }

  return {
    balance: row.balance,
    plan: row.plan as 'free' | 'pro',
    lastRefill: row.lastRefill ? new Date(row.lastRefill) : null,
  };
}

export async function deductCredits(
  env: CloudflareBindings,
  userId: string,
  amount: number,
  operation: string,
  metadata?: unknown,
) {
  const db = createDb(env);

  const credits = await getUserCredits(env, userId);
  if (credits.balance < amount) throw new Error('Insufficient credits');

  // Execute operations sequentially (D1 doesn't support explicit transactions)
  // Insert transaction record
  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    delta: -amount,
    reason: operation,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  // Update balance
  await db
    .update(creditBalances)
    .set({ balance: sql`${creditBalances.balance} - ${amount}` })
    .where(eq(creditBalances.userId, userId));
}

/**
 * Process monthly credit refill for Pro subscribers
 * This should be called from order.created webhook when billing_reason === "subscription_cycle"
 */
export async function processMonthlyRefill(
  env: CloudflareBindings,
  {
    userId,
    subscriptionId,
    orderId,
  }: {
    userId: string;
    subscriptionId: string;
    orderId: string;
  },
): Promise<void> {
  const db = createDb(env);

  console.log(`🔄 Processing monthly refill for user ${userId}, subscription ${subscriptionId}`);

  // Verify user has Pro plan
  const credits = await getUserCredits(env, userId);
  if (credits.plan !== 'pro') {
    console.log(`⚠️ Skipping refill for user ${userId} - not a Pro subscriber (plan: ${credits.plan})`);
    return;
  }

  // Check if this specific order has already been processed
  const creditAmounts = getCreditAmounts(env);
  const existingRefillTransaction = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.reason, 'monthly_refill'),
        eq(creditTransactions.delta, creditAmounts.MONTHLY_PRO_REFILL),
      ),
    )
    .orderBy(desc(creditTransactions.createdAt))
    .limit(5);

  // Check if any existing transaction is for this specific order
  const orderAlreadyProcessed = existingRefillTransaction.some((tx) => {
    try {
      const metadata = JSON.parse(tx.metadata || '{}');
      return metadata.orderId === orderId;
    } catch {
      return false;
    }
  });

  if (orderAlreadyProcessed) {
    console.log(`⚠️ Skipping refill for user ${userId} - order ${orderId} already processed`);
    return;
  }

  try {
    console.log(`🎯 Adding ${creditAmounts.MONTHLY_PRO_REFILL} monthly refill credits to user ${userId}`);

    // Execute operations sequentially (D1 doesn't support explicit transactions)
    // Insert credit transaction for the refill
    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      delta: creditAmounts.MONTHLY_PRO_REFILL,
      reason: 'monthly_refill',
      metadata: JSON.stringify({
        subscriptionId,
        orderId,
        refillDate: new Date().toISOString(),
      }),
    });

    // Update credit balance
    await db
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${creditAmounts.MONTHLY_PRO_REFILL}`,
        lastRefill: new Date(),
      })
      .where(eq(creditBalances.userId, userId));

    console.log(`✅ Successfully added ${creditAmounts.MONTHLY_PRO_REFILL} monthly refill credits to user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to process monthly refill for user ${userId}:`, error);
    throw error;
  }
}

/* list 50 most-recent transactions */
export async function getCreditUsageHistory(env: CloudflareBindings, userId: string, limit = 50) {
  const db = createDb(env);

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }));
}

/* ------------------------------------------------------------------ */
/* 3. Subscriptions (Polar)                                            */
/* ------------------------------------------------------------------ */

export async function getActiveSubscription(env: CloudflareBindings, userId: string) {
  const db = createDb(env);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1);
  return sub ?? null;
}

/**
 * Create a payment record for successful subscription payments
 */
export async function createPaymentRecord(
  env: CloudflareBindings,
  {
    paymentId,
    userId,
    amountCents,
    currency = 'usd',
    billingCountry,
    paidAt,
    type = 'charge',
  }: {
    paymentId: string;
    userId: string;
    amountCents: number;
    currency?: string;
    billingCountry?: string;
    paidAt: Date;
    type?: 'charge' | 'refund';
  },
) {
  const db = createDb(env);

  try {
    await db.insert(payments).values({
      id: paymentId,
      userId,
      amountCents,
      currency,
      billingCountry,
      paidAt,
      type,
    });

    console.log(`✅ Created payment record ${paymentId} for user ${userId}: $${amountCents / 100} ${currency}`);
  } catch (error) {
    console.error(`❌ Failed to create payment record ${paymentId}:`, error);
    throw error;
  }
}

type PolarSubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'unpaid';

export async function createOrUpdatePolarSubscription(
  env: CloudflareBindings,
  {
    userId,
    subscriptionId,
    status,
    plan,
    planName,
    startedAt,
    currentPeriodStart,
    cancelledAt,
    currentPeriodEnd,
  }: // ...extra
  {
    userId: string;
    subscriptionId: string;
    status: PolarSubscriptionStatus;
    plan?: 'pro' | 'free';
    planName?: 'pro' | 'free'; // alias used by callers
    startedAt?: Date;
    currentPeriodStart?: Date; // alias used by callers
    cancelledAt?: Date;
    currentPeriodEnd?: Date;
    // allow arbitrary extra fields (e.g. polarCustomerId, productId, ...)
    [key: string]: unknown;
  },
) {
  const db = createDb(env);

  // Resolve plan and period start fallbacks
  const resolvedPlan: 'pro' | 'free' = (plan ?? planName ?? 'free') as 'pro' | 'free';
  const resolvedStartedAt: Date = startedAt ?? currentPeriodStart ?? new Date();

  console.log(
    `🔄 Processing subscription ${subscriptionId} for user ${userId}: status=${status}, plan=${resolvedPlan}`,
  );

  /* 1️⃣ Check if subscription already exists to prevent duplicate credit assignment */
  const existingSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  const isNewSubscription = existingSubscription.length === 0;
  const isStatusChange = existingSubscription.length > 0 && existingSubscription[0].status !== status;

  console.log(
    `🔍 Subscription analysis: isNew=${isNewSubscription}, isStatusChange=${isStatusChange}, existingStatus=${existingSubscription[0]?.status}`,
  );

  /* 2️⃣ Get current user credits */
  const credits = await getUserCredits(env, userId);

  const isUpgrade = resolvedPlan === 'pro' && credits.plan === 'free';
  const isActivation = resolvedPlan === 'pro' && status === 'active' && (isNewSubscription || isStatusChange);
  const isDowngrade = resolvedPlan === 'free' && credits.plan === 'pro';

  console.log(`🔍 Credit logic: isUpgrade=${isUpgrade}, isActivation=${isActivation}, isDowngrade=${isDowngrade}`);

  /* 3️⃣ Execute subscription + credit changes sequentially (no transactions in D1) */
  try {
    // 1️⃣ Upsert subscription row first
    const subscriptionData = {
      id: subscriptionId,
      userId,
      status,
      plan: resolvedPlan,
      startedAt: resolvedStartedAt,
      cancelledAt,
      currentPeriodEnd,
      syncedAt: new Date(),
    };

    console.log(`🔄 Upserting subscription ${subscriptionId} for user ${userId}`);

    await db
      .insert(subscriptions)
      .values(subscriptionData)
      .onConflictDoUpdate({
        target: subscriptions.id,
        set: {
          status: subscriptionData.status,
          plan: subscriptionData.plan,
          cancelledAt: subscriptionData.cancelledAt,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          syncedAt: subscriptionData.syncedAt,
        },
      });

    // 2️⃣ Handle credit changes
    if ((isUpgrade || isActivation) && (isNewSubscription || isStatusChange)) {
      // Get credit amounts with safe parsing
      const creditAmounts = getCreditAmounts(env);

      // Check if this specific subscription already has credits processed
      const existingCreditTransaction = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, userId),
            eq(creditTransactions.reason, 'initial_pro'),
            eq(creditTransactions.delta, creditAmounts.INITIAL_PRO),
          ),
        )
        .orderBy(desc(creditTransactions.createdAt))
        .limit(5);

      const subscriptionAlreadyProcessed = existingCreditTransaction.some((tx) => {
        try {
          const metadata = JSON.parse(tx.metadata || '{}');
          return metadata.subscriptionId === subscriptionId;
        } catch {
          return false;
        }
      });

      if (!subscriptionAlreadyProcessed) {
        console.log(
          `🎯 Assigning ${creditAmounts.INITIAL_PRO} Pro credits to user ${userId} for subscription ${subscriptionId}`,
        );

        // Insert credit transaction
        await db.insert(creditTransactions).values({
          id: randomUUID(),
          userId,
          delta: creditAmounts.INITIAL_PRO,
          reason: 'initial_pro',
          metadata: JSON.stringify({
            subscriptionId,
            webhookType: status === 'active' ? 'activation' : 'upgrade',
          }),
        });

        // Update credit balance
        await db
          .update(creditBalances)
          .set({
            plan: 'pro',
            balance: sql`${creditBalances.balance} + ${creditAmounts.INITIAL_PRO}`,
            lastRefill: new Date(),
          })
          .where(eq(creditBalances.userId, userId));

        console.log(
          `✅ Successfully added ${creditAmounts.INITIAL_PRO} Pro credits to user ${userId} (${
            isUpgrade ? 'upgrade' : 'activation'
          })`,
        );
      } else {
        console.log(
          `⚠️ Skipping credit assignment for user ${userId} - subscription ${subscriptionId} already processed`,
        );
      }
    } else if (isDowngrade && isStatusChange) {
      // Check if this specific subscription cancellation already processed
      const existingDowngradeTransaction = await db
        .select()
        .from(creditTransactions)
        .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.reason, 'subscription_cancelled')))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(5);

      const cancellationAlreadyProcessed = existingDowngradeTransaction.some((tx) => {
        try {
          const metadata = JSON.parse(tx.metadata || '{}');
          return metadata.subscriptionId === subscriptionId;
        } catch {
          return false;
        }
      });

      if (!cancellationAlreadyProcessed) {
        console.log(`🔻 Processing subscription cancellation for user ${userId}`);

        // Create transaction record for the downgrade
        await db.insert(creditTransactions).values({
          id: randomUUID(),
          userId,
          delta: 0, // No credit change, just plan change
          reason: 'subscription_cancelled',
          metadata: JSON.stringify({
            subscriptionId,
            previousPlan: credits.plan,
            newPlan: 'free',
            cancelledAt: new Date().toISOString(),
          }),
        });

        // Update credit balance to mark plan as free
        await db.update(creditBalances).set({ plan: 'free' }).where(eq(creditBalances.userId, userId));

        console.log(`✅ Successfully downgraded user ${userId} to free plan (credits preserved)`);
      } else {
        console.log(
          `⚠️ Skipping downgrade for user ${userId} - subscription ${subscriptionId} cancellation already processed`,
        );
      }
    } else {
      console.log(`ℹ️ No credit changes needed for user ${userId} (plan=${resolvedPlan}, status=${status})`);
    }

    console.log(`✅ Successfully processed subscription ${subscriptionId} with credit changes`);
  } catch (error) {
    console.error(`❌ Failed to process subscription ${subscriptionId} and credit changes:`, error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 4. Dashboard helper                                                 */
/* ------------------------------------------------------------------ */

export async function getSubscriptionData(env: CloudflareBindings, userId: string) {
  const [credits, sub] = await Promise.all([getUserCredits(env, userId), getActiveSubscription(env, userId)]);

  return {
    hasActiveSubscription: !!sub,
    currentPlan: credits.plan,
    credits,
    subscription: sub,
  };
}
