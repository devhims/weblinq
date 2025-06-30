import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

import { isValidOrigin } from '@/lib/auth-utils';

export default function createAuthCors(c: Context<AppBindings>) {
  return cors({
    // Dynamic origin validation - allows production domains and Vercel previews
    origin: (origin) => {
      // Allow requests with no origin (same-origin requests, Postman, etc.)
      if (!origin) return origin;

      // Use our secure pattern matching - return origin if valid, null if not
      return isValidOrigin(origin, c.env) ? origin : null;
    },
    // ✅ CRITICAL: Must be true for cross-domain cookies
    credentials: true,
    // ✅ CRITICAL: Allow all necessary methods for API operations
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // ✅ CRITICAL: Allow basic headers needed for Better Auth + API keys
    allowHeaders: ['Content-Type', 'Authorization'],
    // ✅ CRITICAL: Expose cookies in response for cross-domain
    exposeHeaders: [
      'Content-Length',
      // Custom binary endpoint headers
      'X-Permanent-Url',
      'X-File-Id',
      'X-Metadata',
      'X-Credits-Cost',
    ],
    // ✅ CRITICAL: Set max age for preflight caching
    maxAge: 600,
  });
}

export { createAuthCors };
