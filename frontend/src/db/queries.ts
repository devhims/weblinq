import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from './index';
import {
  user,
  creditBalances,
  creditTransactions,
  subscriptions,
  payments,
} from './schema';
import { randomUUID } from 'crypto';

/* ------------------------------------------------------------------ */
/* Credit configuration from environment variables                    */
/* ------------------------------------------------------------------ */

const CREDIT_AMOUNTS = {
  INITIAL_FREE: parseInt(
    process.env.NEXT_PUBLIC_INITIAL_FREE_CREDITS || '1000',
    10,
  ),
  INITIAL_PRO: parseInt(
    process.env.NEXT_PUBLIC_INITIAL_PRO_CREDITS || '5000',
    10,
  ),
  MONTHLY_PRO_REFILL: parseInt(
    process.env.NEXT_PUBLIC_MONTHLY_PRO_REFILL || '5000',
    10,
  ),
} as const;

console.log('💰 Credit configuration loaded:', CREDIT_AMOUNTS);

/* ------------------------------------------------------------------ */
/* 1. Users                                                            */
/* ------------------------------------------------------------------ */

export async function getUserById(userId: string) {
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return u ?? null;
}

/* ------------------------------------------------------------------ */
/* 2. Credits                                                          */
/* ------------------------------------------------------------------ */

type CreditSnapshot = {
  balance: number;
  plan: 'free' | 'pro';
  lastRefill: Date | null;
};

/**
 * Assign initial credits to a new user
 * This function should be called during user creation
 */
export async function assignInitialCredits(userId: string): Promise<void> {
  // Check if user already has credits to prevent duplicate assignment
  const existingCredits = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existingCredits.length > 0) {
    console.log(
      `User ${userId} already has credits, skipping initial assignment`,
    );
    return;
  }

  try {
    // Use individual inserts instead of transaction for SQLite proxy compatibility
    // Create initial credit balance
    await db.insert(creditBalances).values({
      userId,
      plan: 'free',
      balance: CREDIT_AMOUNTS.INITIAL_FREE,
    });

    // Record the initial credit transaction
    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      delta: CREDIT_AMOUNTS.INITIAL_FREE,
      reason: 'initial_signup',
      metadata: JSON.stringify({ assignedAt: new Date().toISOString() }),
    });

    console.log(
      `✅ Assigned ${CREDIT_AMOUNTS.INITIAL_FREE} initial credits to user ${userId}`,
    );
  } catch (error) {
    console.error(
      `❌ Failed to assign initial credits to user ${userId}:`,
      error,
    );

    // Try to clean up partial state if credit balance was created but transaction failed
    try {
      await db.delete(creditBalances).where(eq(creditBalances.userId, userId));
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup partial credit assignment for user ${userId}:`,
        cleanupError,
      );
    }

    throw error;
  }
}

export async function getUserCredits(userId: string): Promise<CreditSnapshot> {
  // Get existing credit balance - no more bootstrap logic
  const [row] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (!row) {
    throw new Error(
      `No credit balance found for user ${userId}. Credits should be assigned during signup.`,
    );
  }

  return {
    balance: row.balance,
    plan: row.plan as 'free' | 'pro',
    lastRefill: row.lastRefill ? new Date(row.lastRefill) : null,
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
  operation: string,
  metadata?: unknown,
) {
  const credits = await getUserCredits(userId);
  if (credits.balance < amount) throw new Error('Insufficient credits');

  /* ledger */
  await db.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    delta: -amount,
    reason: operation,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  /* cache */
  await db
    .update(creditBalances)
    .set({ balance: sql`${creditBalances.balance} - ${amount}` })
    .where(eq(creditBalances.userId, userId));
}

/**
 * Process monthly credit refill for Pro subscribers
 * This should be called from order.created webhook when billing_reason === "subscription_cycle"
 */
export async function processMonthlyRefill({
  userId,
  subscriptionId,
  orderId,
}: {
  userId: string;
  subscriptionId: string;
  orderId: string;
}): Promise<void> {
  console.log(
    `🔄 Processing monthly refill for user ${userId}, subscription ${subscriptionId}`,
  );

  // Verify user has Pro plan
  const credits = await getUserCredits(userId);
  if (credits.plan !== 'pro') {
    console.log(
      `⚠️ Skipping refill for user ${userId} - not a Pro subscriber (plan: ${credits.plan})`,
    );
    return;
  }

  // Check if this specific order has already been processed
  const existingRefillTransaction = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.reason, 'monthly_refill'),
        eq(creditTransactions.delta, CREDIT_AMOUNTS.MONTHLY_PRO_REFILL),
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
    console.log(
      `⚠️ Skipping refill for user ${userId} - order ${orderId} already processed`,
    );
    return;
  }

  try {
    console.log(
      `🎯 Adding ${CREDIT_AMOUNTS.MONTHLY_PRO_REFILL} monthly refill credits to user ${userId}`,
    );

    // Insert credit transaction for the refill
    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      delta: CREDIT_AMOUNTS.MONTHLY_PRO_REFILL,
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
        balance: sql`${creditBalances.balance} + ${CREDIT_AMOUNTS.MONTHLY_PRO_REFILL}`,
        lastRefill: new Date(),
      })
      .where(eq(creditBalances.userId, userId));

    console.log(
      `✅ Successfully added ${CREDIT_AMOUNTS.MONTHLY_PRO_REFILL} monthly refill credits to user ${userId}`,
    );
  } catch (error) {
    console.error(
      `❌ Failed to process monthly refill for user ${userId}:`,
      error,
    );

    // Try to clean up the transaction record if balance update failed
    try {
      await db
        .delete(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, userId),
            eq(creditTransactions.reason, 'monthly_refill'),
            eq(creditTransactions.delta, CREDIT_AMOUNTS.MONTHLY_PRO_REFILL),
          ),
        );
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup refill transaction for user ${userId}:`,
        cleanupError,
      );
    }

    throw error;
  }
}

