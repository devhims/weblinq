import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .$defaultFn(() => false)
      .notNull(),
    image: text('image'),
    // Admin plugin fields - required for Better Auth admin functionality
    role: text('role').default('user'),
    banned: integer('banned', { mode: 'boolean' }).default(false),
    banReason: text('ban_reason'),
    banExpires: integer('ban_expires', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => ({
    idxEmail: index('idx_user_email').on(t.email),
    idxRole: index('idx_user_role').on(t.role),
  }),
);

export const session = sqliteTable(
  'session',
  {
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
    // Admin plugin field - required for impersonation functionality
    impersonatedBy: text('impersonated_by'),
  },
  (t) => ({
    idxToken: index('idx_session_token').on(t.token),
    idxImpersonatedBy: index('idx_session_impersonated').on(t.impersonatedBy),
  }),
);

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
    idxStatus: index('idx_sub_user').on(t.userId, t.status),
  }),
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(), // Polar order / payment id
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    billingCountry: text('billing_country'), // ISO-3166-1 alpha-2
    paidAt: integer('paid_at', { mode: 'timestamp' }).notNull(),
    type: text('type', { enum: ['charge', 'refund'] }).notNull(),
  },
  (t) => ({
    idxUserId: index('idx_pay_user').on(t.userId),
    idxPaidAt: index('idx_pay_date').on(t.paidAt),
  }),
);

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
export const creditTransactions = sqliteTable(
  'credit_transactions',
  {
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
  },
  (t) => ({
    idxUserId: index('idx_credit_user').on(t.userId),
  }),
);

/* ------------------------------------------------------------------ */
/*  error logging                                                     */
/* ------------------------------------------------------------------ */

/**
 * Comprehensive error logging table following industry best practices
 * Stores all errors from web route handlers for monitoring and debugging
 */
export const errorLogs = sqliteTable(
  'error_logs',
  {
    /** Unique error log ID */
    id: text('id').primaryKey(),

    /** Request ID from response-utils for correlation */
    requestId: text('request_id'),

    /** User ID if available (nullable for unauthenticated errors) */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),

    /** Error severity level */
    level: text('level', {
      enum: ['error', 'warning', 'critical', 'fatal'],
    })
      .notNull()
      .default('error'),

    /** Error source/category */
    source: text('source').notNull(), // e.g., 'web_handler', 'auth', 'browser', 'ai'

    /** Specific operation that failed */
    operation: text('operation').notNull(), // e.g., 'screenshot', 'markdown', 'pdf'

    /** HTTP status code */
    statusCode: integer('status_code'),

    /** Error code from ERROR_CODES */
    errorCode: text('error_code'),

    /** Human-readable error message */
    message: text('message').notNull(),

    /** Full error stack trace */
    stackTrace: text('stack_trace'),

    /** Request URL */
    url: text('url'),

    /** HTTP method */
    method: text('method'),

    /** User agent */
    userAgent: text('user_agent'),

    /** Client IP address */
    ipAddress: text('ip_address'),

    /** Additional context data as JSON */
    context: text('context'), // JSON: request body, params, env info, etc.

    /** Error resolution status */
    resolved: integer('resolved', { mode: 'boolean' }).default(false),

    /** Resolution notes */
    resolutionNotes: text('resolution_notes'),

    /** When error was resolved */
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),

    /** Who resolved the error */
    resolvedBy: text('resolved_by'),

    /** Error occurrence count for similar errors */
    occurrenceCount: integer('occurrence_count').default(1),

    /** First occurrence of this error pattern */
    firstOccurrence: integer('first_occurrence', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),

    /** Last occurrence of this error pattern */
    lastOccurrence: integer('last_occurrence', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),

    /** Error fingerprint for grouping similar errors */
    fingerprint: text('fingerprint'),

    /** Environment where error occurred */
    environment: text('environment'), // 'production', 'preview', 'development'

    /** Application version/commit hash */
    version: text('version'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),

    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => ({
    idxUserId: index('idx_error_user').on(t.userId),
    idxLevel: index('idx_error_level').on(t.level),
    idxSource: index('idx_error_source').on(t.source),
    idxOperation: index('idx_error_operation').on(t.operation),
    idxStatusCode: index('idx_error_status').on(t.statusCode),
    idxErrorCode: index('idx_error_code').on(t.errorCode),
    idxFingerprint: index('idx_error_fingerprint').on(t.fingerprint),
    idxEnvironment: index('idx_error_environment').on(t.environment),
    idxCreatedAt: index('idx_error_created').on(t.createdAt),
    idxResolved: index('idx_error_resolved').on(t.resolved),
    idxRequestId: index('idx_error_request').on(t.requestId),
  }),
);
