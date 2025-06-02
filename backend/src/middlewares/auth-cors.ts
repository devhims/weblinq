import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

export default function createAuthCors(c: Context<AppBindings>) {
  return cors({
    origin: c.env.FRONTEND_URL,
    // ✅ CRITICAL: Must be true for cross-domain cookies
    credentials: true,
    // ✅ CRITICAL: Allow DELETE method for API key operations (was missing)
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    // ✅ CRITICAL: Allow basic headers needed for Better Auth + API keys
    allowHeaders: ['Content-Type', 'Authorization'],
    // ✅ CRITICAL: Expose cookies in response for cross-domain
    exposeHeaders: ['Content-Length'],
    // ✅ CRITICAL: Set max age for preflight caching
    maxAge: 600,
  });
}

export { createAuthCors };
