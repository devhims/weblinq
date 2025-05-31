import type { Context } from 'hono';

import { cors } from 'hono/cors';

import type { AppBindings } from '@/lib/types';

export default function createAuthCors(c: Context<AppBindings>) {
  // Allow localhost for development and the configured frontend URL for production
  const allowedOrigins = [
    'http://localhost:3000', // Always allow localhost for development
    c.env.FRONTEND_URL, // Production frontend URL
  ].filter(Boolean); // Remove any undefined values

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return null;
      }

      // Check if the origin is in our allowed list
      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 600, // 10 minutes
    credentials: true, // This is crucial for cookies
  });
}
