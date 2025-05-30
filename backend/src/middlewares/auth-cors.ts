import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

export default function createAuthCors(c: Context<AppBindings>) {
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:3000';

  // In development, be more permissive with origins
  const isDevelopment =
    !c.env.FRONTEND_URL || frontendUrl.includes('localhost');
  const allowedOrigins = isDevelopment
    ? [frontendUrl, 'http://localhost:3000', 'https://weblinq.vercel.app']
    : [frontendUrl];

  console.log('CORS Debug:', {
    frontendUrl,
    isDevelopment,
    allowedOrigins,
    requestOrigin: c.req.header('origin'),
  });

  return cors({
    origin: (origin) => {
      // Allow all origins in development, specific origins in production
      if (isDevelopment) {
        console.log('Development mode: allowing origin', origin);
        return origin || '*'; // Return '*' for development
      }
      const allowed = allowedOrigins.includes(origin || '') ? origin : null;
      console.log('Production mode: origin check', { origin, allowed });
      return allowed;
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 86400, // 24 hours
    credentials: true,
  });
}
