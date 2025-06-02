import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { z } from '@hono/zod-openapi';

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

export const tasks = sqliteTable('tasks', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectTasksSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'Learn Hono' }),
  done: z.boolean().openapi({ example: false }),
  userId: z.string().openapi({ example: 'user_123' }),
  createdAt: z
    .string()
    .nullable()
    .openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z
    .string()
    .nullable()
    .openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

// Schema for API responses (excludes userId for security)
export const publicTaskSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'Learn Hono' }),
  done: z.boolean().openapi({ example: false }),
  createdAt: z
    .string()
    .nullable()
    .openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z
    .string()
    .nullable()
    .openapi({ example: '2024-01-01T00:00:00.000Z' }),
});

export const insertTasksSchema = z.object({
  name: z.string().min(1).max(500).openapi({ example: 'Learn Hono' }),
  done: z.boolean().optional().openapi({ example: false }),
});

export const patchTasksSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .openapi({ example: 'Learn Hono' }),
  done: z.boolean().optional().openapi({ example: true }),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
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
  rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' }).default(
    true,
  ),
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
