import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

export default function createAuthCors(c: Context<AppBindings>) {
  const isDevelopment = c.env.NODE_ENV === 'preview';

  return cors({
    origin: isDevelopment ? 'http://localhost:3000' : c.env.FRONTEND_URL,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 600, // 10 minutes
    credentials: true,
  });
}
