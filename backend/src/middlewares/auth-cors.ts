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

  // Create array of allowed origins - include both development and production
  const allowedOrigins = [
    'http://localhost:3000', // Always allow localhost for development
    frontendUrl, // Production frontend URL
  ];

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  return cors({
    origin: uniqueOrigins,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'Set-Cookie',
      'Accept',
      'Origin',
      'User-Agent',
      'DNT',
      'Cache-Control',
      'X-Mx-ReqToken',
      'Keep-Alive',
      'X-Requested-With',
      'If-Modified-Since',
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    exposeHeaders: [
      'Content-Length',
      'Set-Cookie',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
    ],
    maxAge: 86400, // 24 hours - helps with preflight caching
    credentials: true, // Essential for cookies
  });
}

export { createAuthCors };
