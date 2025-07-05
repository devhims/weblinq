import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user, creditBalances, creditTransactions, subscriptions } from './schema';
import { randomUUID } from 'crypto';

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

export async function getUserCredits(userId: string): Promise<CreditSnapshot> {
  // one-row cache (fast gating)
  let [row] = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);

  /* bootstrap on first login */
  if (!row) {
    await db.insert(creditBalances).values({
      userId,
      plan: 'free',
      balance: 1000,
    });

    // re-query to get a fully typed row (including updatedAt)
    [row] = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  }

  if (!row) {
    throw new Error('Failed to retrieve credit balance');
  }

  return {
    balance: row.balance,
    plan: row.plan as 'free' | 'pro',
    lastRefill: row.lastRefill ? new Date(row.lastRefill) : null,
  };
}

export async function deductCredits(userId: string, amount: number, operation: string, metadata?: unknown) {
  const credits = await getUserCredits(userId);
  if (credits.balance < amount) throw new Error('Insufficient credits');

  await db.transaction(async (tx) => {
    /* ledger */
    await tx.insert(creditTransactions).values({
      id: randomUUID(),
      userId,
      delta: -amount,
      reason: operation,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    /* cache */
    await tx
      .update(creditBalances)
      .set({ balance: sql`${creditBalances.balance} - ${amount}` })
      .where(eq(creditBalances.userId, userId));
  });
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
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1);
  return sub ?? null;
}

type PolarSubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'unpaid';

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
  const resolvedPlan: 'pro' | 'free' = (plan ?? planName ?? 'free') as 'pro' | 'free';
  const resolvedStartedAt: Date = startedAt ?? currentPeriodStart ?? new Date();

  /* 1️⃣ Upsert subscription row */
  await db
    .insert(subscriptions)
    .values({
      id: subscriptionId,
      userId,
      status,
      plan: resolvedPlan,
      startedAt: resolvedStartedAt,
      cancelledAt,
      currentPeriodEnd,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        status,
        plan: resolvedPlan,
        cancelledAt,
        currentPeriodEnd,
        syncedAt: new Date(),
      },
    });

  /* 2️⃣ Sync credits: plan switch or new active sub */
  const credits = await getUserCredits(userId);

  const isUpgrade = resolvedPlan === 'pro' && credits.plan === 'free';
  const isDowngrade = resolvedPlan === 'free' && credits.plan === 'pro';
  const isActivation = resolvedPlan === 'pro' && credits.plan === 'pro' && status === 'active';

  if (isUpgrade || isActivation) {
    // +5000 monthly refill
    await db.transaction(async (tx) => {
      await tx.insert(creditTransactions).values({
        id: randomUUID(),
        userId,
        delta: 5000,
        reason: isUpgrade ? 'initial_pro' : 'monthly_refill',
      });
      await tx
        .update(creditBalances)
        .set({
          plan: 'pro',
          balance: sql`${creditBalances.balance} + 5000`,
          lastRefill: new Date(),
        })
        .where(eq(creditBalances.userId, userId));
    });
  } else if (isDowngrade) {
    // keep remaining credits but mark plan
    await db.update(creditBalances).set({ plan: 'free' }).where(eq(creditBalances.userId, userId));
  }
}

/* ------------------------------------------------------------------ */
/* 4. Dashboard helper                                                 */
/* ------------------------------------------------------------------ */

export async function getSubscriptionData(userId: string) {
  const [credits, sub] = await Promise.all([getUserCredits(userId), getActiveSubscription(userId)]);

  return {
    hasActiveSubscription: !!sub,
    currentPlan: credits.plan,
    credits,
    subscription: sub,
  };
}