/* list 50 most-recent transactions */
export async function getCreditUsageHistory(userId: string, limit = 50) {
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

export async function getActiveSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    )
    .limit(1);
  return sub ?? null;
}

/**
 * Create a payment record for successful subscription payments
 */
export async function createPaymentRecord({
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
}) {
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

    console.log(
      `✅ Created payment record ${paymentId} for user ${userId}: $${amountCents / 100} ${currency}`,
    );
  } catch (error) {
    console.error(`❌ Failed to create payment record ${paymentId}:`, error);
    throw error;
  }
}

type PolarSubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

export async function createOrUpdatePolarSubscription({
  userId,
  subscriptionId,
  status,
  plan,
  planName,
  startedAt,
  currentPeriodStart,
  cancelledAt,
  currentPeriodEnd,
}: {
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
}) {
  // Resolve plan and period start fallbacks
  const resolvedPlan: 'pro' | 'free' = (plan ?? planName ?? 'free') as
    | 'pro'
    | 'free';
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
  const isStatusChange =
    existingSubscription.length > 0 &&
    existingSubscription[0].status !== status;

  console.log(
    `🔍 Subscription analysis: isNew=${isNewSubscription}, isStatusChange=${isStatusChange}, existingStatus=${existingSubscription[0]?.status}`,
  );

  /* 2️⃣ Upsert subscription row with race condition protection */
  let subscriptionUpsertSuccess = false;
  try {
    // Always use INSERT with ON CONFLICT to handle race conditions
    // This is more reliable than checking existence first
    const subscriptionData = {
      id: subscriptionId,
      userId: userId,
      status,
      plan: resolvedPlan,
      startedAt: resolvedStartedAt,
      cancelledAt,
      currentPeriodEnd,
      syncedAt: new Date(),
    };

    console.log(
      `🔄 Upserting subscription ${subscriptionId} for user ${userId} (race-condition safe)`,
    );

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

    console.log(
      `✅ Successfully upserted subscription ${subscriptionId} (race-condition safe)`,
    );
    subscriptionUpsertSuccess = true;
  } catch (error) {
    console.error(`❌ Failed to upsert subscription ${subscriptionId}:`, error);
    console.error(`❌ Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't throw error immediately - let's try to process credits anyway
    console.log(
      `⚠️ Continuing with credit processing despite subscription upsert failure`,
    );
  }

  /* 3️⃣ Sync credits: only for new subscriptions or status changes to active */
  const credits = await getUserCredits(userId);

  const isUpgrade = resolvedPlan === 'pro' && credits.plan === 'free';
  const isActivation =
    resolvedPlan === 'pro' &&
    status === 'active' &&
    (isNewSubscription || isStatusChange);
  const isDowngrade = resolvedPlan === 'free' && credits.plan === 'pro';

  console.log(
    `🔍 Credit logic: isUpgrade=${isUpgrade}, isActivation=${isActivation}, isDowngrade=${isDowngrade}`,
  );

  if ((isUpgrade || isActivation) && (isNewSubscription || isStatusChange)) {
    // Simple check: has this specific subscription already been processed?
    const existingCreditTransaction = await db
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.reason, 'initial_pro'),
          eq(creditTransactions.delta, CREDIT_AMOUNTS.INITIAL_PRO),
        ),
      )
      .orderBy(desc(creditTransactions.createdAt))
      .limit(5);

    // Check if any existing transaction is for this specific subscription
    const subscriptionAlreadyProcessed = existingCreditTransaction.some(
      (tx) => {
        try {
          const metadata = JSON.parse(tx.metadata || '{}');
          return metadata.subscriptionId === subscriptionId;
        } catch {
          return false;
        }
      },
    );

    if (subscriptionAlreadyProcessed) {
      console.log(
        `⚠️ Skipping credit assignment for user ${userId} - subscription ${subscriptionId} already processed`,
      );
    } else {
      // Add Pro credits - Use individual operations instead of transaction for SQLite compatibility
      try {
        console.log(
          `🎯 Assigning ${CREDIT_AMOUNTS.INITIAL_PRO} Pro credits to user ${userId} for subscription ${subscriptionId}`,
        );

        // Insert credit transaction first
        await db.insert(creditTransactions).values({
          id: randomUUID(),
          userId,
          delta: CREDIT_AMOUNTS.INITIAL_PRO,
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
            balance: sql`${creditBalances.balance} + ${CREDIT_AMOUNTS.INITIAL_PRO}`,
            lastRefill: new Date(),
          })
          .where(eq(creditBalances.userId, userId));

        console.log(
          `✅ Successfully added ${CREDIT_AMOUNTS.INITIAL_PRO} Pro credits to user ${userId} (${isUpgrade ? 'upgrade' : 'activation'})`,
        );
      } catch (error) {
        console.error(`❌ Failed to update credits for user ${userId}:`, error);

        // Try to clean up the transaction record if balance update failed
        try {
          await db
            .delete(creditTransactions)
            .where(
              and(
                eq(creditTransactions.userId, userId),
                eq(creditTransactions.reason, 'initial_pro'),
                eq(creditTransactions.delta, CREDIT_AMOUNTS.INITIAL_PRO),
              ),
            );
        } catch (cleanupError) {
          console.error(
            `Failed to cleanup credit transaction for user ${userId}:`,
            cleanupError,
          );
        }

        throw error;
      }
    }
  } else if (isDowngrade && isStatusChange) {
    // Simple check: has this specific subscription cancellation already been processed?
    const existingDowngradeTransaction = await db
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.reason, 'subscription_cancelled'),
        ),
      )
      .orderBy(desc(creditTransactions.createdAt))
      .limit(5);

    // Check if any existing transaction is for this specific subscription cancellation
    const cancellationAlreadyProcessed = existingDowngradeTransaction.some(
      (tx) => {
        try {
          const metadata = JSON.parse(tx.metadata || '{}');
          return metadata.subscriptionId === subscriptionId;
        } catch {
          return false;
        }
      },
    );

    if (cancellationAlreadyProcessed) {
      console.log(
        `⚠️ Skipping downgrade for user ${userId} - subscription ${subscriptionId} cancellation already processed`,
      );
    } else {
      try {
        console.log(
          `🔻 Processing subscription cancellation for user ${userId}`,
        );

        // Create transaction record for the downgrade (no credit change, just audit trail)
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

        // Update credit balance to mark plan as free (keep existing credits)
        await db
          .update(creditBalances)
          .set({ plan: 'free' })
          .where(eq(creditBalances.userId, userId));

        console.log(
          `✅ Successfully downgraded user ${userId} to free plan (credits preserved)`,
        );
      } catch (error) {
        console.error(`❌ Failed to downgrade user ${userId}:`, error);
        throw error;
      }
    }
  } else if (isDowngrade && !isStatusChange) {
    console.log(
      `ℹ️ Downgrade detected but no status change for user ${userId} - likely duplicate webhook`,
    );
  } else {
    console.log(
      `ℹ️ No credit changes needed for user ${userId} (plan=${resolvedPlan}, status=${status})`,
    );
  }

  // If subscription upsert failed but we're here, it means credits were processed successfully
  // Only throw error if subscription upsert failed AND this is a critical operation
  if (!subscriptionUpsertSuccess) {
    console.error(
      `❌ Subscription upsert failed for ${subscriptionId}, but credit processing may have succeeded`,
    );
    // For now, let's not throw to avoid breaking the webhook processing
    // throw new Error(`Failed to upsert subscription ${subscriptionId}`);
  }
}

/* ------------------------------------------------------------------ */
/* 4. Dashboard helper                                                 */
/* ------------------------------------------------------------------ */

export async function getSubscriptionData(userId: string) {
  const [credits, sub] = await Promise.all([
    getUserCredits(userId),
    getActiveSubscription(userId),
  ]);

  return {
    hasActiveSubscription: !!sub,
    currentPlan: credits.plan,
    credits,
    subscription: sub,
  };
}
