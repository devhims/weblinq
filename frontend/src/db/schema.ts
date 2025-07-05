import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {
    mode: 'timestamp',
  }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
});

export const apikey = sqliteTable('apikey', {
  id: text('id').primaryKey(),
  name: text('name'),
  start: text('start'),
  prefix: text('prefix'),
  key: text('key').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: integer('last_refill_at', { mode: 'timestamp' }),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' }).default(true),
  rateLimitTimeWindow: integer('rate_limit_time_window').default(86400000),
  rateLimitMax: integer('rate_limit_max').default(10),
  requestCount: integer('request_count'),
  remaining: integer('remaining'),
  lastRequest: integer('last_request', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
});

/* ------------------------------------------------------------------ */
/*  billing: subscriptions & payments                                  */
/* ------------------------------------------------------------------ */

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    /** Polar subscription id (primary key) */
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    status: text('status', {
      enum: ['active', 'cancelled', 'past_due', 'trialing', 'unpaid'],
    }).notNull(),

    /** Always "pro" for the paid plan */
    plan: text('plan').notNull().default('pro'),

    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),

    /** Last time we synced data from Polar */
    syncedAt: integer('synced_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => ({
    idxStatus: index('sub_status').on(t.status),
  }),
);

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(), // Polar order / payment id
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('usd'),
  billingCountry: text('billing_country'), // ISO-3166-1 alpha-2
  paidAt: integer('paid_at', { mode: 'timestamp' }).notNull(),
  type: text('type', { enum: ['charge', 'refund'] }).notNull(),
});

/* ------------------------------------------------------------------ */
/*  credits                                                            */
/* ------------------------------------------------------------------ */

/** Fast look-up table: one row per user. */
export const creditBalances = sqliteTable('credit_balances', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  /** 'free' | 'pro' (mirrors subscription state) */
  plan: text('plan').notNull().default('free'),

  /** Current spendable credits */
  balance: integer('balance').notNull().default(1000),

  /** Last time a monthly refill ran (null for free users) */
  lastRefill: integer('last_refill', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Immutable ledger – every credit gain or spend is a row.
 * Compute authoritative balance with SUM(delta).
 */
export const creditTransactions = sqliteTable('credit_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  /** +5000 monthly refill, -n per API call, etc. */
  delta: integer('delta').notNull(),

  /**
   * reason: 'initial_free', 'monthly_refill', 'api_call', 'admin_adjust', …
   */
  reason: text('reason').notNull(),

  metadata: text('metadata'), // JSON details (endpoint, request id, …)
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});
