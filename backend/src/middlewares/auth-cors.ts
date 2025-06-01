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

  // Remove duplicates and filter out empty values
  const uniqueOrigins = [...new Set(allowedOrigins)].filter(Boolean);

  return cors({
    origin: (origin) => {
      // Allow requests without origin (e.g., mobile apps, server-to-server)
      if (!origin) {
        return origin;
      }

      // Check if origin is in our allowed list and return it if valid
      return uniqueOrigins.includes(origin) ? origin : null;
    },
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
      'X-Captcha-Response', // For captcha support
      'X-Captcha-User-Remote-IP', // For captcha support
    ],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    exposeHeaders: [
      'Content-Length',
      'Set-Cookie', // CRITICAL: Expose auth cookies to frontend
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'X-Retry-After', // For rate limiting
    ],
    maxAge: 86400, // 24 hours - helps with preflight caching
    credentials: true, // CRITICAL: Allow cookies for session authentication
  });
}

export { createAuthCors };
