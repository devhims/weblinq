/* eslint-disable style/operator-linebreak */
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
    // allowHeaders: ['Content-Type', 'Authorization'],
    // allowMethods: ['POST', 'GET', 'OPTIONS'],
    // exposeHeaders: ['Content-Length'],
    // maxAge: 600,
    // credentials: true,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie', // CRITICAL: Allow session cookies from frontend
      'Set-Cookie', // CRITICAL: Allow setting auth cookies
      'X-Session-Token', // CRITICAL: Allow custom session token from frontend
      'Accept',
      'Origin',
      'User-Agent',
      'Cache-Control',
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    exposeHeaders: [
      'Content-Length',
      'Set-Cookie', // CRITICAL: Expose auth cookies to frontend
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
    ],
    maxAge: 86400, // 24 hours - helps with preflight caching
    credentials: true, // CRITICAL: Allow cookies for session authentication
  });
}

export { createAuthCors };
