import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { createDb } from './index';
import { creditBalances, creditTransactions, errorLogs, payments, subscriptions, user } from './schema';

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

export async function getUserById(env: CloudflareBindings, userId: string, db?: any) {
  const database = db || createDb(env);
  const [u] = await database.select().from(user).where(eq(user.id, userId)).limit(1);
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
export async function assignInitialCredits(env: CloudflareBindings, userId: string, db?: any): Promise<void> {
  const database = db || createDb(env);

  // Check if user already has credits to prevent duplicate assignment
  const existingCredits = await database
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

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

    console.log(
      `💳 [D1-QUERY] Assigning ${freeCreditAmount} initial credits for user ${userId} using ${
        db ? 'session-aware' : 'new'
      } database`,
    );

    // 1️⃣ Create initial credit balance row
    await database.insert(creditBalances).values({
      userId,
      plan: 'free',
      balance: freeCreditAmount,
    });

    // 2️⃣ Record the initial credit transaction
    await database.insert(creditTransactions).values({
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

export async function getUserCredits(env: CloudflareBindings, userId: string, db?: any): Promise<CreditSnapshot> {
  // Use provided session-aware database or create new one
  const database = db || createDb(env);

  console.log(`💳 [D1-QUERY] Getting credit balance for user ${userId} using ${db ? 'session-aware' : 'new'} database`);

  // Get existing credit balance - with D1 Sessions API for performance
  const [row] = await database.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);

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
  db?: any,
) {
  // Use provided session-aware database or create new one
  const database = db || createDb(env);

  console.log(
    `💳 [D1-QUERY] Deducting ${amount} credits for user ${userId} using ${db ? 'session-aware' : 'new'} database`,
  );

  const credits = await getUserCredits(env, userId, database);
  if (credits.balance < amount) throw new Error('Insufficient credits');

  // Execute operations sequentially (D1 doesn't support explicit transactions)
  // Insert transaction record
  await database.insert(creditTransactions).values({
    id: randomUUID(),
    userId,
    delta: -amount,
    reason: operation,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  // Update balance
  await database
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
  db?: any,
): Promise<void> {
  const database = db || createDb(env);

  console.log(
    `🔄 Processing monthly refill for user ${userId}, subscription ${subscriptionId} using ${
      db ? 'session-aware' : 'new'
    } database`,
  );

  // Verify user has Pro plan
  const credits = await getUserCredits(env, userId, database);
  if (credits.plan !== 'pro') {
    console.log(`⚠️ Skipping refill for user ${userId} - not a Pro subscriber (plan: ${credits.plan})`);
    return;
  }

  // Check if this specific order has already been processed
  const creditAmounts = getCreditAmounts(env);
  const existingRefillTransaction = await database
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
  const orderAlreadyProcessed = existingRefillTransaction.some((tx: any) => {
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
    await database.insert(creditTransactions).values({
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
    await database
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
export async function getCreditUsageHistory(env: CloudflareBindings, userId: string, limit = 50, db?: any) {
  const database = db || createDb(env);

  console.log(
    `💳 [D1-QUERY] Getting credit usage history for user ${userId} using ${db ? 'session-aware' : 'new'} database`,
  );

  const rows = await database
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);

  return rows.map((r: any) => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }));
}

/* ------------------------------------------------------------------ */
/* 3. Subscriptions (Polar)                                            */
/* ------------------------------------------------------------------ */

export async function getActiveSubscription(env: CloudflareBindings, userId: string, db?: any) {
  const database = db || createDb(env);

  console.log(
    `📋 [D1-QUERY] Getting active subscription for user ${userId} using ${db ? 'session-aware' : 'new'} database`,
  );

  const [sub] = await database
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
  db?: any,
) {
  const database = db || createDb(env);

  console.log(
    `💳 [D1-QUERY] Creating payment record ${paymentId} for user ${userId} using ${
      db ? 'session-aware' : 'new'
    } database`,
  );

  try {
    await database.insert(payments).values({
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
  db?: any,
) {
  const database = db || createDb(env);

  // Resolve plan and period start fallbacks
  const resolvedPlan: 'pro' | 'free' = (plan ?? planName ?? 'free') as 'pro' | 'free';
  const resolvedStartedAt: Date = startedAt ?? currentPeriodStart ?? new Date();

  console.log(
    `🔄 Processing subscription ${subscriptionId} for user ${userId}: status=${status}, plan=${resolvedPlan} using ${
      db ? 'session-aware' : 'new'
    } database`,
  );

  /* 1️⃣ Check if subscription already exists to prevent duplicate credit assignment */
  const existingSubscription = await database
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
  const credits = await getUserCredits(env, userId, database);

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

    await database
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
      const existingCreditTransaction = await database
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

      const subscriptionAlreadyProcessed = existingCreditTransaction.some((tx: any) => {
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
        await database.insert(creditTransactions).values({
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
        await database
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
      const existingDowngradeTransaction = await database
        .select()
        .from(creditTransactions)
        .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.reason, 'subscription_cancelled')))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(5);

      const cancellationAlreadyProcessed = existingDowngradeTransaction.some((tx: any) => {
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
        await database.insert(creditTransactions).values({
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
        await database.update(creditBalances).set({ plan: 'free' }).where(eq(creditBalances.userId, userId));

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

/**
 * Initialize WebDurableObject for a new user during signup
 * This function creates and initializes the user's Durable Object with database setup
 * Database initialization only happens in production where SQLite is available
 */
export async function initializeWebDurableObject(env: CloudflareBindings, userId: string): Promise<void> {
  try {
    console.log(`🔧 Initializing WebDurableObject for user ${userId}...`);

    // Get the WebDurableObject namespace and create stable ID for the user
    // Use the same stable versioned ID logic as handlers for consistency
    const namespace = env.WEBLINQ_DURABLE_OBJECT;
    const durableObjectId = namespace.idFromName(`web:${userId}:v3`);
    const durableObject = namespace.get(durableObjectId);

    console.log(`🆔 Using stable DO ID for user ${userId}: web:${userId}:v3`);

    // Call initialization method on the Durable Object
    // This will set up the user context and database tables (production only)
    await durableObject.initializeUserAndDatabase(userId);

    const isProduction = env.NODE_ENV === 'production';
    if (isProduction) {
      console.log(`✅ Successfully initialized WebDurableObject with database for user ${userId} (production)`);
    } else {
      console.log(`✅ Successfully initialized WebDurableObject for user ${userId} (development - no database)`);
    }
  } catch (error) {
    console.error(`❌ Failed to initialize WebDurableObject for user ${userId}:`, error);
    throw new Error(`Failed to initialize user Durable Object: ${error}`);
  }
}

/**
 * Notify WebDurableObject that user's plan has changed
 * This triggers a plan update in the Durable Object for updated concurrent request limits
 */
export async function notifyPlanChange(
  env: CloudflareBindings,
  userId: string,
  newPlan: 'free' | 'pro',
): Promise<void> {
  try {
    console.log(`📋 Notifying plan change for user ${userId} to ${newPlan}...`);

    // Get the WebDurableObject namespace and create stable ID for the user
    const namespace = env.WEBLINQ_DURABLE_OBJECT;
    const durableObjectId = namespace.idFromName(`web:${userId}:v3`);
    const durableObject = namespace.get(durableObjectId);

    // Call plan update method on the Durable Object
    await durableObject.updateUserPlan(newPlan);

    console.log(`✅ Successfully updated plan for user ${userId} to ${newPlan}`);
  } catch (error) {
    console.error(`❌ Failed to update plan for user ${userId}:`, error);
    // Don't throw - plan change notification failure shouldn't break subscription processing
    console.warn(`⚠️ Plan change notification failure is non-critical, continuing...`);
  }
}

/* ------------------------------------------------------------------ */
/* 4. Dashboard helper                                                 */
/* ------------------------------------------------------------------ */

export async function getSubscriptionData(env: CloudflareBindings, userId: string, db?: any) {
  console.log(
    `📊 [D1-QUERY] Getting subscription data for user ${userId} using ${db ? 'session-aware' : 'new'} database`,
  );

  const [credits, sub] = await Promise.all([getUserCredits(env, userId, db), getActiveSubscription(env, userId, db)]);

  return {
    hasActiveSubscription: !!sub,
    currentPlan: credits.plan,
    credits,
    subscription: sub,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Error Logging                                                   */
/* ------------------------------------------------------------------ */

export interface ErrorLogParams {
  /** Request ID for correlation (usually from response-utils) */
  requestId?: string;
  /** User ID if available */
  userId?: string;
  /** Error severity level */
  level?: 'error' | 'warning' | 'critical' | 'fatal';
  /** Error source/category */
  source: string;
  /** Specific operation that failed */
  operation: string;
  /** HTTP status code */
  statusCode?: number;
  /** Error code from ERROR_CODES */
  errorCode?: string;
  /** Human-readable error message */
  message: string;
  /** Error object for stack trace extraction */
  error?: Error;
  /** Request URL */
  url?: string;
  /** HTTP method */
  method?: string;
  /** User agent */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Environment */
  environment?: string;
  /** Application version */
  version?: string;
}

/**
 * Generate a fingerprint for error grouping
 * Groups similar errors together for better monitoring
 */
function generateErrorFingerprint(message: string, operation: string, errorCode?: string): string {
  // Normalize error message by removing dynamic parts
  const normalizedMessage = message
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g, 'TIMESTAMP') // ISO timestamps
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // UUIDs
    .replace(/\d+ms/g, 'DURATIONms') // Duration
    .replace(/\d+/g, 'NUMBER') // Generic numbers
    .replace(/https?:\/\/\S+/g, 'URL') // URLs
    .toLowerCase()
    .trim();

  const components = [operation, errorCode || 'unknown', normalizedMessage].filter(Boolean);
  return components.join('::');
}

/**
 * Log an error to the database with comprehensive context
 */
export async function logError(env: CloudflareBindings, params: ErrorLogParams, db?: any): Promise<string> {
  const database = db || createDb(env);
  const errorId = randomUUID();

  try {
    const fingerprint = generateErrorFingerprint(params.message, params.operation, params.errorCode);
    const now = new Date();

    // Check if we've seen this error pattern before (for occurrence counting)
    const existingError = await database
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.fingerprint, fingerprint))
      .orderBy(desc(errorLogs.lastOccurrence))
      .limit(1);

    let occurrenceCount = 1;
    let firstOccurrence = now;

    if (existingError.length > 0) {
      occurrenceCount = (existingError[0].occurrenceCount || 0) + 1;
      firstOccurrence = new Date(existingError[0].firstOccurrence);

      // Update the existing error's occurrence count and last occurrence
      await database
        .update(errorLogs)
        .set({
          occurrenceCount,
          lastOccurrence: now,
          updatedAt: now,
        })
        .where(eq(errorLogs.id, existingError[0].id));
    }

    // Create new error log entry
    await database.insert(errorLogs).values({
      id: errorId,
      requestId: params.requestId,
      userId: params.userId,
      level: params.level || 'error',
      source: params.source,
      operation: params.operation,
      statusCode: params.statusCode,
      errorCode: params.errorCode,
      message: params.message,
      stackTrace: params.error?.stack,
      url: params.url,
      method: params.method,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      context: params.context ? JSON.stringify(params.context) : null,
      fingerprint,
      environment: params.environment || 'unknown',
      version: params.version,
      occurrenceCount,
      firstOccurrence,
      lastOccurrence: now,
    });

    console.log(`✅ Logged error ${errorId} (fingerprint: ${fingerprint}, occurrence: ${occurrenceCount})`);
    return errorId;
  } catch (logError) {
    console.error('❌ Failed to log error to database:', logError);
    console.error('Original error that failed to log:', params);
    return errorId; // Return the ID even if logging failed
  }
}

/**
 * Retrieve error logs with filtering and pagination
 */
export async function getErrorLogs(
  env: CloudflareBindings,
  options: {
    userId?: string;
    level?: 'error' | 'warning' | 'critical' | 'fatal';
    source?: string;
    operation?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {},
  db?: any,
) {
  const database = db || createDb(env);

  // Apply filters
  const conditions: any[] = [];
  if (options.userId) conditions.push(eq(errorLogs.userId, options.userId));
  if (options.level) conditions.push(eq(errorLogs.level, options.level));
  if (options.source) conditions.push(eq(errorLogs.source, options.source));
  if (options.operation) conditions.push(eq(errorLogs.operation, options.operation));
  if (options.resolved !== undefined) conditions.push(eq(errorLogs.resolved, options.resolved));

  let baseQuery = database.select().from(errorLogs);

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions)) as any;
  }

  const errors = await baseQuery
    .orderBy(desc(errorLogs.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);

  // Parse context JSON
  return errors.map((error: any) => ({
    ...error,
    context: error.context ? JSON.parse(error.context) : null,
  }));
}

/**
 * Mark an error as resolved
 */
export async function resolveError(
  env: CloudflareBindings,
  errorId: string,
  resolvedBy: string,
  resolutionNotes?: string,
  db?: any,
): Promise<void> {
  const database = db || createDb(env);

  await database
    .update(errorLogs)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes,
      updatedAt: new Date(),
    })
    .where(eq(errorLogs.id, errorId));

  console.log(`✅ Marked error ${errorId} as resolved by ${resolvedBy}`);
}

/**
 * Get error statistics for monitoring dashboard
 */
export async function getErrorStats(
  env: CloudflareBindings,
  timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
  db?: any,
) {
  const database = db || createDb(env);

  const now = new Date();
  const timeframes = {
    hour: new Date(now.getTime() - 60 * 60 * 1000),
    day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  };

  const since = timeframes[timeframe];

  // Get total error counts by level
  const errorsByLevel = await database
    .select({
      level: errorLogs.level,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(errorLogs)
    .where(sql`${errorLogs.createdAt} >= ${since}`)
    .groupBy(errorLogs.level);

  // Get top error sources
  const errorsBySources = await database
    .select({
      source: errorLogs.source,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(errorLogs)
    .where(sql`${errorLogs.createdAt} >= ${since}`)
    .groupBy(errorLogs.source)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // Get most frequent errors by fingerprint
  const topErrors = await database
    .select({
      fingerprint: errorLogs.fingerprint,
      message: errorLogs.message,
      operation: errorLogs.operation,
      count: sql<number>`sum(${errorLogs.occurrenceCount})`.as('count'),
      resolved: errorLogs.resolved,
    })
    .from(errorLogs)
    .where(sql`${errorLogs.createdAt} >= ${since}`)
    .groupBy(errorLogs.fingerprint, errorLogs.message, errorLogs.operation, errorLogs.resolved)
    .orderBy(desc(sql`sum(${errorLogs.occurrenceCount})`))
    .limit(10);

  return {
    timeframe,
    since: since.toISOString(),
    byLevel: errorsByLevel,
    bySources: errorsBySources,
    topErrors,
  };
}
