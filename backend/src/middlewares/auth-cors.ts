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
    'https://weblinq.vercel.app', // Production frontend
    frontendUrl, // Environment-specific frontend
  ];

  // Remove duplicates and filter out invalid URLs
  const uniqueOrigins = [...new Set(allowedOrigins)].filter(Boolean);

  const requestOrigin = c.req.header('origin');
  const requestMethod = c.req.method;

  console.log('🌐 CORS configuration:', {
    isDevelopment,
    frontendUrl,
    allowedOrigins: uniqueOrigins,
    requestOrigin,
    requestMethod,
    isPreflightRequest: requestMethod === 'OPTIONS',
  });

  return cors({
    origin: (origin) => {
      // Allow requests without origin (e.g., mobile apps, server-to-server)
      if (!origin) {
        console.log('📝 CORS: Allowing request without origin');
        return origin; // Return undefined for no origin
      }

      // Check if origin is in our allowed list
      const isAllowed = uniqueOrigins.includes(origin);
      console.log(
        `📝 CORS: Origin ${origin} is ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`,
      );

      return isAllowed ? origin : null; // Return origin if allowed, null if blocked
    },
    // ✅ CRITICAL: Must be true for cross-domain cookies
    credentials: true,
    // ✅ CRITICAL: Allow all methods for Better Auth endpoints
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    // ✅ CRITICAL: Allow all headers needed for Better Auth + API keys + Safari compatibility
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'User-Agent',
      'Cookie',
      'Referer', // Safari sometimes requires this
      'Accept-Language',
      'Accept-Encoding',
      'Connection',
      'Host',
      // Better Auth specific headers
      'X-Better-Auth',
      'X-Better-Auth-Return-To',
      // Additional headers that Safari might send
      'Sec-Fetch-Site',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Dest',
    ],
    // ✅ CRITICAL: Expose cookies in response for cross-domain
    exposeHeaders: [
      'Content-Length',
      'Set-Cookie',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'X-Retry-After',
      'Location', // For redirects
      'Vary',
    ],
    // ✅ CRITICAL: Set max age for preflight caching (shorter for debugging)
    maxAge: isDevelopment ? 60 : 86400, // 1 minute in dev, 24 hours in prod
  });
}

export { createAuthCors };
