/* eslint-disable node/no-process-env */

import { defineConfig } from 'drizzle-kit';

type Env = 'preview' | 'production';

const env: Env = process.env.NODE_ENV as Env;

// Helper function to get database ID based on environment
function getDatabaseId() {
  switch (env) {
    case 'preview':
      return process.env.CLOUDFLARE_DB_PREVIEW!;
    case 'production':
      return process.env.CLOUDFLARE_DB_PRODUCTION!;
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
}

// Helper function to get migrations output directory
function getMigrationsDir() {
  switch (env) {
    case 'preview':
      return './src/db/migrations/preview';
    case 'production':
      return './src/db/migrations/production';
    default:
      return './src/db/migrations';
  }
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: getMigrationsDir(),
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    databaseId: getDatabaseId(),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
  verbose: true,
  strict: true,
});
