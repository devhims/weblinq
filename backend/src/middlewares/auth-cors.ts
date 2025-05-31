import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

export default function createAuthCors(c: Context<AppBindings>) {
  // Check if we're in development environment
  const isDevelopment =
    c.env.NODE_ENV === 'development' ||
    c.env.NODE_ENV === 'preview' ||
    !c.env.NODE_ENV;

  // Get the frontend URL from environment or default to localhost for development
  const frontendUrl = isDevelopment
    ? 'http://localhost:3000'
    : c.env.FRONTEND_URL || 'http://localhost:3000';

  return cors({
    origin: [frontendUrl, 'http://localhost:3000'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'Set-Cookie',
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 600, // 10 minutes
    credentials: true,
  });
}

export { createAuthCors };
